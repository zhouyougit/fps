'use strict';
/**
 * sim.js — 几猫 (JiMao) 的服务器端物理/移动简化版
 *
 * 纯 JS，无 three.js 依赖。与游戏内 G.physics (src/game.js 39909-40155)
 * 的 moveCapsule / raycast / groundHeight 保持同一套算法与常量：
 *   - 玩家圆柱按 AABB 墙盒做圆-盒水平推出（半径 0.32m，高 1.8m）
 *   - 地面 = 码头地面 (y=0, x<=30) / 水面 (y=-1.6) / 盒顶
 *   - 台阶高 0.42m，重力 21，跳跃初速 sqrt(2*21*1)=6.48
 *
 * 用法:
 *   const { createWorld, loadWorld } = require('./sim');
 *   const world = loadWorld(__dirname + '/map_boxes.json');
 *   const pos = {x:-32,y:0,z:6}, vel = {x:0,y:0,z:0};
 *   world.moveCapsule(pos, {x:3.8,y:0,z:0}, 1/30, 0.32, 1.8, true);
 */

const DEFAULTS = Object.freeze({
  radius: 0.32,
  height: 1.8,
  stepHeight: 0.42, // game: u1
  gravity: 21,
  seaY: -1.6,
  groundY: 0,
  quayX: 30,
  bounds: { min: { x: -40, y: 0, z: -30 }, max: { x: 40, y: 30, z: 30 } },
});

function num(v, d = 0) {
  return typeof v === 'number' && Number.isFinite(v) ? v : d;
}

function vec3(v, d = 0) {
  if (!v) return { x: d, y: d, z: d };
  if (Array.isArray(v)) return { x: num(v[0], d), y: num(v[1], d), z: num(v[2], d) };
  return { x: num(v.x, d), y: num(v.y, d), z: num(v.z, d) };
}

function normalizeBox(raw) {
  if (!raw) return null;
  const min = vec3(raw.min);
  const max = vec3(raw.max);
  // 保留零厚度盒（游戏里存在 9 个位于 y=-120 的水底标记盒）；
  // 仅丢弃非有限值，保证导出 566 个盒子全部可用。
  for (const k of ['x', 'y', 'z']) {
    if (!Number.isFinite(min[k]) || !Number.isFinite(max[k])) return null;
  }
  // 兼容 map_boxes.json 的 {opts:{...}} 结构与游戏原生的平铺字段。
  const o = raw.opts && typeof raw.opts === 'object' ? raw.opts : raw;
  return {
    min: { x: Math.min(min.x, max.x), y: Math.min(min.y, max.y), z: Math.min(min.z, max.z) },
    max: { x: Math.max(min.x, max.x), y: Math.max(min.y, max.y), z: Math.max(min.z, max.z) },
    surface: typeof raw.surface === 'string' ? raw.surface : 'concrete',
    tag: typeof raw.tag === 'string' ? raw.tag : '',
    noNav: !!(raw.noNav ?? o.noNav),
    bulletOnly: !!(raw.bulletOnly ?? o.bulletOnly),
    playerOnly: !!(raw.playerOnly ?? o.playerOnly),
  };
}

