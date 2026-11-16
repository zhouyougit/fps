/* packages/sim/movement.js — 确定性玩家移动（走/跑/蹲/跳/土狼/跳跃缓冲/滑铲/翻越）
 * 常量与 src/game.js Mt（63281）一致，滑铲/翻越为 V33 铺垫。
 * 不依赖 Math.random / Date.now / performance.now；同一 state+cmd 序列结果完全一致。
 * UMD 链：Node require('./world.js')。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./world.js'));
  else root.SALT_SIM = factory(root.SALT_SIM || {});
})(typeof globalThis !== 'undefined' ? globalThis : this, function (S) {
  'use strict';
  S = S || {};

  var BTN = {
    FIRE: 1,
    ADS: 2,
    JUMP: 4,
    SPRINT: 8,
    CROUCH: 16,
    RELOAD: 32,
    MELEE: 64,
    GRENADE: 128,
    INTERACT: 256,
    SCAN: 512,
    LEAN_L: 1024,
    LEAN_R: 2048,
  };

  var DEFAULT_TUNING = {
    walk: 3.8,
    sprint: 6.4,
    crouch: 1.9,
    adsSpeed: 2.4,
    accelGround: 34,
    decelGround: 26,
    accelAir: 9,
    airIdleDecel: 0.6,
    gravity: 21,
    jumpApex: 1,
    coyote: 0.12,
    jumpBuffer: 0.13,
    standHeight: 1.8,
    crouchHeight: 1.15,
    radius: 0.32,
    eyeRate: 11,
    adsBlend: 0.18,
    adsLook: 0.6,
    pitchLimit: 1.5,
    maxFallSpeed: 40,
    stepHeight: 0.42,
    landDip: 0.36,
    landDipMax: 0.2,
    // V33 铺垫
    slideTime: 0.65,
    slideFriction: 11,
    slideBoost: 2.1,
    slideMinSpeed: 2.2,
    slideMaxSpeed: 8.6,
    slideMinStart: 4.6,
    vaultTime: 0.3,
    vaultLift: 0.12,
    vaultReach: 0.62,
    vaultMinHeight: 0.55,
    vaultMaxHeight: 1.08,
    vaultClearance: 0.32,
    leanRate: 8,
    // 生存
    maxHealth: 100,
    regenDelay: 4,
    regenRate: 25,
    fallDamageStart: 13,
    fallDamageScale: 7,
    rescueDamage: 12,
    rescueDepth: 2.2,
  };

  var jumpSpeed = Math.sqrt(2 * DEFAULT_TUNING.gravity * DEFAULT_TUNING.jumpApex);

  var _lastTuning = null;
  var _resolvedTuning = null;

  function resolveTuning(t) {
    if (!t) return DEFAULT_TUNING;
    if (t === _lastTuning && _resolvedTuning) return _resolvedTuning;
    var out = {};
    var k;
    for (k in DEFAULT_TUNING) out[k] = DEFAULT_TUNING[k];
    for (k in t) {
      if (typeof t[k] === 'number' && Number.isFinite(t[k])) out[k] = t[k];
      else if (t[k] !== undefined) out[k] = t[k];
    }
    _lastTuning = t;
    _resolvedTuning = out;
    jumpSpeed = Math.sqrt(2 * (out.gravity || DEFAULT_TUNING.gravity) * (out.jumpApex || DEFAULT_TUNING.jumpApex));
    return out;
  }

  function num(v, d) {
    return typeof v === 'number' && Number.isFinite(v) ? v : d;
  }

  function copyPos(a, b) {
    a.x = b.x;
    a.y = b.y;
    a.z = b.z;
    return a;
  }

  function readSpawn(world, spawn) {
    var p = spawn;
    if (p && p.pos) p = p.pos;
    if (Array.isArray(p)) return { x: num(p[0], 0), y: num(p[1], 0), z: num(p[2], 0) };
    if (p && typeof p === 'object') return { x: num(p.x, 0), y: num(p.y, 0), z: num(p.z, 0) };
    if (world && world.playerStart) return readSpawn(world, world.playerStart);
    var b = (world && world.bounds) || { min: { x: -10, y: 0, z: -10 }, max: { x: 10, y: 0, z: 10 } };
    var x = (b.min.x + b.max.x) / 2;
    var z = (b.min.z + b.max.z) / 2;
    var y = world && world.groundHeight ? world.groundHeight(x, z, 50) : 0;
    return { x: x, y: y, z: z };
  }

  function createPlayerState(world, spawn, tuning) {
    var T = resolveTuning(tuning);
    var p = readSpawn(world, spawn);
    var st = {
      pos: { x: p.x, y: p.y, z: p.z },
      vel: { x: 0, y: 0, z: 0 },
      yaw: (spawn && num(spawn.yaw, 0)) || 0,
      pitch: 0,
      onGround: true,
      alive: true,
      crouch01: 0,
      crouching: false,
      sprinting: false,
      ads: 0,
      adsLin: 0,
      coyote: 0,
      jumpBuf: 0,
      slideT: 0,
      slideDirX: 0,
      slideDirZ: 0,
      vaultT: 0,
      vaultFromX: 0,
      vaultFromY: 0,
      vaultFromZ: 0,
      vaultToX: 0,
      vaultToY: 0,
      vaultToZ: 0,
      lean: 0,
      height: T.standHeight,
      radius: T.radius,
      speed: 0,
      surface: 'concrete',
      lastSafe: { x: p.x, y: p.y, z: p.z },
      airTime: 0,
      peakFallSpeed: 0,
      health: T.maxHealth,
      maxHealth: T.maxHealth,
      sinceDamage: T.regenDelay,
      prevButtons: 0,
      tick: 0,
      // 本步事件（每步开头清零）
      jumped: false,
      landed: false,
      landSpeed: 0,
      hitWall: false,
      hitCeil: false,
      rescued: false,
      vaulted: false,
      fell: false,
      tuning: T,
    };
    return st;
  }

  function applyDamage(st, amount) {
    if (!(amount > 0)) return;
    if (st.alive === false) return;
    st.health = Math.max(0, st.health - amount);
    st.sinceDamage = 0;
    st.lastDamage = amount;
    if (st.health <= 0) st.alive = false;
  }

  function canStand(world, pos, radius, standHeight, crouchHeight) {
    if (!world || !world.queryCylinder) return true;
    var r = radius * 0.9;
    var y0 = pos.y + crouchHeight - 0.05;
    var y1 = pos.y + standHeight;
    var blocked = false;
    world.queryCylinder(pos.x, pos.z, r, function (i) {
      var fl = world.boxes.flags[i];
      if (fl & S.world.FLAGS.BULLET_ONLY) return;
      var mn = world.boxes.min;
      var mx = world.boxes.max;
      var b3 = i * 3;
      if (pos.x + r < mn[b3] || pos.x - r > mx[b3]) return;
      if (pos.z + r < mn[b3 + 2] || pos.z - r > mx[b3 + 2]) return;
      if (mn[b3 + 1] < y1 && mx[b3 + 1] > y0) {
        blocked = true;
        return false;
      }
    }, 0);
    return !blocked;
  }

  var _vaultDir = { x: 0, y: 0, z: 0 };
  var _vaultHit = {
    t: 0,
    hit: false,
    point: { x: 0, y: 0, z: 0 },
    normal: { x: 0, y: 0, z: 0 },
    surface: -1,
    boxIndex: -1,
  };
  var _vaultPos = { x: 0, y: 0, z: 0 };

  /**
   * 翻越路径的胶囊采样（3 点）：只挡“比落点更高的墙”，
   * 跳过正在翻越的低掩体本身，避免把合法的过顶动作判成撞墙。
   */
  function vaultPathClear(world, fromX, fromY, fromZ, toX, toY, toZ, T, skipBox, topY) {
    if (!world || !world.queryCylinder) return true;
    var r = T.radius * 0.95;
    var hgt = T.standHeight - 0.1;
    for (var k = 1; k <= 3; k++) {
      var u = k / 3;
      var sm = u * u * (3 - 2 * u);
      var px = fromX + (toX - fromX) * sm;
      var pz = fromZ + (toZ - fromZ) * sm;
      var py = fromY + (toY - fromY) * sm + Math.sin(Math.PI * u) * T.vaultLift;
      var blocked = false;
      world.queryCylinder(px, pz, r, function (i) {
        if (i === skipBox) return;
        var fl = world.boxes.flags[i];
        if (fl & S.world.FLAGS.BULLET_ONLY) return;
        var mn = world.boxes.min;
        var mx = world.boxes.max;
        var b3 = i * 3;
        // 落点高度以下的低掩体属于“翻过去”的目标，不参与阻挡判定。
        if (mx[b3 + 1] <= topY + 0.02) return;
        if (px + r < mn[b3] || px - r > mx[b3]) return;
        if (pz + r < mn[b3 + 2] || pz - r > mx[b3 + 2]) return;
        if (mn[b3 + 1] < py + hgt && mx[b3 + 1] > py) {
          blocked = true;
          return false;
        }
      }, 0);
      if (blocked) return false;
    }
    return true;
  }

  /** 翻越探测：脚下前方低矮掩体 + 顶部可站立。 */
  function tryVault(st, world, T, fwdX, fwdZ, moving) {
    if (!world || !world.raycast || !world.overlapsCylinder) return false;
    if (!st.onGround || st.crouching || !moving) return false;
    _vaultDir.x = fwdX;
    _vaultDir.y = 0;
    _vaultDir.z = fwdZ;
    _vaultPos.x = st.pos.x;
    _vaultPos.y = st.pos.y + Math.min(0.42, T.vaultMinHeight - 0.05);
    _vaultPos.z = st.pos.z;
    world.raycast(_vaultPos, _vaultDir, T.vaultReach + T.radius, S.world.MASK.PLAYER, _vaultHit);
    if (!_vaultHit.hit || _vaultHit.boxIndex < 0) return false;
    var bi = _vaultHit.boxIndex;
    var mn = world.boxes.min;
    var mx = world.boxes.max;
    var top = mx[bi * 3 + 1];
    if (top < st.pos.y + T.vaultMinHeight || top > st.pos.y + T.vaultMaxHeight) return false;
    if (_vaultHit.t < 0.02) return false;
    var tx = st.pos.x + fwdX * (_vaultHit.t + T.radius + T.vaultClearance);
    var tz = st.pos.z + fwdZ * (_vaultHit.t + T.radius + T.vaultClearance);
    var gy = world.groundHeight(tx, tz, top + 0.6);
    if (Math.abs(gy - top) > 0.26) return false;
    if (world.overlapsCylinder({ x: tx, y: gy + 0.02, z: tz }, T.radius * 0.9, T.standHeight - 0.1)) return false;
    // V38：单点落点检查挡不住“低掩体后面 0.2m 厚的薄墙”，沿抛物线再采 3 个胶囊点。
    if (!vaultPathClear(world, st.pos.x, st.pos.y, st.pos.z, tx, gy, tz, T, bi, top)) return false;
    st.vaultT = T.vaultTime;
    st.vaultFromX = st.pos.x;
    st.vaultFromY = st.pos.y;
    st.vaultFromZ = st.pos.z;
    st.vaultToX = tx;
    st.vaultToY = gy;
    st.vaultToZ = tz;
    st.vel.x = 0;
    st.vel.y = 0;
    st.vel.z = 0;
    st.vaulted = true;
    st.onGround = false;
    return true;
  }

  function advanceVault(st, h, T, world) {
    var total = T.vaultTime > 1e-6 ? T.vaultTime : 1e-6;
    st.vaultT = Math.max(0, st.vaultT - h);
    var u = 1 - st.vaultT / total;
    if (u > 1) u = 1;
    var sm = u * u * (3 - 2 * u);
    st.pos.x = st.vaultFromX + (st.vaultToX - st.vaultFromX) * sm;
    st.pos.y = st.vaultFromY + (st.vaultToY - st.vaultFromY) * sm + Math.sin(Math.PI * u) * T.vaultLift;
    st.pos.z = st.vaultFromZ + (st.vaultToZ - st.vaultFromZ) * sm;
    st.vel.x = 0;
    st.vel.y = 0;
    st.vel.z = 0;
    st.height = T.standHeight;
    st.crouching = false;
    if (st.vaultT <= 1e-9) {
      st.vaultT = 0;
      st.pos.x = st.vaultToX;
      st.pos.y = st.vaultToY;
      st.pos.z = st.vaultToZ;
      st.onGround = true;
      st.landed = true;
      st.landSpeed = 0;
      st.coyote = T.coyote;
      if (world && world.bounds) {
        st.lastSafe.x = st.pos.x;
        st.lastSafe.y = st.pos.y;
        st.lastSafe.z = st.pos.z;
      }
    }
  }

  /** 公共收尾：速度 / 蹲伏插值（eye）/ 侧倾 / 回血。翻越的提前返回也必须走这里。 */
  function finishStep(st, buttons, T, h) {
    st.speed = Math.sqrt(st.vel.x * st.vel.x + st.vel.z * st.vel.z);
    st.crouch01 += ((st.crouching ? 1 : 0) - st.crouch01) * (1 - Math.exp(-T.eyeRate * h));

    var leanTarget = buttons & BTN.LEAN_L ? 1 : buttons & BTN.LEAN_R ? -1 : 0;
    st.lean += (leanTarget - st.lean) * (1 - Math.exp(-T.leanRate * h));

    st.sinceDamage += h;
    if (st.health > 0 && st.health < T.maxHealth && st.sinceDamage > T.regenDelay) {
      st.health = Math.min(T.maxHealth, st.health + T.regenRate * h);
    }
  }

  /**
   * 固定步玩家推进。
   * @param {object} st createPlayerState 产生的状态（原地修改）
   * @param {object} cmd {tick,mx,my,yaw,pitch,buttons,weaponSlot}
   * @param {object} world packages/sim/world
   * @param {number} h 固定步长（1/60）
   * @param {object} [tuning] 覆盖 DEFAULT_TUNING 的部分字段
   */
  function stepPlayer(st, cmd, world, h, tuning) {
    var T = resolveTuning(tuning || st.tuning);
    h = num(h, 1 / 60);
    if (h <= 0) h = 1 / 60;
    var buttons = cmd && typeof cmd.buttons === 'number' ? cmd.buttons | 0 : 0;
    var prevButtons = st.prevButtons | 0;
    var pressed = buttons & ~prevButtons;
    st.prevButtons = buttons;
    st.tick = cmd && typeof cmd.tick === 'number' ? cmd.tick | 0 : st.tick + 1;
    st.jumped = false;
    st.landed = false;
    st.landSpeed = 0;
    st.hitWall = false;
    st.hitCeil = false;
    st.rescued = false;
    st.vaulted = false;
    st.fell = false;
    if (st.alive === undefined) st.alive = true;

    if (cmd) {
      st.yaw = num(cmd.yaw, st.yaw);
      st.pitch = Math.max(-T.pitchLimit, Math.min(T.pitchLimit, num(cmd.pitch, st.pitch)));
    }

    if (st.vaultT > 0) {
      advanceVault(st, h, T, world);
      finishStep(st, buttons, T, h);
      return st;
    }

    // ADS：线性 0.18s 再 smootherstep，和武器表现层一致。
    var adsTarget = buttons & BTN.ADS ? 1 : 0;
    st.adsLin = Math.max(0, Math.min(1, st.adsLin + (adsTarget ? h : -h) / T.adsBlend));
    var a = st.adsLin;
    st.ads = a * a * a * (a * (6 * a - 15) + 10);

    var mx = cmd ? num(cmd.mx, 0) : 0;
    var my = cmd ? num(cmd.my, 0) : 0;
    var inLen2 = mx * mx + my * my;
    if (inLen2 > 1) {
      // 防御：Command 本应已归一化；直接调用 stepPlayer 时也不允许超速。
      var inLen = Math.sqrt(inLen2);
      mx /= inLen;
      my /= inLen;
      inLen2 = 1;
    }
    var moving = inLen2 > 0.01;

    // 蹲：按住生效；松开时只有头顶有空间才站起。
    var crouchHeld = !!(buttons & BTN.CROUCH);
    if (crouchHeld) st.crouching = true;
    else if (st.crouching && canStand(world, st.pos, T.radius, T.standHeight, T.crouchHeight)) st.crouching = false;

    // 滑铲（V33）：冲刺中按下蹲、贴地、向前。
    var slideStart = crouchHeld && !(prevButtons & BTN.CROUCH) && st.onGround;
    if (st.slideT > 0) {
      if (!st.onGround || !crouchHeld) st.slideT = 0;
    } else if (slideStart && st.onGround && st.speed >= T.slideMinStart && st.ads < 0.25 && my > 0.3) {
      var sdx = st.vel.x;
      var sdz = st.vel.z;
      var slen = Math.sqrt(sdx * sdx + sdz * sdz);
      if (slen > 1e-4) {
        sdx /= slen;
        sdz /= slen;
      } else {
        sdx = -Math.sin(st.yaw);
        sdz = -Math.cos(st.yaw);
      }
      st.slideT = T.slideTime;
      st.slideDirX = sdx;
      st.slideDirZ = sdz;
      st.crouching = true;
      var boosted = Math.min(T.slideMaxSpeed, Math.max(st.speed, T.sprint) + T.slideBoost);
      st.vel.x = sdx * boosted;
      st.vel.z = sdz * boosted;
    }

    var wantSprint =
      !!(buttons & BTN.SPRINT) && my > 0.55 && Math.abs(mx) < 0.6 && !st.crouching && st.ads < 0.35 && !(buttons & BTN.FIRE);
    st.sprinting = (wantSprint && st.onGround && st.speed > T.walk * 0.6) || (wantSprint && !st.onGround && st.sprinting);

    var speedMax = T.walk;
    if (st.crouching) speedMax = T.crouch;
    else if (wantSprint) speedMax = T.sprint;
    // 引擎：bi(P, Math.min(P, ads), ads)
    var adsSpd = Math.min(speedMax, T.adsSpeed);
    speedMax = speedMax + (adsSpd - speedMax) * st.ads;
    if (my < 0) speedMax *= 1 + (0.82 - 1) * -my;
    st.height = st.crouching ? T.crouchHeight : T.standHeight;

    var sy = Math.sin(st.yaw);
    var cy = Math.cos(st.yaw);
    var desiredX;
    var desiredZ;

    if (st.slideT > 0) {
      st.slideT = Math.max(0, st.slideT - h);
      var curSpeed = Math.sqrt(st.vel.x * st.vel.x + st.vel.z * st.vel.z);
      var slideSpeed = Math.max(T.slideMinSpeed, curSpeed - T.slideFriction * h);
      st.vel.x = st.slideDirX * slideSpeed;
      st.vel.z = st.slideDirZ * slideSpeed;
      if (st.slideT <= 0) {
        // V38：滑铲结束不能无视头顶空间；低顶棚下保持蹲姿。
        st.crouching = crouchHeld || !canStand(world, st.pos, T.radius, T.standHeight, T.crouchHeight);
        st.height = st.crouching ? T.crouchHeight : T.standHeight;
      }
    } else {
      desiredX = (mx * cy - my * sy) * speedMax;
      desiredZ = (-mx * sy - my * cy) * speedMax;
      var accel = st.onGround ? (moving ? T.accelGround : T.decelGround) : moving ? T.accelAir : T.airIdleDecel;
      var dvx = desiredX - st.vel.x;
      var dvz = desiredZ - st.vel.z;
      if (!st.onGround && !moving) {
        dvx = -st.vel.x;
        dvz = -st.vel.z;
      }
      var dvLen = Math.sqrt(dvx * dvx + dvz * dvz);
      var maxDelta = accel * h;
      if (dvLen <= maxDelta || dvLen < 1e-6) {
        if (st.onGround || moving) {
          st.vel.x = desiredX;
          st.vel.z = desiredZ;
        }
      } else {
        st.vel.x += (dvx / dvLen) * maxDelta;
        st.vel.z += (dvz / dvLen) * maxDelta;
      }
    }

    var prevOnGround = st.onGround;
    st.coyote = prevOnGround ? T.coyote : Math.max(0, st.coyote - h);
    st.jumpBuf = pressed & BTN.JUMP ? T.jumpBuffer : Math.max(0, st.jumpBuf - h);

    // 翻越：跳跃键 + 前方低矮掩体。优先于普通跳跃。
    if (pressed & BTN.JUMP && st.onGround && !st.crouching && my > 0.2) {
      var fwdX = -sy;
      var fwdZ = -cy;
      if (moving) {
        var il = 1 / Math.sqrt(inLen2);
        fwdX = (mx * cy - my * sy) * il;
        fwdZ = (-mx * sy - my * cy) * il;
      }
      if (tryVault(st, world, T, fwdX, fwdZ, moving)) {
        st.jumpBuf = 0;
        advanceVault(st, h, T, world);
        finishStep(st, buttons, T, h);
        return st;
      }
    }

    var jumpVel = Math.sqrt(2 * T.gravity * T.jumpApex);
    if (st.jumpBuf > 0 && st.coyote > 0 && (!st.crouching || canStand(world, st.pos, T.radius, T.standHeight, T.crouchHeight))) {
      st.vel.y = jumpVel;
      st.jumpBuf = 0;
      st.coyote = 0;
      st.onGround = false;
      st.crouching = false;
      st.slideT = 0;
      st.height = T.standHeight;
      st.jumped = true;
    }

    st.vel.y -= T.gravity * h * 0.5;
    if (st.vel.y < -T.maxFallSpeed) st.vel.y = -T.maxFallSpeed;
    var fallVel = st.vel.y;

    var res = null;
    if (world && world.moveCapsule) {
      res = world.moveCapsule(st.pos, st.vel, h, T.radius, st.height, prevOnGround);
    }
    if (res && !res.onGround) st.vel.y -= T.gravity * h * 0.5;
    if (st.vel.y < -T.maxFallSpeed) st.vel.y = -T.maxFallSpeed;

    var b = world && world.bounds;
    if (b) {
      st.pos.x = Math.max(b.min.x + 0.4, Math.min(b.max.x - 0.4, st.pos.x));
      st.pos.z = Math.max(b.min.z + 0.4, Math.min(b.max.z - 0.4, st.pos.z));
    }

    st.onGround = !!(res && res.onGround);
    if (res && res.surface) st.surface = res.surface;
    st.hitWall = !!(res && res.hitWall);
    st.hitCeil = !!(res && res.hitCeil);

    if (st.onGround) {
      if (!prevOnGround && st.airTime > 0.12) {
        var impact = Math.max(0, -fallVel);
        st.landed = true;
        st.landSpeed = impact;
        if (impact > T.fallDamageStart) applyDamage(st, (impact - T.fallDamageStart) * T.fallDamageScale);
      }
      st.airTime = 0;
      st.peakFallSpeed = 0;
      if (st.pos.x <= (world ? world.quayX : 30) - 1.2 && st.pos.y > -0.5) {
        st.lastSafe.x = st.pos.x;
        st.lastSafe.y = st.pos.y;
        st.lastSafe.z = st.pos.z;
      }
    } else {
      st.airTime += h;
      if (-st.vel.y > st.peakFallSpeed) st.peakFallSpeed = -st.vel.y;
    }

    if (world && st.pos.y < world.seaY - T.rescueDepth) {
      st.pos.x = st.lastSafe.x;
      st.pos.y = st.lastSafe.y;
      st.pos.z = st.lastSafe.z;
      st.vel.x = 0;
      st.vel.y = 0;
      st.vel.z = 0;
      st.onGround = true;
      st.yaw += Math.PI;
      st.rescued = true;
      st.fell = true;
      st.slideT = 0;
      applyDamage(st, T.rescueDamage);
    }

    finishStep(st, buttons, T, h);
    return st;
  }

  S.movement = {
    BTN: BTN,
    DEFAULT_TUNING: DEFAULT_TUNING,
    get jumpSpeed() {
      return jumpSpeed;
    },
    resolveTuning: resolveTuning,
    createPlayerState: createPlayerState,
    stepPlayer: stepPlayer,
    canStand: canStand,
  };
  return S;
});
