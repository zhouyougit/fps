/* packages/sim/weapons.js — 武器纯函数：散布 / 后坐 / 距离衰减 / 弹丸
 * 散布使用 ROADMAP WP32-0 修复后的公式（注意括号：缩放因子作用于整个和式）。
 * UMD 链：Node require('./movement.js')。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./movement.js'));
  else root.SALT_SIM = factory(root.SALT_SIM || {});
})(typeof globalThis !== 'undefined' ? globalThis : this, function (S) {
  'use strict';
  S = S || {};
  var M = S.math;

  var EMPTY_MODS = { spread: 1 };

  /**
   * 修复后的散布公式（ROADMAP_V32-V36.md WP32-0 319-327）：
   *   base   = lerp(0.0125, 0.0012, ads)
   *   move   = speed01 * lerp(0.013, 0.004, ads)
   *   bloom  = bloom * lerp(0.0065, 0.0022, ads)
   *   air    = onGround ? 0 : 0.022
   *   crouch = crouching ? 0.002 * (1 - ads) : 0
   *   target = max(0.0004, (base+move+bloom+air-crouch) * spreadScale * mods.spread)
   * @param {object} o {ads,speed01,bloom,onGround,crouching,spreadScale,mods}
   * @returns {number} 弧度制散布半角
   */
  function spreadFor(o) {
    o = o || {};
    var ads = M.clamp(typeof o.ads === 'number' ? o.ads : 0, 0, 1);
    var speed01 = M.clamp(typeof o.speed01 === 'number' ? o.speed01 : 0, 0, 1);
    var bloom = M.clamp(typeof o.bloom === 'number' ? o.bloom : 0, 0, 1);
    var onGround = o.onGround !== false;
    var crouching = !!o.crouching;
    var scale = o.spreadScale == null ? 1 : +o.spreadScale || 0;
    var mods = o.mods || EMPTY_MODS;
    var spreadMul = mods.spread == null ? 1 : +mods.spread;
    if (!Number.isFinite(spreadMul)) spreadMul = 1;

    var base = M.lerp(0.0125, 0.0012, ads);
    var move = speed01 * M.lerp(0.013, 0.004, ads);
    var bloomTerm = bloom * M.lerp(0.0065, 0.0022, ads);
    var air = onGround ? 0 : 0.022;
    var crouch = crouching ? 0.002 * (1 - ads) : 0;
    return Math.max(0.0004, (base + move + bloomTerm + air - crouch) * scale * spreadMul);
  }

  function hash01(seed, index, salt) {
    var x = (seed >>> 0) ^ Math.imul((index | 0) + 1, 0x9e3779b1) ^ (salt | 0);
    x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
    x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
    x = (x ^ (x >>> 16)) >>> 0;
    return x / 4294967296;
  }

  /**
   * 第 index 发的后坐（0 起始）。前 9 发垂直后坐全量，之后 0.38；
   * 水平方向前 3 发随机、之后按 sin 摆动 + 小随机。与游戏 Be() 的结构一致。
   * @returns {{index:number,burst:number,pitch:number,yaw:number}}
   */
  function recoilPattern(index, seed) {
    var i = index | 0;
    if (i < 0) i = 0;
    var sd = (seed === undefined ? 0 : seed) >>> 0;
    var burst = i + 1;
    var verticalFactor = burst <= 9 ? 1 : 0.38;
    var r1 = hash01(sd, i, 0x1234);
    var r2 = hash01(sd, i, 0x5678);
    var r3 = hash01(sd, i, 0x9abc);
    var pitch = 0.0068 * verticalFactor * (0.85 + r1 * 0.3);
    var yaw = burst < 4 ? (r2 - 0.5) * 0.0022 : Math.sin(burst * 0.57) * 0.0042 + (r3 - 0.5) * 0.002;
    return { index: i, burst: burst, pitch: pitch, yaw: yaw };
  }

  /**
   * 距离伤害衰减。
   * falloff 为数字时按每米线性衰减；为对象时 {start,end,min} 从 start 的 1.0
   * 线性降到 end 的 min，之后保持 min。
   */
  function damageAtRange(base, dist, falloff) {
    var b = +base || 0;
    var d = dist > 0 ? dist : 0;
    if (falloff == null) return b;
    if (typeof falloff === 'number') {
      if (!(falloff > 0)) return b;
      return Math.max(0, b * (1 - falloff * d));
    }
    var start = typeof falloff.start === 'number' ? falloff.start : 0;
    var end = typeof falloff.end === 'number' ? falloff.end : start + 1;
    var min = typeof falloff.min === 'number' ? M.clamp(falloff.min, 0, 1) : 0.5;
    if (d <= start) return b;
    if (d >= end || end <= start) return b * min;
    return b * (1 + (min - 1) * M.invLerp(start, end, d));
  }

  /**
   * 霰弹枪弹丸方向（本地空间，-Z 为前）。零分配（传入 out 时）。
   * 与游戏 Be() 的 tan(spread)*sqrt(rng) 采样一致；rng 必须是命名流函数。
   * @returns {Float32Array} 长度 count*3
   */
  function pelletDirections(count, spread, rng, out) {
    var n = Math.max(0, count | 0);
    if (typeof rng !== 'function') throw new TypeError('pelletDirections requires a seeded rng function');
    var arr = out && out.length >= n * 3 ? out : new Float32Array(n * 3);
    var tanSpread = Math.tan(Math.max(0, +spread || 0));
    for (var i = 0; i < n; i++) {
      var ang = rng() * Math.PI * 2;
      var r = tanSpread * Math.sqrt(rng());
      var x = Math.cos(ang) * r;
      var y = Math.sin(ang) * r;
      var z = -1;
      var len = Math.sqrt(x * x + y * y + z * z);
      arr[i * 3] = x / len;
      arr[i * 3 + 1] = y / len;
      arr[i * 3 + 2] = z / len;
    }
    return arr;
  }

  /** 与 src/weapon_ext.js 对应的示例数据表（权威内容后续迁到 packages/data/weapons）。 */
  var WEAPONS = {
    pac9: Object.freeze({
      id: 'pac9',
      name: '几猫九式突击步枪',
      damage: 24,
      rpm: 720,
      magSize: 30,
      reserve: 180,
      pellets: 1,
      range: 120,
      recoil: 1,
      spreadScale: 1,
      falloff: { start: 20, end: 90, min: 0.55 },
    }),
    dmr: Object.freeze({
      id: 'dmr',
      name: '几猫·长眼 精确射手步枪',
      damage: 62,
      rpm: 240,
      magSize: 10,
      reserve: 90,
      pellets: 1,
      range: 320,
      recoil: 1.7,
      spreadScale: 0.45,
      falloff: { start: 40, end: 240, min: 0.72 },
    }),
    breaker12: Object.freeze({
      id: 'breaker12',
      name: '几猫·破门锤 12 号霰弹枪',
      damage: 11,
      rpm: 78,
      magSize: 8,
      reserve: 48,
      pellets: 9,
      pelletSpread: 1.35,
      range: 90,
      recoil: 2.35,
      spreadScale: 1,
      falloff: { start: 6, end: 40, min: 0.25 },
    }),
  };

  function weaponById(id) {
    return Object.prototype.hasOwnProperty.call(WEAPONS, id) ? WEAPONS[id] : null;
  }

  S.weapons = {
    spreadFor: spreadFor,
    recoilPattern: recoilPattern,
    damageAtRange: damageAtRange,
    pelletDirections: pelletDirections,
    WEAPONS: WEAPONS,
    weaponById: weaponById,
  };
  return S;
});