function createWorld(rawBoxes, opts = {}) {
  const boxes = [];
  for (const b of rawBoxes || []) {
    const box = normalizeBox(b);
    if (box) boxes.push(box);
  }
  const bounds = {
    min: vec3(opts.bounds && opts.bounds.min, 0),
    max: vec3(opts.bounds && opts.bounds.max, 0),
  };
  if (!(bounds.max.x > bounds.min.x)) {
    bounds.min = { ...DEFAULTS.bounds.min };
    bounds.max = { ...DEFAULTS.bounds.max };
  }
  const groundY = num(opts.groundY, DEFAULTS.groundY);
  const seaY = num(opts.seaY, DEFAULTS.seaY);
  const quayX = num(opts.quayX, DEFAULTS.quayX);

  // 地面/盒顶查询：射线（与游戏 raycast 一致的 y=0 / y=-1.6 平面处理）
  function raycast(originIn, dirIn, maxDist = 500) {
    const origin = vec3(originIn);
    const dir = vec3(dirIn);
    let w = num(maxDist, 500);
    if (!(w > 0)) return null;
    let hitBox = null;
    let axis = -1;
    let sign = 0;
    let plane = 0; // 0=box 1=ground 2=water

    // 地面/水面平面
    if (dir.y < -1e-6) {
      const tGround = (groundY - origin.y) / dir.y;
      if (tGround > 0 && tGround < w) {
        if (origin.x + dir.x * tGround <= quayX) {
          w = tGround;
          plane = 1;
        } else {
          const tSea = (seaY - origin.y) / dir.y;
          if (tSea > 0 && tSea < w) {
            w = tSea;
            plane = 2;
          }
        }
      }
    }

    const invX = dir.x === 0 ? Infinity : 1 / dir.x;
    const invY = dir.y === 0 ? Infinity : 1 / dir.y;
    const invZ = dir.z === 0 ? Infinity : 1 / dir.z;

    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (b.playerOnly) continue; // 与游戏射线一致（子弹不与 playerOnly 碰撞）
      let tNear = 0;
      let tFar = w;
      let hitAxis = -1;
      let hitSign = 0;
      let t1;
      let t2;

      if (dir.x !== 0) {
        t1 = (b.min.x - origin.x) * invX;
        t2 = (b.max.x - origin.x) * invX;
        let s = -1;
        if (t1 > t2) {
          const tmp = t1;
          t1 = t2;
          t2 = tmp;
          s = 1;
        }
        if (t1 > tNear) {
          tNear = t1;
          hitAxis = 0;
          hitSign = s;
        }
        if (t2 < tFar) tFar = t2;
        if (tNear > tFar) continue;
      } else if (origin.x < b.min.x || origin.x > b.max.x) continue;

      if (dir.y !== 0) {
        t1 = (b.min.y - origin.y) * invY;
        t2 = (b.max.y - origin.y) * invY;
        let s = -1;
        if (t1 > t2) {
          const tmp = t1;
          t1 = t2;
          t2 = tmp;
          s = 1;
        }
        if (t1 > tNear) {
          tNear = t1;
          hitAxis = 1;
          hitSign = s;
        }
        if (t2 < tFar) tFar = t2;
        if (tNear > tFar) continue;
      } else if (origin.y < b.min.y || origin.y > b.max.y) continue;

      if (dir.z !== 0) {
        t1 = (b.min.z - origin.z) * invZ;
        t2 = (b.max.z - origin.z) * invZ;
        let s = -1;
        if (t1 > t2) {
          const tmp = t1;
          t1 = t2;
          t2 = tmp;
          s = 1;
        }
        if (t1 > tNear) {
          tNear = t1;
          hitAxis = 2;
          hitSign = s;
        }
        if (t2 < tFar) tFar = t2;
        if (tNear > tFar) continue;
      } else if (origin.z < b.min.z || origin.z > b.max.z) continue;

      if (hitAxis < 0) continue;
      w = tNear;
      hitBox = b;
      axis = hitAxis;
      sign = hitSign;
      plane = 0;
    }

    if (!hitBox && !plane) return null;
    const point = {
      x: origin.x + dir.x * w,
      y: origin.y + dir.y * w,
      z: origin.z + dir.z * w,
    };
    if (plane) {
      return {
        dist: w,
        point,
        normal: { x: 0, y: 1, z: 0 },
        surface: plane === 2 ? 'water' : 'concrete',
        box: null,
      };
    }
    const normal = { x: 0, y: 0, z: 0 };
    if (axis === 0) normal.x = sign;
    else if (axis === 1) normal.y = sign;
    else normal.z = sign;
    return { dist: w, point, normal, surface: hitBox.surface, box: hitBox };
  }

  function lineOfSight(aIn, bIn) {
    const a = vec3(aIn);
    const b = vec3(bIn);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-4) return true;
    return !raycast(a, { x: dx / len, y: dy / len, z: dz / len }, len - 0.05);
  }

  function groundHeight(x, z, maxY = 50) {
    let h = x <= quayX ? groundY : seaY;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (b.bulletOnly) continue;
      if (x >= b.min.x && x <= b.max.x && z >= b.min.z && z <= b.max.z && b.max.y <= maxY && b.max.y > h) {
        h = b.max.y;
      }
    }
    return h;
  }

  /**
   * 与游戏一致的胶囊移动。
   * @param {{x:number,y:number,z:number}} pos 会被原地修改
   * @param {{x:number,y:number,z:number}} vel 会被原地修改（撞墙/落地时分量清零）
   * @param {number} dt
   * @param {number} radius
   * @param {number} height
   * @param {boolean} snap 是否贴地（走行时为 true）
   */
  function moveCapsule(posIn, velIn, dt, radius = DEFAULTS.radius, height = DEFAULTS.height, snap = true) {
    // 原地修改调用者的 pos / vel（与游戏 API 一致），不能复制。
    const pos = posIn;
    const vel = velIn;
    if (!pos || !vel) throw new TypeError('moveCapsule requires pos and vel objects');
    pos.x = num(pos.x);
    pos.y = num(pos.y);
    pos.z = num(pos.z);
    vel.x = num(vel.x);
    vel.y = num(vel.y);
    vel.z = num(vel.z);
    const result = { onGround: false, hitWall: false, hitCeil: false, surface: 'concrete' };
    const stepH = DEFAULTS.stepHeight;
    const dx = vel.x * dt;
    const dz = vel.z * dt;
    const sub = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (radius * 0.6)));
    const startY = pos.y;

    for (let s = 0; s < sub; s++) {
      pos.x += dx / sub;
      pos.z += dz / sub;
      for (let iter = 0; iter < 3; iter++) {
        let pushed = false;
        for (let i = 0; i < boxes.length; i++) {
          const b = boxes[i];
          if (b.bulletOnly) continue;
          if (b.max.y <= pos.y + (snap ? stepH : 0.08)) continue;
          if (b.min.y >= pos.y + height) continue;
          const cx = Math.max(b.min.x, Math.min(b.max.x, pos.x));
          const cz = Math.max(b.min.z, Math.min(b.max.z, pos.z));
          const ox = pos.x - cx;
          const oz = pos.z - cz;
          const d2 = ox * ox + oz * oz;
          if (d2 >= radius * radius) continue;
          if (d2 > 1e-10) {
            const d = Math.sqrt(d2);
            const pen = radius - d;
            const nx = ox / d;
            const nz = oz / d;
            pos.x += nx * pen;
            pos.z += nz * pen;
            const vn = vel.x * nx + vel.z * nz;
            if (vn < 0) {
              vel.x -= nx * vn;
              vel.z -= nz * vn;
            }
          } else {
            const left = pos.x - b.min.x;
            const right = b.max.x - pos.x;
            const back = pos.z - b.min.z;
            const front = b.max.z - pos.z;
            const m = Math.min(left, right, back, front);
            if (m === left) {
              pos.x = b.min.x - radius;
              if (vel.x > 0) vel.x = 0;
            } else if (m === right) {
              pos.x = b.max.x + radius;
              if (vel.x < 0) vel.x = 0;
            } else if (m === back) {
              pos.z = b.min.z - radius;
              if (vel.z > 0) vel.z = 0;
            } else {
              pos.z = b.max.z + radius;
              if (vel.z < 0) vel.z = 0;
            }
          }
          pushed = true;
          result.hitWall = true;
        }
        if (!pushed) break;
      }
    }

    // 垂直方向：先算落地/天花板
    const nextY = pos.y + vel.y * dt;
    const c = radius * 0.7;
    let floorY = pos.x <= quayX + c ? groundY : -50;
    let floorSurface = null;
    let ceilY = Infinity;
    const floorProbe = startY + (snap ? stepH : 0.08) + 1e-4;

    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (b.bulletOnly) continue;
      if (pos.x + c < b.min.x || pos.x - c > b.max.x) continue;
      if (pos.z + c < b.min.z || pos.z - c > b.max.z) continue;
      if (b.max.y <= floorProbe && b.max.y > floorY) {
        floorY = b.max.y;
        floorSurface = b.surface;
      }
      if (b.min.y >= startY + height - 0.05 && b.min.y < ceilY) ceilY = b.min.y;
    }

    if (vel.y > 0 && nextY + height > ceilY) {
      pos.y = ceilY - height;
      vel.y = 0;
      result.hitCeil = true;
    } else if (nextY <= floorY) {
      pos.y = floorY;
      if (vel.y < 0) vel.y = 0;
      result.onGround = true;
    } else if (snap && vel.y <= 0 && nextY - floorY < stepH) {
      pos.y = floorY;
      vel.y = 0;
      result.onGround = true;
    } else {
      pos.y = nextY;
    }

    if (result.onGround) result.surface = floorSurface || 'concrete';
    return result;
  }

  return {
    boxes,
    bounds,
    groundY,
    seaY,
    quayX,
    raycast,
    lineOfSight,
    groundHeight,
    moveCapsule,
    get boxCount() {
      return boxes.length;
    },
  };
}

function loadWorld(filePath, opts = {}) {
  const fs = require('node:fs');
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const list = Array.isArray(raw) ? raw : raw.boxes;
  const meta = Array.isArray(raw) ? {} : raw.meta || raw;
  return createWorld(list, {
    ...opts,
    bounds: opts.bounds || meta.bounds,
    groundY: opts.groundY != null ? opts.groundY : meta.groundY,
    seaY: opts.seaY != null ? opts.seaY : meta.seaY,
    quayX: opts.quayX != null ? opts.quayX : meta.quayX,
  });
}

module.exports = {
  DEFAULTS,
  createWorld,
  loadWorld,
  normalizeBox,
  vec3,
};
