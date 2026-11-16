/* packages/sim/world.js — 碰撞世界：AABB + 2m 均匀网格 CSR 粗筛 + 2D DDA
 * 行为与 server/sim.js（以及 src/game.js d3）逐条一致：
 *   - 射线先测地面 / 海面平面，再做标准 slab；playerOnly 盒不挡子弹
 *   - 胶囊按圆-盒水平推出（半径 0.32 / 高 1.8 / 台阶 0.42），垂直方向单次 floor/ceil
 * 数据全部使用 TypedArray，raycast 零分配。
 * UMD 链：Node require('./rng.js')。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rng.js'));
  else root.SALT_SIM = factory(root.SALT_SIM || {});
})(typeof globalThis !== 'undefined' ? globalThis : this, function (S) {
  'use strict';
  S = S || {};

  var DEFAULTS = {
    radius: 0.32,
    height: 1.8,
    stepHeight: 0.42,
    gravity: 21,
    groundY: 0,
    seaY: -1.6,
    quayX: 30,
    bounds: { min: { x: -40, y: 0, z: -30 }, max: { x: 40, y: 30, z: 30 } },
    maxDist: 500,
  };

  /** flags 位；mask 表示“要忽略的位”。 */
  var FLAGS = {
    BULLET_ONLY: 1,
    PLAYER_ONLY: 2,
    NO_NAV: 4,
    THIN: 8,
  };
  var MASK = {
    NONE: 0,
    /** 子弹：忽略 playerOnly 与可穿透的 thin */
    BULLET: FLAGS.PLAYER_ONLY | FLAGS.THIN,
    /** 玩家移动：忽略只挡子弹的盒 */
    PLAYER: FLAGS.BULLET_ONLY,
    /** 导航：忽略 bulletOnly 与 noNav */
    NAV: FLAGS.BULLET_ONLY | FLAGS.NO_NAV,
    /** 视线：与子弹一致 */
    SIGHT: FLAGS.PLAYER_ONLY | FLAGS.THIN,
  };

  var CELL = 2;

  function num(v, d) {
    return typeof v === 'number' && Number.isFinite(v) ? v : d;
  }

  function vec3(v, d) {
    d = d === undefined ? 0 : d;
    if (v == null) return { x: d, y: d, z: d };
    if (typeof v === 'number') return { x: v, y: d, z: d };
    if (Array.isArray(v)) return { x: num(v[0], d), y: num(v[1], d), z: num(v[2], d) };
    return { x: num(v.x, d), y: num(v.y, d), z: num(v.z, d) };
  }

  function flagListToBits(list) {
    var bits = 0;
    if (!list) return bits;
    if (typeof list === 'number') return list | 0;
    for (var i = 0; i < list.length; i++) {
      var s = String(list[i]);
      if (s === 'bulletOnly' || s === 'bullet_only') bits |= FLAGS.BULLET_ONLY;
      else if (s === 'playerOnly' || s === 'player_only') bits |= FLAGS.PLAYER_ONLY;
      else if (s === 'noNav' || s === 'no_nav') bits |= FLAGS.NO_NAV;
      else if (s === 'thin') bits |= FLAGS.THIN;
    }
    return bits;
  }

  function readBox(raw) {
    if (!raw) return null;
    if (Array.isArray(raw) && raw.length >= 2) raw = { min: raw[0], max: raw[1], opts: raw[2] };
    var a = vec3(raw.min, NaN);
    var b = vec3(raw.max, NaN);
    if (!Number.isFinite(a.x) || !Number.isFinite(a.y) || !Number.isFinite(a.z)) return null;
    if (!Number.isFinite(b.x) || !Number.isFinite(b.y) || !Number.isFinite(b.z)) return null;
    // 兼容 {opts:{...}}（mapkit / map_boxes.json）与平铺字段。
    var o = raw.opts && typeof raw.opts === 'object' ? raw.opts : raw;
    var min = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), z: Math.min(a.z, b.z) };
    var max = { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y), z: Math.max(a.z, b.z) };
    var bits = 0;
    if (raw.flags != null) bits |= flagListToBits(raw.flags);
    if (o !== raw && o.flags != null) bits |= flagListToBits(o.flags);
    if (raw.bulletOnly != null ? raw.bulletOnly : o.bulletOnly) bits |= FLAGS.BULLET_ONLY;
    if (raw.playerOnly != null ? raw.playerOnly : o.playerOnly) bits |= FLAGS.PLAYER_ONLY;
    if (raw.noNav != null ? raw.noNav : o.noNav) bits |= FLAGS.NO_NAV;
    if (raw.thin != null ? raw.thin : o.thin) bits |= FLAGS.THIN;
    var surface = typeof raw.surface === 'string' ? raw.surface : typeof o.surface === 'string' ? o.surface : 'concrete';
    return { min: min, max: max, surface: surface, flags: bits & 255 };
  }

  function sortAsc(arr, n) {
    // 插入排序：n 很小（通常 < 20），保证按盒索引升序，与暴力遍历顺序一致。
    for (var i = 1; i < n; i++) {
      var v = arr[i];
      var j = i - 1;
      while (j >= 0 && arr[j] > v) {
        arr[j + 1] = arr[j];
        j--;
      }
      arr[j + 1] = v;
    }
  }

  /**
   * @param {object|Array} mapData 单图 spec：{boxes,bounds,groundY?,seaY?,quayX?}
   *   或裸 boxes 数组；也接受 server/maps.json 的单图对象。
   * @param {object} [opts] 覆盖 groundY/seaY/quayX/bounds/stepHeight
   */
  function createWorld(mapData, opts) {
    // 每个世界独立的去重戳与候选缓冲：服务器可同时持有多个房间/地图。
    var _cand = [];
    var _stampRay = null;
    var _stampQuery = null;
    var _rayId = 0;
    var _queryId = 0;
    opts = opts || {};
    if (Array.isArray(mapData)) mapData = { boxes: mapData };
    mapData = mapData || {};
    var rawBoxes = mapData.boxes || mapData.colliders || [];

    var parsed = [];
    for (var i = 0; i < rawBoxes.length; i++) {
      var pb = readBox(rawBoxes[i]);
      if (pb) parsed.push(pb);
    }
    var N = parsed.length;

    var minArr = new Float32Array(N * 3);
    var maxArr = new Float32Array(N * 3);
    var flags = new Uint8Array(N);
    var surf = new Uint8Array(N);

    // 材质表：'concrete' 固定为 0，water 总是注册。
    var surfaceNames = ['concrete'];
    var surfaceIds = Object.create(null);
    surfaceIds.concrete = 0;
    function sid(name) {
      if (surfaceIds[name] === undefined) {
        if (surfaceNames.length >= 256) return 0;
        surfaceIds[name] = surfaceNames.length;
        surfaceNames.push(name);
      }
      return surfaceIds[name];
    }
    sid('water');

    var extMinX = Infinity, extMaxX = -Infinity, extMinZ = Infinity, extMaxZ = -Infinity;
    for (i = 0; i < N; i++) {
      var p = parsed[i];
      var o3 = i * 3;
      minArr[o3] = p.min.x;
      minArr[o3 + 1] = p.min.y;
      minArr[o3 + 2] = p.min.z;
      maxArr[o3] = p.max.x;
      maxArr[o3 + 1] = p.max.y;
      maxArr[o3 + 2] = p.max.z;
      flags[i] = p.flags;
      surf[i] = sid(p.surface);
      if (p.min.x < extMinX) extMinX = p.min.x;
      if (p.max.x > extMaxX) extMaxX = p.max.x;
      if (p.min.z < extMinZ) extMinZ = p.min.z;
      if (p.max.z > extMaxZ) extMaxZ = p.max.z;
    }

    var bIn = mapData.bounds || (mapData.meta && mapData.meta.bounds) || opts.bounds;
    var bounds = {
      min: vec3(bIn && bIn.min, 0),
      max: vec3(bIn && bIn.max, 0),
    };
    if (!(bounds.max.x > bounds.min.x) || !(bounds.max.z > bounds.min.z)) {
      bounds.min = { x: DEFAULTS.bounds.min.x, y: DEFAULTS.bounds.min.y, z: DEFAULTS.bounds.min.z };
      bounds.max = { x: DEFAULTS.bounds.max.x, y: DEFAULTS.bounds.max.y, z: DEFAULTS.bounds.max.z };
    }

    var groundY = num(mapData.groundY, num(mapData.ground && mapData.ground.y, num(opts.groundY, DEFAULTS.groundY)));
    var seaY = num(mapData.seaY, num(mapData.ground && mapData.ground.seaY, num(opts.seaY, DEFAULTS.seaY)));
    var quayX = num(mapData.quayX, num(mapData.ground && mapData.ground.quayX, num(opts.quayX, DEFAULTS.quayX)));
    var stepHeight = num(opts.stepHeight, num(mapData.stepHeight, DEFAULTS.stepHeight));

    // 网格覆盖 bounds ∪ boxes，避免盒越界被漏掉。
    var gridX = Math.min(bounds.min.x, extMinX === Infinity ? bounds.min.x : extMinX);
    var gridZ = Math.min(bounds.min.z, extMinZ === Infinity ? bounds.min.z : extMinZ);
    var gridMaxX = Math.max(bounds.max.x, extMaxX === -Infinity ? bounds.max.x : extMaxX);
    var gridMaxZ = Math.max(bounds.max.z, extMaxZ === -Infinity ? bounds.max.z : extMaxZ);
    var gw = Math.max(1, Math.ceil((gridMaxX - gridX) / CELL));
    var gh = Math.max(1, Math.ceil((gridMaxZ - gridZ) / CELL));
    if (gw * gh > 4 * 1024 * 1024) {
      // 防御：异常地图不要把内存打爆。
      gw = Math.min(gw, 2048);
      gh = Math.min(gh, 2048);
    }

    var cellCount = gw * gh;
    var counts = new Uint32Array(cellCount + 1);
    var i0, i1, j0, j1, cx, cz, c;
    for (i = 0; i < N; i++) {
      var q = i * 3;
      i0 = Math.floor((minArr[q] - gridX) / CELL);
      i1 = Math.floor((maxArr[q] - gridX) / CELL);
      j0 = Math.floor((minArr[q + 2] - gridZ) / CELL);
      j1 = Math.floor((maxArr[q + 2] - gridZ) / CELL);
      if (i0 < 0) i0 = 0;
      if (j0 < 0) j0 = 0;
      if (i1 >= gw) i1 = gw - 1;
      if (j1 >= gh) j1 = gh - 1;
      if (i0 >= gw || j0 >= gh) continue;
      for (cz = j0; cz <= j1; cz++) {
        var row = cz * gw;
        for (cx = i0; cx <= i1; cx++) counts[row + cx + 1]++;
      }
    }
    for (c = 0; c < cellCount; c++) counts[c + 1] += counts[c];
    var cellStart = counts;
    var cellItems = new Uint32Array(N === 0 ? 0 : cellStart[cellCount]);
    var cursor = new Uint32Array(cellCount);
    for (i = 0; i < N; i++) {
      q = i * 3;
      i0 = Math.max(0, Math.floor((minArr[q] - gridX) / CELL));
      i1 = Math.min(gw - 1, Math.floor((maxArr[q] - gridX) / CELL));
      j0 = Math.max(0, Math.floor((minArr[q + 2] - gridZ) / CELL));
      j1 = Math.min(gh - 1, Math.floor((maxArr[q + 2] - gridZ) / CELL));
      if (i0 >= gw || j0 >= gh) continue;
      for (cz = j0; cz <= j1; cz++) {
        for (cx = i0; cx <= i1; cx++) {
          c = cz * gw + cx;
          cellItems[cellStart[c] + cursor[c]++] = i;
        }
      }
    }

    _stampRay = new Uint32Array(N);
    _stampQuery = new Uint32Array(N);

    var groundSurfaceId = sid(mapData.groundSurface || 'concrete');
    var waterSurfaceId = surfaceIds.water;

    var world = {
      boxes: { min: minArr, max: maxArr, flags: flags, surf: surf, count: N },
      bounds: bounds,
      groundY: groundY,
      seaY: seaY,
      quayX: quayX,
      grid: { cell: CELL, x: gridX, z: gridZ, w: gw, h: gh },
      surfaces: surfaceNames,
      surfaceName: function (id) {
        return surfaceNames[id] || 'concrete';
      },
      surfaceIndex: sid,
    };

    var _hit = {
      t: 0,
      hit: false,
      point: { x: 0, y: 0, z: 0 },
      normal: { x: 0, y: 0, z: 0 },
      surface: -1,
      boxIndex: -1,
    };

    /**
     * 与 server/sim.js raycast 语义一致；命中信息写入 out（复用，零分配）。
     * @returns {object} out: {t,hit,point,normal,surface,boxIndex}
     */
    function raycast(origin, dir, maxDist, mask, out) {
      out = out || _hit;
      if (mask === undefined || mask === null) mask = MASK.BULLET;
      var limit = num(maxDist, DEFAULTS.maxDist);
      var ox = num(origin && origin.x, 0);
      var oy = num(origin && origin.y, 0);
      var oz = num(origin && origin.z, 0);
      var dx = num(dir && dir.x, 0);
      var dy = num(dir && dir.y, 0);
      var dz = num(dir && dir.z, 0);

      out.t = limit;
      out.hit = false;
      out.normal.x = 0;
      out.normal.y = 0;
      out.normal.z = 0;
      out.surface = -1;
      out.boxIndex = -1;
      out.point.x = ox;
      out.point.y = oy;
      out.point.z = oz;
      if (!(limit > 0)) return out;

      var best = limit;
      var hitBox = -1;
      var axis = -1;
      var sign = 0;
      var plane = 0;

      // 地面 / 海面平面（与 server/sim.js 完全一致，包括 quayX 分支）。
      if (dy < -1e-6) {
        var tGround = (groundY - oy) / dy;
        if (tGround > 0 && tGround < best) {
          if (ox + dx * tGround <= quayX) {
            best = tGround;
            plane = 1;
          } else {
            var tSea = (seaY - oy) / dy;
            if (tSea > 0 && tSea < best) {
              best = tSea;
              plane = 2;
            }
          }
        }
      }

      if (N > 0) {
        _rayId++;
        if (_rayId === 0xffffffff) {
          _stampRay.fill(0);
          _rayId = 1;
        }
        var cx0 = Math.floor((ox - gridX) / CELL);
        var cz0 = Math.floor((oz - gridZ) / CELL);
        if (cx0 < 0) cx0 = 0;
        else if (cx0 >= gw) cx0 = gw - 1;
        if (cz0 < 0) cz0 = 0;
        else if (cz0 >= gh) cz0 = gh - 1;
        var sx = dx > 0 ? 1 : dx < 0 ? -1 : 0;
        var sz = dz > 0 ? 1 : dz < 0 ? -1 : 0;
        var tDX = dx !== 0 ? Math.abs(CELL / dx) : Infinity;
        var tDZ = dz !== 0 ? Math.abs(CELL / dz) : Infinity;
        var tMaxX = dx > 0 ? (gridX + (cx0 + 1) * CELL - ox) / dx : dx < 0 ? (gridX + cx0 * CELL - ox) / dx : Infinity;
        var tMaxZ = dz > 0 ? (gridZ + (cz0 + 1) * CELL - oz) / dz : dz < 0 ? (gridZ + cz0 * CELL - oz) / dz : Infinity;
        var invX = dx !== 0 ? 1 / dx : Infinity;
        var invY = dy !== 0 ? 1 / dy : Infinity;
        var invZ = dz !== 0 ? 1 / dz : Infinity;
        var tEnter = 0;
        var cxNow = cx0;
        var czNow = cz0;

        while (tEnter <= best && cxNow >= 0 && cxNow < gw && czNow >= 0 && czNow < gh) {
          c = czNow * gw + cxNow;
          var k = cellStart[c];
          var kEnd = cellStart[c + 1];
          for (; k < kEnd; k++) {
            var bi = cellItems[k];
            if (_stampRay[bi] === _rayId || (flags[bi] & mask)) continue;
            _stampRay[bi] = _rayId;
            var b3 = bi * 3;
            var bminX = minArr[b3], bminY = minArr[b3 + 1], bminZ = minArr[b3 + 2];
            var bmaxX = maxArr[b3], bmaxY = maxArr[b3 + 1], bmaxZ = maxArr[b3 + 2];
            var tNear = 0;
            var tFar = best;
            var hitAxis = -1;
            var hitSign = 0;
            var t1, t2, s;
            if (dx !== 0) {
              t1 = (bminX - ox) * invX;
              t2 = (bmaxX - ox) * invX;
              s = -1;
              if (t1 > t2) {
                var tmp = t1;
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
            } else if (ox < bminX || ox > bmaxX) continue;

            if (dy !== 0) {
              t1 = (bminY - oy) * invY;
              t2 = (bmaxY - oy) * invY;
              s = -1;
              if (t1 > t2) {
                var tmp2 = t1;
                t1 = t2;
                t2 = tmp2;
                s = 1;
              }
              if (t1 > tNear) {
                tNear = t1;
                hitAxis = 1;
                hitSign = s;
              }
              if (t2 < tFar) tFar = t2;
              if (tNear > tFar) continue;
            } else if (oy < bminY || oy > bmaxY) continue;

            if (dz !== 0) {
              t1 = (bminZ - oz) * invZ;
              t2 = (bmaxZ - oz) * invZ;
              s = -1;
              if (t1 > t2) {
                var tmp3 = t1;
                t1 = t2;
                t2 = tmp3;
                s = 1;
              }
              if (t1 > tNear) {
                tNear = t1;
                hitAxis = 2;
                hitSign = s;
              }
              if (t2 < tFar) tFar = t2;
              if (tNear > tFar) continue;
            } else if (oz < bminZ || oz > bmaxZ) continue;

            if (hitAxis < 0) continue;
            best = tNear;
            hitBox = bi;
            axis = hitAxis;
            sign = hitSign;
            plane = 0;
          }
          if (tMaxX < tMaxZ) {
            tEnter = tMaxX;
            tMaxX += tDX;
            cxNow += sx;
          } else {
            tEnter = tMaxZ;
            tMaxZ += tDZ;
            czNow += sz;
          }
        }
      }

      out.t = best;
      out.point.x = ox + dx * best;
      out.point.y = oy + dy * best;
      out.point.z = oz + dz * best;
      if (plane) {
        out.hit = true;
        out.normal.y = 1;
        out.surface = plane === 2 ? waterSurfaceId : groundSurfaceId;
        out.boxIndex = -1;
      } else if (hitBox >= 0) {
        out.hit = true;
        if (axis === 0) out.normal.x = sign;
        else if (axis === 1) out.normal.y = sign;
        else out.normal.z = sign;
        out.surface = surf[hitBox];
        out.boxIndex = hitBox;
      }
      return out;
    }

    /** 收集圆（其实是其外接方形）覆盖格内的盒索引，去重、按索引升序。 */
    function collectCylinder(x, z, r, mask) {
      _cand.length = 0;
      if (N === 0) return 0;
      var m = mask | 0;
      var minX = x - r, maxX = x + r, minZ = z - r, maxZ = z + r;
      var a0 = Math.floor((minX - gridX) / CELL);
      var a1 = Math.floor((maxX - gridX) / CELL);
      var b0 = Math.floor((minZ - gridZ) / CELL);
      var b1 = Math.floor((maxZ - gridZ) / CELL);
      if (a0 < 0) a0 = 0;
      if (b0 < 0) b0 = 0;
      if (a1 >= gw) a1 = gw - 1;
      if (b1 >= gh) b1 = gh - 1;
      if (a0 > a1 || b0 > b1) return 0;
      _queryId++;
      if (_queryId === 0xffffffff) {
        _stampQuery.fill(0);
        _queryId = 1;
      }
      for (var zz = b0; zz <= b1; zz++) {
        var row = zz * gw;
        for (var xx = a0; xx <= a1; xx++) {
          c = row + xx;
          var k = cellStart[c];
          var kEnd = cellStart[c + 1];
          for (; k < kEnd; k++) {
            var bi = cellItems[k];
            if (_stampQuery[bi] === _queryId) continue;
            _stampQuery[bi] = _queryId;
            if (flags[bi] & m) continue;
            _cand.push(bi);
          }
        }
      }
      if (_cand.length > 1) sortAsc(_cand, _cand.length);
      return _cand.length;
    }

    /**
     * 查询与圆柱（外接方形粗筛）重叠的盒；cb(boxIndex) 返回 false 可提前结束。
     * 盒按索引升序回调，保证与暴力遍历同样的顺序。
     */
    function queryCylinder(x, z, r, cb, mask) {
      var n = collectCylinder(num(x, 0), num(z, 0), Math.max(0, num(r, 0)), mask === undefined ? 0 : mask);
      if (typeof cb !== 'function') return n;
      for (var i = 0; i < n; i++) {
        if (cb(_cand[i]) === false) return i + 1;
      }
      return n;
    }

    /** 与 server/sim.js groundHeight 一致。 */
    function groundHeight(x, z, maxY) {
      var top = maxY === undefined ? 50 : num(maxY, 50);
      var h = x <= quayX ? groundY : seaY;
      if (N === 0) return h;
      var n = collectCylinder(x, z, 0, 0);
      for (var i = 0; i < n; i++) {
        var bi = _cand[i];
        if (flags[bi] & FLAGS.BULLET_ONLY) continue;
        var b3 = bi * 3;
        if (
          x >= minArr[b3] &&
          x <= maxArr[b3] &&
          z >= minArr[b3 + 2] &&
          z <= maxArr[b3 + 2] &&
          maxArr[b3 + 1] <= top &&
          maxArr[b3 + 1] > h
        ) {
          h = maxArr[b3 + 1];
        }
      }
      return h;
    }

    /** 竖直胶囊是否与任何墙体重叠（地图校验用）。 */
    function overlapsCylinder(pos, radius, height) {
      var p = vec3(pos, 0);
      var r = radius === undefined ? DEFAULTS.radius : radius;
      var hgt = height === undefined ? DEFAULTS.height : height;
      var y0 = p.y;
      var y1 = p.y + hgt;
      var hit = false;
      queryCylinder(p.x, p.z, r, function (bi) {
        if (flags[bi] & FLAGS.BULLET_ONLY) return;
        var b3 = bi * 3;
        if (minArr[b3] >= p.x + r || maxArr[b3] <= p.x - r) return;
        if (minArr[b3 + 2] >= p.z + r || maxArr[b3 + 2] <= p.z - r) return;
        if (minArr[b3 + 1] < y1 && maxArr[b3 + 1] > y0) {
          hit = true;
          return false;
        }
      }, 0);
      return hit;
    }

    var _losHit = {
      t: 0,
      hit: false,
      point: { x: 0, y: 0, z: 0 },
      normal: { x: 0, y: 0, z: 0 },
      surface: -1,
      boxIndex: -1,
    };
    var _losDir = { x: 0, y: 0, z: 0 };

    function lineOfSight(aIn, bIn) {
      var a = vec3(aIn, 0);
      var b = vec3(bIn, 0);
      var dx = b.x - a.x;
      var dy = b.y - a.y;
      var dz = b.z - a.z;
      var len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (len < 1e-4) return true;
      _losDir.x = dx / len;
      _losDir.y = dy / len;
      _losDir.z = dz / len;
      raycast(a, _losDir, len - 0.05, MASK.SIGHT, _losHit);
      return !_losHit.hit;
    }

    var _move = { onGround: false, hitWall: false, hitCeil: false, surface: 'concrete', surfaceIndex: 0 };

    /**
     * 与 server/sim.js / game.js d3 相同的胶囊移动；pos/vel 原地修改。
     * @param {number} dt 本步时长（固定步长）
     * @param {number} radius
     * @param {number} height
     * @param {boolean} snap 上一帧是否在地面（走行时 true）
     */
    function moveCapsule(pos, vel, dt, radius, height, snap) {
      if (!pos || !vel) throw new TypeError('moveCapsule requires pos and vel objects');
      var hStep = num(dt, 0);
      var rad = radius === undefined ? DEFAULTS.radius : Math.max(1e-3, num(radius, DEFAULTS.radius));
      var hgt = height === undefined ? DEFAULTS.height : num(height, DEFAULTS.height);
      snap = snap === undefined ? true : !!snap;

      pos.x = num(pos.x, 0);
      pos.y = num(pos.y, 0);
      pos.z = num(pos.z, 0);
      vel.x = num(vel.x, 0);
      vel.y = num(vel.y, 0);
      vel.z = num(vel.z, 0);

      var res = _move;
      res.onGround = false;
      res.hitWall = false;
      res.hitCeil = false;
      res.surface = 'concrete';
      res.surfaceIndex = groundSurfaceId;

      var dx = vel.x * hStep;
      var dz = vel.z * hStep;
      var sub = Math.max(1, Math.ceil(Math.sqrt(dx * dx + dz * dz) / (rad * 0.6)));
      var startY = pos.y;
      var stepH = stepHeight;
      var verticalProbe = snap ? stepH : 0.08;

      for (var s = 0; s < sub; s++) {
        pos.x += dx / sub;
        pos.z += dz / sub;
        for (var iter = 0; iter < 3; iter++) {
          var pushed = false;
          var n = collectCylinder(pos.x, pos.z, rad, FLAGS.BULLET_ONLY);
          for (var ci = 0; ci < n; ci++) {
            var bi = _cand[ci];
            var b3 = bi * 3;
            var bmaxY = maxArr[b3 + 1];
            var bminY = minArr[b3 + 1];
            if (bmaxY <= pos.y + verticalProbe) continue;
            if (bminY >= pos.y + hgt) continue;
            var bminX = minArr[b3], bmaxX = maxArr[b3];
            var bminZ = minArr[b3 + 2], bmaxZ = maxArr[b3 + 2];
            var cxp = Math.max(bminX, Math.min(bmaxX, pos.x));
            var czp = Math.max(bminZ, Math.min(bmaxZ, pos.z));
            var ox = pos.x - cxp;
            var oz = pos.z - czp;
            var d2 = ox * ox + oz * oz;
            if (d2 >= rad * rad) continue;
            if (d2 > 1e-10) {
              var d = Math.sqrt(d2);
              var pen = rad - d;
              var nx = ox / d;
              var nz = oz / d;
              pos.x += nx * pen;
              pos.z += nz * pen;
              var vn = vel.x * nx + vel.z * nz;
              if (vn < 0) {
                vel.x -= nx * vn;
                vel.z -= nz * vn;
              }
            } else {
              var left = pos.x - bminX;
              var right = bmaxX - pos.x;
              var back = pos.z - bminZ;
              var front = bmaxZ - pos.z;
              var m = Math.min(left, right, back, front);
              if (m === left) {
                pos.x = bminX - rad;
                if (vel.x > 0) vel.x = 0;
              } else if (m === right) {
                pos.x = bmaxX + rad;
                if (vel.x < 0) vel.x = 0;
              } else if (m === back) {
                pos.z = bminZ - rad;
                if (vel.z > 0) vel.z = 0;
              } else {
                pos.z = bmaxZ + rad;
                if (vel.z < 0) vel.z = 0;
              }
            }
            pushed = true;
            res.hitWall = true;
          }
          if (!pushed) break;
        }
      }

      // 垂直：floor / ceiling
      var nextY = pos.y + vel.y * hStep;
      var cRad = rad * 0.7;
      var floorY = pos.x <= quayX + cRad ? groundY : -50;
      var floorSurface = -1;
      var ceilY = Infinity;
      var floorProbe = startY + verticalProbe + 1e-4;
      var nv = collectCylinder(pos.x, pos.z, cRad, FLAGS.BULLET_ONLY);
      for (var vi = 0; vi < nv; vi++) {
        var biv = _cand[vi];
        var v3 = biv * 3;
        // 网格粗筛只保证“格子相交”，这里补上 server/sim.js 的方形精确判断。
        if (pos.x + cRad < minArr[v3] || pos.x - cRad > maxArr[v3]) continue;
        if (pos.z + cRad < minArr[v3 + 2] || pos.z - cRad > maxArr[v3 + 2]) continue;
        if (maxArr[v3 + 1] <= floorProbe && maxArr[v3 + 1] > floorY) {
          floorY = maxArr[v3 + 1];
          floorSurface = surf[biv];
        }
        if (minArr[v3 + 1] >= startY + hgt - 0.05 && minArr[v3 + 1] < ceilY) ceilY = minArr[v3 + 1];
      }

      if (vel.y > 0 && nextY + hgt > ceilY) {
        pos.y = ceilY - hgt;
        vel.y = 0;
        res.hitCeil = true;
      } else if (nextY <= floorY) {
        pos.y = floorY;
        if (vel.y < 0) vel.y = 0;
        res.onGround = true;
      } else if (snap && vel.y <= 0 && nextY - floorY < stepH) {
        pos.y = floorY;
        vel.y = 0;
        res.onGround = true;
      } else {
        pos.y = nextY;
      }

      if (res.onGround) {
        if (floorSurface >= 0) {
          res.surfaceIndex = floorSurface;
          res.surface = surfaceNames[floorSurface] || 'concrete';
        } else {
          res.surfaceIndex = groundSurfaceId;
          res.surface = surfaceNames[groundSurfaceId] || 'concrete';
        }
      }
      return res;
    }

    var _boxOut = {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 },
      surface: 'concrete',
      flags: 0,
    };
    /** 调试/服务器迁移用：把第 i 个盒还原成对象（默认复用返回对象）。 */
    world.boxAt = function (i, out) {
      out = out || _boxOut;
      var b3 = i * 3;
      out.min.x = minArr[b3];
      out.min.y = minArr[b3 + 1];
      out.min.z = minArr[b3 + 2];
      out.max.x = maxArr[b3];
      out.max.y = maxArr[b3 + 1];
      out.max.z = maxArr[b3 + 2];
      out.surface = surfaceNames[surf[i]] || 'concrete';
      out.flags = flags[i];
      return out;
    };
    world.playerStart = mapData.playerStart || null;
    world.raycast = raycast;
    world.queryCylinder = queryCylinder;
    world.groundHeight = groundHeight;
    world.overlapsCylinder = overlapsCylinder;
    world.lineOfSight = lineOfSight;
    world.moveCapsule = moveCapsule;
    world.boxCount = N;
    world.stepHeight = stepHeight;
    world.DEFAULTS = DEFAULTS;
    return world;
  }

  S.world = {
    createWorld: createWorld,
    FLAGS: FLAGS,
    MASK: MASK,
    DEFAULTS: DEFAULTS,
    CELL: CELL,
  };
  return S;
});
