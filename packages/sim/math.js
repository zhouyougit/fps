/* packages/sim/math.js — 标量数学（零依赖，不引用 three.js / DOM）
 * UMD：浏览器 <script> 顺序拼接共享 root.SALT_SIM；Node 下 module.exports。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SALT_SIM = factory(root.SALT_SIM || {});
})(typeof globalThis !== 'undefined' ? globalThis : this, function (S) {
  'use strict';
  S = S || {};

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function invLerp(a, b, v) {
    return b === a ? 0 : (v - a) / (b - a);
  }

  /** 标准 smoothstep（与引擎的 Yo=smootherstep 不同，需要时用 smootherstep）。 */
  function smoothstep(a, b, v) {
    var t = clamp(invLerp(a, b, v), 0, 1);
    return t * t * (3 - 2 * t);
  }

  /** 与引擎 kn(current, target, rate, dt) 完全一致的指数趋近（帧率无关）。 */
  function damp(current, target, rate, dt) {
    return target + (current - target) * Math.exp(-rate * dt);
  }

  /** 2D 欧氏距离（x/z 平面）。 */
  function dist2(ax, az, bx, bz) {
    var dx = bx - ax, dz = bz - az;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /** 3D 欧氏距离。 */
  function dist3(ax, ay, az, bx, by, bz) {
    var dx = bx - ax, dy = by - ay, dz = bz - az;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  function distSq2(ax, az, bx, bz) {
    var dx = bx - ax, dz = bz - az;
    return dx * dx + dz * dz;
  }

  function distSq3(ax, ay, az, bx, by, bz) {
    var dx = bx - ax, dy = by - ay, dz = bz - az;
    return dx * dx + dy * dy + dz * dz;
  }

  /** 归一化 2D；零向量返回 (0,0)。out 可复用以零分配。 */
  function normalize2(x, z, out) {
    var len = Math.sqrt(x * x + z * z);
    out = out || { x: 0, z: 0 };
    if (len < 1e-12) {
      out.x = 0;
      out.z = 0;
      return out;
    }
    out.x = x / len;
    out.z = z / len;
    return out;
  }

  /** 归一化 3D；零向量返回 (0,0,0)。out 可复用以零分配。 */
  function normalize3(x, y, z, out) {
    var len = Math.sqrt(x * x + y * y + z * z);
    out = out || { x: 0, y: 0, z: 0 };
    if (len < 1e-12) {
      out.x = 0;
      out.y = 0;
      out.z = 0;
      return out;
    }
    out.x = x / len;
    out.y = y / len;
    out.z = z / len;
    return out;
  }

  function nearlyEqual(a, b, eps) {
    eps = eps === undefined ? 1e-6 : eps;
    return Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
  }

  S.math = {
    clamp: clamp,
    lerp: lerp,
    invLerp: invLerp,
    smoothstep: smoothstep,
    damp: damp,
    dist2: dist2,
    dist3: dist3,
    distSq2: distSq2,
    distSq3: distSq3,
    normalize2: normalize2,
    normalize3: normalize3,
    nearlyEqual: nearlyEqual,
    EPS: 1e-6,
  };
  return S;
});
