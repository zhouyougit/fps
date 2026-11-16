/* SALTLINE · game part 5/6 — 玩法运行时
   音频、玩家、武器、敌人、AI、HUD、任务目标等运行时。
   片段：由 tools/build.cjs 按 src/game/manifest.json 顺序拼接，不单独执行。 */
  var vt = Math.PI * 2;
  function ao(i) {
    let e = i >>> 0;
    return () => {
      (e |= 0), (e = (e + 1831565813) | 0);
      let t = Math.imul(e ^ (e >>> 15), 1 | e);
      return (
        (t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t),
        ((t ^ (t >>> 14)) >>> 0) / 4294967296
      );
    };
  }
  function Kb(i) {
    let e = 2166136261;
    for (let t = 0; t < i.length; t++)
      (e ^= i.charCodeAt(t)), (e = Math.imul(e, 16777619));
    return e >>> 0;
  }
  var St = (i, e) => new Float32Array(Math.max(1, Math.round(i * e))),
    Xt = (i, e, t) => e + (t - e) * i(),
    Ns = (i) => 440 * Math.pow(2, (i - 69) / 12);
  function Qn(i, e, t) {
    let n = St(i, e);
    for (let s = 0; s < n.length; s++) n[s] = t() * 2 - 1;
    return n;
  }
  function Av(i, e, t, n) {
    let s = (vt * Math.max(10, Math.min(e, n * 0.47))) / n,
      o = Math.cos(s),
      r = Math.sin(s),
      a = r / (2 * t),
      l,
      c,
      u,
      h = 1 + a,
      f = -2 * o,
      p = 1 - a;
    return (
      i === "lp"
        ? ((l = (1 - o) / 2), (c = 1 - o), (u = l))
        : i === "hp"
          ? ((l = (1 + o) / 2), (c = -(1 + o)), (u = l))
          : ((l = a), (c = 0), (u = -a)),
      [l / h, c / h, u / h, f / h, p / h]
    );
  }
  function tn(i, e, t, n, s) {
    let [o, r, a, l, c] = Av(e, t, n, s),
      u = 0,
      h = 0;
    for (let f = 0; f < i.length; f++) {
      let p = i[f],
        d = o * p + u;
      (u = r * p - l * d + h), (h = a * p - c * d), (i[f] = d);
    }
    return i;
  }
  function di(i, e, t, n, s, o = 1) {
    let r = i.length;
    for (let a = 0; a < o; a++) {
      let l = 0,
        c = 0,
        u = null;
      a > 0 && ((l = di.z1), (c = di.z2));
      let h = a === o - 1 ? i : null;
      for (let f = 0; f < r; f++) {
        (f & 31) === 0 &&
          (u = Av(e, t(f / r), typeof n == "function" ? n(f / r) : n, s));
        let p = i[f],
          d = u[0] * p + l;
        (l = u[1] * p - u[3] * d + c),
          (c = u[2] * p - u[4] * d),
          h && (h[f] = d);
      }
      (di.z1 = l), (di.z2 = c);
    }
    return i;
  }
  var Vo =
    (i, e, t = 1) =>
    (n) =>
      i * Math.pow(e / i, Math.pow(n, t));
  function lo(i, e, t) {
    for (let n = 0; n < i.length; n++) i[n] *= t(n / e);
    return i;
  }
  var co = (i, e = 0) =>
    e > 0
      ? (t) => (1 - Math.exp(-t / e)) * Math.exp(-t / i)
      : (t) => Math.exp(-t / i);
  function Se(i, e, t, n, s) {
    let o = Math.round(t * s),
      r = Math.min(e.length, i.length - o);
    for (let a = Math.max(0, -o); a < r; a++) i[o + a] += e[a] * n;
    return i;
  }
  function Us(i, e, t, n, s) {
    let o = i.length,
      r = Math.round(t * s) % o;
    r < 0 && (r += o);
    for (let a = 0; a < e.length; a++) (i[r] += e[a] * n), ++r >= o && (r = 0);
    return i;
  }
  function Qb(i) {
    let e = 0;
    for (let t = 0; t < i.length; t++) {
      let n = Math.abs(i[t]);
      n > e && (e = n);
    }
    return e;
  }
  function ml(i, e) {
    for (let t = 0; t < i.length; t++) i[t] *= e;
    return i;
  }
  function Wo(i, e) {
    let t = 1 / Math.tanh(e);
    for (let n = 0; n < i.length; n++) i[n] = Math.tanh(i[n] * e) * t;
    return i;
  }
  function em(i, e, t, n) {
    let s = Math.min(i.length >> 1, Math.round(t * e)),
      o = Math.min(i.length >> 1, Math.round(n * e));
    for (let r = 0; r < s; r++) i[r] *= r / s;
    for (let r = 0; r < o; r++) {
      let a = r / o;
      i[i.length - 1 - r] *= a * a;
    }
    return i;
  }
  function at(i, e, t, n, s = {}) {
    let o = Qn(i, t, e);
    s.hp && tn(o, "hp", s.hp, 0.707, i),
      s.lp && tn(o, "lp", s.lp, 0.707, i),
      s.bp && tn(o, "bp", s.bp, s.q || 1, i),
      lo(o, i, co(n, s.att || 0));
    let r = Qb(o);
    return r > 0 ? ml(o, 1 / r) : o;
  }
  function ei(i, e, t, n, s, o, r = 6e-4) {
    let a = St(i, e),
      l = 0;
    for (let c = 0; c < a.length; c++) {
      let u = c / i;
      (l += (vt * (n + (t - n) * Math.exp(-u / s))) / i),
        (a[c] = Math.sin(l) * Math.exp(-u / o) * (1 - Math.exp(-u / r)));
    }
    return a;
  }
  function jc(i, e, t, n, s = !0) {
    let o = St(i, e),
      r = 0,
      a = o.length;
    for (let l = 0; l < a; l++) {
      let c = l / a;
      (r += (vt * t * Math.pow(n / t, c)) / i),
        (o[l] = Math.sin(r) * (s ? Math.sin(Math.PI * c) : 1));
    }
    return o;
  }
  function dn(i, e, t, n) {
    let s = St(i, e);
    for (let [r, a, l] of t) {
      if (r > i * 0.46) continue;
      let c = (vt * r) / i,
        u = n ? n() * vt : 0,
        h = Math.exp(-1 / (a * i)),
        f = l;
      for (
        let p = 0;
        p < s.length &&
        ((s[p] += Math.sin(c * p + u) * f), (f *= h), !(f < 1e-5));
        p++
      );
    }
    let o = Math.min(s.length, Math.round(4e-4 * i));
    for (let r = 0; r < o; r++) s[r] *= r / o;
    return s;
  }
  function Jc(i, e, t, n, s = {}) {
    let o = St(i, t),
      r = s.from || 0,
      a = s.fall || 1;
    for (let l = 0; l < n; l++) {
      let c = r + (t - r - 0.02) * Math.pow(e(), a),
        u = Math.round(c * i),
        h = Math.round(Xt(e, s.minLen || 0.001, s.maxLen || 0.004) * i),
        f = Xt(e, 0.2, 1) * (s.ampFall ? Math.exp(-c / s.ampFall) : 1);
      for (let p = 0; p < h && u + p < o.length; p++)
        o[u + p] += (e() * 2 - 1) * f * Math.exp((-4 * p) / h);
    }
    return (
      s.hp && tn(o, "hp", s.hp, 0.707, i),
      s.lp && tn(o, "lp", s.lp, 0.707, i),
      s.bp && tn(o, "bp", s.bp, s.q || 1, i),
      o
    );
  }
  function Rv(i, e, t) {
    let n = i.length - e,
      s = new Float32Array(e);
    s.set(i.subarray(0, e));
    for (let o = 0; o < n; o++) {
      let r = (o + 0.5) / n,
        a = t ? Math.sin((r * Math.PI) / 2) : r,
        l = t ? Math.cos((r * Math.PI) / 2) : 1 - r;
      s[o] = i[o] * a + i[e + o] * l;
    }
    return s;
  }
  function Zc(i, e, t, n, s = 0.4) {
    let o = Qn(i, e + s, t);
    return n(o), Rv(o, Math.round(i * e), !0);
  }
  function Q1(i, ...e) {
    let t = new Float32Array(i);
    for (let [n, s] of e)
      for (let o = 0; o < Math.min(i, n.length); o++) t[o] += n[o] * s;
    return t;
  }
  function KR(i, e, t) {
    let n = [1, 0.955, 1.045, 0.985][t & 3],
      s = [1, 1.12, 0.9, 1.05][t & 3],
      o = St(i, 0.32);
    Se(o, at(i, e, 0.012, 0.0011, { hp: 2600 * s }), 0, 2.6, i),
      Se(o, at(i, e, 0.02, 0.003, { hp: 1200, lp: 8e3 }), 2e-4, 1.2, i),
      Se(o, ei(i, 0.11, 160 * n, 45 * n, 0.024, 0.03, 0.003), 0, 0.62, i),
      Se(
        o,
        at(i, e, 0.22, 0.03, { hp: 300 * n, lp: 2500 * n * s, att: 0.0012 }),
        0,
        1.5,
        i,
      ),
      Se(
        o,
        at(i, e, 0.09, 0.016, { bp: 760 * n, q: 2.2, att: 0.001 }),
        0,
        0.9,
        i,
      ),
      Se(o, at(i, e, 0.16, 0.04, { hp: 4800 }), 0.001, 0.34, i);
    let r = 0.035 + (t - 1.5) * 0.0015;
    return (
      Se(
        o,
        dn(
          i,
          0.05,
          [
            [2150 * n, 0.007, 1],
            [3420 * n, 0.006, 0.7],
            [5230, 0.004, 0.5],
            [880 * n, 0.012, 0.5],
          ],
          e,
        ),
        r,
        0.26,
        i,
      ),
      Se(o, at(i, e, 0.012, 0.002, { bp: 3100, q: 1.2 }), r, 0.3, i),
      Se(
        o,
        dn(
          i,
          0.05,
          [
            [1780 * n, 0.008, 1],
            [2890 * n, 0.006, 0.6],
            [640 * n, 0.02, 0.5],
          ],
          e,
        ),
        r + 0.027,
        0.17,
        i,
      ),
      Se(o, at(i, e, 0.01, 0.002, { bp: 2400, q: 1.2 }), r + 0.027, 0.16, i),
      Se(
        o,
        dn(
          i,
          0.2,
          [
            [712 * n, 0.05, 1],
            [1466 * n, 0.03, 0.4],
          ],
          e,
        ),
        r + 0.03,
        0.035,
        i,
      ),
      Wo(ml(o, 0.46), 1.5)
    );
  }
  function QR(i, e, t) {
    let n = (o) => {
        let r = ao(o),
          a = St(i, 1.55),
          l = t
            ? [
                [0.058, 0.5, 4200],
                [0.097, 0.4, 3300],
                [0.139, 0.28, 2500],
                [0.176, 0.2, 1900],
                [0.262, 0.1, 1300],
              ]
            : [
                [0.066, 0.52, 4600],
                [0.088, 0.34, 3600],
                [0.124, 0.3, 2700],
                [0.169, 0.22, 2e3],
                [0.231, 0.12, 1400],
              ];
        for (let [h, f, p] of l)
          Se(
            a,
            at(i, r, 0.09, 0.016, { hp: 420, lp: p }),
            h + Xt(r, -0.004, 0.004),
            f * Xt(r, 0.8, 1.1),
            i,
          );
        let c = Qn(i, 1.5, r);
        di(c, "lp", Vo(3400, 380, 0.6), 0.6, i),
          tn(c, "hp", 130, 0.7, i),
          Se(a, lo(c, i, co(0.3, 0.05)), 0.03, 0.55, i);
        let u = Qn(i, 1.2, r);
        return (
          tn(u, "lp", 150, 0.7, i),
          Se(a, lo(u, i, co(0.26, 0.03)), 0.02, 0.9, i),
          a
        );
      },
      s = Math.floor(e() * 1e9);
    return [n(s), n(s + 77)];
  }
  function* e8(i, e, t) {
    let n = function* (o) {
        let r = ao(o),
          a = St(i, 2.3),
          l = Qn(i, 2.25, r);
        di(l, "lp", Vo(2400, 260, 0.5), 0.7, i),
          Se(a, lo(l, i, co(0.42, 0.012)), 0.008, 0.6, i);
        for (let [u, h] of [
          [54, 1],
          [81, 0.8],
          [117, 0.6],
          [163, 0.45],
          [228, 0.3],
        ]) {
          let f = Qn(i, 2.2, r);
          tn(f, "bp", u * (t ? 1.06 : 1), 9, i),
            Se(a, lo(f, i, co(0.5, 0.02)), 0.01, h * 2.4, i),
            yield;
        }
        let c = t ? 0.051 : 0.044;
        for (let u = 1; u < 9; u++)
          Se(
            a,
            at(i, r, 0.05, 0.009, { hp: 500, lp: 3800 / (1 + u * 0.35) }),
            c * u + Xt(r, -0.003, 0.003),
            0.42 * Math.pow(0.74, u),
            i,
          );
        return a;
      },
      s = Math.floor(e() * 1e9);
    return [yield* n(s), yield* n(s + 131)];
  }
  function t8(i, e) {
    let t = St(i, 0.13);
    return (
      Se(
        t,
        dn(
          i,
          0.05,
          [
            [2840, 0.004, 1],
            [4130, 0.004, 0.7],
            [6320, 0.003, 0.5],
            [1210, 0.008, 0.4],
          ],
          e,
        ),
        0,
        0.7,
        i,
      ),
      Se(t, at(i, e, 0.006, 0.0012, { hp: 2e3 }), 0, 0.6, i),
      Se(
        t,
        dn(
          i,
          0.08,
          [
            [930, 0.018, 1],
            [1870, 0.012, 0.5],
          ],
          e,
        ),
        0.016,
        0.16,
        i,
      ),
      Se(t, at(i, e, 0.004, 0.001, { hp: 3e3 }), 0.018, 0.2, i),
      t
    );
  }
  function e_(i, e, t, n, s, o) {
    let r = Qn(i, t, e);
    di(r, "bp", Vo(n, s), 1.6, i);
    let a = 0.5,
      l = 0.5;
    for (let c = 0; c < r.length; c++) {
      c % Math.round(i / o) === 0 && (l = 0.25 + e() * 0.75),
        (a += (l - a) * 0.02);
      let u = c / r.length;
      r[c] *= a * Math.sin(Math.PI * Math.pow(u, 0.7));
    }
    return r;
  }
  function n8(i, e) {
    let t = St(i, 0.46);
    return (
      Se(
        t,
        dn(
          i,
          0.03,
          [
            [3300, 0.004, 1],
            [5100, 0.003, 0.6],
          ],
          e,
        ),
        0.004,
        0.45,
        i,
      ),
      Se(t, at(i, e, 0.005, 0.001, { hp: 2500 }), 0.004, 0.35, i),
      Se(t, e_(i, e, 0.17, 1700, 3400, 190), 0.03, 0.5, i),
      Se(t, at(i, e, 0.06, 0.012, { lp: 950 }), 0.2, 0.8, i),
      Se(
        t,
        dn(
          i,
          0.12,
          [
            [415, 0.03, 1],
            [1140, 0.018, 0.6],
            [2290, 0.01, 0.4],
            [3470, 0.006, 0.25],
          ],
          e,
        ),
        0.2,
        0.42,
        i,
      ),
      Se(t, at(i, e, 0.08, 0.02, { bp: 2600, q: 0.8 }), 0.215, 0.14, i),
      t
    );
  }
  function i8(i, e) {
    let t = St(i, 0.5);
    return (
      Se(t, e_(i, e, 0.14, 1250, 2900, 240), 0, 0.55, i),
      Se(
        t,
        dn(
          i,
          0.03,
          [
            [2600, 0.004, 1],
            [4300, 0.003, 0.5],
          ],
          e,
        ),
        0.05,
        0.2,
        i,
      ),
      Se(t, ei(i, 0.07, 190, 88, 0.02, 0.022), 0.15, 0.8, i),
      Se(t, at(i, e, 0.05, 0.008, { lp: 1600 }), 0.15, 0.8, i),
      Se(
        t,
        dn(
          i,
          0.1,
          [
            [655, 0.024, 1],
            [1710, 0.014, 0.6],
            [3120, 0.008, 0.4],
          ],
          e,
        ),
        0.15,
        0.4,
        i,
      ),
      Se(
        t,
        dn(
          i,
          0.04,
          [
            [3650, 0.005, 1],
            [5600, 0.004, 0.6],
            [2100, 0.007, 0.5],
          ],
          e,
        ),
        0.187,
        0.42,
        i,
      ),
      Se(t, at(i, e, 0.005, 0.001, { hp: 3e3 }), 0.187, 0.36, i),
      t
    );
  }
  function s8(i, e) {
    let t = St(i, 0.38);
    Se(
      t,
      dn(
        i,
        0.03,
        [
          [2900, 0.005, 1],
          [4600, 0.004, 0.6],
        ],
        e,
      ),
      0,
      0.3,
      i,
    ),
      Se(t, at(i, e, 0.03, 0.01, { bp: 2200, q: 0.8 }), 0.004, 0.25, i);
    let n = 0.03;
    return (
      Se(t, at(i, e, 0.02, 0.004, { hp: 1200 }), n, 1, i),
      Se(t, ei(i, 0.06, 230, 105, 0.012, 0.018), n, 0.8, i),
      Se(
        t,
        dn(
          i,
          0.15,
          [
            [1310, 0.03, 1],
            [2460, 0.024, 0.8],
            [3920, 0.016, 0.6],
            [5640, 0.01, 0.45],
            [7900, 0.006, 0.3],
          ],
          e,
        ),
        n,
        0.36,
        i,
      ),
      Se(
        t,
        dn(
          i,
          0.3,
          [
            [722, 0.075, 1],
            [1451, 0.05, 0.35],
          ],
          e,
        ),
        n + 0.002,
        0.1,
        i,
      ),
      Wo(t, 1.3)
    );
  }
  function o8(i, e, t) {
    let n = St(i, 0.55),
      s = [1, 1.09, 0.93][t % 3],
      o = 0,
      r = 1,
      a = 2 + (t !== 1 ? 1 : 0);
    for (let l = 0; l < a; l++) {
      let c = s * Xt(e, 0.96, 1.05);
      Se(
        n,
        dn(
          i,
          0.22,
          [
            [4180 * c, Xt(e, 0.03, 0.055), 1],
            [6830 * c, 0.03, 0.7],
            [9760 * c, 0.02, 0.5],
            [11900 * c, 0.012, 0.3],
            [2470 * c, 0.012, 0.3],
          ],
          e,
        ),
        o,
        r * 0.5,
        i,
      ),
        Se(n, at(i, e, 0.004, 8e-4, { hp: 3500 }), o, r * 0.5, i),
        (o += Xt(e, 0.085, 0.15) * (l ? 0.75 : 1)),
        (r *= Xt(e, 0.45, 0.62));
    }
    return n;
  }
  function r8(i, e, t) {
    let n = St(i, 0.3),
      s = [1, 1.07, 0.94, 1.03][t & 3];
    Se(n, ei(i, 0.06, 112 * s, 58 * s, 0.018, 0.02, 0.002), 0, 0.75, i),
      Se(n, at(i, e, 0.06, 0.016, { lp: 720 * s }), 0, 0.9, i),
      Se(
        n,
        at(i, e, 0.1, 0.028, { bp: 2500 * s, q: 0.7, att: 0.004 }),
        0.012,
        0.22,
        i,
      );
    let o = at(i, e, 0.2, 0.05, { hp: 3800, att: 0.01 }),
      r = 1;
    for (let a = 0; a < o.length; a++)
      a % 70 === 0 && (r = 0.3 + e() * 0.7), (o[a] *= r);
    return Se(n, o, 0.02, 0.16, i), n;
  }
  function t_(i, e, t, n) {
    let s = St(i, t),
      o = Qn(i, t * 0.9, e);
    di(o, "bp", Vo(1500, 520), 0.8, i),
      Se(s, lo(o, i, co(0.085 * n, 0.007)), 0, 0.9, i),
      Se(
        s,
        at(i, e, t * 0.8, 0.07 * n, { hp: 3e3, att: 0.012 }),
        0.01,
        0.25,
        i,
      );
    let r = Math.round(5 * n);
    for (let a = 0; a < r; a++) {
      let l = Xt(e, 500, 1700);
      Se(
        s,
        jc(i, Xt(e, 0.008, 0.02), l, l * Xt(e, 1.3, 1.9)),
        Xt(e, 0.03, t * 0.6),
        Xt(e, 0.1, 0.3),
        i,
      );
    }
    return s;
  }
  function a8(i, e, t) {
    let n = t_(i, e, 0.46, 1 + t * 0.08);
    return Se(n, ei(i, 0.06, 100, 55, 0.02, 0.02, 0.002), 0, 0.5, i), n;
  }
  function l8(i, e, t) {
    let n = St(i, 0.38),
      s = [1, 1.08, 0.92][t % 3];
    return (
      Se(n, ei(i, 0.06, 120, 62, 0.018, 0.02, 0.002), 0, 0.6, i),
      Se(n, at(i, e, 0.04, 0.008, { lp: 2400 }), 0, 0.6, i),
      Se(
        n,
        dn(
          i,
          0.36,
          [
            [178 * s, 0.09, 1],
            [412 * s, 0.075, 0.8],
            [733 * s, 0.06, 0.55],
            [1214 * s, 0.045, 0.4],
            [1958 * s, 0.03, 0.3],
            [3130 * s, 0.016, 0.18],
          ],
          e,
        ),
        0.001,
        0.3,
        i,
      ),
      Se(
        n,
        at(i, e, 0.08, 0.02, { bp: 3e3, q: 0.8, att: 0.003 }),
        0.01,
        0.1,
        i,
      ),
      n
    );
  }
  function c8(i, e) {
    let t = St(i, 0.45);
    Se(t, ei(i, 0.14, 124, 44, 0.03, 0.045, 0.002), 0, 1, i),
      Se(t, at(i, e, 0.14, 0.035, { lp: 520 }), 0, 1, i),
      Se(
        t,
        at(i, e, 0.2, 0.06, { bp: 1500, q: 0.7, att: 0.01 }),
        0.01,
        0.16,
        i,
      );
    for (let n of [0.022, 0.05, 0.088])
      Se(
        t,
        at(i, e, 0.012, 0.003, { bp: Xt(e, 2200, 4200), q: 2 }),
        n,
        Xt(e, 0.1, 0.22),
        i,
      );
    return (
      Se(t, at(i, e, 0.2, 0.05, { hp: 3500, att: 0.01 }), 0.015, 0.1, i),
      Wo(t, 1.2)
    );
  }
  function u8(i, e) {
    let t = St(i, 0.26);
    return (
      Se(t, at(i, e, 0.2, 0.05, { bp: 900, q: 0.7, att: 0.02 }), 0, 0.6, i),
      Se(
        t,
        at(i, e, 0.1, 0.025, { bp: 2600, q: 0.8, att: 0.004 }),
        0.005,
        0.35,
        i,
      ),
      Se(t, ei(i, 0.05, 95, 60, 0.02, 0.018, 0.003), 0, 0.4, i),
      t
    );
  }
  function h8(i, e) {
    let t = St(i, 0.5);
    return (
      Se(t, ei(i, 0.25, 92, 38, 0.04, 0.06, 0.0015), 0, 1.1, i),
      Se(t, at(i, e, 0.2, 0.04, { lp: 320 }), 0, 1.2, i),
      Se(t, at(i, e, 0.06, 0.01, { bp: 820, q: 1 }), 0, 0.55, i),
      Se(t, at(i, e, 0.03, 0.004, { hp: 1800, lp: 5e3 }), 0, 0.2, i),
      Wo(t, 1.6)
    );
  }
  function f8(i) {
    let e = St(i, 2.4);
    for (let t = 0; t < e.length; t++) {
      let n = t / i;
      e[t] =
        (Math.sin(vt * 3150 * n) +
          0.7 * Math.sin(vt * 4013 * n + 1) +
          0.35 * Math.sin(vt * 5310 * n + 2)) *
        (1 - Math.exp(-n / 0.12)) *
        Math.exp(-n / 0.55);
    }
    return e;
  }
  function d8(i, e, t) {
    let n = St(i, 0.5),
      s = [640, 880, 745][t % 3] * Xt(e, 0.97, 1.03);
    return (
      Se(n, at(i, e, 0.015, 0.003, { hp: 1500 }), 0, 1, i),
      Se(n, at(i, e, 0.04, 0.008, { lp: 1800 }), 0, 0.6, i),
      Se(
        n,
        dn(
          i,
          0.48,
          [1, 1.58, 2.24, 2.92, 3.71, 4.93, 6.31, 8.1].map((r, a) => [
            s * r,
            0.13 / (1 + a * 0.55),
            1 / (1 + a * 0.5),
          ]),
          e,
        ),
        5e-4,
        0.42,
        i,
      ),
      n
    );
  }
  function p8(i, e, t) {
    let n = St(i, 0.36),
      s = [1, 1.1, 0.9][t % 3];
    return (
      Se(n, at(i, e, 0.06, 0.013, { lp: 950 * s }), 0, 1.1, i),
      Se(n, ei(i, 0.05, 150 * s, 70, 0.012, 0.016), 0, 0.6, i),
      Se(n, at(i, e, 0.012, 0.002, { hp: 2e3 }), 0, 0.6, i),
      Se(n, at(i, e, 0.12, 0.024, { bp: 3500 * s, q: 0.7 }), 0.003, 0.3, i),
      Se(
        n,
        Jc(i, e, 0.34, 16, { from: 0.03, fall: 1.8, hp: 1800, ampFall: 0.1 }),
        0,
        0.35,
        i,
      ),
      n
    );
  }
  function m8(i, e, t) {
    let n = St(i, 0.26),
      s = t ? 1.14 : 1;
    return (
      Se(
        n,
        dn(
          i,
          0.2,
          [
            [238 * s, 0.03, 1],
            [512 * s, 0.022, 0.8],
            [893 * s, 0.016, 0.6],
            [1410 * s, 0.01, 0.4],
          ],
          e,
        ),
        0,
        0.6,
        i,
      ),
      Se(n, at(i, e, 0.03, 0.006, { lp: 2100 }), 0, 0.8, i),
      Se(n, at(i, e, 0.01, 0.002, { hp: 3e3 }), 0, 0.5, i),
      Se(
        n,
        Jc(i, e, 0.2, 6, { from: 0.01, fall: 2, bp: 2600, q: 1.5 }),
        0,
        0.3,
        i,
      ),
      n
    );
  }
  function g8(i, e, t) {
    let n = t_(i, e, 0.5, 0.8 + t * 0.2);
    return Se(n, jc(i, 0.035, 420, 1150), 0, 0.5, i), n;
  }
  function v8(i, e, t) {
    let n = St(i, 0.3),
      s = [1, 1.12, 0.9][t % 3];
    Se(n, at(i, e, 0.03, 0.007, { hp: 4e3 }), 0, 0.9, i),
      Se(
        n,
        dn(
          i,
          0.12,
          [
            [2920 * s, 0.022, 1],
            [4730 * s, 0.018, 0.8],
            [7310 * s, 0.012, 0.6],
            [1180 * s, 0.03, 0.5],
          ],
          e,
        ),
        0,
        0.4,
        i,
      ),
      Se(n, at(i, e, 0.05, 0.012, { bp: 320 * s, q: 1.5 }), 0, 0.9, i);
    let o = Qn(i, 0.06, e);
    tn(o, "bp", 2400, 1, i);
    for (let r = 0; r < o.length; r++) {
      let a = r / i;
      o[r] *= (Math.sin(vt * 118 * a) > 0.2 ? 1 : 0.1) * Math.exp(-a / 0.02);
    }
    return (
      Se(n, o, 0.004, 0.5, i),
      Se(
        n,
        Jc(i, e, 0.28, 10, { from: 0.02, fall: 1.6, hp: 5e3, ampFall: 0.08 }),
        0,
        0.3,
        i,
      ),
      n
    );
  }
  function x8(i, e) {
    let t = St(i, 0.45);
    Se(t, at(i, e, 0.01, 0.002, { hp: 2500 }), 0, 1, i);
    for (let n = 0; n < 9; n++) {
      let s = Xt(e, 3200, 9500);
      Se(
        t,
        dn(
          i,
          0.1,
          [
            [s, Xt(e, 0.01, 0.03), 1],
            [s * 1.47, 0.01, 0.5],
          ],
          e,
        ),
        Math.pow(e(), 2) * 0.3,
        Xt(e, 0.1, 0.35),
        i,
      );
    }
    return t;
  }
  function y8(i, e, t) {
    let n = St(i, 0.75),
      s = [3300, 2700, 3900][t % 3],
      o = [820, 1100, 700][t % 3],
      r = 0,
      a = Qn(i, 0.75, e);
    for (let l = 0; l < n.length; l++) {
      let c = l / i,
        u = o + (s - o) * Math.exp(-c / 0.16),
        h = 1 + 0.035 * Math.sin(vt * (18 + 30 * c) * c);
      (r += (vt * u * h) / i),
        (n[l] =
          (Math.sin(r) + 0.3 * Math.sin(2 * r)) *
          (1 - Math.exp(-c / 0.004)) *
          Math.exp(-c / 0.19));
    }
    return (
      di(a, "bp", (l) => o + (s - o) * Math.exp((-l * 0.75) / 0.16), 6, i),
      Se(n, lo(a, i, co(0.15, 0.003)), 0, 1.6, i),
      Se(n, at(i, e, 0.01, 0.002, { hp: 2500 }), 0, 0.7, i),
      n
    );
  }
  function b8(i, e, t) {
    let n = St(i, 0.3),
      s = Qn(i, 0.28, e),
      o = [5200, 4300, 6100][t % 3],
      r = [1300, 1e3, 1700][t % 3];
    di(s, "bp", Vo(o, r, 0.8), 3.5, i);
    for (let l = 0; l < s.length; l++) {
      let c = (l / i - 0.05) / (l / i < 0.05 ? 0.018 : 0.05);
      s[l] *= Math.exp(-c * c);
    }
    Se(n, s, 0, 1, i),
      Se(n, at(i, e, 0.006, 8e-4, { hp: 3e3 }), 0.048, 0.25, i);
    let a = jc(i, 0.2, o * 0.5, r * 0.6);
    return Se(n, a, 0, 0.03, i), n;
  }
  var Tv = (i, e) => Math.round(i * e) / e;
  function* _8(i, e) {
    let n = i * 2,
      s = new Float32Array(n),
      o = [
        [184, 2.5],
        [207.5, 3.5],
        [233, 2],
        [258.5, 4.5],
      ];
    for (let [l, c] of o) {
      let u = Tv(l, 2),
        h = Tv(c, 2),
        f = e() * vt,
        p = e() * vt;
      for (let d = 0; d < n; d++) {
        let v = d / i,
          g = vt * u * v + f;
        s[d] +=
          (Math.sin(g) +
            0.5 * Math.sin(2 * g + 1) +
            0.3 * Math.sin(3 * g + 2) +
            0.16 * Math.sin(4 * g) +
            0.08 * Math.sin(6 * g)) *
          (0.72 + 0.28 * Math.sin(vt * h * v + p)) *
          0.25;
      }
      yield;
    }
    let r = Zc(
        i,
        2,
        e,
        (l) => {
          tn(l, "hp", 1100, 0.7, i), tn(l, "lp", 5200, 0.7, i);
        },
        0.25,
      ),
      a = Tv(46, 2);
    for (let l = 0; l < n; l++)
      s[l] += r[l] * (0.55 + 0.45 * Math.sin((vt * a * l) / i)) * 0.5;
    return s;
  }
  function M8(i, e) {
    let n = i * 2,
      s = new Float32Array(n);
    for (let r = 0; r < n; r++) {
      let a = r / i,
        l = 1.1 * Math.sin(vt * 0.5 * a) + 0.5 * Math.sin(vt * 1.5 * a + 1),
        c = vt * 310 * a + l,
        u = 0.7 + 0.3 * Math.sin(vt * 1.5 * a),
        h =
          (Math.sin(c) +
            0.45 * Math.sin(2 * c + l) +
            0.2 * Math.sin(4 * c + 0.5)) *
          0.3 *
          u,
        f = vt * 62 * a;
      (h +=
        (Math.sin(f) +
          0.5 * Math.sin(2 * f) +
          0.33 * Math.sin(3 * f) +
          0.2 * Math.sin(5 * f)) *
        0.28),
        (s[r] = h);
    }
    let o = Zc(
      i,
      2,
      e,
      (r) => {
        tn(r, "hp", 2800, 0.7, i), tn(r, "lp", 7e3, 0.7, i);
      },
      0.25,
    );
    for (let r = 0; r < n; r++)
      s[r] += o[r] * 0.12 * (0.6 + 0.4 * Math.sin((vt * 1.5 * r) / i + 2));
    return s;
  }
  function w8(i, e) {
    let n = i * 2,
      s = new Float32Array(n);
    for (let r = 0; r < n; r++) {
      let a = r / i,
        l = vt * 50 * a;
      s[r] =
        (Math.sin(l) * 0.5 +
          Math.sin(2 * l + 0.4) +
          0.5 * Math.sin(3 * l + 1) +
          0.3 * Math.sin(4 * l) +
          0.22 * Math.sin(6 * l + 2) +
          0.12 * Math.sin(10 * l)) *
          0.3 *
          (0.9 + 0.1 * Math.sin(vt * 0.5 * a)) +
        Math.sin(vt * 4100 * a) * 0.012 * (0.6 + 0.4 * Math.sin(vt * 1 * a)) +
        Math.sin(vt * 1250 * a + 0.6 * Math.sin(vt * 2 * a)) * 0.02;
    }
    let o = Zc(i, 2, e, (r) => tn(r, "bp", 2100, 1.2, i), 0.25);
    for (let r = 0; r < n; r++)
      s[r] +=
        o[r] * 0.16 * Math.pow(0.5 + 0.5 * Math.sin((vt * 100 * r) / i), 3);
    return s;
  }
  function E8(i, e, t) {
    let n = St(i, 0.3),
      s = t ? 1.07 : 1,
      o = 0;
    Se(n, at(i, e, 0.008, 0.0012, { hp: 3200 }), 0, 1.1, i);
    let r = St(i, 0.12);
    for (let a = 0; a < r.length; a++) {
      let l = a / i,
        c = (380 + 620 * Math.exp(-l / 0.018)) * s;
      o += c / i;
      let u = 2 * (o - Math.floor(o)) - 1;
      r[a] =
        (u + 0.5 * Math.sign(Math.sin(vt * o * 2.02))) * Math.exp(-l / 0.024);
    }
    return (
      tn(r, "bp", 1500 * s, 0.9, i),
      Se(n, r, 0, 1.5, i),
      Se(n, at(i, e, 0.08, 0.014, { bp: 2400 * s, q: 1.4 }), 0, 0.7, i),
      Se(n, ei(i, 0.05, 240, 120, 0.012, 0.014), 0, 0.5, i),
      Se(
        n,
        dn(
          i,
          0.05,
          [
            [3400 * s, 0.006, 1],
            [5200, 0.005, 0.6],
            [1900, 0.008, 0.5],
          ],
          e,
        ),
        0.021,
        0.2,
        i,
      ),
      Se(n, at(i, e, 0.15, 0.04, { hp: 6e3 }), 0.002, 0.1, i),
      Wo(ml(n, 0.6), 1.6)
    );
  }
  function S8(i, e, t) {
    let n = St(i, 0.48),
      s = t ? 0.94 : 1;
    return (
      Se(n, at(i, e, 0.012, 0.002, { hp: 1500, lp: 6e3 }), 0, 0.7, i),
      Se(n, ei(i, 0.3, 112 * s, 37 * s, 0.035, 0.07), 0, 1.4, i),
      Se(n, at(i, e, 0.3, 0.045, { hp: 90, lp: 900 * s }), 0, 1.2, i),
      Se(n, at(i, e, 0.12, 0.024, { bp: 420 * s, q: 1.6 }), 0, 1.2, i),
      Se(
        n,
        dn(
          i,
          0.12,
          [
            [310 * s, 0.03, 1],
            [642 * s, 0.022, 0.7],
            [985 * s, 0.016, 0.5],
            [2200, 0.006, 0.3],
          ],
          e,
        ),
        0.055,
        0.3,
        i,
      ),
      Se(n, at(i, e, 0.02, 0.004, { bp: 1800, q: 1 }), 0.055, 0.25, i),
      Wo(ml(n, 0.42), 1.8)
    );
  }
  function T8(i, e, t) {
    let n = St(i, 0.42),
      s = [1, 1.07, 0.93][t % 3];
    Se(n, jc(i, 0.035, 920 * s, 610 * s), 0, 0.06, i);
    let o = 0.03;
    return (
      Se(n, ei(i, 0.2, 84 * s, 41, 0.03, 0.05, 0.002), o, 1.1, i),
      Se(n, at(i, e, 0.12, 0.03, { lp: 360 }), o, 1.1, i),
      Se(n, at(i, e, 0.03, 0.006, { lp: 2600, hp: 500 }), o, 0.4, i),
      Se(
        n,
        dn(
          i,
          0.12,
          [
            [522 * s, 0.026, 1],
            [1133 * s, 0.02, 0.7],
            [1871 * s, 0.014, 0.5],
            [3040 * s, 0.008, 0.3],
          ],
          e,
        ),
        o,
        0.2,
        i,
      ),
      Se(n, at(i, e, 0.14, 0.04, { hp: 3e3, att: 0.006 }), o + 0.01, 0.06, i),
      Wo(n, 1.5)
    );
  }
  function A8(i, e) {
    let t = St(i, 1.5),
      n = [0, 0, 0, 0];
    Se(t, at(i, e, 0.02, 0.004, { hp: 2500 }), 0, 0.9, i);
    let s = [184, 207, 233, 258];
    for (let a = 0; a < Math.round(1.1 * i); a++) {
      let l = a / i,
        c = Math.pow(0.16, l / 1) * (1 + 0.06 * Math.sin(vt * (9 - 5 * l) * l)),
        u = 0;
      for (let f = 0; f < 4; f++)
        (n[f] += (vt * s[f] * c) / i),
          (u +=
            Math.sin(n[f]) +
            0.5 * Math.sin(2 * n[f]) +
            0.3 * Math.sin(3 * n[f]));
      let h = 0.6 + 0.4 * Math.sign(Math.sin(vt * (26 - 16 * l) * l));
      t[a] += u * 0.16 * h * Math.exp(-l / 0.55) * (1 - Math.exp(-l / 0.01));
    }
    let o = Qn(i, 1, e);
    di(o, "bp", Vo(3200, 500), 1, i),
      Se(t, lo(o, i, co(0.35, 0.01)), 0, 0.3, i);
    let r = 0.72;
    return (
      Se(t, at(i, e, 0.2, 0.035, { lp: 3e3 }), r, 1, i),
      Se(t, ei(i, 0.12, 130, 55, 0.02, 0.035), r, 0.8, i),
      Se(
        t,
        dn(
          i,
          0.4,
          [
            [705, 0.07, 1],
            [1490, 0.05, 0.7],
            [2610, 0.035, 0.5],
            [4020, 0.02, 0.3],
          ],
          e,
        ),
        r,
        0.28,
        i,
      ),
      Se(
        t,
        Jc(i, e, 0.7, 26, {
          from: 0.02,
          fall: 1.7,
          hp: 1500,
          ampFall: 0.2,
          maxLen: 0.008,
        }),
        r,
        0.5,
        i,
      ),
      Se(
        t,
        dn(
          i,
          0.2,
          [
            [1900, 0.03, 1],
            [3350, 0.02, 0.6],
          ],
          e,
        ),
        r + 0.19,
        0.14,
        i,
      ),
      Wo(t, 1.4)
    );
  }
  function R8(i, e) {
    let t = St(i, 1.9),
      n = 0,
      s = 0,
      o = St(i, 1.3);
    for (let r = 0; r < o.length; r++) {
      let a = r / i,
        l = 30 + 112 * Math.pow(1 - a / 1.3, 1.6);
      (n += l / i),
        (s += (180 + 1050 * Math.exp(-a / 0.3)) / i),
        (o[r] =
          (2 * (n - Math.floor(n)) - 1) *
            (1 - Math.exp(-a / 0.02)) *
            Math.pow(1 - a / 1.3, 0.7) +
          Math.sin(vt * s) * 0.25 * Math.exp(-a / 0.4));
    }
    di(o, "lp", Vo(1100, 160), 2.5, i),
      Se(t, o, 0, 0.55, i),
      Se(t, at(i, e, 0.03, 0.006, { hp: 2e3 }), 0, 0.5, i);
    for (let [r, a, l] of [
      [0.62, 1, 1],
      [0.84, 0.75, 1.22],
      [0.98, 0.5, 0.86],
      [1.17, 0.42, 1.4],
      [1.33, 0.22, 1.1],
    ])
      Se(t, ei(i, 0.1, 105 * l, 48, 0.02, 0.035), r, a * 0.9, i),
        Se(t, at(i, e, 0.08, 0.016, { lp: 2400 }), r, a * 0.8, i),
        Se(
          t,
          dn(
            i,
            0.3,
            [
              [388 * l, 0.07, 1],
              [861 * l, 0.05, 0.7],
              [1540 * l, 0.035, 0.5],
              [2750 * l, 0.02, 0.35],
            ],
            e,
          ),
          r,
          a * 0.3,
          i,
        );
    return (
      Se(
        t,
        Jc(i, e, 1, 22, {
          from: 0,
          fall: 1.2,
          hp: 1800,
          ampFall: 0.4,
          maxLen: 0.007,
        }),
        0.62,
        0.3,
        i,
      ),
      Wo(ml(t, 0.55), 1.5)
    );
  }
  function C8(i, e, t) {
    let n = St(i, 0.52),
      s = t ? 622 : 1320,
      o = s * 1.4142,
      r = 0,
      a = (l, c, u, h) => {
        let f = Math.round(c * i),
          p = Math.round(l * i);
        for (let d = 0; d < f; d++) {
          let v = d / f,
            g = d / i;
          r += (vt * u * (1 + h * v)) / i;
          let x = Math.sin(
            r + 1.6 * Math.sin(r * 0.25) + 0.4 * Math.sin(vt * 71 * g),
          );
          n[p + d] +=
            Math.tanh(x * 2.2) *
            Math.min(1, d / (0.004 * i), (f - d) / (0.012 * i));
        }
      };
    return (
      a(0, 0.09, s, 0),
      a(0.12, 0.17, o, -0.05),
      t && a(0.3, 0.2, s * 0.5, 0.5),
      tn(n, "bp", t ? 1100 : 2100, 0.6, i),
      Se(n, at(i, e, 0.4, 0.2, { hp: 4e3, att: 0.02 }), 0, 0.03, i),
      n
    );
  }
  function P8(i, e, t) {
    let n = St(i, 0.6),
      s = n.length,
      o = 0.55,
      r = 0,
      a = 0;
    for (let c = 0; c < s; c++) {
      let u = c / i,
        h = Math.min(1, u / o),
        f = Math.pow(h, 1.4) * (u < o ? 1 : Math.exp(-(u - o) / 0.008));
      if (t) {
        (r += (170 + 380 * h * h) / i), (a += (680 + 900 * h) / i);
        let p = 2 * (r - Math.floor(r)) - 1;
        n[c] =
          (p * (0.7 + 0.3 * Math.sin(vt * 38 * u)) + 0.35 * Math.sin(vt * a)) *
          f;
      } else
        (r += (620 + 1900 * h * h * h) / i),
          (a += ((1240 + 3800 * h * h * h) * 1.003) / i),
          (n[c] =
            (Math.sin(vt * r) +
              0.4 * Math.sin(vt * a) +
              0.25 * Math.sign(Math.sin(vt * r * 0.5))) *
            f *
            (0.8 + 0.2 * Math.sin(vt * (20 + 60 * h) * u)));
    }
    tn(n, "lp", t ? 2600 : 7e3, 0.7, i), tn(n, "hp", t ? 120 : 400, 0.7, i);
    let l = t ? 7 : 5;
    for (let c = 0; c < l; c++) {
      let u = o * Math.sqrt(c / l);
      Se(
        n,
        dn(
          i,
          0.03,
          [
            [t ? 1500 : 3800, 0.004, 1],
            [t ? 2600 : 6100, 0.003, 0.6],
          ],
          e,
        ),
        u,
        0.12 + (0.2 * c) / l,
        i,
      );
    }
    return n;
  }
  function I8(i, e, t) {
    let n = St(i, 3),
      s = t ? 0.9 : 1;
    Se(n, at(i, e, 0.03, 0.006, { hp: 1500 }), 0, 1.8, i),
      Se(n, ei(i, 1.6, 96 * s, 27, 0.16, 0.36, 0.001), 0, 0.85, i);
    let o = Qn(i, 1.6, e);
    di(o, "lp", Vo(2800, 260, 0.5), 0.7, i),
      Se(n, lo(o, i, co(0.26, 0.002)), 0, 3.2, i);
    let r = Qn(i, 2.6, e);
    tn(r, "lp", 120, 0.7, i),
      Se(n, lo(r, i, co(0.7, 0.03)), 0, 2.2, i),
      Se(n, at(i, e, 0.5, 0.09, { bp: 520 * s, q: 1.2 }), 0, 1.3, i),
      Se(
        n,
        Jc(i, e, 2.5, 120, {
          from: 0.25,
          fall: 1.5,
          hp: 1500,
          lp: 9e3,
          ampFall: 0.8,
          maxLen: 0.01,
        }),
        0,
        0.5,
        i,
      );
    for (let a = 0; a < 7; a++) {
      let l = Xt(e, 900, 3600);
      Se(
        n,
        dn(
          i,
          0.2,
          [
            [l, Xt(e, 0.02, 0.06), 1],
            [l * 1.61, 0.02, 0.5],
          ],
          e,
        ),
        Xt(e, 0.4, 1.9),
        Xt(e, 0.03, 0.09),
        i,
      );
    }
    return Wo(ml(n, 0.36), 1.7);
  }
  function z8(i, e) {
    let t = St(i, 1.7);
    Se(t, at(i, e, 0.01, 0.002, { hp: 2500 }), 0, 1, i);
    let n = Qn(i, 0.5, e);
    tn(n, "bp", 3e3, 0.8, i);
    let s = 1;
    for (let l = 0; l < n.length; l++) {
      let c = l / i;
      l % 220 === 0 && (s = e() < 0.55 + 0.4 * (1 - c / 0.5) ? 1 : 0),
        (n[l] =
          (n[l] * (Math.sin(vt * 100 * c) > -0.2 ? 1 : 0.15) +
            0.35 * Math.sign(Math.sin(vt * 100 * c)) * (e() - 0.3)) *
          s *
          Math.exp(-c / 0.3));
    }
    Se(t, n, 0.005, 0.8, i);
    let o = St(i, 1.25),
      r = 0,
      a = 0;
    for (let l = 0; l < o.length; l++) {
      let c = l / i,
        u = Math.pow(0.22, c / 1.2);
      (r += (vt * 100 * u) / i),
        (a += (vt * (150 + 1900 * Math.pow(1 - c / 1.25, 2.2))) / i),
        (o[l] =
          ((Math.sin(r) +
            0.6 * Math.sin(2 * r) +
            0.4 * Math.sin(3 * r) +
            0.25 * Math.sin(5 * r)) *
            0.5 +
            Math.sin(a) * 0.22) *
          Math.pow(1 - c / 1.25, 1.2) *
          (1 - Math.exp(-c / 0.03)));
    }
    return (
      Se(t, o, 0.4, 0.8, i),
      Se(t, ei(i, 0.12, 140, 60, 0.03, 0.04), 0.4, 0.5, i),
      Wo(t, 1.3)
    );
  }
  function* D8(i, e, t) {
    let n = St(i, 6.5),
      s = Qn(i, 6.4, e);
    yield, di(s, "lp", Vo(t ? 520 : 380, 70, 0.6), 0.7, i), yield;
    let o = [];
    for (let a = 0; a < 9; a++)
      o.push([Xt(e, 0.05, 3.6), Xt(e, 0.12, 0.5), Xt(e, 0.4, 1)]);
    for (let a = 0; a < s.length; a++) {
      let l = a / i,
        c = 0;
      for (let [u, h, f] of o) {
        let p = (l - u) / h;
        c += f * Math.exp(-p * p);
      }
      s[a] *= (0.25 + c) * Math.exp(-l / 1.9) * (1 - Math.exp(-l / 0.05));
    }
    Se(n, s, 0, 1, i), yield;
    let r = Qn(i, 6, e);
    return (
      tn(r, "bp", 48, 1.2, i),
      Se(n, lo(r, i, co(2, 0.2)), 0.05, 3, i),
      t && Se(n, at(i, e, 0.3, 0.06, { hp: 300, lp: 2500 }), 0.02, 0.25, i),
      n
    );
  }
  var jb = [0, 1, 0.435, 0.268, 0.19, 0.145, 0.116, 0.097];
  function L8(i, e) {
    let t = St(i, 5),
      n = t.length;
    for (let s = 0; s < n; s++) {
      let o = s / i,
        r = 0.0025 * Math.sin(vt * 4.3 * o),
        a =
          Math.min(1, o / 0.45) *
          Math.min(1, (5 - o) / 1.5) *
          (o < 3.2 ? 1 : Math.exp(-(o - 3.2) / 0.7)),
        l = 0;
      for (let c = 1; c <= 7; c++)
        l += Math.sin(vt * 92.5 * c * o * (1 + r) + c) * jb[c];
      for (let c = 1; c <= 4; c++)
        l += 0.45 * Math.sin(vt * 138.6 * c * o + c * 2) * jb[c];
      t[s] = l * a;
    }
    return tn(t, "lp", 520, 0.7, i), t;
  }
  function k8(i, e, t) {
    let n = St(i, 1.4),
      s = t ? 3 : 4,
      o = 0.02;
    for (let r = 0; r < s; r++) {
      let a = Xt(e, 0.17, 0.26) * (t ? 1.4 : 1),
        l = Math.round(a * i),
        c = Math.round(o * i),
        u = (t ? 1250 : 1550) * (1 - r * 0.04),
        h = 0;
      for (let f = 0; f < l && c + f < n.length; f++) {
        let p = f / l,
          d = u * (1 + 0.55 * Math.sin(Math.PI * Math.pow(p, 0.6)) - 0.25 * p);
        h += (vt * d) / i;
        let v = 1 + 0.3 * Math.sin((vt * 63 * f) / i);
        n[c + f] +=
          (Math.sin(h) +
            0.6 * Math.sin(2 * h + 0.5) +
            0.35 * Math.sin(3 * h) +
            0.15 * Math.sin(4 * h)) *
          v *
          Math.pow(Math.sin(Math.PI * p), 0.7) *
          (1 - r * 0.14);
      }
      o += a + Xt(e, 0.05, 0.12);
    }
    return tn(n, "lp", 4200, 0.7, i), n;
  }
  function F8(i, e, t) {
    let n = St(i, 1.1),
      s = t ? 1.19 : 1,
      o = 0.01,
      r = t ? 3 : 4;
    for (let a = 0; a < r; a++)
      Se(
        n,
        dn(
          i,
          0.5,
          [
            [2310 * s, Xt(e, 0.06, 0.13), 1],
            [3740 * s, 0.07, 0.7],
            [5910 * s, 0.04, 0.5],
            [8130 * s, 0.025, 0.3],
            [1012 * s, 0.03, 0.3],
          ],
          e,
        ),
        o,
        Xt(e, 0.35, 1),
        i,
      ),
        Se(n, at(i, e, 0.004, 0.001, { hp: 3e3 }), o, 0.3, i),
        (o += Xt(e, 0.09, 0.26));
    return n;
  }
  function U8(i, e) {
    let t = St(i, 2.8),
      n = St(i, 2.2);
    return (
      Se(
        n,
        dn(
          i,
          2.2,
          [
            [47, 0.7, 1],
            [77, 0.55, 0.9],
            [121, 0.4, 0.7],
            [163, 0.3, 0.5],
            [214, 0.22, 0.4],
            [330, 0.12, 0.25],
          ],
          e,
        ),
        0,
        0.5,
        i,
      ),
      Se(n, at(i, e, 0.5, 0.11, { lp: 420 }), 0, 1, i),
      Se(t, n, 0, 1, i),
      Se(t, n, 0.36, 0.3, i),
      Se(t, n, 0.61, 0.12, i),
      t
    );
  }
  function N8(i, e) {
    let t = St(i, 0.09);
    return (
      Se(
        t,
        dn(
          i,
          0.08,
          [
            [1820, 0.009, 1],
            [2730, 0.007, 0.6],
            [640, 0.012, 0.5],
          ],
          e,
        ),
        0,
        1,
        i,
      ),
      Se(t, at(i, e, 0.004, 0.001, { hp: 2500 }), 0, 0.5, i),
      t
    );
  }
  function B8(i, e) {
    let t = St(i, 0.06);
    return (
      Se(
        t,
        dn(
          i,
          0.05,
          [
            [3200, 0.008, 1],
            [4800, 0.005, 0.3],
          ],
          e,
        ),
        0,
        1,
        i,
      ),
      t
    );
  }
  function* O8(i, e) {
    let n = function* (s) {
      let o = Zc(i, 6, s, (u) => {
        tn(u, "hp", 900, 0.6, i), tn(u, "lp", 8500, 0.6, i);
      });
      yield;
      let r = Zc(i, 6, s, (u) => {
          tn(u, "bp", 420, 0.5, i);
        }),
        a = o.length,
        l = Q1(a, [o, 0.5], [r, 0.75]),
        c = new Float32Array(a);
      for (let u = 0; u < 1020; u++) {
        let h = Math.floor(s() * a),
          f = Math.round(Xt(s, 6e-4, 0.003) * i),
          p = Math.pow(s(), 3) * 1.6 + 0.15;
        for (let d = 0; d < f; d++)
          (c[h] += (s() * 2 - 1) * p * Math.exp((-5 * d) / f)),
            ++h >= a && (h = 0);
      }
      yield, di(c, "hp", () => 2200, 0.7, i, 2), yield;
      for (let u = 0; u < 30; u++) {
        let h = Xt(s, 700, 2100);
        Us(
          c,
          jc(i, Xt(s, 0.008, 0.02), h, h * 1.7),
          s() * 6,
          Xt(s, 0.08, 0.3),
          i,
        );
      }
      for (let u = 0; u < a; u++) l[u] += c[u] * 0.55;
      return l;
    };
    return [
      yield* n(ao(Math.floor(e() * 1e9))),
      yield* n(ao(Math.floor(e() * 1e9))),
    ];
  }
  function* H8(i, e) {
    let n = function* (s) {
      let o = Zc(i, 6, s, (c) => {
          tn(c, "lp", 1300, 0.6, i), tn(c, "hp", 110, 0.7, i);
        }),
        r = o.length,
        a = new Float32Array(r);
      for (let c = 0; c < 1560; c++)
        a[Math.floor(s() * r)] += (s() * 2 - 1) * (0.2 + Math.pow(s(), 4) * 3);
      let l = Q1(r, [o, 0.8]);
      for (let [c, u, h] of [
        [1820, 14, 1],
        [2740, 16, 0.8],
        [4150, 18, 0.6],
        [6200, 14, 0.35],
        [940, 8, 0.7],
      ]) {
        let f = Float32Array.from(a);
        di(f, "bp", () => c, u, i, 2);
        for (let p = 0; p < r; p++) l[p] += f[p] * h * 5;
        yield;
      }
      for (let c = 0; c < 4; c++) {
        let u = Xt(s, 900, 1600);
        Us(l, jc(i, 0.014, u, u * 1.8), s() * 6, 0.25, i);
      }
      return l;
    };
    return [
      yield* n(ao(Math.floor(e() * 1e9))),
      yield* n(ao(Math.floor(e() * 1e9))),
    ];
  }
  function V8(i, e) {
    let s = Qn(i, 8.5, e),
      o = Float32Array.from(s);
    di(
      s,
      "bp",
      (r) => {
        let a = r * 8.5;
        return (
          380 +
          190 * Math.sin((vt * a) / 8) +
          90 * Math.sin((vt * a) / 2.667 + 1)
        );
      },
      1.3,
      i,
    ),
      di(
        o,
        "bp",
        (r) => {
          let a = r * 8.5;
          return 1350 + 260 * Math.sin((vt * a) / 4 + 2);
        },
        9,
        i,
      );
    for (let r = 0; r < s.length; r++) {
      let a = r / i;
      s[r] =
        s[r] * (0.7 + 0.3 * Math.sin((vt * a) / 8 + 0.5)) +
        o[r] * 0.22 * Math.pow(0.5 + 0.5 * Math.sin((vt * a) / 4 + 1), 2);
    }
    return Rv(s, i * 8, !0);
  }
  function* W8(i, e) {
    let s = Qn(i, 8.5, e),
      o = Qn(i, 8 + 0.5, e),
      r = Qn(i, 8 + 0.5, e);
    yield,
      tn(s, "lp", 1100, 0.6, i),
      tn(s, "hp", 70, 0.7, i),
      tn(o, "hp", 2400, 0.7, i),
      tn(r, "bp", 520, 1.2, i),
      yield;
    for (let a = 0; a < s.length; a++) {
      let l = a / i,
        c = (l % 4) / 4,
        u = Math.pow(0.5 - 0.5 * Math.cos(vt * c), 1.5),
        h = Math.exp(-Math.pow((c - 0.5) / 0.05, 2)),
        f = Math.exp(-Math.pow((c - 0.68) / 0.16, 2)),
        p = 0.5 - 0.5 * Math.cos((vt * ((l + 1.3) % 2.667)) / 2.667);
      s[a] =
        s[a] * (0.3 + 0.7 * u + 0.25 * p) + r[a] * h * 1.8 + o[a] * f * 0.35;
    }
    return Rv(s, i * 8, !0);
  }
  var Fr = { bpm: 100, bar: 2.4, loopBars: 8, sr: 32e3 },
    Cv = [
      { root: 38, tones: [0, 3, 7, 12, 10], base: 50 },
      { root: 34, tones: [0, 4, 7, 12, 11], base: 46 },
      { root: 31, tones: [0, 3, 7, 12, 10], base: 43 },
      { root: 33, tones: [0, 5, 7, 12, 10], base: 45 },
    ];
  function Jb(i, e, t, n, s, o, r) {
    let a = Math.round((t + s) * i),
      l = new Float32Array(a),
      c = [r(), r(), r()],
      u = [1 - o, 1, 1 + o * 1.1];
    for (let h = 0; h < a; h++) {
      let f = h / i,
        p = 0;
      for (let v = 0; v < 3; v++)
        (c[v] += (e * u[v]) / i),
          (c[v] -= Math.floor(c[v])),
          (p += 2 * c[v] - 1);
      let d =
        f < t
          ? 1 - Math.exp(-f / n)
          : (1 - Math.exp(-t / n)) * Math.exp(-(f - t) / (s * 0.3));
      l[h] = p * d * 0.33;
    }
    return em(l, i, 0, 0.1), l;
  }
  function* G8(i, e) {
    let t = Fr.bar * 8,
      n = Math.round(t * i),
      s = function* (o) {
        let r = new Float32Array(n);
        for (let a = 0; a < 4; a++) {
          let l = Cv[a],
            c = a * 4.8;
          for (let [u, h] of [
            [0, 1],
            [7, 0.6],
            [12, 0.5],
            [l.tones[1] + 12, 0.28],
          ])
            Us(
              r,
              Jb(i, Ns(l.root + u), 4.6, 1.3, 1.8, 0.0035, o),
              c - 0.5,
              h * 0.3,
              i,
            ),
              yield;
        }
        return (
          Us(r, Jb(i, Ns(26), t - 0.2, 2.5, 0.2, 0.002, o), 0.1, 0.16, i),
          yield,
          di(
            r,
            "lp",
            (a) =>
              560 + 300 * Math.sin(vt * a * 2) + 120 * Math.sin(vt * a * 5 + 1),
            0.9,
            i,
            2,
          ),
          yield,
          r
        );
      };
    return [
      yield* s(ao(Math.floor(e() * 1e9))),
      yield* s(ao(Math.floor(e() * 1e9))),
    ];
  }
  function n_(i, e, t) {
    let n = Math.round(0.42 * i),
      s = new Float32Array(n),
      o = 0,
      r = 0,
      a = 0,
      l = 0,
      c = 0;
    for (let u = 0; u < n; u++) {
      let h = u / i;
      (o += e / i),
        (o -= Math.floor(o)),
        (r += (e * 0.5) / i),
        (r -= Math.floor(r));
      let f = 2 * o - 1 + 0.4 * (r < 0.5 ? 1 : -1);
      (u & 15) === 0 &&
        (c = 1 - Math.exp((-vt * (300 + 2600 * t * Math.exp(-h / 0.06))) / i)),
        (a += (f - a) * c),
        (l += (a - l) * c),
        (s[u] = l * Math.exp(-h / 0.1) * Math.min(1, u / 40));
    }
    return em(s, i, 0, 0.03);
  }
  function* q8(i) {
    let e = Fr.bar * 8,
      t = new Float32Array(Math.round(e * i)),
      n = [0, 0, 2, 0, 1, 0, 2, 0, 3, 0, 2, 0, 1, 0, 4, 2],
      s = [
        1, 0.45, 0.7, 0.45, 0.85, 0.45, 0.7, 0.5, 1, 0.45, 0.7, 0.45, 0.85, 0.5,
        0.8, 0.6,
      ];
    for (let o = 0; o < 128; o++) {
      let r = Cv[(o >> 5) & 3],
        a = o & 15,
        l = n_(i, Ns(r.base + r.tones[n[a]]), s[a]);
      Us(t, l, o * 0.15, 0.5 * (0.5 + 0.5 * s[a]), i),
        Us(t, l, o * 0.15 + 0.45, 0.14, i),
        (o & 7) === 7 && (yield);
    }
    return t;
  }
  function* X8(i, e) {
    let t = Fr.bar * 4,
      n = new Float32Array(Math.round(t * i)),
      s = () =>
        Q1(
          Math.round(0.9 * i),
          [ei(i, 0.9, 74, 34, 0.07, 0.24, 0.002), 1],
          [at(i, e, 0.4, 0.07, { lp: 240 }), 1.2],
          [at(i, e, 0.05, 0.008, { bp: 1400, q: 0.8 }), 0.25],
        ),
      o = (a) =>
        Q1(
          Math.round(0.5 * i),
          [ei(i, 0.5, a, a * 0.55, 0.05, 0.12, 0.002), 1],
          [at(i, e, 0.1, 0.02, { lp: 600 }), 0.5],
        ),
      r = (a) => at(i, e, 0.06, 0.008 + a * 0.01, { hp: 6500 });
    for (let a = 0; a < 4; a++) {
      let l = a * 2.4;
      Us(n, s(), l, 1, i),
        Us(n, o(104), l + 1.5, 0.55, i),
        a % 2 === 1 && Us(n, s(), l + 2.1, 0.6, i);
      for (let c = 0; c < 16; c++)
        Us(
          n,
          r(c % 4 === 2 ? 1 : 0),
          l + c * 0.15,
          c % 4 === 2 ? 0.34 : c % 2 ? 0.11 : 0.2,
          i,
        );
      yield;
    }
    for (let [a, l] of [
      [12, 120],
      [13, 104],
      [14, 88],
      [15, 74],
    ])
      Us(n, o(l), 7.2 + a * 0.15, 0.6, i);
    return Wo(n, 1.3);
  }
  function $c(i, e, t) {
    let n = Math.round(t * i),
      s = new Float32Array(n),
      o = 0,
      r = 0,
      a = 0,
      l = 0,
      c = null;
    for (let u = 0; u < n; u++) {
      let h = u / i,
        f = u / n,
        p = Math.pow(Math.sin(Math.PI * Math.pow(f, 0.8)), 1.5),
        d = 1 + 0.004 * Math.sin(vt * 5.1 * h) * Math.min(1, h);
      (o += (e * d) / i),
        (o -= Math.floor(o)),
        (r += (e * 1.004 * d) / i),
        (r -= Math.floor(r)),
        (u & 31) === 0 && (c = Av("lp", 240 + 1700 * p * p, 1.1, i));
      let v = 2 * o - 1 + (2 * r - 1),
        g = c[0] * v + a;
      (a = c[1] * v - c[3] * g + l),
        (l = c[2] * v - c[4] * g),
        (s[u] = g * p * 0.5);
    }
    return s;
  }
  function* Y8(i) {
    let e = Fr.bar * 8,
      t = new Float32Array(Math.round(e * i));
    for (let n = 0; n < 4; n++) {
      let s = Cv[n];
      for (let [o, r] of [
        [12, 1],
        [19, 0.7],
        [24 + s.tones[1], 0.5],
        [24, 0.4],
      ])
        Us(t, $c(i, Ns(s.root + o), 4.7), n * 4.8 + 0.05, r * 0.3, i), yield;
    }
    return t;
  }
  function Pf(i, e, t) {
    let n = dn(i, t, [
        [e, t * 0.3, 1],
        [e * 2.003, t * 0.18, 0.4],
        [e * 3.01, t * 0.1, 0.18],
        [e * 4.2, t * 0.05, 0.1],
        [e * 0.5, t * 0.3, 0.25],
      ]),
      s = Math.round(0.006 * i);
    for (let o = 0; o < s; o++) n[o] *= o / s;
    return em(n, i, 0, 0.2);
  }
  function* $8(i) {
    let e = Fr.bar * 8,
      t = new Float32Array(Math.round(e * i)),
      n = (s, o, r) => {
        let a = Pf(i, Ns(o), 3.2);
        Us(t, a, s, r, i),
          Us(t, a, s + 0.45, r * 0.28, i),
          Us(t, a, s + 0.9, r * 0.1, i);
      };
    for (let [s, o] of [
      [0, 62],
      [0.9, 69],
      [1.8, 70],
      [3, 65],
    ])
      n(s, o, 0.5), yield;
    for (let [s, o] of [
      [0, 62],
      [0.9, 69],
      [1.8, 72],
      [3, 67],
    ])
      n(9.6 + s, o, 0.42), yield;
    return t;
  }
  function* Z8(i) {
    let e = St(i, 2.8);
    [57, 62, 65, 69].forEach((t, n) => {
      Se(e, Pf(i, Ns(t), 1.6), n * 0.15, 0.45 + n * 0.08, i),
        Se(e, n_(i, Ns(t), 1), n * 0.15, 0.3, i);
    }),
      Se(e, ei(i, 0.8, 73.4, 36.7, 0.1, 0.25, 0.002), 0.45, 0.7, i);
    for (let t of [50, 57, 62, 64])
      Se(e, $c(i, Ns(t), 2.2), 0.45, 0.14, i), yield;
    return e;
  }
  function* j8(i) {
    let e = St(i, 4.2);
    Se(e, ei(i, 1, 73.4, 36.7, 0.1, 0.3, 0.002), 0, 0.9, i),
      Se(e, ei(i, 1, 73.4, 36.7, 0.1, 0.3, 0.002), 0.6, 0.7, i);
    for (let t of [50, 57, 62, 65]) Se(e, $c(i, Ns(t), 1.5), 0, 0.16, i), yield;
    for (let t of [48, 55, 60, 64])
      Se(e, $c(i, Ns(t), 1.4), 0.6, 0.16, i), yield;
    for (let t of [50, 57, 62, 65, 69])
      Se(e, $c(i, Ns(t), 2.9), 1.2, 0.17, i), yield;
    return (
      [62, 65, 69, 74].forEach((t, n) =>
        Se(e, Pf(i, Ns(t), 2), 1.2 + n * 0.15, 0.4, i),
      ),
      e
    );
  }
  function* J8(i) {
    let e = St(i, 6);
    Se(e, ei(i, 1.4, 73.4, 36.7, 0.15, 0.4, 0.003), 0, 0.9, i);
    for (let [t, n] of [
      [38, 1],
      [50, 0.8],
      [57, 0.7],
      [62, 0.7],
      [66, 0.7],
      [69, 0.5],
    ])
      Se(e, $c(i, Ns(t), 5.6), 0, 0.14 * n, i), yield;
    return (
      [62, 66, 69, 74, 78, 81].forEach((t, n) => {
        Se(e, Pf(i, Ns(t), 3), 0.3 + n * 0.3, 0.42, i),
          Se(e, Pf(i, Ns(t), 3), 0.75 + n * 0.3, 0.12, i);
      }),
      e
    );
  }
  function K8(i, e) {
    let t = St(i, 3.8),
      n = t.length,
      s = [0, 0, 0];
    for (let o = 0; o < n; o++) {
      let r = o / i,
        a = Math.pow(2, -1.1 * Math.pow(r / 3.8, 0.7)),
        l = 0;
      [73.42, 110, 146.83].forEach((c, u) => {
        (s[u] += (c * a * (1 + u * 0.002)) / i),
          (s[u] -= Math.floor(s[u])),
          (l += (2 * s[u] - 1) * (u === 1 ? 0.6 : 1));
      }),
        (t[o] =
          l * 0.3 * Math.pow(1 - r / 3.8, 1.3) * (1 - Math.exp(-r / 0.01)));
    }
    return (
      di(t, "lp", Vo(1500, 110, 0.7), 1.2, i),
      Se(t, ei(i, 1.2, 82, 30, 0.12, 0.35, 0.002), 0, 1, i),
      Se(t, at(i, e, 0.3, 0.06, { lp: 300 }), 0, 0.8, i),
      t
    );
  }
  function Q8(i, e) {
    let t = (n, s) => {
      let o = St(i, 1.4),
        r = [
          [0.062, 0.55],
          [0.089, 0.42],
          [0.118, 0.36],
          [0.151, 0.26],
          [0.178, 0.2],
          [0.243, 0.1],
        ];
      for (let [l, c] of r)
        Se(
          o,
          at(i, n, 0.01, 0.0018, { hp: 700, lp: 5500 }),
          l * (s ? 1.07 : 0.96) + Xt(n, 0, 0.006),
          c * Xt(n, 0.6, 1.15),
          i,
        );
      let a = Qn(i, 1.3, n);
      return (
        tn(a, "hp", 300, 0.7, i),
        di(a, "lp", Vo(6e3, 900, 0.6), 0.7, i),
        Se(o, lo(a, i, co(0.27, 0.04)), 0.04, 0.045, i),
        o
      );
    };
    return [t(ao(Math.floor(e() * 1e9)), 0), t(ao(Math.floor(e() * 1e9)), 1)];
  }
  function eC(i, e) {
    let t = (n, s) => {
      let o = St(i, 2.2),
        r = Qn(i, 2.18, n);
      di(r, "lp", Vo(5200, 650, 0.5), 0.7, i),
        Se(o, lo(r, i, co(0.33, 0.006)), 0.012, 0.3, i);
      let a = Qn(i, 2.1, n);
      tn(a, "lp", 260, 0.7, i), Se(o, lo(a, i, co(0.4, 0.01)), 0.012, 0.5, i);
      for (let [l, c] of [
        [0.018, 0.7],
        [0.031, 0.55],
        [0.047, 0.45],
        [0.093, 0.3],
        [0.139, 0.2],
      ])
        Se(
          o,
          at(i, n, 0.008, 0.0015, { lp: 4500 }),
          l * (s ? 1.09 : 0.95),
          c,
          i,
        );
      return o;
    };
    return [t(ao(Math.floor(e() * 1e9)), 0), t(ao(Math.floor(e() * 1e9)), 1)];
  }
  var ki = 44100,
    Xn = 32e3,
    pl = 22050,
    Go = {
      rifle_shot: {
        gen: KR,
        n: 4,
        sr: ki,
        peak: 0.97,
        bus: "near",
        max: 5,
        pri: 9,
        boot: 1,
      },
      rifle_tail_out: {
        gen: QR,
        n: 2,
        sr: Xn,
        peak: 0.5,
        bus: "dry",
        max: 3,
        pri: 8,
        boot: 1,
      },
      rifle_tail_in: {
        gen: e8,
        n: 2,
        sr: Xn,
        peak: 0.62,
        bus: "dry",
        max: 3,
        pri: 8,
        boot: 1,
      },
      rifle_dry: {
        gen: t8,
        n: 1,
        sr: ki,
        peak: 0.5,
        bus: "near",
        max: 2,
        pri: 6,
        boot: 1,
      },
      reload_magout: {
        gen: n8,
        n: 1,
        sr: ki,
        peak: 0.6,
        bus: "near",
        max: 2,
        pri: 6,
      },
      reload_magin: {
        gen: i8,
        n: 1,
        sr: ki,
        peak: 0.65,
        bus: "near",
        max: 2,
        pri: 6,
      },
      reload_bolt: {
        gen: s8,
        n: 1,
        sr: ki,
        peak: 0.8,
        bus: "near",
        max: 2,
        pri: 6,
      },
      shell_bounce: {
        gen: o8,
        n: 3,
        sr: ki,
        peak: 0.3,
        bus: "world",
        max: 4,
        pri: 1,
        ref: 2,
        roll: 1,
      },
      step_concrete: {
        gen: r8,
        n: 4,
        sr: Xn,
        peak: 0.45,
        bus: "near",
        max: 3,
        pri: 3,
        boot: 1,
      },
      step_water: {
        gen: a8,
        n: 3,
        sr: Xn,
        peak: 0.5,
        bus: "near",
        max: 3,
        pri: 3,
        boot: 1,
      },
      step_metal: {
        gen: l8,
        n: 3,
        sr: Xn,
        peak: 0.5,
        bus: "near",
        max: 3,
        pri: 3,
        boot: 1,
      },
      land: { gen: c8, n: 1, sr: Xn, peak: 0.7, bus: "near", max: 2, pri: 4 },
      jump: { gen: u8, n: 1, sr: Xn, peak: 0.35, bus: "near", max: 2, pri: 3 },
      hurt: { gen: h8, n: 1, sr: Xn, peak: 0.85, bus: "dry", max: 2, pri: 8 },
      ear_ring: {
        gen: f8,
        n: 1,
        sr: pl,
        peak: 0.2,
        bus: "dry",
        max: 1,
        pri: 5,
      },
      impact_metal: {
        gen: d8,
        n: 3,
        sr: ki,
        peak: 0.7,
        bus: "world",
        max: 4,
        pri: 4,
        ref: 4,
        roll: 0.7,
      },
      impact_concrete: {
        gen: p8,
        n: 3,
        sr: ki,
        peak: 0.7,
        bus: "world",
        max: 4,
        pri: 4,
        ref: 4,
        roll: 0.7,
      },
      impact_wood: {
        gen: m8,
        n: 2,
        sr: ki,
        peak: 0.7,
        bus: "world",
        max: 3,
        pri: 4,
        ref: 4,
        roll: 0.7,
      },
      impact_water: {
        gen: g8,
        n: 2,
        sr: Xn,
        peak: 0.6,
        bus: "world",
        max: 3,
        pri: 4,
        ref: 4,
        roll: 0.7,
      },
      impact_enemy: {
        gen: v8,
        n: 3,
        sr: ki,
        peak: 0.75,
        bus: "world",
        max: 4,
        pri: 5,
        ref: 5,
        roll: 0.6,
      },
      impact_glass: {
        gen: x8,
        n: 1,
        sr: ki,
        peak: 0.6,
        bus: "world",
        max: 2,
        pri: 4,
        ref: 4,
        roll: 0.7,
      },
      whiz: {
        gen: b8,
        n: 3,
        sr: ki,
        peak: 0.5,
        bus: "world",
        max: 3,
        pri: 5,
        ref: 2.5,
        roll: 0.6,
      },
      ricochet: {
        gen: y8,
        n: 3,
        sr: ki,
        peak: 0.4,
        bus: "world",
        max: 2,
        pri: 3,
        ref: 5,
        roll: 0.6,
      },
      gull_fire: {
        gen: E8,
        n: 2,
        sr: ki,
        peak: 0.85,
        bus: "world",
        max: 5,
        pri: 7,
        ref: 7,
        roll: 0.55,
      },
      hound_fire: {
        gen: S8,
        n: 2,
        sr: ki,
        peak: 0.95,
        bus: "world",
        max: 5,
        pri: 7,
        ref: 8,
        roll: 0.5,
      },
      hound_step: {
        gen: T8,
        n: 3,
        sr: Xn,
        peak: 0.7,
        bus: "world",
        max: 4,
        pri: 3,
        ref: 5,
        roll: 0.8,
      },
      gull_die: {
        gen: A8,
        n: 1,
        sr: Xn,
        peak: 0.85,
        bus: "world",
        max: 3,
        pri: 7,
        ref: 7,
        roll: 0.5,
      },
      hound_die: {
        gen: R8,
        n: 1,
        sr: Xn,
        peak: 0.9,
        bus: "world",
        max: 3,
        pri: 7,
        ref: 7,
        roll: 0.5,
      },
      telegraph: {
        gen: P8,
        n: 2,
        sr: Xn,
        peak: 0.42,
        bus: "world",
        max: 4,
        pri: 6,
        ref: 6,
        roll: 0.6,
      },
      alert: {
        gen: C8,
        n: 2,
        sr: Xn,
        peak: 0.5,
        bus: "world",
        max: 3,
        pri: 6,
        ref: 8,
        roll: 0.5,
      },
      explosion: {
        gen: I8,
        n: 2,
        sr: ki,
        peak: 0.97,
        bus: "world",
        max: 3,
        pri: 10,
        ref: 12,
        roll: 0.5,
      },
      relay_cut: {
        gen: z8,
        n: 1,
        sr: Xn,
        peak: 0.75,
        bus: "world",
        max: 2,
        pri: 8,
        ref: 6,
        roll: 0.5,
      },
      thunder: { gen: D8, n: 2, sr: pl, peak: 0.8, bus: "dry", max: 2, pri: 6 },
      foghorn: {
        gen: L8,
        n: 1,
        sr: pl,
        peak: 0.5,
        bus: "world",
        max: 1,
        pri: 2,
      },
      gull_cry: {
        gen: k8,
        n: 2,
        sr: pl,
        peak: 0.4,
        bus: "world",
        max: 2,
        pri: 1,
      },
      halyard: {
        gen: F8,
        n: 2,
        sr: Xn,
        peak: 0.3,
        bus: "world",
        max: 2,
        pri: 1,
      },
      container_bang: {
        gen: U8,
        n: 1,
        sr: pl,
        peak: 0.6,
        bus: "world",
        max: 1,
        pri: 2,
      },
      ui_click: {
        gen: N8,
        n: 1,
        sr: ki,
        peak: 0.3,
        bus: "dry",
        max: 2,
        pri: 9,
      },
      ui_hover: {
        gen: B8,
        n: 1,
        sr: ki,
        peak: 0.12,
        bus: "dry",
        max: 2,
        pri: 9,
      },
      objective: {
        gen: Z8,
        n: 1,
        sr: Xn,
        peak: 0.6,
        bus: "music",
        max: 1,
        pri: 9,
      },
      objective_all: {
        gen: j8,
        n: 1,
        sr: Xn,
        peak: 0.65,
        bus: "music",
        max: 1,
        pri: 9,
      },
      complete: {
        gen: J8,
        n: 1,
        sr: Xn,
        peak: 0.7,
        bus: "music",
        max: 1,
        pri: 9,
      },
      death: {
        gen: K8,
        n: 1,
        sr: Xn,
        peak: 0.75,
        bus: "music",
        max: 1,
        pri: 9,
      },
      gull_rotor: {
        gen: _8,
        n: 1,
        sr: Xn,
        peak: 0.6,
        loop: 1,
        ref: 5,
        roll: 0.9,
      },
      hound_servo: {
        gen: M8,
        n: 1,
        sr: Xn,
        peak: 0.42,
        loop: 1,
        ref: 4,
        roll: 1,
      },
      relay_hum: {
        gen: w8,
        n: 1,
        sr: Xn,
        peak: 0.4,
        loop: 1,
        ref: 2.5,
        roll: 1.4,
      },
      rain: { gen: O8, n: 1, sr: Xn, peak: 0.5, loop: 1 },
      rain_interior: { gen: H8, n: 1, sr: Xn, peak: 0.7, loop: 1 },
      wind: { gen: V8, n: 1, sr: pl, peak: 0.5, loop: 1 },
      sea: { gen: W8, n: 1, sr: pl, peak: 0.5, loop: 1, ref: 10, roll: 0.6 },
      music_drone: { gen: G8, n: 1, sr: Fr.sr, peak: 0.5, loop: 1, music: 1 },
      music_ost: { gen: q8, n: 1, sr: Fr.sr, peak: 0.45, loop: 1, music: 1 },
      music_perc: { gen: X8, n: 1, sr: Fr.sr, peak: 0.7, loop: 1, music: 1 },
      music_brass: { gen: Y8, n: 1, sr: Fr.sr, peak: 0.45, loop: 1, music: 1 },
      music_motif: { gen: $8, n: 1, sr: Fr.sr, peak: 0.45, loop: 1, music: 1 },
      ir_outdoor: { gen: Q8, n: 1, sr: ki, peak: 0.9, ir: 1 },
      ir_shed: { gen: eC, n: 1, sr: ki, peak: 0.9, ir: 1 },
    },
    i_ = {
      step: "step_concrete",
      impact: "impact_concrete",
      hurt: "hurt",
      objective_done: "objective",
      extraction: "complete",
      enemy_alert: "alert",
    },
    s_ = (i) => i && typeof i.next == "function";
  function o_(i, e, t) {
    let n = Array.isArray(e) ? e : [e];
    if (!i.loop)
      for (let r of n) em(r, t, i.ir ? 0 : 3e-4, i.ir ? 0.05 : 0.012);
    let s = 0;
    for (let r of n) s = Math.max(s, Qb(r));
    let o = s > 0 ? i.peak / s : 1;
    for (let r of n) ml(r, o);
    return { sr: t, ch: n, loop: !!i.loop };
  }
  function r_(i, e = 0, t) {
    let n = Go[i];
    if (!n) return null;
    let s = t || n.sr,
      o = e % n.n,
      r = n.gen(s, ao(Kb(i) + o * 7919), o);
    if (s_(r)) {
      let a;
      do a = r.next();
      while (!a.done);
      r = a.value;
    }
    return o_(n, r, s);
  }
  function a_(i, e = 0, t) {
    let n = Go[i];
    if (!n) return null;
    let s = t || n.sr,
      o = e % n.n,
      r = n.gen(s, ao(Kb(i) + o * 7919), o),
      a = null;
    return {
      step() {
        if (a) return a;
        if (s_(r)) {
          let l = r.next();
          if (!l.done) return null;
          r = l.value;
        }
        return (a = o_(n, r, s));
      },
    };
  }
  var pi = (i, e, t) => Math.min(t, Math.max(e, i)),
    Pv = (i, e, t) => {
      let n = pi((t - i) / (e - i), 0, 1);
      return n * n * (3 - 2 * n);
    },
    l_ = {
      metal: "impact_metal",
      concrete: "impact_concrete",
      wood: "impact_wood",
      water: "impact_water",
      glass: "impact_glass",
      dirt: "impact_concrete",
      rubber: "impact_wood",
    },
    Iv = {
      metal: "step_metal",
      water: "step_water",
      concrete: "step_concrete",
      wood: "step_concrete",
      dirt: "step_concrete",
      glass: "step_concrete",
      rubber: "step_concrete",
    },
    tC = new Set([
      "thunder",
      "foghorn",
      "objective",
      "objective_all",
      "complete",
      "death",
      "explosion",
      "rifle_tail_in",
      "gull_die",
      "hound_die",
      "relay_cut",
      "container_bang",
      "ear_ring",
    ]),
    nC = [
      "ir_outdoor",
      "ir_shed",
      "rain",
      "whiz",
      "reload_magout",
      "reload_magin",
      "reload_bolt",
      "shell_bounce",
      "impact_concrete",
      "impact_metal",
      "land",
      "jump",
      "hurt",
      "music_drone",
      "wind",
      "music_motif",
      "impact_enemy",
      "impact_wood",
      "impact_water",
      "impact_glass",
      "ricochet",
      "gull_rotor",
      "hound_servo",
      "alert",
      "telegraph",
      "gull_fire",
      "hound_fire",
      "hound_step",
      "ui_click",
      "ui_hover",
      "sea",
      "rain_interior",
      "relay_hum",
      "gull_die",
      "hound_die",
      "explosion",
      "ear_ring",
      "death",
      "music_ost",
      "music_perc",
      "music_brass",
      "relay_cut",
      "objective",
      "thunder",
      "objective_all",
      "complete",
      "gull_cry",
      "halyard",
      "foghorn",
      "container_bang",
    ],
    tm = [
      "music_drone",
      "music_ost",
      "music_perc",
      "music_brass",
      "music_motif",
    ];
  function iC() {
    let i = () => {},
      e = { setPos: i, setGain: i, setPitch: i, stop: i };
    return {
      silent: !0,
      update: i,
      resume: i,
      play: i,
      loop: () => e,
      setIntensity: i,
      setInterior: i,
      setVolume: i,
      setPaused: i,
      debug: () => ({ state: "none" }),
      names: Object.keys(Go),
      ready: Promise.resolve(),
    };
  }
  async function c_(i) {
    let e =
        typeof window < "u" &&
        (window.AudioContext || window.webkitAudioContext),
      t = null;
    try {
      e && (t = new e({ latencyHint: "interactive" }));
    } catch {
      t = null;
    }
    return t
      ? u_(i, t, null)
      : (console.warn("[audio] WebAudio unavailable \u2014 running silent"),
        iC());
  }
  function u_(i, e, t) {
    let n = i.events,
      s = Math.random,
      o = () => (t ? !0 : e.state === "running"),
      r = t ? t.bufs : new Map(),
      a = new Map(),
      l = 0,
      c = 0,
      u = 0;
    function h(te, he) {
      let pe = e.createBuffer(he.ch.length, he.ch[0].length, he.sr);
      for (let ye = 0; ye < he.ch.length; ye++)
        pe.getChannelData(ye).set(he.ch[ye]);
      r.set(te, pe), c++;
      let ge = a.get(te);
      if (ge) {
        a.delete(te);
        for (let ye of ge)
          try {
            ye(pe);
          } catch (Le) {
            console.error("[audio] ready callback", Le);
          }
      }
      return pe;
    }
    let f = (te) => (Go[te].ir ? e.sampleRate : void 0);
    function p(te, he) {
      let pe = performance.now(),
        ge = h(te + "#" + he, r_(te, he, f(te)));
      return (l += performance.now() - pe), ge;
    }
    let d = [],
      v = new Set();
    for (let te of [...nC, ...Object.keys(Go)]) {
      let he = Go[te];
      if (!(!he || v.has(te))) {
        v.add(te);
        for (let pe = 0; pe < he.n; pe++)
          r.has(te + "#" + pe) ||
            (he.boot
              ? p(te, pe)
              : d.push({ name: te, v: pe, k: te + "#" + pe, steps: null }));
      }
    }
    u = l;
    let g,
      x = new Promise((te) => {
        g = te;
      });
    function y() {
      let te = performance.now();
      for (; d.length; ) {
        let he = d[0];
        if (r.has(he.k)) {
          d.shift();
          continue;
        }
        he.steps || (he.steps = a_(he.name, he.v, f(he.name)));
        let pe = null;
        try {
          pe = he.steps.step();
        } catch (ge) {
          console.error("[audio] synthesis failed for " + he.k, ge), d.shift();
          continue;
        }
        if (
          (pe && (h(he.k, pe), d.shift(), be(he.name)),
          performance.now() - te > 6)
        )
          break;
      }
      (l += performance.now() - te), d.length ? setTimeout(y, 12) : g();
    }
    t ? g() : setTimeout(y, 120);
    function b(te, he, pe) {
      let ge = te + "#" + he,
        ye = r.get(ge);
      if (ye) {
        pe(ye);
        return;
      }
      a.has(ge) || a.set(ge, []), a.get(ge).push(pe);
      let Le = d.findIndex((ke) => ke.k === ge);
      if (Le > 0 && !d[Le].steps) {
        let [ke] = d.splice(Le, 1);
        d.splice(d[0] && d[0].steps ? 1 : 0, 0, ke);
      }
    }
    let m = (te) => {
        let he = e.createGain();
        return (he.gain.value = te), he;
      },
      A = m(1),
      _ = e.createDynamicsCompressor(),
      M = m(0.45),
      E = e.createWaveShaper(),
      w = m(0.9);
    (_.threshold.value = -10),
      (_.knee.value = 6),
      (_.ratio.value = 6),
      (_.attack.value = 0.002),
      (_.release.value = 0.14);
    {
      let he = new Float32Array(2049);
      for (let pe = 0; pe < 2049; pe++) {
        let ge = ((pe / 2048) * 2 - 1) * 2,
          ye = Math.abs(ge);
        he[pe] =
          Math.sign(ge) *
          (ye <= 0.6 ? ye : 0.6 + 0.4 * Math.tanh((ye - 0.6) / 0.4));
      }
      E.curve = he;
      try {
        E.oversample = "2x";
      } catch {}
    }
    A.connect(_),
      _.connect(M),
      M.connect(E),
      E.connect(w),
      w.connect(e.destination);
    let S = e.createBiquadFilter();
    (S.type = "lowpass"), (S.frequency.value = 2e4), (S.Q.value = 0.5);
    let z = m(1);
    S.connect(z), z.connect(A);
    let H = {
      world: m(1),
      near: m(0.95),
      amb: m(0.55),
      dry: m(1),
      music: m(0.62),
    };
    H.world.connect(S), H.near.connect(S), H.amb.connect(S), H.dry.connect(A);
    let O = m(1);
    H.music.connect(O), O.connect(A);
    let q = m(1),
      U = m(1),
      T = m(0),
      D = e.createConvolver(),
      C = e.createConvolver(),
      G = m(0.75),
      j = m(0.95),
      N = m(0.9),
      Q = m(0.32),
      K = m(0.2);
    H.world.connect(N),
      N.connect(q),
      H.near.connect(Q),
      Q.connect(q),
      q.connect(U),
      q.connect(T),
      U.connect(D),
      T.connect(C),
      D.connect(G),
      C.connect(j),
      G.connect(S),
      j.connect(S),
      H.music.connect(K),
      K.connect(C),
      b("ir_outdoor", 0, (te) => {
        D.buffer = te;
      }),
      b("ir_shed", 0, (te) => {
        C.buffer = te;
      });
    function ie(te, he, pe, ge) {
      te.positionX
        ? ((te.positionX.value = he),
          (te.positionY.value = pe),
          (te.positionZ.value = ge))
        : te.setPosition(he, pe, ge);
    }
    function F(te) {
      let he = e.createPanner();
      return (
        (he.panningModel = te ? "HRTF" : "equalpower"),
        (he.distanceModel = "inverse"),
        (he.refDistance = 3),
        (he.rolloffFactor = 0.6),
        (he.maxDistance = 400),
        (he.coneInnerAngle = 360),
        he
      );
    }
    let X = { world: [], near: [], dry: [], music: [] };
    function ne(te, he) {
      let pe = {
        g: m(0),
        pan: null,
        src: null,
        end: 0,
        start: 0,
        name: "",
        pri: 0,
      };
      he
        ? ((pe.pan = F(!1)), pe.g.connect(pe.pan), pe.pan.connect(H[te]))
        : pe.g.connect(H[te]),
        X[te].push(pe);
    }
    for (let te = 0; te < 22; te++) ne("world", !0);
    for (let te = 0; te < 12; te++) ne("near", !1);
    for (let te = 0; te < 8; te++) ne("dry", !1);
    for (let te = 0; te < 3; te++) ne("music", !1);
    let re = { x: 0, y: 1.7, z: 0 },
      $ = !1,
      ue = !1,
      me = 0.9,
      ee = (i.game && i.game.state) || "title",
      B = 0,
      P = 0,
      V = 0,
      Y = 0,
      L = 0,
      Z = 0,
      J = 1,
      oe = 1,
      fe = 0,
      le = -9,
      R = -9,
      I = 0,
      se = -9,
      ae = -9,
      k = -9,
      ce = -9,
      ve = -9,
      _e = -9,
      Te = -9,
      Pe = {},
      Re = { autoIntensity: !0 };
    function Fe(te, he, pe, ge) {
      let ye = null,
        Le = 0,
        ke = null,
        Ue = null;
      for (let ct = 0; ct < te.length; ct++) {
        let De = te[ct];
        if (De.end <= ge) {
          ye || (ye = De);
          continue;
        }
        De.name === he && (Le++, (!ke || De.start < ke.start) && (ke = De)),
          (!Ue ||
            De.pri < Ue.pri ||
            (De.pri === Ue.pri && De.start < Ue.start)) &&
            (Ue = De);
      }
      return Le >= (pe.max || 4)
        ? ke
        : ye || (Ue && Ue.pri <= pe.pri ? Ue : null);
    }
    function ze(te, he) {
      (he = he || {}),
        (te = i_[te] || te),
        he.surface &&
          (te === "impact_concrete"
            ? (te = l_[he.surface] || te)
            : te === "step_concrete" && (te = Iv[he.surface] || te));
      let pe = Go[te];
      if (!pe || pe.loop || pe.ir || !o()) return !1;
      let ge = he.variant;
      ge == null
        ? (ge = Pe[te] =
            ((Pe[te] || 0) + 1 + (pe.n > 2 && s() < 0.3 ? 1 : 0)) % pe.n)
        : (ge %= pe.n);
      let ye = r.get(te + "#" + ge);
      if (!ye) {
        if (tC.has(te)) {
          let Ht = e.currentTime;
          return (
            b(te, ge, () => {
              e.currentTime - Ht < 2.5 &&
                ze(te, Object.assign({}, he, { variant: ge }));
            }),
            !1
          );
        }
        ye = p(te, ge);
      }
      let Le = e.currentTime,
        ke = he.pos,
        Ue = !!ke && pe.bus === "world",
        ct = Ue ? X.world : X[pe.bus === "world" ? "near" : pe.bus],
        De = Fe(ct, te, pe, Le);
      if (!De) return !1;
      let it = Le + (he.delay || 0),
        gt = De.g.gain;
      if ((gt.cancelScheduledValues(Le), De.end > Le && De.src)) {
        gt.setTargetAtTime(0, Le, 0.004);
        try {
          De.src.stop(Le + 0.025);
        } catch {}
        it = Math.max(it, Le + 0.025);
      }
      let Ot = he.jitter != null ? he.jitter : 0.035,
        xn = pi((he.pitch || 1) * (1 + (s() * 2 - 1) * Ot), 0.25, 4);
      if (
        (gt.setValueAtTime(
          (he.gain != null ? he.gain : 1) * (1 - s() * 0.08),
          it,
        ),
        Ue)
      ) {
        let Ht = Array.isArray(ke) ? { x: ke[0], y: ke[1], z: ke[2] } : ke;
        ie(De.pan, Ht.x || 0, Ht.y || 0, Ht.z || 0),
          (De.pan.refDistance = he.ref || pe.ref || 3),
          (De.pan.rolloffFactor =
            he.roll != null ? he.roll : pe.roll != null ? pe.roll : 0.6);
      }
      let $t = e.createBufferSource();
      return (
        ($t.buffer = ye),
        ($t.playbackRate.value = xn),
        $t.connect(De.g),
        ($t.onended = () => {
          try {
            $t.disconnect();
          } catch {}
        }),
        $t.start(it),
        (De.src = $t),
        (De.start = it),
        (De.end = it + ye.duration / xn + 0.03),
        (De.name = te),
        (De.pri = pe.pri || 0),
        !0
      );
    }
    let We = new Set(),
      Ne = new Set(),
      dt = () => {},
      xe = !1,
      Ie = { setPos: dt, setGain: dt, setPitch: dt, stop: dt, alive: !1 };
    function Be(te, he) {
      he = he || {};
      let pe = Go[te];
      if (!pe || !pe.loop) return Ie;
      let ge = (te === "gull_rotor" || te === "hound_servo") && !he._auto;
      ge && !he.hrtf && (he = Object.assign({ hrtf: !0 }, he));
      let ye = {
          name: te,
          alive: !0,
          vT: 1,
          vC: 1,
          px: 0,
          py: 0,
          pz: 0,
          gT: he.gain != null ? he.gain : 1,
          gC: 0,
          pT: he.pitch || 1,
          pC: he.pitch || 1,
          src: null,
          g: m(0),
          pan: null,
          rate: he.fade || 6,
        },
        Le = ye.g;
      if (
        (he.pos &&
          ((ye.pan = F(!!he.hrtf)),
          (ye.pan.refDistance = he.ref || pe.ref || 3),
          (ye.pan.rolloffFactor =
            he.roll != null ? he.roll : pe.roll != null ? pe.roll : 0.6),
          ye.g.connect(ye.pan),
          (Le = ye.pan)),
        Le.connect(
          H[he.bus || (he.pos ? "world" : pe.music ? "music" : "amb")],
        ),
        (ye.setPos = (ke) => {
          ye.pan &&
            ke &&
            (Array.isArray(ke)
              ? ((ye.px = ke[0]), (ye.py = ke[1]), (ye.pz = ke[2]))
              : ((ye.px = ke.x || 0), (ye.py = ke.y || 0), (ye.pz = ke.z || 0)),
            Number.isFinite(ye.px + ye.py + ye.pz) &&
              ie(ye.pan, ye.px, ye.py, ye.pz));
        }),
        (ye.setGain = (ke) => {
          ye.gT = Math.max(0, +ke || 0);
        }),
        (ye.setPitch = (ke) => {
          ye.pT = pi(+ke || 1, 0.25, 4);
        }),
        (ye.stop = (ke) => {
          if (!ye.alive) return;
          (ye.alive = !1), We.delete(ye), Ne.delete(ye);
          let Ue = ke ?? 0.18,
            ct = e.currentTime;
          try {
            ye.g.gain.setValueAtTime(ye.gC, ct),
              ye.g.gain.linearRampToValueAtTime(0, ct + Ue),
              ye.src && ye.src.stop(ct + Ue + 0.03);
          } catch {}
          setTimeout(
            () => {
              try {
                ye.src && ye.src.disconnect(),
                  ye.g.disconnect(),
                  ye.pan && ye.pan.disconnect();
              } catch {}
            },
            (Ue + 0.3) * 1e3,
          );
        }),
        he.pos && ye.setPos(he.pos),
        b(te, 0, (ke) => {
          if (!ye.alive) return;
          let Ue = e.createBufferSource();
          (Ue.buffer = ke),
            (Ue.loop = !0),
            (Ue.playbackRate.value = ye.pC),
            Ue.connect(ye.g),
            Ue.start(0, he.offset != null ? he.offset : s() * ke.duration),
            (ye.src = Ue);
        }),
        We.add(ye),
        ge && (Ne.add(ye), !xe))
      ) {
        xe = !0;
        for (let ke of [...pn.keys()]) Rs(ke);
      }
      return ye;
    }
    let Xe = { on: !1, layers: {} };
    function Me() {
      if (Xe.on || !o()) return;
      for (let he of tm) if (!r.has(he + "#0")) return;
      let te = e.currentTime + 0.08;
      for (let he of tm) {
        let pe = m(0),
          ge = e.createBufferSource();
        (ge.buffer = r.get(he + "#0")),
          (ge.loop = !0),
          ge.connect(pe),
          pe.connect(H.music),
          ge.start(te),
          (Xe.layers[he] = { g: pe, s: ge, c: 0 });
      }
      (Xe.on = !0), (Xe.t0 = te);
    }
    function we(te) {
      return ee === "title"
        ? [0.85, 0, 0, 0, 0.9]
        : ee === "intro"
          ? [0.8, 0, 0, 0, 0.6]
          : ee === "dead"
            ? [0.75, 0, 0, 0, 0]
            : ee === "complete"
              ? [0.6, 0, 0, 0, 0.7]
              : [
                  0.6 + 0.3 * te,
                  Pv(0.05, 0.5, te) * 0.85,
                  Pv(0.4, 0.8, te) * 0.95,
                  Pv(0.62, 1, te) * 0.8,
                  0,
                ];
    }
    function be(te) {
      Go[te].music && Me();
    }
    let Oe = {
        rain: Be("rain", { gain: 0, fade: 2 }),
        rainIn: Be("rain_interior", { gain: 0, fade: 2 }),
        wind: Be("wind", { gain: 0, fade: 2 }),
        sea: Be("sea", { gain: 0, pos: [33, -1, 0], fade: 2, bus: "amb" }),
      },
      pt = 0.4,
      ut = 0.4,
      nn = 2,
      bt = {
        fog: 14 + s() * 14,
        gull: 5 + s() * 8,
        hal: 4 + s() * 6,
        bang: 20 + s() * 25,
      };
    function Os(te, he) {
      let pe = 1 - 0.7 * P;
      if ((bt.fog -= te) <= 0) {
        bt.fog = 40 + s() * 30;
        let ge = re.z + (s() * 2 - 1) * 250;
        ze("foghorn", {
          pos: [re.x + 320, 8, ge],
          ref: 400,
          gain: 0.34 * he * pe,
          pitch: s() < 0.3 ? 0.89 : 1,
          jitter: 0.01,
        });
      }
      if ((bt.gull -= te) <= 0) {
        bt.gull = 9 + s() * 16;
        let ge = s() * 6.283,
          ye = 35 + s() * 50;
        ze("gull_cry", {
          pos: [
            re.x + Math.cos(ge) * ye,
            14 + s() * 18,
            re.z + Math.sin(ge) * ye,
          ],
          ref: ye,
          roll: 1,
          gain: (0.16 + s() * 0.16) * he * pe,
          jitter: 0.1,
        });
      }
      if (
        ((bt.hal -= te) <= 0 &&
          ((bt.hal = 6 + s() * 11),
          ze("halyard", {
            pos: [29 + s() * 8, 3 + s() * 6, -8 + s() * 32],
            ref: 16,
            roll: 0.5,
            gain: (0.3 + s() * 0.3) * he * pe,
            jitter: 0.08,
          })),
        (bt.bang -= te) <= 0)
      ) {
        bt.bang = 28 + s() * 34;
        let ge = 1.6 + s() * 3.2;
        ze("container_bang", {
          pos: [re.x + Math.cos(ge) * 150, 4, re.z + Math.sin(ge) * 150],
          ref: 150,
          gain: (0.2 + s() * 0.16) * he * pe,
          jitter: 0.12,
        });
      }
    }
    let pn = new Map(),
      Ti = 0;
    function ho(te) {
      !te ||
        xe ||
        pn.has(te) ||
        te.alive === !1 ||
        pn.set(te, {
          h: null,
          type: te.type === "hound" ? "hound" : "gull",
          lx: te.pos ? te.pos.x : 0,
          ly: te.pos ? te.pos.y : 0,
          lz: te.pos ? te.pos.z : 0,
          sp: 0,
          d: 1e9,
          tune: 0.96 + s() * 0.1,
        });
    }
    function Rs(te) {
      let he = pn.get(te);
      he && (he.h && he.h.stop(0.12), pn.delete(te));
    }
    let Un = [];
    function zo(te) {
      if (((Ti -= te), Ti <= 0 && xe)) {
        (Ti = 0.25), (Un.length = 0);
        for (let he of Ne)
          (he.d = Math.hypot(he.px - re.x, he.py - re.y, he.pz - re.z)),
            Un.push(he);
        Un.sort((he, pe) => he.d - pe.d);
        for (let he = 0; he < Un.length; he++)
          Un[he].vT = he < 6 && Un[he].d < 90 ? 1 : 0;
      }
      if (Ti <= 0) {
        Ti = 0.25;
        let he = i.enemies && i.enemies.list;
        if (Array.isArray(he))
          for (let pe = 0; pe < he.length; pe++) {
            let ge = he[pe];
            ge && ge.alive !== !1 && !pn.has(ge) && ho(ge);
          }
        Un.length = 0;
        for (let [pe, ge] of pn) {
          if (pe.alive === !1 || (Array.isArray(he) && he.indexOf(pe) < 0)) {
            Rs(pe);
            continue;
          }
          let ye = pe.pos;
          ye &&
            ((ge.d = Math.hypot(ye.x - re.x, ye.y - re.y, ye.z - re.z)),
            Un.push(ge));
        }
        Un.sort((pe, ge) => pe.d - ge.d);
        for (let pe = 0; pe < Un.length; pe++) {
          let ge = Un[pe],
            ye = pe < 6 && ge.d < 90;
          ye && !ge.h
            ? (ge.h = Be(ge.type === "gull" ? "gull_rotor" : "hound_servo", {
                pos: [ge.lx, ge.ly, ge.lz],
                gain: 0,
                hrtf: !0,
                fade: 5,
                _auto: !0,
              }))
            : !ye && ge.h && (ge.h.stop(0.25), (ge.h = null));
        }
      }
      for (let [he, pe] of pn) {
        let ge = he.pos;
        if (ge) {
          if (te > 0) {
            let ye = Math.hypot(ge.x - pe.lx, ge.y - pe.ly, ge.z - pe.lz) / te;
            pe.sp += (Math.min(ye, 30) - pe.sp) * Math.min(1, te * 5);
          }
          if (((pe.lx = ge.x), (pe.ly = ge.y), (pe.lz = ge.z), !!pe.h))
            if ((pe.h.setPos(ge), pe.type === "gull"))
              pe.h.setGain(1),
                pe.h.setPitch(pe.tune * (0.94 + 0.3 * pi(pe.sp / 10, 0, 1)));
            else {
              let ye = pi(pe.sp / 3, 0, 1);
              pe.h.setGain(0.3 + 0.5 * ye),
                pe.h.setPitch(pe.tune * (0.88 + 0.3 * ye));
            }
        }
      }
    }
    let $i = [];
    function ya() {
      for (let he of $i) he.h.stop(0.2);
      $i = [];
      let te = i.level && i.level.objectives;
      Array.isArray(te) &&
        te.forEach((he, pe) => {
          he &&
            he.pos &&
            $i.push({
              id: he.id,
              index: pe,
              pos: { x: he.pos.x, y: (he.pos.y || 0) + 1.2, z: he.pos.z },
              h: Be("relay_hum", {
                pos: [he.pos.x, (he.pos.y || 0) + 1.2, he.pos.z],
                gain: 0.9,
              }),
            });
        });
    }
    function ba(te) {
      te = te || {};
      let he = $i.findIndex((pe) => te.id != null && pe.id === te.id);
      if (
        (he < 0 &&
          te.index != null &&
          (he = $i.findIndex((pe) => pe.index === te.index)),
        he >= 0)
      ) {
        let pe = $i[he];
        pe.h.stop(0.08),
          $i.splice(he, 1),
          ze("relay_cut", { pos: pe.pos, gain: 1 });
      } else ze("relay_cut", { gain: 0.8 });
    }
    let Hn = (te) => (te && typeof te.x == "number" ? te : null);
    function fo(te) {
      let he = P;
      he < 0.95 && ze("rifle_tail_out", { gain: te * (1 - he), jitter: 0.03 }),
        he > 0.05 && ze("rifle_tail_in", { gain: te * he, jitter: 0.03 }),
        (R = e.currentTime);
    }
    let ln = (te, he) => {
      n &&
        n.on &&
        n.on(te, (pe) => {
          try {
            he(pe || {});
          } catch (ge) {
            console.error("[audio] " + te, ge);
          }
        });
    };
    ln("weapon:fire", (ev) => {
      (I = (I + 1) & 3);
      let wid = ev && ev.weapon;
      if (wid === "breaker12") {
        ze("rifle_shot", { variant: I, gain: 1.1, jitter: 0.02, pitch: 0.7 });
        ze("explosion", { gain: 0.16, jitter: 0.1, pitch: 2.4, delay: 0.01 });
      } else if (wid === "dmr") {
        ze("rifle_shot", { variant: I, gain: 1.05, jitter: 0.01, pitch: 1.08 });
      } else ze("rifle_shot", { variant: I, gain: 1, jitter: 0.012 });
      let te = e.currentTime;
      (le = te),
        te - R > 0.28 && fo(1),
        (J = Math.min(J, 0.55)),
        Y > 0.3 && (Y = Math.min(1, Y + 0.015));
    }),
      ln("weapon:dry", () => ze("rifle_dry", { gain: 0.9 })),
      ln("weapon:reload", (te) => {
        te.phase === "magout"
          ? ze("reload_magout")
          : te.phase === "magin"
            ? ze("reload_magin")
            : te.phase === "bolt"
              ? ze("reload_bolt")
              : te.phase === "start" && ze("jump", { gain: 0.5, pitch: 1.3 });
      }),
      ln("weapon:melee", () => ze("jump", { gain: 0.9, pitch: 1.2 })),
      ln("shell:bounce", (te) => {
        let he = e.currentTime;
        he - ce < 0.04 ||
          ((ce = he),
          te.surface === "water"
            ? ze("impact_water", { pos: Hn(te.pos), gain: 0.25, pitch: 1.7 })
            : ze("shell_bounce", {
                pos: Hn(te.pos),
                gain: te.surface === "metal" ? 1 : 0.8,
                pitch: te.surface === "metal" ? 1.12 : 1,
              }));
      }),
      ln("impact", (te) => {
        let he = e.currentTime;
        if (he - se < 0.022) return;
        se = he;
        let pe = Hn(te.point),
          ge = te.surface;
        if (te.enemy) {
          ze("impact_enemy", {
            pos: pe,
            gain: te.part === "weak" ? 1 : 0.85,
            pitch: te.part === "weak" ? 1.25 : 1,
          });
          return;
        }
        if (
          te.from === "enemy" &&
          pe &&
          te.dir &&
          typeof te.dir.x == "number" &&
          he - Te > 0.09
        ) {
          let ye = te.dir,
            Le = ye.x * ye.x + ye.y * ye.y + ye.z * ye.z || 1,
            ke =
              ((re.x - pe.x) * ye.x +
                (re.y - pe.y) * ye.y +
                (re.z - pe.z) * ye.z) /
              Le;
          if (ke < -1.5) {
            let Ue = pe.x + ye.x * ke,
              ct = pe.y + ye.y * ke,
              De = pe.z + ye.z * ke,
              it = Math.hypot(re.x - Ue, re.y - ct, re.z - De);
            it < 3.2 &&
              ((Te = he),
              ze("whiz", {
                pos: { x: Ue, y: ct, z: De },
                gain: pi(1.15 - it / 3.5, 0.3, 1),
                jitter: 0.1,
              }));
          }
        }
        ze(l_[ge] || "impact_concrete", {
          pos: pe,
          gain: te.from === "enemy" ? 0.8 : 0.9,
          pitch: ge === "dirt" ? 0.8 : ge === "rubber" ? 0.7 : 1,
          jitter: 0.07,
        }),
          he - ae > 0.22 &&
            ((ge === "metal" && s() < 0.24) ||
              (ge === "concrete" && s() < 0.07)) &&
            ((ae = he),
            ze("ricochet", {
              pos: pe,
              gain: 0.75,
              delay: 0.012,
              jitter: 0.12,
            }));
      }),
      ln("player:step", (te) => {
        let he = te.surface || "concrete";
        try {
          te.pos &&
            i.ground &&
            i.ground.isPuddle &&
            i.ground.isPuddle(te.pos.x, te.pos.z) &&
            (he = "water");
        } catch {}
        ze(Iv[he] || "step_concrete", {
          gain: (te.sprint ? 0.8 : 0.55) * (he === "water" ? 0.9 : 1),
          pitch: (te.sprint ? 1.05 : 1) * (he === "wood" ? 1.18 : 1),
          jitter: 0.06,
        });
      }),
      ln("player:jump", () => ze("jump", { gain: 0.8 })),
      ln("player:land", (te) => {
        let he = pi(0.35 + (Math.abs(te.speed) || 4) / 10, 0.35, 1);
        ze("land", { gain: he }),
          (te.surface === "water" || te.surface === "metal") &&
            ze(Iv[te.surface], { gain: he * 0.8, pitch: 0.9 });
      }),
      ln("player:hit", (te) => {
        let he = +te.amount || 10,
          pe = e.currentTime;
        ze("hurt", { gain: pi(0.5 + he / 40, 0.5, 1), jitter: 0.08 }),
          he >= 6 &&
            pe - k > 1.8 &&
            ((k = pe),
            ze("ear_ring", { gain: pi(he / 28, 0.3, 1), jitter: 0.02 })),
          (Z = Math.max(Z, pi(he / 40, 0.2, 0.7))),
          (Y = Math.min(1, Math.max(Y, 0.6) + 0.15));
      }),
      ln("player:dead", () => {
        e.currentTime - _e > 1 &&
          ((_e = e.currentTime), ze("death", { gain: 1, jitter: 0 })),
          (Z = 1);
      }),
      ln("enemy:spawn", (te) => ho(te.enemy)),
      ln("enemy:alert", (te) => {
        Y = Math.max(Y, 0.6);
        let he = e.currentTime;
        if (he - ve < 0.12) return;
        ve = he;
        let pe = te.enemy || {};
        ze("alert", {
          pos: Hn(pe.pos) || Hn(te.pos),
          variant: pe.type === "hound" ? 1 : 0,
          gain: 0.9,
        });
      }),
      ln("enemy:fire", (te) => {
        let he = te.type || (te.enemy && te.enemy.type),
          pe = Hn(te.pos) || (te.enemy && Hn(te.enemy.pos));
        let vv = te.enemy && te.enemy.variant;
        let vpitch = vv === "marksman" ? 1.25 : vv === "heavy" ? 0.68 : vv === "turret" ? 0.82 : 1;
        let vgain = vv === "turret" ? 1.15 : 1;
        ze(he === "hound" ? "hound_fire" : "gull_fire", {
          pos: pe,
          gain: vgain,
          jitter: 0.04,
          pitch: vpitch,
        }),
          (Y = Math.min(1, Math.max(Y, 0.6) + 0.05));
      }),
      ln("enemy:step", (te) => {
        if (te.crash) {
          ze("hound_step", { pos: Hn(te.pos), gain: 1, pitch: 0.72 }),
            ze("impact_metal", { pos: Hn(te.pos), gain: 0.8, pitch: 0.55 });
          return;
        }
        te.type !== "gull" &&
          ze("hound_step", {
            pos: Hn(te.pos),
            gain: pi(0.6 + (+te.speed || 2) * 0.1, 0.6, 1),
            jitter: 0.06,
          });
      }),
      ln("enemy:telegraph", (te) => {
        let he = te.enemy || {},
          pe = te.type || he.type,
          ge = pi(+te.time || 0.55, 0.15, 1.5);
        ze("telegraph", {
          pos: Hn(te.pos) || Hn(he.pos),
          variant: pe === "hound" ? 1 : 0,
          pitch: 0.55 / ge,
          gain: te.melee ? 0.7 : 1,
          jitter: 0,
        }),
          (Y = Math.max(Y, 0.6));
      }),
      ln("enemy:melee", (te) => {
        let he = Hn(te.pos) || (te.enemy && Hn(te.enemy.pos));
        ze("hound_step", { pos: he, gain: 1, pitch: 0.8 }),
          ze("impact_metal", { pos: he, gain: 0.9, pitch: 0.7 }),
          ze("hurt", { gain: 0.6 });
      }),
      ln("enemy:killed", (te) => {
        let he = te.enemy,
          pe = te.type || (he && he.type),
          ge = Hn(te.pos) || (he && Hn(he.pos));
        he && Rs(he),
          ze(pe === "hound" ? "hound_die" : "gull_die", {
            pos: ge,
            gain: 1,
            jitter: 0.05,
          });
      }),
      ln("explosion", (te) => {
        let he = pi(+te.size || 1, 0.3, 3),
          pe = Hn(te.pos);
        if (
          (ze("explosion", {
            pos: pe,
            gain: pi(0.6 + 0.25 * he, 0.5, 1.1),
            pitch: pi(1.12 - 0.1 * he, 0.8, 1.15),
            jitter: 0.04,
          }),
          pe)
        ) {
          let ge = Math.hypot(pe.x - re.x, pe.y - re.y, pe.z - re.z);
          Z = Math.max(Z, pi(1 - (ge - 5) / 10, 0, 0.8));
        }
        (Y = Math.max(Y, 0.6)), (J = Math.min(J, 0.4));
      }),
      ln("objective:done", (te) => {
        ba(te), ze("objective", { delay: 0.35, gain: 1, jitter: 0 });
      }),
      ln("objective:all", () =>
        ze("objective_all", { delay: 2.2, gain: 1, jitter: 0 }),
      );
    let Zo = () => {
      let te = e.currentTime;
      te - _e > 6 && ((_e = te), ze("complete", { gain: 1, jitter: 0 }));
    };
    ln("extraction:reached", Zo),
      ln("thunder", (te) => {
        let he = pi(te.intensity != null ? +te.intensity : 0.6, 0.1, 1);
        ze("thunder", {
          variant: he > 0.6 ? 1 : 0,
          delay: 0.5 + (1 - he) * 2 + s() * 0.6,
          gain: 0.35 + 0.65 * he,
          jitter: 0.1,
        });
      }),
      ln("ui:click", () => ze("ui_click")),
      ln("ui:hover", () => ze("ui_hover")),
      ln("game:state", (te) => {
        let he = ee;
        if (((ee = te.state || ee), ee === "playing" && he !== "paused")) {
          (Y = 0), (Z = 0), ya();
          for (let pe of [...pn.keys()]) pe.alive === !1 && Rs(pe);
        }
        ee === "complete" && Zo(),
          ee === "paused" ? (ue = !0) : he === "paused" && (ue = !1);
      });
    function yr() {
      if ((($ = !0), e.state !== "running" && e.state !== "closed"))
        try {
          let te = e.resume();
          te && te.catch && te.catch(() => {});
        } catch {}
    }
    if (typeof window < "u" && !t) {
      let te = () => {
        if ((yr(), o()))
          for (let he of ["pointerdown", "keydown", "touchend", "mousedown"])
            window.removeEventListener(he, te, !0);
      };
      for (let he of ["pointerdown", "keydown", "touchend", "mousedown"])
        window.addEventListener(he, te, { capture: !0, passive: !0 });
      document.addEventListener("visibilitychange", () => {
        try {
          document.hidden ? e.suspend() : $ && e.resume();
        } catch {}
      });
    }
    function lu(te) {
      te = Math.min(Math.max(+te || 0, 0), 0.25);
      let he = i.camera,
        pe = e.listener;
      if (he && he.matrixWorld) {
        let De = he.matrixWorld.elements;
        (re.x = De[12]),
          (re.y = De[13]),
          (re.z = De[14]),
          Number.isFinite(re.x + re.y + re.z + De[8] + De[4]) &&
            (pe.positionX
              ? ((pe.positionX.value = re.x),
                (pe.positionY.value = re.y),
                (pe.positionZ.value = re.z),
                (pe.forwardX.value = -De[8]),
                (pe.forwardY.value = -De[9]),
                (pe.forwardZ.value = -De[10]),
                (pe.upX.value = De[4]),
                (pe.upY.value = De[5]),
                (pe.upZ.value = De[6]))
              : (pe.setPosition(re.x, re.y, re.z),
                pe.setOrientation(
                  -De[8],
                  -De[9],
                  -De[10],
                  De[4],
                  De[5],
                  De[6],
                )));
      }
      let ge = i.level && i.level.interiorBoxes;
      if (Array.isArray(ge) && ge.length) {
        let De = 0;
        for (let it = 0; it < ge.length; it++) {
          let gt = ge[it];
          if (
            gt &&
            gt.min &&
            gt.max &&
            re.x > gt.min.x &&
            re.x < gt.max.x &&
            re.y > gt.min.y - 0.5 &&
            re.y < gt.max.y &&
            re.z > gt.min.z &&
            re.z < gt.max.z
          ) {
            De = 1;
            break;
          }
        }
        B = De;
      }
      let ye = (De) => 1 - Math.exp(-te * De);
      if (
        ((P += (B - P) * ye(3)),
        (U.gain.value = 1 - 0.9 * P),
        (T.gain.value = P),
        !o())
      )
        return;
      Me();
      let Le = e.currentTime;
      le > R + 0.02 && Le - le > 0.1 && fo(0.9);
      let ke = ee === "playing" || ee === "intro";
      (fe +=
        ((ue ? 0 : ee === "title" ? 0.6 : ee === "dead" ? 0.7 : 1) - fe) *
        ye(1.2)),
        (oe += ((ue ? 0 : 1) - oe) * ye(12)),
        (z.gain.value = oe),
        (Z += ((ee === "dead" ? 0.85 : 0) - Z) * ye(ee === "dead" ? 3 : 0.9)),
        (S.frequency.value = 2e4 * Math.pow(0.03, pi(Z, 0, 1))),
        (w.gain.value = me),
        (nn -= te) <= 0 && ((nn = 3 + s() * 6), (ut = 0.12 + s() * 0.88)),
        (pt += (ut - pt) * ye(0.5)),
        Oe.rain.setGain(fe * (1 - 0.93 * P) * 0.95),
        Oe.rainIn.setGain(fe * P * 0.95),
        Oe.wind.setGain(fe * (0.3 + 0.7 * pt) * (1 - 0.65 * P) * 0.75),
        Oe.wind.setPitch(0.9 + 0.25 * pt),
        Oe.sea.setGain(fe * (1 - 0.5 * P) * 1),
        Oe.sea.setPos([33, -1, pi(re.z, -28, 26)]),
        !ue &&
          (ke || ee === "title" || ee === "complete") &&
          Os(te, ee === "title" ? 0.7 : 1),
        ue || zo(te),
        (Y = Math.max(0, Y - te * (pn.size ? 0.045 : 0.14)));
      let ct =
        ke || ue ? Math.max(V, Re.autoIntensity ? Math.max(0.15, Y) : 0) : 0;
      if (
        ((L += (ct - L) * ye(2)),
        (J += (1 - J) * ye(3.5)),
        (O.gain.value = J * (ue ? 0.45 : 1)),
        Xe.on)
      ) {
        let De = we(L),
          it = ye(1 / 0.5);
        for (let gt = 0; gt < tm.length; gt++) {
          let Ot = Xe.layers[tm[gt]];
          (Ot.c += (De[gt] - Ot.c) * it), (Ot.g.gain.value = Ot.c);
        }
      }
      for (let De of We)
        (De.vC += (De.vT - De.vC) * ye(4)),
          (De.gC += (De.gT * De.vC - De.gC) * ye(De.rate)),
          (De.g.gain.value = De.gC),
          De.src &&
            Math.abs(De.pT - De.pC) > 1e-4 &&
            ((De.pC += (De.pT - De.pC) * ye(8)),
            (De.src.playbackRate.value = De.pC));
    }
    async function de(te) {
      (te = te || {}), await x;
      let he = e.sampleRate,
        pe = te.seconds || 10,
        ge = new OfflineAudioContext(2, he * pe, he),
        ye = new Map(),
        Le = {
          on(Tt, Ai) {
            ye.has(Tt) || ye.set(Tt, []), ye.get(Tt).push(Ai);
          },
          emit(Tt, Ai) {
            for (let sn of ye.get(Tt) || []) sn(Ai);
          },
        },
        ke = new Float32Array(16);
      (ke[0] = ke[5] = ke[10] = ke[15] = 1), (ke[13] = 1.7);
      let Ue = [
          { type: "gull", alive: !0, pos: { x: 6, y: 4, z: -9 } },
          { type: "hound", alive: !0, pos: { x: -8, y: 0, z: -14 } },
          { type: "gull", alive: !0, pos: { x: 0, y: 5, z: -30 } },
        ],
        ct = { min: { x: -99, y: -9, z: -99 }, max: { x: 99, y: 99, z: 99 } },
        De = {
          events: Le,
          params: {},
          camera: { matrixWorld: { elements: ke } },
          enemies: { list: [] },
          level: {
            interiorBoxes: te.interior
              ? [ct]
              : [
                  {
                    min: { x: 500, y: 0, z: 500 },
                    max: { x: 501, y: 1, z: 501 },
                  },
                ],
            objectives: [{ id: "A", pos: { x: 4, y: 0, z: 3 } }],
          },
        },
        it = u_(De, ge, { bufs: r }),
        gt = 0.02,
        Ot = 0,
        xn = (Tt) => {
          let Ai = Tt * gt;
          if (
            (Tt === 0 && Le.emit("game:state", { state: "playing" }),
            Ai < 3 &&
              Tt % 23 === 0 &&
              Le.emit("player:step", { surface: "concrete", sprint: !1 }),
            Tt === 150)
          ) {
            for (let sn of Ue)
              De.enemies.list.push(sn), Le.emit("enemy:spawn", { enemy: sn });
            Le.emit("enemy:alert", { enemy: Ue[0] }), it.setIntensity(1);
          }
          Ai >= 3 &&
            Ai < 6 &&
            (Tt % 4 === 0 &&
              (Ai < 4.2 || Ai > 4.8) &&
              (Le.emit("weapon:fire", {}),
              Le.emit("impact", {
                point: { x: 4, y: 1, z: -12 },
                surface: Tt % 8 ? "metal" : "concrete",
                from: "player",
              }),
              Le.emit("shell:bounce", {
                pos: { x: 0.6, y: 0, z: 0.2 },
                surface: "concrete",
              })),
            Tt % 13 === 0 &&
              Le.emit("enemy:fire", {
                enemy: Ue[0],
                pos: Ue[0].pos,
                type: "gull",
              }),
            Tt % 17 === 0 &&
              Le.emit("enemy:fire", {
                enemy: Ue[1],
                pos: Ue[1].pos,
                type: "hound",
              }),
            Tt % 25 === 0 &&
              Le.emit("enemy:step", { pos: Ue[1].pos, type: "hound" })),
            Tt === 300 &&
              Le.emit("explosion", { pos: { x: 3, y: 0, z: -5 }, size: 1.5 }),
            Tt === 350 && Le.emit("player:hit", { amount: 20 }),
            Tt === 360 &&
              ((Ue[0].alive = !1),
              Le.emit("enemy:killed", {
                enemy: Ue[0],
                pos: Ue[0].pos,
                type: "gull",
              })),
            Tt === 400 &&
              (Le.emit("objective:done", { id: "A", index: 0, total: 3 }),
              it.setIntensity(0.15));
        };
      for (let Tt = 1; Tt * gt < pe - 0.01; Tt++)
        ge.suspend(Tt * gt).then(() => {
          xn(Tt), it.update(gt), Ot++, ge.resume();
        });
      xn(0), it.update(gt);
      let $t = performance.now(),
        Ht = await ge.startRendering(),
        Je = performance.now() - $t,
        Pt = {
          interior: !!te.interior,
          renderMs: Math.round(Je),
          steps: Ot,
          peak: 0,
          over: 0,
          nan: 0,
          rmsDb: [],
          inst: it.debug(),
        },
        Vt = Ht.getChannelData(0),
        ss = Ht.getChannelData(1),
        Hs = Math.round(he / 2);
      for (let Tt = 0; Tt * Hs < Vt.length; Tt++) {
        let Ai = 0;
        for (let sn = Tt * Hs; sn < (Tt + 1) * Hs && sn < Vt.length; sn++) {
          let os = Vt[sn],
            rs = ss[sn];
          (!(Math.abs(os) < 1e9) || !(Math.abs(rs) < 1e9)) && Pt.nan++;
          let Ni = Math.max(Math.abs(os), Math.abs(rs));
          Ni > Pt.peak && (Pt.peak = Ni),
            Ni >= 0.999 && Pt.over++,
            (Ai += os * os + rs * rs);
        }
        Pt.rmsDb.push(+(10 * Math.log10(Ai / (2 * Hs) + 1e-12)).toFixed(1));
      }
      return (Pt.peak = +Pt.peak.toFixed(3)), Pt;
    }
    return (
      Object.assign(Re, {
        ctx: e,
        resume: yr,
        play: ze,
        loop: Be,
        update: lu,
        ready: x,
        selfTest: de,
        setIntensity(te) {
          V = pi(+te || 0, 0, 1);
        },
        setInterior(te) {
          B = pi(+te || 0, 0, 1);
        },
        setVolume(te) {
          (me = pi(+te, 0, 1)),
            Number.isFinite(me) || (me = 0.9),
            (w.gain.value = me);
        },
        setPaused(te) {
          ue = !!te;
        },
        names: Object.keys(Go).filter((te) => !Go[te].ir),
        get intensity() {
          return L;
        },
        get interior() {
          return P;
        },
        debug() {
          let te = 0,
            he = e.currentTime;
          for (let pe in X) for (let ge of X[pe]) ge.end > he && te++;
          return {
            state: e.state,
            sampleRate: e.sampleRate,
            buffers: c,
            queued: d.length,
            genMs: Math.round(l),
            bootMs: Math.round(u),
            voices: te,
            loops: We.size,
            tracked: pn.size,
            music: Xe.on,
            intensity: +L.toFixed(2),
            interior: +P.toFixed(2),
            gameState: ee,
            reverb: [!!D.buffer, !!C.buffer],
          };
        },
      }),
      Re
    );
  }
  var h_ = {
      KeyW: "forward",
      KeyS: "back",
      KeyA: "left",
      KeyD: "right",
      Space: "jump",
      ShiftLeft: "sprint",
      ShiftRight: "sprint",
      KeyC: "crouch",
      ControlLeft: "crouch",
      ControlRight: "crouch",
      KeyR: "reload",
      KeyE: "interact",
      KeyF: "melee",
      KeyV: "melee",
      KeyG: "grenade",
      Digit1: "slot1",
      Digit2: "slot2",
      Digit3: "slot3",
      KeyX: "scan",
      Escape: "pause",
      KeyP: "pause",
      KeyQ: "scan",
      Enter: "fire",
      NumpadEnter: "fire",
      ArrowLeft: "turnL",
      ArrowRight: "turnR",
      ArrowUp: "turnU",
      ArrowDown: "turnD",
      KeyJ: "turnL",
      KeyL: "turnR",
      KeyI: "turnU",
      KeyK: "turnD",
    },
    f_ = 0.0021,
    d_ = 0.0052,
    p_ = 2.1,
    m_ = 3,
    If = 58,
    g_ = { pause: 1 };
  function v_(i) {
    let e =
        (i.renderer && i.renderer.domElement) ||
        document.getElementById("view"),
      t = document.getElementById("ui"),
      n = new Set(),
      s = new Set(),
      o = {
        key: new Set(),
        mouse: new Set(),
        touch: new Set(),
        pad: new Set(),
      },
      r = !1,
      a = !1,
      l = 0,
      c = 0,
      u = 0,
      h = [],
      f = {
        move: { x: 0, y: 0 },
        look: { dx: 0, dy: 0 },
        fire: !1,
        ads: !1,
        sprint: !1,
        crouch: !1,
        locked: !1,
        touch: !1,
        gamepad: !1,
        sensitivity: 1,
        invertY: !1,
        mode: "lock",
        down(P) {
          return n.has(P) && (r || g_[P] === 1);
        },
        pressed(P) {
          return s.has(P) && (r || g_[P] === 1);
        },
        update: ee,
        endFrame: B,
        requestLock: A,
        exitLock: _,
        setGameplay(P) {
          (P = !!P),
            P !== r &&
              ((r = P),
              P || v(),
              M && M.root.classList.toggle("on", P && f.touch));
        },
        setPrompt(P) {
          M && M.btn.interact.classList.toggle("on", !!P);
        },
        onModeChange(P) {
          h.push(P);
        },
        describeMode() {
          return f.mode === "touch"
            ? "触屏操作已启用"
            : f.mode === "drag"
              ? "鼠标捕获不可用：移动鼠标调整视角，停在屏幕边缘持续转向；点击开火；方向键或 IJKL 也可转向"
              : f.locked
                ? "鼠标已捕获，按 Esc 释放"
                : "点击游戏画面以捕获鼠标";
        },
      };
    function p(P) {
      if (f.mode !== P) {
        f.mode = P;
        for (let V of h)
          try {
            V(P);
          } catch (Y) {
            console.error(Y);
          }
      }
    }
    function d(P, V, Y) {
      if (!V) return;
      let L = o[P];
      if (Y) {
        if (L.has(V)) return;
        L.add(V), n.has(V) || (n.add(V), s.add(V));
      } else {
        if (!L.delete(V)) return;
        !o.key.has(V) &&
          !o.mouse.has(V) &&
          !o.touch.has(V) &&
          !o.pad.has(V) &&
          n.delete(V);
      }
    }
    function v() {
      for (let P in o) o[P].clear();
      n.clear(),
        (u = 0),
        (j = !1),
        M && (M.btn.ads.classList.remove("active"), ie(), (q = -1), (D = -1));
    }
    addEventListener("keydown", (P) => {
      let V = h_[P.code];
      if (!V) return;
      let Y = P.target;
      (Y &&
        (Y.tagName === "INPUT" ||
          Y.tagName === "SELECT" ||
          Y.tagName === "TEXTAREA")) ||
        (Y &&
          Y.tagName === "BUTTON" &&
          (P.code === "Space" ||
            P.code === "Enter" ||
            P.code === "NumpadEnter")) ||
        (r &&
          (P.code === "Space" ||
            P.code.startsWith("Arrow") ||
            P.code === "ControlLeft") &&
          P.preventDefault(),
        !P.repeat && d("key", V, !0));
    }),
      addEventListener("keyup", (P) => {
        d("key", h_[P.code], !1);
      }),
      addEventListener("blur", () => {
        v();
      });
    let g = (P) =>
      P === 0 ? "fire" : P === 2 ? "ads" : P === 1 ? "melee" : null;
    e.addEventListener("mousedown", (P) => {
      if (!(f.touch && performance.now() - E < 800) && r) {
        if (!f.locked && f.mode === "lock") {
          A(), P.preventDefault();
          return;
        }
        (u |= 1 << P.button), d("mouse", g(P.button), !0), P.preventDefault();
      }
    }),
      addEventListener("mouseup", (P) => {
        (u &= ~(1 << P.button)), d("mouse", g(P.button), !1);
      }),
      addEventListener("contextmenu", (P) => {
        (P.target === e || r) && P.preventDefault();
      }),
      addEventListener("mousemove", (P) => {
        if (
          r &&
          (f.mode === "drag" &&
            ((x = P.clientX / Math.max(1, innerWidth)),
            (y = P.clientY / Math.max(1, innerHeight)),
            (b = !0)),
          f.locked || f.mode === "drag")
        ) {
          let V = P.movementX || 0,
            Y = P.movementY || 0;
          if (Math.abs(V) > 400 || Math.abs(Y) > 400) return;
          (f.look.dx += V * f_ * f.sensitivity),
            (f.look.dy += Y * f_ * f.sensitivity * (f.invertY ? -1 : 1));
        }
      }),
      document.addEventListener("pointerlockchange", () => {
        if (((f.locked = document.pointerLockElement === e), f.locked))
          (a = !0), (l = 0), (c = 0), f.touch || p("lock");
        else {
          o.mouse.clear(), n.delete("fire"), n.delete("ads");
          for (let P of o.key) n.add(P);
          u = 0;
        }
        i.events.emit("input:lock", { locked: f.locked });
      }),
      document.addEventListener("pointerlockerror", () => m());
    let x = 0.5,
      y = 0.5,
      b = !1;
    document.addEventListener("mouseleave", () => {
      b = !1;
    });
    function m() {
      (l = 0), !(f.locked || f.touch) && (c++, a || p("drag"));
    }
    function A() {
      if (!(f.touch || f.locked)) {
        if (!e.requestPointerLock) {
          m();
          return;
        }
        try {
          l = performance.now();
          let P = e.requestPointerLock();
          P && P.catch && P.catch(() => m());
        } catch {
          m();
        }
        try {
          e.focus({ preventScroll: !0 });
        } catch {}
      }
    }
    function _() {
      try {
        document.pointerLockElement && document.exitPointerLock();
      } catch {}
    }
    let M = null,
      E = 0,
      w = -1,
      S = 0,
      z = 0,
      H = 0,
      O = 0,
      q = -1,
      U = 0,
      T = 0,
      D = -1,
      C = 0,
      G = 0,
      j = !1;
    function N() {
      let P = document.createElement("div");
      (P.className = "touch"),
        (P.innerHTML =
          '<div class="t-stick"><i class="t-ring"></i><i class="t-nub"></i></div><button class="t-btn t-fire" data-a="fire" aria-label="开火"><span>开火</span></button><button class="t-btn t-ads" data-a="ads" aria-label="瞄准"><span>瞄准</span></button><button class="t-btn t-reload" data-a="reload" aria-label="换弹"><span>换弹</span></button><button class="t-btn t-jump" data-a="jump" aria-label="跳跃"><span>跳跃</span></button><button class="t-btn t-interact" data-a="interact" aria-label="Interact"><span>交互</span></button><button class="t-btn t-pause" data-a="pause" aria-label="暂停"><span>暂停</span></button>'),
        t.appendChild(P);
      let V = (L) => P.querySelector(L),
        Y = {
          root: P,
          stick: V(".t-stick"),
          nub: V(".t-nub"),
          btn: {
            fire: V(".t-fire"),
            ads: V(".t-ads"),
            reload: V(".t-reload"),
            jump: V(".t-jump"),
            interact: V(".t-interact"),
            pause: V(".t-pause"),
          },
        };
      for (let L in Y.btn) {
        let Z = Y.btn[L];
        Z.addEventListener(
          "touchstart",
          (oe) => {
            oe.preventDefault(), oe.stopPropagation(), (E = performance.now());
            let fe = oe.changedTouches[0];
            if (L === "ads") {
              (j = !j), Z.classList.toggle("active", j);
              return;
            }
            L === "fire" &&
              ((D = fe.identifier), (C = fe.clientX), (G = fe.clientY)),
              Z.classList.add("active"),
              d("touch", L, !0);
          },
          { passive: !1 },
        );
        let J = (oe) => {
          if ((oe.preventDefault(), oe.stopPropagation(), L !== "ads")) {
            if (L === "fire") {
              let fe = !1;
              for (let le of oe.changedTouches)
                le.identifier === D && (fe = !0);
              if (!fe) return;
              D = -1;
            }
            Z.classList.remove("active"), d("touch", L, !1);
          }
        };
        Z.addEventListener("touchend", J, { passive: !1 }),
          Z.addEventListener("touchcancel", J, { passive: !1 }),
          Z.addEventListener(
            "touchmove",
            (oe) => {
              if ((oe.preventDefault(), L === "fire"))
                for (let fe of oe.changedTouches)
                  fe.identifier === D &&
                    (Q(fe.clientX - C, fe.clientY - G),
                    (C = fe.clientX),
                    (G = fe.clientY));
            },
            { passive: !1 },
          ),
          Z.addEventListener("contextmenu", (oe) => oe.preventDefault());
      }
      return Y;
    }
    function Q(P, V) {
      (f.look.dx += P * d_ * f.sensitivity),
        (f.look.dy += V * d_ * f.sensitivity * (f.invertY ? -1 : 1));
    }
    function K() {
      f.touch ||
        ((f.touch = !0),
        _(),
        M || (M = N()),
        M.root.classList.toggle("on", r),
        document.documentElement.classList.add("is-touch"),
        p("touch"));
    }
    function ie() {
      (w = -1), (H = O = 0), M && M.stick.classList.remove("on");
    }
    addEventListener(
      "touchstart",
      () => {
        (E = performance.now()), K();
      },
      { passive: !0, capture: !0 },
    ),
      e.addEventListener(
        "touchstart",
        (P) => {
          if ((P.preventDefault(), !!r))
            for (let V of P.changedTouches)
              V.clientX < innerWidth * 0.45 && w < 0
                ? ((w = V.identifier),
                  (S = V.clientX),
                  (z = V.clientY),
                  (H = O = 0),
                  M &&
                    ((M.stick.style.transform = `translate3d(${S}px,${z}px,0)`),
                    (M.nub.style.transform = "translate3d(0,0,0)"),
                    M.stick.classList.add("on")))
                : q < 0 &&
                  ((q = V.identifier), (U = V.clientX), (T = V.clientY));
        },
        { passive: !1 },
      ),
      e.addEventListener(
        "touchmove",
        (P) => {
          if ((P.preventDefault(), !!r))
            for (let V of P.changedTouches)
              if (V.identifier === w) {
                let Y = V.clientX - S,
                  L = V.clientY - z,
                  Z = Math.hypot(Y, L);
                Z > If && ((Y *= If / Z), (L *= If / Z)),
                  (H = Y / If),
                  (O = -L / If),
                  M &&
                    (M.nub.style.transform = `translate3d(${Y.toFixed(1)}px,${L.toFixed(1)}px,0)`);
              } else
                V.identifier === q &&
                  (Q(V.clientX - U, V.clientY - T),
                  (U = V.clientX),
                  (T = V.clientY));
        },
        { passive: !1 },
      );
    let F = (P) => {
      for (let V of P.changedTouches)
        V.identifier === w ? ie() : V.identifier === q && (q = -1);
    };
    e.addEventListener("touchend", F, { passive: !1 }),
      e.addEventListener("touchcancel", F, { passive: !1 });
    let X = {
        0: "jump",
        1: "crouch",
        2: "reload",
        3: "interact",
        5: "melee",
        6: "ads",
        7: "fire",
        9: "pause",
        10: "sprint",
        11: "melee",
      },
      ne = typeof navigator < "u" && !!navigator.getGamepads,
      re = 0,
      $ = 0,
      ue = (P) => {
        let V = Math.abs(P);
        return V < 0.16 ? 0 : (Math.sign(P) * (V - 0.16)) / 0.84;
      };
    function me(P) {
      if (((re = $ = 0), !ne)) return;
      let V;
      try {
        V = navigator.getGamepads();
      } catch {
        ne = !1;
        return;
      }
      let Y = null;
      for (let J = 0; V && J < V.length; J++)
        if (V[J] && V[J].connected && V[J].mapping === "standard") {
          Y = V[J];
          break;
        }
      if (!Y) {
        f.gamepad && ((f.gamepad = !1), o.pad.clear());
        return;
      }
      (f.gamepad = !0), (re = ue(Y.axes[0] || 0)), ($ = -ue(Y.axes[1] || 0));
      let L = ue(Y.axes[2] || 0),
        Z = ue(Y.axes[3] || 0);
      r &&
        ((f.look.dx += L * Math.abs(L) * m_ * P * f.sensitivity),
        (f.look.dy +=
          Z *
          Math.abs(Z) *
          m_ *
          0.7 *
          P *
          f.sensitivity *
          (f.invertY ? -1 : 1)));
      for (let J in X) {
        let oe = Y.buttons[J];
        d("pad", X[J], !!oe && (oe.pressed || oe.value > 0.4));
      }
    }
    function ee(P) {
      if (
        (me(P),
        l && performance.now() - l > 1200 && !f.locked && m(),
        f.mode === "drag" && r && b && !f.locked)
      ) {
        let Z =
            x < 0.12 ? -(0.12 - x) / 0.12 : x > 0.88 ? (x - 0.88) / 0.12 : 0,
          J = y < 0.1 ? -(0.1 - y) / 0.1 : y > 0.9 ? (y - 0.9) / 0.1 : 0;
        (f.look.dx += Z * 2.4 * P * f.sensitivity),
          (f.look.dy += J * 1.2 * P * f.sensitivity * (f.invertY ? -1 : 1));
      }
      let V = 0,
        Y = 0,
        L = !1;
      if (r) {
        (V = (n.has("right") ? 1 : 0) - (n.has("left") ? 1 : 0)),
          (Y = (n.has("forward") ? 1 : 0) - (n.has("back") ? 1 : 0)),
          (L = n.has("sprint")),
          w >= 0 &&
            ((V += H),
            (Y += O),
            Math.hypot(H, O) > 0.93 && O > 0.8 && (L = !0)),
          (V += re),
          (Y += $);
        let Z = Math.hypot(V, Y);
        Z > 1 && ((V /= Z), (Y /= Z));
        let J = (n.has("turnR") ? 1 : 0) - (n.has("turnL") ? 1 : 0),
          oe = (n.has("turnD") ? 1 : 0) - (n.has("turnU") ? 1 : 0);
        J && (f.look.dx += J * p_ * P), oe && (f.look.dy += oe * p_ * 0.6 * P);
      }
      (f.move.x = V),
        (f.move.y = Y),
        (f.fire = r && n.has("fire")),
        (f.ads = r && (n.has("ads") || j)),
        (f.sprint = r && L),
        (f.crouch = r && n.has("crouch"));
    }
    function B() {
      s.clear(), (f.look.dx = 0), (f.look.dy = 0);
    }
    return f;
  }
  var Mt = {
      walk: 3.8,
      sprint: 6.4,
      crouch: 1.9,
      ads: 2.4,
      accelGround: 34,
      decelGround: 26,
      accelAir: 9,
      gravity: 21,
      jumpApex: 1,
      coyote: 0.12,
      jumpBuffer: 0.13,
      standHeight: Pi.height,
      crouchHeight: 1.15,
      eyeRate: 11,
      stride: { walk: 1.55, sprint: 2.1, crouch: 1.05 },
      bobY: 0.024,
      bobX: 0.013,
      bobSprint: 1.9,
      bobAds: 0.22,
      rollStrafe: 0.02,
      landDip: 0.36,
      landDipMax: 0.2,
      fovSprint: 6,
      fovAds: 52,
      adsLook: 0.6,
      regenDelay: 4,
      regenRate: 25,
      recoilKeep: 0.35,
      recoilApply: 34,
      recoilRecover: 6.5,
      recoilHold: 0.09,
      shakeDecay: 1.7,
      shakePitch: 0.03,
      shakeYaw: 0.03,
      shakeRoll: 0.045,
      pitchLimit: 1.5,
    },
    rC = Math.sqrt(2 * Mt.gravity * Mt.jumpApex);
  function x_(i) {
    let e = i.camera,
      t = () => (i.render && i.render.post) || n,
      n = {},
      s = Pi.eye,
      o = Mt.standHeight,
      r = 0,
      a = 0,
      l = !0,
      c = 0,
      u = 0,
      h = 0,
      f = 0,
      p = 0,
      d = 0,
      v = 0,
      g = { x: 0, v: 0 },
      x = 0,
      y = 0,
      b = 0,
      m = 0,
      A = 0,
      _ = 0,
      M = 0,
      E = 99,
      w = 0,
      S = 0,
      z = 0,
      H = Pi.fov,
      O = 0,
      q = "concrete",
      U = new W(),
      T = new In(0, 0, 0, "YXZ"),
      D = new W(),
      C = {
        pos: new W(),
        eye: new W(),
        vel: new W(),
        forward: new W(0, 0, -1),
        yaw: 0,
        pitch: 0,
        health: 100,
        maxHealth: 100,
        alive: !0,
        onGround: !0,
        sprinting: !1,
        crouching: !1,
        ads: 0,
        speed: 0,
        enabled: !0,
        invulnerable: !1,
        baseFov: Pi.fov,
        hurtPulse: 0,
        lookScale: 1,
        lastSafe: D,
        tuning: Mt,
        reset(F) {
          let X = F ||
            (i.level && i.level.playerStart) || { pos: new W(), yaw: 0 };
          C.pos.copy(X.pos),
            (C.yaw = X.yaw || 0),
            (C.pitch = 0),
            C.vel.set(0, 0, 0),
            (C.health = C.maxHealth),
            (C.alive = !0),
            (C.onGround = !0),
            (C.sprinting = !1),
            (C.crouching = !1),
            (C.invulnerable = !1),
            (C.speed = 0),
            (s = Pi.eye),
            (o = Mt.standHeight),
            (r = 0),
            (a = 0),
            (l = !0),
            (c = 0),
            (u = 0),
            (h = 0),
            (f = 0),
            (p = d = 0),
            (v = 0),
            (g.x = g.v = 0),
            (x = y = b = m = 0),
            (A = 0),
            (_ = 0),
            (E = 99),
            (w = 0),
            (S = 0),
            (z = 0),
            (C.hurtPulse = 0),
            D.copy(C.pos);
          let ne = t();
          (ne.damage = 0), (ne.lowHealth = 0), (ne.ads = 0), K(0);
        },
        damage(F, X) {
          !C.alive ||
            C.invulnerable ||
            !(F > 0) ||
            ((C.health = Math.max(0, C.health - F)),
            (E = 0),
            (w = Math.min(1, w + 0.35 + F / 40)),
            C.addShake(0.22 + F / 70),
            i.events.emit("player:hit", { amount: F, fromPos: X }),
            C.health <= 0 &&
              ((C.alive = !1),
              (z = 0),
              (C.sprinting = !1),
              i.events.emit("player:dead", {})));
        },
        heal(F) {
          C.alive && (C.health = Math.min(C.maxHealth, C.health + F));
        },
        addRecoil(F = 0, X = 0) {
          let ne = Mt.recoilKeep;
          (C.pitch = Zn(C.pitch + F * ne, -Mt.pitchLimit, Mt.pitchLimit)),
            (C.yaw += X * ne),
            (x += F * (1 - ne)),
            (y += X * (1 - ne)),
            (x = Zn(x, -0.3, 0.3)),
            (y = Zn(y, -0.2, 0.2)),
            (A = Mt.recoilHold);
        },
        addShake(F = 0.3) {
          _ = Math.min(1, _ + F);
        },
        setFov(F) {
          C.baseFov = Zn(+F || Pi.fov, 55, 100);
        },
        update: N,
      };
    i.events.on("explosion", (F) => {
      if (!F || !F.pos) return;
      let X = C.eye.distanceTo(F.pos),
        ne = F.size || 1,
        re = Fo(1 - X / (14 + ne * 10)) * (0.35 + 0.35 * ne);
      re > 0.01 && C.addShake(re);
    });
    function G() {
      let F = i.physics && i.physics.boxes;
      if (!F) return !0;
      let X = Pi.radius * 0.9,
        ne = C.pos.y + Mt.crouchHeight - 0.05,
        re = C.pos.y + Mt.standHeight;
      for (let $ = 0; $ < F.length; $++) {
        let ue = F[$];
        if (
          !ue.bulletOnly &&
          !(
            C.pos.x + X < ue.min.x ||
            C.pos.x - X > ue.max.x ||
            C.pos.z + X < ue.min.z ||
            C.pos.z - X > ue.max.z
          ) &&
          ue.min.y < re &&
          ue.max.y > ne
        )
          return !1;
      }
      return !0;
    }
    function j() {
      let F = C.pos.x,
        X = C.pos.z;
      try {
        if (
          i.ground &&
          i.ground.isPuddle &&
          C.pos.y < 0.05 &&
          i.ground.isPuddle(F, X)
        )
          return "water";
      } catch {}
      if (q && q !== "concrete") return q;
      try {
        return (
          (i.level &&
            i.level.groundSurfaceAt &&
            i.level.groundSurfaceAt(F, X)) ||
          q ||
          "concrete"
        );
      } catch {
        return q || "concrete";
      }
    }
    function N(F) {
      let X = i.input,
        ne = i.weapon || {};
      if (
        (ne.stub || typeof ne.ads != "number"
          ? ((O = kn(O, C.enabled && X.ads ? 1 : 0, 14, F)), (C.ads = O))
          : (C.ads = Fo(ne.ads)),
        !C.alive)
      ) {
        (z += F), Q(F), K(F), ie(F);
        return;
      }
      let re = C.enabled;
      (C.lookScale = bi(1, Mt.adsLook, C.ads)),
        re &&
          ((C.yaw -= X.look.dx * C.lookScale),
          (C.pitch = Zn(
            C.pitch - X.look.dy * C.lookScale,
            -Mt.pitchLimit,
            Mt.pitchLimit,
          )),
          (C.yaw > Math.PI * 4 || C.yaw < -Math.PI * 4) &&
            (C.yaw = C.yaw % (Math.PI * 2))),
        re && X.crouch
          ? (C.crouching = !0)
          : C.crouching && G() && (C.crouching = !1),
        (o = C.crouching ? Mt.crouchHeight : Mt.standHeight);
      let ue = re ? X.move.x : 0,
        me = re ? X.move.y : 0,
        ee = ue * ue + me * me > 0.01,
        B =
          re &&
          X.sprint &&
          me > 0.55 &&
          Math.abs(ue) < 0.6 &&
          !C.crouching &&
          C.ads < 0.35 &&
          !X.fire;
      C.sprinting =
        (B && C.onGround && C.speed > Mt.walk * 0.6) ||
        (B && !C.onGround && C.sprinting);
      let P = Mt.walk;
      C.crouching ? (P = Mt.crouch) : B && (P = Mt.sprint),
        (P = bi(P, Math.min(P, Mt.ads), C.ads)),
        me < 0 && (P *= bi(1, 0.82, -me));
      let V = Math.sin(C.yaw),
        Y = Math.cos(C.yaw);
      U.set(ue * Y - me * V, 0, -ue * V - me * Y).multiplyScalar(P);
      let L = C.onGround
          ? ee
            ? Mt.accelGround
            : Mt.decelGround
          : ee
            ? Mt.accelAir
            : 0.6,
        Z = U.x - C.vel.x,
        J = U.z - C.vel.z;
      !C.onGround && !ee && ((Z = -C.vel.x), (J = -C.vel.z));
      let oe = Math.hypot(Z, J),
        fe = L * F;
      oe <= fe || oe < 1e-6
        ? (C.onGround || ee) && ((C.vel.x = U.x), (C.vel.z = U.z))
        : ((C.vel.x += (Z / oe) * fe), (C.vel.z += (J / oe) * fe)),
        (r = C.onGround ? Mt.coyote : Math.max(0, r - F)),
        (a = re && X.pressed("jump") ? Mt.jumpBuffer : Math.max(0, a - F)),
        a > 0 &&
          r > 0 &&
          (!C.crouching || G()) &&
          ((C.vel.y = rC),
          (a = 0),
          (r = 0),
          (C.onGround = !1),
          (C.crouching = !1),
          (o = Mt.standHeight),
          i.events.emit("player:jump", { pos: C.pos })),
        (C.vel.y -= Mt.gravity * F * 0.5),
        C.vel.y < -40 && (C.vel.y = -40);
      let le = C.vel.y,
        R = i.physics.moveCapsule(C.pos, C.vel, F, Pi.radius, o, l) || {};
      R.onGround || (C.vel.y -= Mt.gravity * F * 0.5);
      let I = i.physics.bounds;
      if (
        (I &&
          ((C.pos.x = Zn(C.pos.x, I.min.x + 0.4, I.max.x - 0.4)),
          (C.pos.z = Zn(C.pos.z, I.min.z + 0.4, I.max.z - 0.4))),
        (C.onGround = !!R.onGround),
        R.surface && (q = R.surface),
        C.onGround)
      ) {
        if (!l && c > 0.12) {
          let ce = Math.max(0, -le, u);
          (g.v -= Math.min(ce * Mt.landDip, 3.2)),
            ce > 7.5 && C.addShake(Math.min(0.5, (ce - 7.5) * 0.06)),
            i.events.emit("player:land", {
              speed: ce,
              surface: j(),
              pos: C.pos,
            }),
            ce > 13 && C.damage((ce - 13) * 7, null),
            (h = 0.35);
        }
        (c = 0),
          (u = 0),
          C.pos.x <= oi.quayX - 1.2 && C.pos.y > -0.5 && D.copy(C.pos);
      } else (c += F), (u = Math.max(u, -C.vel.y));
      (l = C.onGround),
        C.pos.y < oi.seaY - 2.2 &&
          (C.pos.copy(D),
          C.vel.set(0, 0, 0),
          (C.onGround = !0),
          (l = !0),
          (_ = 0.6),
          (C.yaw += Math.PI),
          C.damage(12, null),
          i.events.emit("player:rescued", {})),
        (C.speed = Math.hypot(C.vel.x, C.vel.z));
      let se = C.crouching
        ? Mt.stride.crouch
        : C.sprinting
          ? Mt.stride.sprint
          : Mt.stride.walk;
      if (C.onGround && C.speed > 0.5) {
        let ce = h;
        (h += (C.speed * F) / se),
          Math.floor(h) > Math.floor(ce) &&
            i.events.emit("player:step", {
              surface: j(),
              sprint: C.sprinting,
              pos: C.pos,
            });
      } else C.onGround && (h = kn(h, Math.round(h), 8, F));
      let ae = C.onGround
        ? Fo(C.speed / Mt.walk) *
          (C.sprinting ? Mt.bobSprint : 1) *
          bi(1, Mt.bobAds, C.ads) *
          (C.crouching ? 0.7 : 1)
        : 0;
      (f = kn(f, ae, 9, F)),
        (d = -Math.cos(h * Math.PI * 2) * Mt.bobY * f),
        (p = Math.sin(h * Math.PI) * Mt.bobX * f);
      let k = C.vel.x * Y - C.vel.z * V;
      (v = kn(v, (-k / Mt.sprint) * Mt.rollStrafe * bi(1, 0.4, C.ads), 8, F)),
        (E += F),
        E > Mt.regenDelay &&
          C.health < C.maxHealth &&
          (C.health = Math.min(C.maxHealth, C.health + Mt.regenRate * F)),
        K(F),
        ie(F);
    }
    function Q(F) {
      (C.vel.x = kn(C.vel.x, 0, 5, F)),
        (C.vel.z = kn(C.vel.z, 0, 5, F)),
        (C.vel.y -= Mt.gravity * F);
      try {
        let X = i.physics.moveCapsule(C.pos, C.vel, F, Pi.radius, 0.6, l);
        l = !!(X && X.onGround);
      } catch {}
      C.pos.y < oi.seaY - 1 && ((C.pos.y = oi.seaY - 1), (C.vel.y = 0)),
        (C.speed = 0),
        (C.sprinting = !1),
        (f = kn(f, 0, 10, F)),
        (p *= 0.9),
        (d *= 0.9);
    }
    function K(F) {
      let X = C.crouching ? Pi.crouchEye : Pi.eye,
        ne = 0,
        re = 0;
      if (C.alive) F > 0 ? (s = kn(s, X, Mt.eyeRate, F)) : (s = X);
      else {
        let Z = sl(0, 0.85, z),
          J = Z * Z;
        (X = bi(Pi.eye, 0.22, J)),
          (s = kn(s, X, 18, F)),
          (ne = 1.15 * J),
          (re = -0.25 * Z + 0.12 * Math.sin(Z * Math.PI));
      }
      if (F > 0) {
        let Z = -g.x * 150 - g.v * 17;
        (g.v += Z * F),
          (g.x += g.v * F),
          (g.x = Zn(g.x, -Mt.landDipMax, 0.05)),
          (A -= F),
          A <= 0 &&
            ((x = kn(x, 0, Mt.recoilRecover, F)),
            (y = kn(y, 0, Mt.recoilRecover, F))),
          (b = kn(b, x, Mt.recoilApply, F)),
          (m = kn(m, y, Mt.recoilApply, F)),
          (_ = Math.max(0, _ - Mt.shakeDecay * F)),
          (M += F);
      }
      let $ = Math.sin(C.yaw),
        ue = Math.cos(C.yaw);
      C.eye.set(C.pos.x + p * ue, C.pos.y + s + d + g.x, C.pos.z - p * $);
      let me = Zn(C.pitch + b, -1.55, 1.55),
        ee = C.yaw + m;
      T.set(me, ee, 0, "YXZ"), C.forward.set(0, 0, -1).applyEuler(T);
      let B = _ * _,
        P = M,
        V =
          B *
          Mt.shakePitch *
          (Math.sin(P * 43.1) + 0.6 * Math.sin(P * 71.7 + 1.3)),
        Y =
          B *
          Mt.shakeYaw *
          (Math.sin(P * 37.3 + 2.1) + 0.6 * Math.sin(P * 83.9)),
        L =
          B *
          Mt.shakeRoll *
          (Math.sin(P * 29.7 + 0.7) + 0.5 * Math.sin(P * 61.3 + 4));
      if (
        (e.position.copy(C.eye),
        e.rotation.set(
          me + V + re + g.x * 0.12,
          ee + Y,
          v + L + ne + p * 0.35,
          "YXZ",
        ),
        !i.params || !i.params.fov)
      ) {
        let Z = bi(
          C.baseFov + (C.sprinting ? Mt.fovSprint : 0),
          (i.weapon && i.weapon.adsFov) || Mt.fovAds,
          C.ads,
        );
        (H = F > 0 ? kn(H, Z, C.ads > 0.02 && C.ads < 0.98 ? 30 : 7, F) : Z),
          Math.abs(e.fov - H) > 0.01 &&
            ((e.fov = H), e.updateProjectionMatrix());
      }
    }
    function ie(F) {
      (w = Math.max(0, w - F * 1.9)), (C.hurtPulse = w);
      let X = C.alive ? sl(0.55, 0.12, C.health / C.maxHealth) : 1;
      S = kn(S, X, 4, F);
      let ne = t();
      (ne.damage = w), (ne.lowHealth = S), (ne.ads = C.ads);
    }
    return C;
  }
  function zv(i) {
    let e = { shots: 0, hits: 0, kills: 0 };
    return (
      i.events.on("enemy:killed", () => {
        e.kills++;
      }),
      {
        stats: e,
        reset() {
          e.shots = e.hits = e.kills = 0;
        },
        playerShot(
          n,
          s,
          { damage: o = 28, range: r = 300, impulse: a = 1 } = {},
        ) {
          e.shots++;
          let l = i.physics.raycast(n, s, r),
            c = i.enemies.raycast(n, s, l ? l.dist : r);
          if (c) {
            e.hits++;
            let u = c.part === "weak" ? 2.2 : 1,
              h = c.enemy.damage(o * u, c.point, s, c.part) === !0,
              f = {
                point: c.point,
                normal: c.normal || s.clone().negate(),
                dist: c.dist,
                surface: "enemy",
                enemy: c.enemy,
                part: c.part,
                dir: s,
                from: "player",
                killed: h,
              };
            return (
              i.events.emit("impact", f),
              i.events.emit("player:hitEnemy", {
                enemy: c.enemy,
                part: c.part,
                killed: h,
                weak: c.part === "weak",
              }),
              f
            );
          }
          if (l) {
            let u = {
              point: l.point,
              normal: l.normal,
              dist: l.dist,
              surface: l.surface,
              enemy: null,
              dir: s,
              from: "player",
            };
            return i.events.emit("impact", u), u;
          }
          return null;
        },
        enemyShot(n, s, { damage: o = 6, range: r = 200 } = {}) {
          let a = i.physics.raycast(n, s, r),
            l = a ? a.dist : r,
            c = i.player;
          if (c && c.alive) {
            let u = nm.copy(c.pos);
            u.y += 1;
            let h = u.sub(n).dot(s);
            if (h > 0 && h < l) {
              zf.copy(n).addScaledVector(s, h);
              let f = Math.abs(zf.y - (c.pos.y + 0.95));
              if (Math.hypot(zf.x - c.pos.x, zf.z - c.pos.z) < 0.38 && f < 0.95)
                return c.damage(o, n), !0;
            }
          }
          return (
            a &&
              i.events.emit("impact", {
                point: a.point,
                normal: a.normal,
                dist: a.dist,
                surface: a.surface,
                enemy: null,
                dir: s,
                from: "enemy",
              }),
            !1
          );
        },
        explode(n, s = 5, o = 80, r = "player") {
          for (let l of i.enemies.list) {
            if (!l.alive) continue;
            let c = l.pos.distanceTo(n);
            c < s &&
              i.physics.lineOfSight(n, nm.copy(l.pos).setY(l.pos.y + 0.5)) &&
              l.damage(
                o * (1 - c / s),
                l.pos,
                zf.copy(l.pos).sub(n).normalize(),
                "body",
              );
          }
          let a = i.player;
          if (a && a.alive) {
            let l = nm
              .copy(a.pos)
              .setY(a.pos.y + 1)
              .distanceTo(n);
            l < s &&
              i.physics.lineOfSight(n, nm.copy(a.pos).setY(a.pos.y + 1)) &&
              a.damage(o * 0.5 * (1 - l / s), n);
          }
        },
      }
    );
  }
  var nm = new W(),
    zf = new W();
  var Xv = {};
  br(Xv, { create: () => dm, showcase: () => PC, inventory: () => inventory });
  var im = (i, e, t) => {
      let n = Math.sin(i * 12.9898 + e * 78.233 + t * 37.719) * 43758.5453;
      return n - Math.floor(n);
    },
    cC = (i, e, t) => Math.max(Math.abs(i), Math.abs(e), Math.abs(t)) < 0.95,
    b_ = (i, e, t) => {
      let n = Math.abs(t);
      return n > 0.15 && n < 0.95;
    };
  function sm(i, e, t = 0, n = null) {
    let s = i.attributes.position,
      o = i.attributes.normal,
      r = s.count,
      a = new Float32Array(r * 3);
    for (let l = 0; l < r; l++) {
      let c = s.getX(l),
        u = s.getY(l),
        h = s.getZ(l),
        f =
          0.9 +
          0.2 * im(Math.round(c * 70), Math.round(u * 70), Math.round(h * 70));
      if (t > 0 && n && n(o.getX(l), o.getY(l), o.getZ(l))) {
        let p = im(
          Math.round(c * 300),
          Math.round(u * 300),
          Math.round(h * 300),
        );
        {
          let d = Math.max(0, p - 0.84) / 0.16;
          f *= 1 + t * 1.6 * d * d;
        }
      }
      (a[l * 3] = e[0] * f),
        (a[l * 3 + 1] = e[1] * f),
        (a[l * 3 + 2] = e[2] * f);
    }
    return i.setAttribute("color", new et(a, 3)), i;
  }
  var y_ = new In(),
    uC = new Ye();
  function Rt(i, e, t, n, s, o, r, a, l = 0, c = null) {
    let u = Wi(i, e, t, n);
    return (
      sm(u, a, l, cC),
      c &&
        (y_.set(c[0], c[1], c[2]),
        u.applyMatrix4(uC.makeRotationFromEuler(y_))),
      u.translate(s, o, -r),
      u
    );
  }
  function hC(i, e) {
    let t = new ji();
    if (
      (i.forEach((n, s) => (s ? t.lineTo(n[0], n[1]) : t.moveTo(n[0], n[1]))),
      t.closePath(),
      e)
    )
      for (let n of e) t.holes.push(new or(n.map((s) => new Ae(s[0], s[1]))));
    return t;
  }
  function __(i, e, t, n) {
    return new rr(hC(i, n), {
      depth: Math.max(1e-4, e - 2 * t),
      bevelEnabled: t > 0,
      bevelThickness: t,
      bevelSize: t,
      bevelOffset: -t,
      bevelSegments: 1,
      steps: 1,
      curveSegments: 6,
    });
  }
  function M_(i) {
    i.computeBoundingBox();
    let e = i.boundingBox.min.z,
      t = i.boundingBox.max.z,
      n = i.attributes.position,
      s = i.attributes.normal;
    for (let o = 0; o < n.count; o++) {
      let r = s.getZ(o),
        a = Math.abs(r);
      if (a < 0.15 || a > 0.95) continue;
      let l = n.getZ(o);
      if (Math.abs(l - e) < 1e-6 || Math.abs(l - t) < 1e-6)
        s.setXYZ(o, 0, 0, Math.sign(r));
      else {
        let c = Math.hypot(s.getX(o), s.getY(o)) || 1;
        s.setXYZ(o, s.getX(o) / c, s.getY(o) / c, 0);
      }
    }
    return i;
  }
  function xr(i, e, t, n, s, o = 0, r = null) {
    let a = __(i, t - e, n, r);
    return (
      sm(a, s, o, b_),
      M_(a),
      a.translate(0, 0, e + n),
      a.rotateY(Math.PI / 2),
      a
    );
  }
  function qo(i, e, t, n, s, o = 0, r = null) {
    let a = __(i, t - e, n, r);
    return sm(a, s, o, b_), M_(a), a.translate(0, 0, -t + n), a;
  }
  function Cn(i, e, t, n = 0, s = 0, o = 0, r = null) {
    let a = [],
      l = [],
      c = [],
      u = [],
      h = 0;
    for (let p = 0; p < i.length - 1; p++) {
      let [d, v] = i[p],
        [g, x] = i[p + 1],
        y = g - d,
        b = x - v,
        m = Math.hypot(y, b);
      if (m < 1e-7) continue;
      let A = b / m,
        _ = -y / m,
        M = Math.abs(A) > 0.25 && Math.abs(_) > 0.25;
      for (let E = 0; E <= e; E++) {
        let w = (E / e) * Math.PI * 2,
          S = Math.cos(w),
          z = Math.sin(w);
        for (let H = 0; H < 2; H++) {
          let O = H ? g : d,
            q = H ? x : v,
            U = s + O * S,
            T = o + O * z,
            D = -q;
          a.push(U, T, D), l.push(A * S, A * z, -_);
          let C = 0.9 + 0.2 * im(Math.round(q * 150), Math.round(w * 3), p);
          if (M && n > 0) {
            let j = im(E * 7.1, p * 3.3, q * 100);
            {
              let N = Math.max(0, j - 0.84) / 0.16;
              C *= 1 + n * 1.6 * N * N;
            }
          }
          let G = r ? r(O, q, t) : t;
          c.push(G[0] * C, G[1] * C, G[2] * C);
        }
      }
      for (let E = 0; E < e; E++) {
        let w = h + E * 2,
          S = w + 2,
          z = w + 1,
          H = w + 3;
        u.push(w, z, S, S, z, H);
      }
      h += (e + 1) * 2;
    }
    let f = new nt();
    return (
      f.setAttribute("position", new He(a, 3)),
      f.setAttribute("normal", new He(l, 3)),
      f.setAttribute("color", new He(c, 3)),
      f.setAttribute("uv", new He(new Float32Array((a.length / 3) * 2), 2)),
      f.setIndex(u),
      f
    );
  }
  function Fi(i, e, t, n, s, o, r = 12, a = 0) {
    let l = Math.min(i * 0.25, e * 0.25),
      c = e / 2,
      u = Cn(
        [
          [0, -c],
          [i - l, -c],
          [i, -c + l],
          [i, c - l],
          [i - l, c],
          [0, c],
        ],
        r,
        o,
        a,
      );
    return u.rotateY(Math.PI / 2), u.translate(t, n, -s), u;
  }
  function Dv(i, e, t, n, s = 4) {
    let o = [],
      r = n / 2,
      a = t / 2 - r;
    for (let l = 0; l <= s; l++) {
      let c = -Math.PI / 2 + (l / s) * Math.PI;
      o.push([i + a + Math.cos(c) * r, e + Math.sin(c) * r]);
    }
    for (let l = 0; l <= s; l++) {
      let c = Math.PI / 2 + (l / s) * Math.PI;
      o.push([i - a + Math.cos(c) * r, e + Math.sin(c) * r]);
    }
    return o;
  }
  var fC = (i, e, t, n, s) => [
      [i + s, e],
      [t - s, e],
      [t, e + s],
      [t, n - s],
      [t - s, n],
      [i + s, n],
      [i, n - s],
      [i, e + s],
    ],
    mi = {
      name: "几猫九式突击步枪",
      muzzle: [0, 0, -0.531],
      eject: [0.023, 0.004, -0.028],
      sightY: 0.069,
      lensF: 0.0285,
      window: [
        [-0.016, 0.057],
        [0.016, 0.057],
        [0.016, 0.0772],
        [0.0122, 0.081],
        [-0.0122, 0.081],
        [-0.016, 0.0772],
      ],
      magPos: [0, -0.02, -0.0665],
      boltTravel: 0.062,
      railTop: 0.0435,
      grip: [0, -0.1, 0.073],
      handguard: [0, 0, -0.255],
      handguardR: 0.021,
      handlePos: [-0.026, 0.007, -0.078],
      squeeze: 0.86,
    };
  function w_(gcfg) {
    gcfg = gcfg || mi;
    let i = [1, 1, 1],
      e = [1, 1, 1],
      t = [5.5, 5.5, 5.7],
      n = [0.4, 0.4, 0.42],
      s = [1, 1, 1],
      o = [0.022, 0.022, 0.023],
      r = [],
      a = [],
      l = [],
      c = [],
      u = [],
      h = [],
      f = [],
      p = 9,
      d = 5,
      v = 0.6,
      g = [
        [-0.1, -0.02],
        [0.1, -0.02],
        [0.1, 0.027],
        [0.093, 0.034],
        [-0.088, 0.034],
        [-0.1, 0.024],
      ];
    r.push(
      xr(g, 0, 0.0205, 0.0014, i, p, [fC(-0.012, -0.01, 0.06, 0.012, 0.003)]),
    ),
      r.push(
        xr(g, -0.0205, 0, 0.0014, i, p, [Dv(0.032, 0.007, 0.112, 0.0075, 4)]),
      ),
      a.push(Rt(0.004, 0.036, 0.19, 5e-4, -0.0135, 0.006, 0, n)),
      a.push(Rt(0.004, 0.012, 0.19, 5e-4, 0.0145, 0.022, 0, n)),
      a.push(Rt(0.004, 0.008, 0.19, 5e-4, 0.0145, -0.014, 0, n)),
      a.push(
        Cn(
          [
            [0, 0.058],
            [0.0128, 0.058],
            [0.0128, 0.099],
            [0, 0.099],
          ],
          16,
          [0.8, 0.8, 0.82],
        ),
      ),
      r.push(
        Rt(
          0.009,
          0.02,
          0.018,
          0.003,
          0.0225,
          0.004,
          -0.026,
          i,
          p,
          [0, -0.35, 0],
        ),
      ),
      r.push(
        Cn(
          [
            [0, -0.086],
            [0.0062, -0.086],
            [0.0072, -0.084],
            [0.0072, -0.06],
            [0.0045, -0.057],
            [0, -0.057],
          ],
          12,
          i,
          p,
          0.0215,
          0.012,
        ),
      ),
      a.push(
        Cn(
          [
            [0, -0.094],
            [0.0048, -0.094],
            [0.0055, -0.092],
            [0.0055, -0.086],
            [0, -0.086],
          ],
          12,
          t,
          0,
          0.0215,
          0.012,
        ),
      ),
      r.push(Rt(0.004, 0.012, 0.05, 0.0015, -0.0212, -0.006, -0.055, i, p)),
      r.push(Rt(0.004, 0.006, 0.15, 0.0015, -0.0212, 0.0215, 0.012, i, p)),
      r.push(Rt(0.003, 0.01, 0.03, 0.001, 0.0212, 0.022, 0.075, i, p)),
      r.push(
        qo(
          [
            [-0.0078, 0.0335],
            [0.0078, 0.0335],
            [0.0106, 0.0402],
            [-0.0106, 0.0402],
          ],
          -0.096,
          0.397,
          5e-4,
          i,
          0,
        ),
      );
    let x = [
      [-0.0102, 0.0398],
      [0.0102, 0.0398],
      [0.0106, 0.0408],
      [0.0084, 0.0435],
      [-0.0084, 0.0435],
      [-0.0106, 0.0408],
    ];
    for (let F = 0; F < 49; F++) {
      let X = -0.094 + F * 0.01;
      r.push(qo(x, X, X + 0.0048, 8e-4, i, p));
    }
    let y = [
      [-0.1, -0.021],
      [0.099, -0.021],
      [0.101, -0.03],
      [0.098, -0.088],
      [0.036, -0.082],
      [0.031, -0.058],
      [-0.03, -0.058],
      [-0.04, -0.066],
      [-0.078, -0.055],
      [-0.1, -0.044],
    ];
    l.push(xr(y, -0.019, 0.019, 0.0014, s, v)),
      l.push(
        Rt(0.043, 0.01, 0.066, 0.002, 0, -0.0835, 0.0668, s, v, [-0.095, 0, 0]),
      ),
      l.push(Rt(0.0405, 0.052, 0.005, 8e-4, 0, -0.052, 0.0975, s, v)),
      l.push(Rt(0.0405, 0.04, 0.005, 8e-4, 0, -0.048, 0.0345, s, v)),
      a.push(Fi(0.0038, 0.0396, 0, -0.031, -0.086, t, 12)),
      a.push(Fi(0.0038, 0.0396, 0, -0.029, 0.087, t, 12)),
      a.push(Fi(0.0022, 0.0392, 0, -0.04, -0.012, t, 8)),
      a.push(Fi(0.0022, 0.0392, 0, -0.032, -0.032, t, 8));
    for (let F of [-1, 1])
      a.push(Fi(0.0068, 0.004, F * 0.0205, -0.036, -0.048, e, 14, d)),
        a.push(
          Rt(
            0.004,
            0.006,
            0.024,
            0.0015,
            F * 0.0228,
            -0.036,
            -0.036,
            e,
            d,
            [0.5, 0, 0],
          ),
        );
    a.push(Rt(0.0045, 0.024, 0.013, 0.0015, -0.0212, -0.03, 0.022, e, d));
    for (let F = 0; F < 4; F++)
      a.push(
        Rt(
          0.0012,
          0.002,
          0.012,
          5e-4,
          -0.0238,
          -0.021 - F * 0.0045,
          0.022,
          e,
          d,
        ),
      );
    a.push(Fi(0.0058, 0.005, 0.0205, -0.042, 0.016, e, 12, d)),
      l.push(Rt(0.004, 0.004, 0.026, 8e-4, 0.0205, -0.051, 0.016, s, v)),
      l.push(Rt(0.004, 0.02, 0.004, 8e-4, 0.0205, -0.043, 0.027, s, v)),
      l.push(
        xr(
          [
            [0.033, -0.056],
            [0.033, -0.093],
            [0.024, -0.1005],
            [-0.031, -0.1005],
            [-0.041, -0.09],
            [-0.041, -0.06],
          ],
          -0.0085,
          0.0085,
          8e-4,
          s,
          v,
          [
            [
              [0.028, -0.059],
              [0.028, -0.091],
              [0.022, -0.096],
              [-0.029, -0.096],
              [-0.036, -0.088],
              [-0.036, -0.061],
            ],
          ],
        ),
      ),
      a.push(
        xr(
          [
            [-0.006, -0.057],
            [0.004, -0.057],
            [0.003, -0.069],
            [0.0065, -0.079],
            [0.01, -0.086],
            [0.0065, -0.088],
            [0.001, -0.081],
            [-0.004, -0.07],
          ],
          -0.0032,
          0.0032,
          8e-4,
          t,
          0,
        ),
      ),
      l.push(
        xr(
          [
            [-0.038, -0.05],
            [-0.045, -0.074],
            [-0.049, -0.086],
            [-0.049, -0.1],
            [-0.054, -0.112],
            [-0.057, -0.13],
            [-0.064, -0.158],
            [-0.11, -0.152],
            [-0.102, -0.112],
            [-0.096, -0.082],
            [-0.095, -0.064],
            [-0.103, -0.046],
            [-0.08, -0.044],
          ],
          -0.0165,
          0.0165,
          0.005,
          s,
          v,
        ),
      );
    for (let F = 0; F < 9; F++) {
      let X = -0.078 - F * 0.0082,
        ne = -0.073 + (X + 0.078) * 0.26;
      l.push(Rt(0.0345, 0.0028, 0.03, 0.001, 0, X, ne, s, v, [-0.25, 0, 0]));
    }
    for (let F = 0; F < 7; F++) {
      let X = -0.078 - F * 0.01,
        ne = -0.098 + (X + 0.078) * 0.14;
      l.push(Rt(0.022, 0.0045, 0.006, 0.0015, 0, X, ne, s, v, [-0.14, 0, 0]));
    }
    l.push(
      Rt(0.035, 0.006, 0.05, 0.002, 0, -0.157, -0.087, s, v, [0.13, 0, 0]),
    ),
      a.push(Fi(0.003, 0.034, 0, -0.15, -0.085, t, 8));
    let b = gcfg.handguardR,
      m = 0.00885,
      A = 0.0028,
      _ = 0.101,
      M = 0.398,
      E = [
        [_, -m],
        [M, -m],
        [M, m],
        [_, m],
      ];
    for (let F = 0; F < 8; F++) {
      let X = [];
      if (F === 0 || F === 4 || F === 6)
        for (let $ = 0; $ < 6; $++)
          X.push(Dv(0.13 + $ * 0.047, 0, 0.032, 0.007, 4));
      else if (F !== 2)
        for (let $ = 0; $ < 10; $++) {
          let ue = 0.124 + $ * 0.027;
          (F === 3 && ue > 0.3) || X.push(Dv(ue, 0, 0.013, 0.0052, 3));
        }
      let ne = xr(E, b - A, b, 9e-4, i, p, X);
      ne.rotateZ((F * Math.PI) / 4), r.push(ne);
      let re = ((F + 0.5) * Math.PI) / 4;
      r.push(
        Cn(
          [
            [0, _],
            [0.003, _],
            [0.003, M],
            [0, M],
          ],
          8,
          i,
          0,
          Math.cos(re) * 0.0197,
          Math.sin(re) * 0.0197,
        ),
      );
    }
    r.push(
      qo(
        [
          [-0.0088, 0.02],
          [0.0088, 0.02],
          [0.0106, 0.029],
          [0.0082, 0.0338],
          [-0.0082, 0.0338],
          [-0.0106, 0.029],
        ],
        0.1012,
        0.3978,
        0.0012,
        i,
        p,
      ),
    ),
      r.push(
        Cn(
          [
            [0.016, 0.096],
            [0.0238, 0.096],
            [0.0243, 0.0966],
            [0.0243, 0.106],
            [0.0232, 0.1075],
            [0.016, 0.1075],
          ],
          24,
          i,
          p,
        ),
      ),
      r.push(
        Cn(
          [
            [0.018, 0.3985],
            [0.0224, 0.3985],
            [0.0224, 0.4003],
            [0.0218, 0.401],
            [0.018, 0.401],
            [0.018, 0.3985],
          ],
          8,
          i,
          p,
        ),
      );
    for (let F of [-1, 1])
      for (let X of [0.112, 0.126])
        a.push(Fi(0.0024, 0.0024, F * 0.0212, -0.004, X, t, 10));
    for (let F of [0.115, 0.215, 0.3, 0.385])
      for (let X of [-1, 1])
        a.push(
          Cn(
            [
              [0, -8e-4],
              [0.0017, -8e-4],
              [0.002, -4e-4],
              [0.002, 6e-4],
              [0, 6e-4],
            ],
            8,
            t,
            0,
            0,
            0,
          )
            .rotateX(Math.PI / 2)
            .translate(X * 0.0098, 0.0312, -F),
        );
    {
      let X = [
        qo(
          [
            [-0.0078, 0.0206],
            [0.0078, 0.0206],
            [0.0106, 0.0242],
            [-0.0106, 0.0242],
          ],
          0.318,
          0.396,
          5e-4,
          i,
          0,
        ),
      ];
      for (let ne = 0; ne < 8; ne++) {
        let re = 0.319 + ne * 0.01;
        X.push(
          qo(
            x.map(($) => [$[0], $[1] - 0.016]),
            re,
            re + 0.0048,
            5e-4,
            i,
            p,
          ),
        );
      }
      for (let ne of X) ne.rotateZ(Math.PI / 4), r.push(ne);
    }
    {
      let F = [];
      for (let X = 0; X < 4; X++) {
        let ne = 0.352 + X * 0.01;
        F.push(
          qo(
            x.map((re) => [re[0], re[1] - 0.016]),
            ne,
            ne + 0.0048,
            5e-4,
            i,
            p,
          ),
        );
      }
      F.push(
        qo(
          [
            [-0.0078, 0.0206],
            [0.0078, 0.0206],
            [0.0106, 0.0242],
            [-0.0106, 0.0242],
          ],
          0.35,
          0.392,
          5e-4,
          i,
          0,
        ),
      );
      for (let X of F) X.rotateZ(Math.PI), r.push(X);
    }
    l.push(
      xr(
        [
          [0.35, -0.026],
          [0.392, -0.026],
          [0.388, -0.036],
          [0.372, -0.05],
          [0.362, -0.05],
          [0.354, -0.036],
        ],
        -0.011,
        0.011,
        0.003,
        s,
        v,
      ),
    ),
      l.push(
        xr(
          [
            [0.2395, -0.0215],
            [0.2725, -0.0215],
            [0.2725, -0.03],
            [0.27, -0.092],
            [0.2665, -0.0965],
            [0.2455, -0.0975],
            [0.242, -0.093],
            [0.2395, -0.03],
          ],
          -0.014,
          0.014,
          0.0045,
          s,
          v,
        ),
      );
    for (let F = 0; F < 6; F++)
      l.push(
        Rt(
          0.0292,
          0.0022,
          0.0315,
          8e-4,
          0,
          -0.04 - F * 0.0085,
          0.256 - F * 3e-4,
          s,
          v,
        ),
      );
    l.push(Rt(0.03, 0.005, 0.04, 0.0015, 0, -0.024, 0.256, s, v)),
      a.push(Fi(0.003, 0.031, 0, -0.025, 0.256, t, 10)),
      a.push(
        Cn(
          [
            [0.0115, 0.095],
            [0.0115, 0.15],
            [0.0095, 0.153],
            [0.0095, 0.285],
            [0.009, 0.288],
            [0.009, 0.322],
            [0.0086, 0.326],
            [0.0086, 0.435],
            [0.0092, 0.437],
            [0.0092, 0.453],
            [0.0075, 0.455],
            [0.0075, 0.461],
          ],
          20,
          e,
          d,
        ),
      ),
      a.push(
        Cn(
          [
            [0.0092, 0.286],
            [0.0135, 0.286],
            [0.0142, 0.2875],
            [0.0142, 0.3165],
            [0.0135, 0.318],
            [0.0092, 0.318],
          ],
          16,
          e,
          d,
        ),
      ),
      a.push(Rt(0.014, 0.009, 0.03, 0.002, 0, 0.0145, 0.302, e, d)),
      a.push(
        Cn(
          [
            [0, 0.1],
            [0.0026, 0.1],
            [0.0026, 0.3],
            [0, 0.3],
          ],
          8,
          t,
          0,
          0,
          0.0172,
        ),
      ),
      a.push(Fi(0.002, 0.0145, 0, 0.012, 0.308, t, 6)),
      a.push(
        Cn(
          [
            [0.0075, 0.459],
            [0.0108, 0.459],
            [0.0116, 0.4605],
            [0.0116, 0.477],
            [0.011, 0.478],
            [0.0052, 0.478],
          ],
          20,
          e,
          d,
        ),
      ),
      a.push(
        Cn(
          [
            [0.0052, 0.477],
            [0.0052, 0.517],
          ],
          12,
          n,
        ),
      );
    for (let F of [0.4865, 0.4965, 0.5065])
      a.push(
        Cn(
          [
            [0.0052, F - 0.0019],
            [0.011, F - 0.0019],
            [0.0116, F - 0.0012],
            [0.0116, F + 0.0012],
            [0.011, F + 0.0019],
            [0.0052, F + 0.0019],
          ],
          20,
          e,
          d,
        ),
      );
    a.push(
      Cn(
        [
          [0.0052, 0.5145],
          [0.011, 0.5145],
          [0.0116, 0.5155],
          [0.0116, 0.527],
          [0.0102, 0.5305],
          [0.0048, 0.5305],
          [0.0036, 0.526],
          [0.0036, 0.495],
        ],
        20,
        e,
        d,
        0,
        0,
        (F, X, ne) => (F < 0.0047 ? [0.25, 0.25, 0.25] : ne),
      ),
    );
    for (let F of [-1, 1])
      a.push(Rt(0.0125, 0.0042, 0.042, 0.0012, 0, F * 0.0096, 0.496, e, d));
    for (let F = 0; F < 3; F++)
      a.push(Fi(0.0016, 0.0236, 0, 0, 0.4675 + F * 0.0035, n, 6));
    r.push(
      Cn(
        [
          [0, -0.292],
          [0.0142, -0.292],
          [0.0148, -0.2905],
          [0.0148, -0.1],
        ],
        20,
        i,
        p,
      ),
    ),
      r.push(
        Cn(
          [
            [0.0148, -0.122],
            [0.0185, -0.122],
            [0.0195, -0.1205],
            [0.0195, -0.1115],
            [0.0185, -0.11],
            [0.0148, -0.11],
          ],
          12,
          i,
          p * 1.5,
        ),
      );
    {
      let F = [
          [-0.019, -0.024],
          [0.019, -0.024],
          [0.021, -0.018],
          [0.021, 0.018],
          [0.016, 0.024],
          [-0.016, 0.024],
          [-0.021, 0.018],
          [-0.021, 0.006],
          [-0.036, 0.004],
          [-0.04, -0.002],
          [-0.04, -0.014],
          [-0.034, -0.02],
          [-0.021, -0.02],
        ],
        X = [
          [-0.025, -0.014],
          [-0.025, -0.002],
          [-0.033, -5e-4],
          [-0.036, -0.004],
          [-0.036, -0.012],
          [-0.032, -0.016],
        ];
      a.push(qo(F, -0.1095, -0.1045, 8e-4, [1.6, 1.6, 1.65], d, [X]));
    }
    l.push(
      xr(
        [
          [-0.146, 0.024],
          [-0.3, 0.024],
          [-0.331, 0.014],
          [-0.334, -0.086],
          [-0.318, -0.101],
          [-0.29, -0.096],
          [-0.232, -0.04],
          [-0.146, -0.024],
        ],
        -0.019,
        0.019,
        0.004,
        s,
        v,
        [
          [
            [-0.262, -0.036],
            [-0.306, -0.036],
            [-0.306, -0.074],
            [-0.292, -0.074],
          ],
        ],
      ),
    ),
      l.push(Rt(0.033, 0.016, 0.118, 0.006, 0, 0.031, -0.232, s, v));
    for (let F of [-0.196, -0.268]) a.push(Fi(0.0032, 0.035, 0, 0.03, F, t, 8));
    l.push(Rt(0.012, 0.012, 0.04, 0.003, 0, -0.033, -0.19, s, v, [0.2, 0, 0])),
      f.push(Rt(0.037, 0.12, 0.011, 0.004, 0, -0.04, -0.3395, o, 0));
    for (let F = 0; F < 9; F++)
      f.push(
        Rt(0.031, 0.004, 0.003, 0.001, 0, 0.004 - F * 0.011, -0.3455, o, 0),
      );
    for (let F of [-1, 1])
      a.push(Fi(0.0065, 0.003, F * 0.0195, -0.06, -0.318, t, 12));
    let w = gcfg.sightY,
      S = gcfg.window,
      z = [0.012, 0.012, 0.013];
    r.push(Rt(0.03, 0.0092, 0.04, 0.0016, 0, 0.048, 0.021, i, p)),
      r.push(Rt(0.0045, 0.0085, 0.034, 0.001, -0.0162, 0.0452, 0.021, i, p));
    for (let F of [0.009, 0.033])
      a.push(Fi(0.004, 0.0042, -0.02, 0.0452, F, t, 6)),
        a.push(Fi(0.003, 0.0022, 0.016, 0.0452, F, t, 10));
    let H = [
      [-0.0192, 0.0525],
      [0.0192, 0.0525],
      [0.0192, 0.0788],
      [0.0138, 0.0842],
      [-0.0138, 0.0842],
      [-0.0192, 0.0788],
    ];
    r.push(qo(H, 0.008, 0.034, 0.001, i, p, [S])),
      f.push(
        qo(
          S.map((F) => [F[0] * 1.004, (F[1] - w) * 1.004 + w]),
          0.0078,
          0.0342,
          0,
          z,
          0,
          [S.map((F) => [F[0] * 0.982, (F[1] - w) * 0.982 + w])],
        ),
      );
    let O = [
      [-0.0204, 0.06],
      [-0.0204, 0.0792],
      [-0.0143, 0.0854],
      [0.0143, 0.0854],
      [0.0204, 0.0792],
      [0.0204, 0.06],
      [0.0193, 0.06],
      [0.0193, 0.0788],
      [0.0138, 0.0843],
      [-0.0138, 0.0843],
      [-0.0193, 0.0788],
      [-0.0193, 0.06],
    ];
    r.push(qo(O, 0.029, 0.038, 3e-4, i, p)),
      a.push(
        Cn(
          [
            [0, -0.006],
            [0.0052, -0.006],
            [0.0058, -0.0054],
            [0.0058, 0.0036],
            [0.0052, 0.0042],
            [0, 0.0042],
          ],
          14,
          e,
          d,
          0,
          0,
        )
          .rotateY(Math.PI / 2)
          .translate(0.0222, 0.0625, -0.021),
      );
    for (let F of [0.0165, 0.0245])
      f.push(Rt(0.0022, 0.0055, 0.0055, 9e-4, -0.0196, 0.064, F, o, 0));
    for (let F of [0.012, 0.03])
      for (let X of [-1, 1])
        a.push(Fi(0.0016, 0.0012, X * 0.0195, 0.0555, F, t, 8));
    f.push(Rt(0.009, 0.0026, 0.006, 6e-4, 0, 0.058, 0.0115, z));
    for (let [F, X] of [
      [0.0128, 0.0548],
      [-0.0128, 0.0548],
    ])
      a.push(
        Cn(
          [
            [0, -6e-4],
            [0.0019, -6e-4],
            [0.0022, -2e-4],
            [0.0022, 7e-4],
            [0, 7e-4],
          ],
          10,
          t,
          0,
          F,
          X,
        )
          .translate(0, 0, -0.008 + 1e-4)
          .rotateY(0),
      );
    a.push(
      Cn(
        [
          [0, -0.001],
          [0.0026, -0.001],
          [0.003, -5e-4],
          [0.003, 0.0012],
          [0, 0.0012],
        ],
        12,
        t,
        0,
        0,
        0,
      )
        .rotateX(Math.PI / 2)
        .translate(0.009, 0.0842, -0.014),
    ),
      f.push(Rt(0.0012, 2e-4, 0.0044, 5e-5, 0.009, 0.0855, 0.014, z)),
      f.push(
        qo(S, 0.0304, 0.0318, 0, z, 0, [
          S.map((F) => [F[0] * 0.955, (F[1] - w) * 0.955 + w]),
        ]),
      );
    for (let [F, X] of [
      [-0.03, 1],
      [0.372, -1],
    ])
      a.push(Rt(0.021, 0.0075, 0.03, 0.0015, 0, 0.0472, F, e, d)),
        a.push(Rt(0.0125, 0.004, 0.036, 0.001, 0, 0.0527, F + X * 0.004, e, d)),
        a.push(Fi(0.0028, 0.024, 0, 0.0505, F - X * 0.013, e, 8)),
        a.push(Rt(0.004, 0.006, 0.006, 0.001, X * 0.0125, 0.0475, F, e, d)),
        a.push(Fi(0.0042, 0.0045, -0.0125, 0.0475, F + 0.006, t, 8));
    a.push(
      Cn(
        [
          [0.0016, -0.0012],
          [0.0034, -0.0012],
          [0.0038, -8e-4],
          [0.0038, 8e-4],
          [0.0034, 0.0012],
          [0.0016, 0.0012],
          [0.0016, -0.0012],
        ],
        12,
        e,
        d,
        0,
        0,
      )
        .rotateX(Math.PI / 2)
        .translate(0, 0.0553, 0.016),
    ),
      a.push(Fi(0.0048, 0.005, 0.015, 0.049, -0.036, e, 12, d));
    for (let F = 0; F < 6; F++)
      a.push(
        Rt(
          0.0044,
          0.001,
          0.001,
          3e-4,
          0.015,
          0.049 + Math.sin(F * 1.047) * 0.0046,
          -0.036 + Math.cos(F * 1.047) * 0.0046,
          e,
          d,
        ),
      );
    r.push(Rt(0.016, 0.005, 0.02, 0.0012, 0, 0.0355, -0.098, i, p)),
      a.push(Rt(0.01, 0.003, 0.008, 8e-4, 0, 0.0392, -0.0985, e, d));
    for (let F = 0; F < 4; F++)
      a.push(
        Rt(0.0092, 8e-4, 0.001, 3e-4, 0, 0.0409, -0.0958 - F * 0.0018, e, d),
      );
    let q = -0.0267,
      U = 0.0267;
    a.push(
      Cn(
        [
          [0, 0.308],
          [0.0095, 0.308],
          [0.0108, 0.3095],
          [0.0108, 0.322],
          [0.0118, 0.323],
          [0.0118, 0.378],
          [0.0128, 0.38],
          [0.0142, 0.382],
          [0.0142, 0.404],
          [0.0136, 0.406],
          [0.0142, 0.408],
          [0.0142, 0.412],
          [0.0128, 0.4135],
          [0.0118, 0.4135],
          [0.0112, 0.409],
        ],
        18,
        e,
        d,
        q,
        U,
      ),
    ),
      a.push(
        Cn(
          [
            [0.0112, 0.409],
            [0, 0.409],
          ],
          18,
          [0.35, 0.4, 0.45],
          0,
          q,
          U,
        ),
      );
    for (let F = 0; F < 5; F++)
      a.push(
        Cn(
          [
            [0.0118, 0.33 + F * 0.008],
            [0.0124, 0.3305 + F * 0.008],
            [0.0124, 0.3335 + F * 0.008],
            [0.0118, 0.334 + F * 0.008],
          ],
          18,
          e,
          d,
          q,
          U,
        ),
      );
    {
      let F = Rt(0.02, 0.008, 0.04, 0.0012, 0, 0.028, 0.352, e, d);
      F.rotateZ(Math.PI / 4), a.push(F);
    }
    {
      let F = Fi(0.004, 0.006, 0.0135, 0.028, 0.352, t, 8);
      F.rotateZ(Math.PI / 4), a.push(F);
    }
    f.push(Rt(0.0185, 0.0065, 0.07, 0.0025, 0, 0.0468, 0.214, o, 0));
    for (let F = 0; F < 6; F++)
      f.push(
        Rt(0.014, 0.0012, 0.004, 5e-4, 0, 0.0503, 0.192 + F * 0.009, o, 0),
      );
    let T = Fn(
      [
        [q, U, -0.308],
        [q - 0.001, U + 0.002, -0.296],
        [-0.0265, 0.0235, -0.284],
        [-0.0255, 0.0215, -0.272],
        [-0.0235, 0.027, -0.262],
        [-0.016, 0.04, -0.256],
        [-0.007, 0.0465, -0.252],
        [-0.002, 0.047, -0.247],
      ],
      0.0018,
      6,
    );
    sm(T, o, 0), f.push(T);
    for (let F of [
      [-0.0262, 0.0228, 0.28],
      [-0.0242, 0.0255, 0.265],
    ]) {
      let X = Rt(0.0065, 0.0026, 0.0035, 8e-4, 0, 0, 0, [0.03, 0.03, 0.03], 0);
      X.rotateZ(Math.PI / 4), X.translate(F[0], F[1], -F[2]), f.push(X);
    }
    c.push(
      Cn(
        [
          [0, -0.058],
          [0.0118, -0.058],
          [0.0124, -0.057],
          [0.0124, -0.01],
          [0.0116, -0.008],
          [0.0116, -0.002],
          [0.0124, 0],
          [0.0124, 0.046],
          [0.0105, 0.048],
          [0.0105, 0.056],
          [0.0062, 0.056],
          [0.0062, 0.06],
          [0, 0.06],
        ],
        16,
        [7, 7, 7.2],
        0,
        0,
        0.001,
      ),
    );
    for (let F = 0; F < 5; F++)
      c.push(
        Rt(
          0.0015,
          0.008,
          0.003,
          5e-4,
          0.0122,
          0.001,
          0.01 + F * 0.007,
          [1.2, 1.2, 1.2],
          0,
        ),
      );
    c.push(Rt(0.012, 0.0055, 0.014, 0.0015, -0.0165, 0.007, 0.078, e, d));
    {
      let F = Cn(
        [
          [0, -0.009],
          [0.0045, -0.009],
          [0.0056, -0.0078],
          [0.0056, -0.003],
          [0.0048, -0.002],
          [0.0048, 0.002],
          [0.0056, 0.003],
          [0.0056, 0.0078],
          [0.0045, 0.009],
          [0, 0.009],
        ],
        12,
        e,
        d,
      );
      F.rotateY(Math.PI / 2), F.translate(-0.031, 0.007, -0.078), c.push(F);
    }
    let D = (F) => 1.5 * Math.pow(Math.max(0, F - 0.07), 2),
      C = (F) => 3 * Math.max(0, F - 0.07),
      G = [1, 1, 1],
      j = [],
      N = 0.212,
      Q = 12;
    for (let F = 0; F <= Q; F++) {
      let X = -0.004 + ((N + 0.004) * F) / Q;
      j.push([D(X) + 0.0298, -X]);
    }
    for (let F = Q; F >= 0; F--) {
      let X = -0.004 + ((N + 0.004) * F) / Q;
      j.push([D(X) - 0.0298, -X]);
    }
    u.push(xr(j, -0.0113, 0.0113, 0.002, G, 0.25));
    for (let F = 0; F < 8; F++) {
      let X = 0.082 + F * 0.0155;
      u.push(
        Rt(0.0246, 0.0058, 0.05, 0.0016, 0, -X, D(X), G, 0.3, [
          Math.atan(C(X)),
          0,
          0,
        ]),
      );
    }
    for (let F = 0; F < 10; F++) {
      let X = 0.078 + F * 0.013;
      u.push(
        Rt(0.012, 0.011, 0.004, 0.001, 0, -X, D(X) + 0.0302, G, 0.3, [
          Math.atan(C(X)),
          0,
          0,
        ]),
      );
    }
    u.push(
      Rt(0.027, 0.009, 0.068, 0.003, 0, -N - 0.003, D(N) + 0.001, G, 0.3, [
        Math.atan(C(N)),
        0,
        0,
      ]),
    ),
      u.push(
        Rt(
          0.01,
          0.004,
          0.012,
          0.001,
          0,
          -N - 0.008,
          D(N) - 0.01,
          [0.6, 0.6, 0.6],
          0,
          [Math.atan(C(N)), 0, 0],
        ),
      ),
      u.push(Rt(0.003, 0.006, 0.04, 0.001, -0.0085, 0.0045, 0.004, G, 0.3)),
      u.push(Rt(0.003, 0.006, 0.04, 0.001, 0.0085, 0.0045, 0.004, G, 0.3));
    let K = [1.25, 0.72, 0.5];
    h.push(
      Cn(
        [
          [0, -0.02],
          [0.004, -0.02],
          [0.0047, -0.019],
          [0.0047, 0.01],
          [0.0034, 0.014],
          [0.0034, 0.018],
        ],
        12,
        [1, 1, 1],
        0,
        0.002,
        0.0062,
      ),
    ),
      h.push(
        Cn(
          [
            [0.003, 0.018],
            [0.0029, 0.024],
            [0.0022, 0.03],
            [0.001, 0.0345],
            [0, 0.0352],
          ],
          12,
          K,
          0,
          0.002,
          0.0062,
        ),
      ),
      h.push(
        Cn(
          [
            [0, -0.02],
            [0.004, -0.02],
            [0.0047, -0.019],
            [0.0047, 0.01],
          ],
          10,
          [0.8, 0.8, 0.8],
          0,
          -0.003,
          5e-4,
        ),
      );
    let ie = {
      ano: Ii(r),
      gun: Ii(a),
      poly: Ii(l),
      plain: Ii(f),
      bolt: Ii(c),
      mag: Ii(u),
      round: Ii(h),
    };
    for (let F of ["ano", "gun", "poly", "plain", "bolt"]) {
      let X = ie[F].attributes.position;
      for (let ne = 0; ne < X.count; ne++)
        X.getZ(ne) > -0.1002 &&
          X.getY(ne) < 0.0341 &&
          X.setX(ne, X.getX(ne) * gcfg.squeeze);
    }
    for (let F in ie) ie[F].computeBoundingSphere();
    return ie;
  }
  var Kc = (i) => (i.index ? i.index.count : i.attributes.position.count) / 3;
  var ti = W,
    vl = Lt,
    rm = Ye,
    Bv = [31, 21.5, 12.5],
    Fv = [5.6, 5.3, 5],
    Lv = [3.2, 3.1, 3],
    am = [12.5, 10, 7.6],
    lm = [16, 11, 6.6],
    dC = [3, 2.6, 2.2],
    kf = [36, 27, 16],
    gl = [20, 14, 8.4],
    Df = [4.8, 4.5, 4.2],
    pC = [30, 9.5, 2.2],
    E_ = [5, 6.9, 9],
    mC = [30, 9.5, 2.2],
    gC = [26, 26, 25],
    um = (i) => (i < 0 ? 0 : i > 1 ? 1 : i),
    xl = (i, e, t) => ((t = um((t - i) / (e - i))), t * t * (3 - 2 * t)),
    Ff = (i, e) => Math.sign(i) * Math.pow(Math.abs(i), e),
    vC = (i) => {
      let e = Math.sin(i * 127.1 + 311.7) * 43758.5453;
      return e - Math.floor(e);
    },
    Xo = new ti(),
    S_ = new ti(0, 0, -1),
    yl = class {
      constructor(e) {
        (this.N = e), (this.P = []), (this.C = []), (this.weld = []);
      }
      v(e, t, n = 1) {
        this.P.push(e.x, e.y, e.z), this.C.push(t[0] * n, t[1] * n, t[2] * n);
      }
      rings() {
        return this.P.length / 3 / this.N;
      }
      collapse() {
        this.weld.push(this.rings() - 1);
      }
      geo(e = !1) {
        let t = this.N,
          n = this.rings(),
          s = [];
        for (let a = 0; a < n - 1; a++)
          for (let l = 0; l < t; l++) {
            let c = a * t + l,
              u = a * t + ((l + 1) % t),
              h = c + t,
              f = u + t;
            e ? s.push(c, u, h, u, f, h) : s.push(c, h, u, u, h, f);
          }
        let o = new nt();
        o.setAttribute("position", new He(this.P, 3)),
          o.setAttribute("color", new He(this.C, 3)),
          o.setAttribute(
            "uv",
            new He(new Float32Array((this.P.length / 3) * 2), 2),
          ),
          o.setIndex(s),
          o.computeVertexNormals();
        let r = o.attributes.normal;
        for (let a of this.weld) {
          let l = 0,
            c = 0,
            u = 0;
          for (let f = 0; f < t; f++)
            (l += r.getX(a * t + f)),
              (c += r.getY(a * t + f)),
              (u += r.getZ(a * t + f));
          let h = Math.hypot(l, c, u) || 1;
          for (let f = 0; f < t; f++) r.setXYZ(a * t + f, l / h, c / h, u / h);
        }
        return o;
      }
    };
  function I_(i, e, t) {
    let n = [],
      s = [],
      o = [],
      r = i.length,
      a = e.length;
    for (let c = 0; c < a; c++)
      for (let u = 0; u < r; u++) {
        let h = t(i[u], e[c], Xo);
        n.push(Xo.x, Xo.y, Xo.z), s.push(h[0], h[1], h[2]);
      }
    for (let c = 0; c < a - 1; c++)
      for (let u = 0; u < r - 1; u++) {
        let h = c * r + u,
          f = h + 1,
          p = h + r,
          d = p + 1;
        o.push(h, f, p, f, d, p);
      }
    let l = new nt();
    return (
      l.setAttribute("position", new He(n, 3)),
      l.setAttribute("color", new He(s, 3)),
      l.setAttribute("uv", new He(new Float32Array((n.length / 3) * 2), 2)),
      l.setIndex(o),
      l.computeVertexNormals(),
      l
    );
  }
  var Uv = [-1, -0.9, -0.5, 0, 0.5, 0.9, 1],
    cm = (i) => (Math.abs(i) > 0.95 ? -1 : Math.abs(i) > 0.8 ? 0.82 : 1);
  function Lf(i, e, t, n, s, o, r, a = null, l = !1, c = Uv, u = Uv) {
    return I_(c, u, (h, f, p) => {
      let d = i + h * t,
        v = e + (l ? f : -f) * n,
        g = Math.min(cm(h), cm(f)),
        x = r(d, v) + (g < 0 ? -0.0022 : s * g);
      p.set(d, l ? -x : x, v), a && a(p);
      let y = typeof o == "function" ? o(h, f) : o,
        b = g < 0 ? 0.5 : g < 1 ? 0.8 : 1;
      return [y[0] * b, y[1] * b, y[2] * b];
    });
  }
  var om = [
      {
        base: [-0.031, 0, -0.094],
        len: [0.044, 0.026, 0.022],
        rad: [0.0096, 0.009, 0.0083, 0.0076],
      },
      {
        base: [-0.0105, 0.001, -0.099],
        len: [0.049, 0.03, 0.023],
        rad: [0.0097, 0.0091, 0.0084, 0.0077],
      },
      {
        base: [0.0105, 0, -0.095],
        len: [0.045, 0.028, 0.022],
        rad: [0.0094, 0.0088, 0.0081, 0.0074],
      },
      {
        base: [0.03, -0.002, -0.086],
        len: [0.035, 0.021, 0.02],
        rad: [0.0084, 0.0078, 0.0072, 0.0066],
      },
    ],
    Nv = [
      12, 34, 44, 68, 90, 112, 136, 146, 168, 192, 220, 245, 270, 295, 320, 348,
    ].map((i) => (i * Math.PI) / 180),
    T_ = Nv.length,
    A_ = 0.0012,
    R_ = [0.14, 0.22, 0.27, 0.73, 0.78, 0.88],
    xC = [0.1, 0.17, 0.1];
  function z_(i) {
    let e = new yl(T_),
      { base: t, qs: n, len: s, rad: o } = i,
      r = i.pads || [1, 1, 0],
      a = i.patchJ ?? 1,
      l = i.bump || xC,
      c = i.tipW || 1,
      u = i.tipH || 1,
      h = [],
      f = [],
      p = t.clone();
    for (let M = 0; M < 3; M++)
      h.push(p.clone()),
        f.push(S_.clone().applyQuaternion(n[M + 1])),
        p.addScaledVector(f[M], s[M]);
    let d = S_.clone().applyQuaternion(n[0]),
      v = (M) => (M ? f[M - 1] : d),
      g = [0, 1, 2].map((M) => new ti().addVectors(v(M), f[M]).normalize()),
      x = (M, E) =>
        (M.x - h[E].x) * g[E].x +
        (M.y - h[E].y) * g[E].y +
        (M.z - h[E].z) * g[E].z,
      y = (M, E) => {
        let w = x(M, E);
        w > 0 && M.addScaledVector(v(E), -w / v(E).dot(g[E]));
      },
      b = (M, E) => {
        let w = x(M, E);
        w < 0 && M.addScaledVector(f[E], -w / f[E].dot(g[E]));
      },
      m = new ti(),
      A = new vl(),
      _ = (M, E, w, S) => {
        let z = S.kD || 1,
          H = S.kP || 1,
          O = S.ao || 1;
        for (let q = 0; q < T_; q++) {
          let U = Math.cos(Nv[q]),
            T = Math.sin(Nv[q]),
            D = q >= 1 && q <= 7,
            C = q >= 2 && q <= 6,
            G = w * U,
            j =
              T > 0
                ? w * 0.96 * T * (C ? z : 1 + (z - 1) * 0.4)
                : w * 0.98 * T * H;
          S.pad && C && ((G += U * A_), (j += T * A_)),
            (G *= S.wx || 1),
            (j *= S.wy || 1),
            m.set(G, j, 0).applyQuaternion(M).add(E),
            S.a >= 0 && y(m, S.a),
            S.b >= 0 && b(m, S.b);
          let N = D ? Bv : q >= 10 && q <= 14 ? am : lm,
            Q = O;
          S.pad && C ? (N = Fv) : S.patch && C && ((N = lm), (Q *= 0.9)),
            ((S.pad && D && !C) || (S.edge && D)) && (N = dC),
            S.saddle && q >= 8 && ((N = am), (Q *= 0.9)),
            S.stitch && D && ((N = kf), (Q *= 0.8)),
            (q === 0 || q === 8 || q === 9 || q === 15) && (Q *= 0.72),
            q >= 9 && (Q *= S.aoP || 1),
            e.v(m, N, Q);
        }
      };
    _(
      n[0],
      Xo.copy(h[0]).addScaledVector(d, -(i.rootBack || 0.012) - 0.002),
      1e-5,
      { a: 0, b: -1, ao: i.rootAo || 0.5 },
    ),
      e.collapse(),
      _(
        n[0],
        Xo.copy(h[0]).addScaledVector(d, -(i.rootBack || 0.012)),
        o[0] * (i.rootK || 1),
        { a: 0, b: -1, ao: i.rootAo || 0.5, saddle: i.saddle },
      );
    for (let M = 0; M < 3; M++) {
      for (let E = 0; E < 4; E++) {
        let w = E / 3;
        A.slerpQuaternions(n[M], n[M + 1], w),
          _(
            A,
            Xo.copy(h[M]).addScaledVector(
              E < 2 ? v(M) : f[M],
              (E - 1.5) * 4e-4,
            ),
            o[M],
            {
              a: w < 0.5 ? M : -1,
              b: w < 0.5 ? -1 : M,
              kD: 1 + l[M] * (E === 0 || E === 3 ? 0.55 : 1),
              patch: M === a,
              saddle: i.saddle && M < 2,
              wx: M === 2 ? 1 + (c - 1) * 0.5 : 1,
              wy: M === 2 ? 1 + (u - 1) * 0.5 : 1,
              ao: M === 0 && !i.rootAo ? 0.62 + 0.1 * E : 1,
              aoP: E === 1 || E === 2 ? 0.55 : 0.8,
            },
          );
      }
      if (M < 2)
        for (let E = 0; E < R_.length; E++) {
          let w = R_[E],
            S =
              (o[M] + (o[M + 1] - o[M]) * w) *
              (1 - 0.06 * Math.sin(Math.PI * w));
          _(n[M + 1], Xo.copy(h[M]).addScaledVector(f[M], s[M] * w), S, {
            a: M + 1,
            b: M,
            pad: r[M] && (E === 2 || E === 3),
            edge: r[M] && (E === 1 || E === 4),
            saddle: i.saddle && M === 0,
            ao: M === 0 && !i.rootAo ? 0.86 + 0.14 * xl(0, 0.5, w) : 1,
          });
        }
      else {
        let E = o[3],
          w = s[2] - E;
        _(n[3], Xo.copy(h[2]).addScaledVector(f[2], s[2] * 0.2), o[2] * 0.97, {
          a: -1,
          b: 2,
          stitch: 1,
          wx: c,
          wy: u,
        }),
          _(
            n[3],
            Xo.copy(h[2]).addScaledVector(f[2], s[2] * 0.42),
            (o[2] + E) * 0.5,
            { a: -1, b: 2, kP: 1.08, wx: c, wy: u },
          );
        for (let S of [0, 0.6, 1.05, 1.36])
          _(
            n[3],
            Xo.copy(h[2]).addScaledVector(f[2], w + E * 1.08 * Math.sin(S)),
            E * Math.cos(S),
            { a: -1, b: -1, kP: 1.06, wx: c, wy: u },
          );
        _(n[3], Xo.copy(h[2]).addScaledVector(f[2], w + E * 1.08), 1e-5, {
          a: -1,
          b: -1,
        }),
          e.collapse();
      }
    }
    return e.geo();
  }
  var yC = (i) => new vl().setFromAxisAngle(new ti(0, 1, 0), i),
    bC = (i) => new vl().setFromAxisAngle(new ti(1, 0, 0), i);
  function C_(i, e) {
    let t = [yC(e[3] || 0)];
    for (let n = 0; n < 3; n++) t.push(t[n].clone().multiply(bC(-e[n])));
    return z_({
      base: new ti(i.base[0], i.base[1], i.base[2]),
      qs: t,
      len: i.len,
      rad: i.rad,
    });
  }
  function _C(i, e) {
    let t = i.clone().negate(),
      n = new ti().crossVectors(e, t);
    n.lengthSq() < 1e-6 && n.set(1, 0, 0), n.normalize();
    let s = new ti().crossVectors(t, n);
    return new vl().setFromRotationMatrix(new rm().makeBasis(n, s, t));
  }
  function MC(i) {
    let e = i.map((o) => new ti(o[0], o[1], o[2]).normalize()),
      t = new ti(-0.72, 0.69, 0),
      n = [],
      s = e[2].clone().sub(e[0]);
    s.length() > 0.12 &&
      t.multiplyScalar(0.25).addScaledVector(s.normalize(), -1);
    for (let o = 0; o < 3; o++) n.push(_C(e[o], t));
    return (
      n.unshift(n[0].clone()),
      z_({
        base: new ti(-0.028, -0.007, -0.014),
        qs: n,
        len: [0.044, 0.031, 0.026],
        rad: [0.0165, 0.0118, 0.011, 0.01],
        pads: [0, 1, 0],
        patchJ: 2,
        bump: [0, 0.2, 0.2],
        tipW: 1.12,
        tipH: 0.86,
        saddle: 1,
        rootBack: 0.01,
        rootK: 0.72,
        rootAo: 0.9,
      })
    );
  }
  var Qc = 0.006,
    D_ = (i) => -0.0975 + 0.0125 * Math.pow((i + 0.008) / 0.04, 2),
    Ov = (i) => D_(i) + 0.006,
    Hv = (i) => 0.029 + 0.014 * xl(0.05, 0.85, i),
    L_ = (i) => 0.0185 - 0.0065 * xl(0.1, 1, i),
    k_ = (i) =>
      0.0185 + 0.003 * Math.sin(Math.PI * um(i * 1.6)) - 0.0055 * xl(0.3, 1, i);
  function kv(i, e) {
    let t = um((Qc - e) / (Qc - Ov(i))),
      n = Math.min(0.999, Math.abs(i / Hv(t)));
    return L_(t) * Math.pow(1 - Math.pow(n, 2.5), 0.4);
  }
  function wC(i, e) {
    let t = um((Qc - e) / (Qc - Ov(i))),
      n = Hv(t),
      s = Math.min(0.999, Math.abs(i / n));
    return (
      k_(t) *
      Math.pow(1 - Math.pow(s, 2.5), 0.4) *
      (1 + 0.14 * Math.max(0, i / n) * Math.sin(Math.PI * t))
    );
  }
  function EC() {
    let e = new yl(24),
      t = new ti(),
      n = [
        [0, 0, 1, 1],
        [0.1, 0, 1, 1],
        [0.22, 0, 1, 1],
        [0.36, 0, 1, 1],
        [0.5, 0, 1, 1],
        [0.64, 0, 1, 1],
        [0.77, 0, 1, 1],
        [0.89, 0, 1, 1],
        [1, 0, 1, 1],
        [1, -0.005, 0.8, 1],
        [1, -0.009, 0.45, 0.985],
        [1, -0.0105, 0.04, 0.97],
      ];
    for (let [s, o, r, a] of n) {
      let l = Hv(s) * a,
        c = L_(s) * r,
        u = k_(s) * r;
      for (let h = 0; h < 24; h++) {
        let f = ((h + 0.5) / 24) * Math.PI * 2,
          p = Math.cos(f),
          d = Math.sin(f),
          v = l * Ff(p, 0.8),
          g =
            d >= 0
              ? c * Ff(d, 0.8)
              : u *
                Ff(d, 0.8) *
                (1 + 0.14 * Math.max(0, v / l) * Math.sin(Math.PI * s));
        t.set(v, g, Qc + (Ov(v) - Qc) * s + o);
        let x = d > 0.3 ? Bv : d < -0.3 ? am : lm,
          y = 1;
        s === 0.1 && d > 0.3 && ((x = kf), (y = 0.75)),
          o < 0 && ((x = lm), (y = 0.7 + o * 30)),
          d < -0.3 && (y *= 0.82 + 0.18 * Math.abs(p)),
          e.v(t, x, y);
      }
    }
    return e.geo();
  }
  function SC(i) {
    let t = new yl(12),
      n = new ti(),
      s = new ti(),
      o = new ti(),
      r = new ti(),
      a = new ti(),
      l = new ti(i.x, i.y, i.z - 1).normalize(),
      c = [-0.12, 0, 0.2, 0.4, 0.6, 0.78, 0.9];
    for (let d = 0; d < c.length; d++) {
      let v = c[d],
        g = d === 0 || d === c.length - 1;
      s.set(-0.028, -0.007, -0.014).addScaledVector(i, 0.044 * v),
        o.set(-0.03, -0.003, -0.022 - 0.06 * v),
        r.subVectors(s, o);
      let x = r.length() * 0.5 + 0.005;
      r.normalize(), a.crossVectors(r, l).normalize();
      let y = g ? 1e-5 : 0.0085 * (1 - 0.55 * v),
        b = g ? 1e-5 : x * (1 - 0.3 * v * v);
      for (let m = 0; m < 12; m++) {
        let A = ((m + 0.5) / 12) * Math.PI * 2,
          _ = Math.cos(A),
          M = Math.sin(A);
        n.copy(s)
          .add(o)
          .multiplyScalar(0.5)
          .addScaledVector(r, _ * b)
          .addScaledVector(a, M * y);
        let E = a.y * M < 0;
        t.v(n, E ? am : Bv, E ? 0.85 : 0.92);
      }
      g && t.collapse();
    }
    let u = t.geo(),
      h = u.attributes.position,
      f = u.index.array,
      p = 0;
    for (let d = 0; d < f.length; d += 3)
      s.fromBufferAttribute(h, f[d]),
        o.fromBufferAttribute(h, f[d + 1]),
        n.fromBufferAttribute(h, f[d + 2]),
        (p += s.dot(o.cross(n)));
    if (p < 0) {
      for (let d = 0; d < f.length; d += 3) {
        let v = f[d + 1];
        (f[d + 1] = f[d + 2]), (f[d + 2] = v);
      }
      u.computeVertexNormals();
    }
    return u;
  }
  function P_(i) {
    if ((i.scale(-1, 1, 1), !i.index)) {
      let t = i.attributes.position.count,
        n = new Uint32Array(t);
      for (let s = 0; s < t; s++) n[s] = s;
      i.setIndex(new et(n, 1));
    }
    let e = i.index.array;
    for (let t = 0; t < e.length; t += 3) {
      let n = e[t + 1];
      (e[t + 1] = e[t + 2]), (e[t + 2] = n);
    }
    return i;
  }
  function Vv(i) {
    let e = [],
      t = i.debugParts || null,
      n = (d, v) => (e.push(v), t && t.push([d, v]), v);
    n("palm", EC());
    {
      let d = [];
      for (let v = 0; v <= 30; v++) d.push(-1 + v / 15);
      n(
        "guard",
        I_(d, [-1, -0.9, -0.5, 0, 0.5, 0.9, 1], (v, g, x) => {
          let y = -5e-4 + v * 0.0405,
            b = D_(y) + 0.0045 - g * 0.011,
            m = Math.min(cm(v), cm(g)),
            A = 0;
          for (let M = 0; M < 4; M++) {
            let E = (y - om[M].base[0]) / 0.0058;
            A += (M === 3 ? 0.8 : 1) * Math.exp(-E * E);
          }
          (A = Math.min(1, A) * (1 - 0.55 * g * g)),
            x.set(
              y,
              kv(y, b) +
                (m < 0
                  ? g > 0.95
                    ? -0.008
                    : -0.003
                  : (0.0016 + 0.006 * A) * m),
              b,
            );
          let _ = m < 0 ? 0.6 : 0.85 + 1.3 * A;
          return [Lv[0] * _, Lv[1] * _, Lv[2] * _];
        }),
      );
    }
    for (let d = 0; d < 3; d++)
      n(
        "bar",
        Lf(
          0.001,
          -0.034 - d * 0.015,
          0.023 + d * 0.0025,
          0.0052,
          0.0019,
          Fv,
          kv,
        ),
      );
    n(
      "seam",
      Lf(
        0,
        -0.0225,
        0.027,
        0.0013,
        9e-4,
        kf.map((d) => d * 0.8),
        kv,
        null,
        !1,
        Uv,
        [-1, 0, 1].map((d) => d * 0.9),
      ),
    ),
      n("heelPad", Lf(0.013, -0.03, 0.0135, 0.017, 0.0017, Fv, wC, null, !0));
    let s = [];
    for (let d = 0; d < 4; d++) {
      if (d === 0 && i.indexPoses) {
        for (let v of i.indexPoses) s.push(C_(om[0], v));
        continue;
      }
      n("finger" + d, C_(om[d], i.fingers[d]));
    }
    n("thumb", MC(i.thumb)),
      n(
        "web",
        SC(new ti(i.thumb[0][0], i.thumb[0][1], i.thumb[0][2]).normalize()),
      );
    let o = new ti(i.forearm[0], i.forearm[1], i.forearm[2]).normalize(),
      r = i.sleeve || 0.36,
      a = 0.022,
      l = new vl().setFromUnitVectors(new ti(0, 0, 1), o),
      c = new vl(),
      u = new vl(),
      h = (d) => (
        u.slerpQuaternions(c, l, xl(0.002, 0.042, d.z)),
        (d.z -= a),
        d.applyQuaternion(u),
        (d.z += a),
        d
      );
    {
      let v = new yl(24),
        g = new ti(),
        x = [
          [-0.0085, -0.0015, Df, 0.6],
          [-0.009, 0.0022, Df, 1.3],
          [-0.006, 0.0026, Df, 1.3],
          [-0.0052, 0.002, gl, 0.75],
          [0.004, 0.0014, gl, 1],
          [0.011, 0.0016, gl, 0.7],
          [0.0122, 0.003, Df, 1.2],
          [0.0305, 0.0032, Df, 1.2],
          [0.0317, 0.0018, gl, 0.7],
          [0.04, 0.002, gl, 1],
          [0.054, 0.0024, gl, 1],
          [0.058, 0.0026, kf, 0.7],
          [0.058, -0.004, gl, 0.4],
        ];
      for (let [y, b, m, A] of x)
        for (let _ = 0; _ < 24; _++) {
          let M = ((_ + 0.5) / 24) * Math.PI * 2,
            E = Math.sin(M);
          v.v(
            h(
              g.set(
                (0.0296 + b) * Ff(Math.cos(M), 0.8),
                (E >= 0 ? 0.0185 + b : 0.0204 + b) * Ff(E, 0.8),
                y,
              ),
            ),
            m,
            A,
          );
        }
      n("cuff", v.geo(!0));
    }
    n(
      "strapTab",
      Lf(
        0.009,
        0.0215,
        0.0135,
        0.0076,
        0.0017,
        (d) => (d > 0.55 ? kf.map((v) => v * 0.75) : [9, 9, 9.6]),
        (d) =>
          0.0217 *
          Math.pow(
            1 - Math.pow(Math.min(0.999, Math.abs(d / 0.0328)), 2.5),
            0.4,
          ),
        h,
      ),
    ),
      n(
        "pullTab",
        Lf(0.003, 0.004, 0.0065, 0.0115, 0.0022, pC, () => 0.022, h, !0),
      );
    {
      let d = [];
      for (let z = 0; z < 24; z++)
        d.push(z * 15),
          (z === 4 || z === 16) && d.push(z * 15 + 11.5),
          (z === 5 || z === 17) && d.push(z * 15 + 3.5);
      d.sort((z, H) => z - H);
      let v = d.length,
        g = d.indexOf(75),
        x = d.indexOf(255),
        y = new yl(v),
        b = new ti(),
        m = 0.04 + r,
        A = [
          [0.0415, 0],
          [0.04, 1],
          [0.044, 2],
          [0.049, 3],
          [0.055, 3],
          [0.061, 3],
          [0.0655, 4],
          [0.0685, 5],
        ],
        _ = [0.1415, 0.143, 0.157, 0.1582, 0.1662, 0.1674, 0.181, 0.1825],
        M = _.slice(),
        E = Math.ceil((m - 0.074) / 0.0052);
      for (let z = 0; z <= E; z++) {
        let H = 0.074 + ((m - 0.074) * z) / E;
        _.some((O) => Math.abs(O - H) < 0.0016) || M.push(H);
      }
      M.sort((z, H) => z - H);
      for (let z of M) A.push([z, 6]);
      let w = 0;
      for (let [z, H] of A)
        for (let O = 0; O < v; O++) {
          let q = (d[O] * Math.PI) / 180,
            U,
            T = 1,
            D = E_;
          if (H === 0) (U = 0.0292), (T = 0.4);
          else if (H === 1) (U = 0.0372), (T = 1.15);
          else if (H === 2) (U = 0.0377), (T = 1.1);
          else if (H === 3) {
            let C = Math.cos(q * 12);
            (U = 0.0368 + 0.0012 * C), (T = 0.62 + 0.26 * C);
          } else if (H === 4) (U = 0.0356), (T = 0.55);
          else if (H === 5) (U = 0.038), (T = 0.9);
          else {
            let C = (z - 0.0685) / (m - 0.0685),
              G = 0.0048 * Math.exp(-Math.pow((C - 0.13) / 0.11, 2)),
              j = 0.0048 * xl(0.62, 0.85, C),
              N =
                Math.pow(
                  Math.abs(
                    Math.sin(
                      (Math.PI * z) / 0.027 +
                        1.7 * Math.sin(q + 0.5) +
                        0.8 * Math.sin(2 * q + 1.3),
                    ),
                  ),
                  0.6,
                ) *
                  2 -
                1.25,
              Q =
                Math.pow(
                  Math.abs(
                    Math.sin(
                      (Math.PI * z) / 0.034 +
                        1.9 * Math.sin(q - 0.8) +
                        0.7 * Math.sin(2 * q),
                    ),
                  ),
                  0.6,
                ) *
                  2 -
                1.25,
              K =
                Math.sin(z * 40 + 2 * Math.sin(q * 2 + 1)) +
                0.6 * Math.sin(3 * q + z * 25);
            (U =
              0.0405 +
              0.012 * Math.pow(C, 0.85) +
              0.0025 * Math.exp(-Math.pow((z - 0.082) / 0.012, 2)) +
              G * N +
              j * Q +
              0.0016 * K),
              (T =
                0.78 +
                0.26 * xl(-1.1, 0.5, (G * N + j * Q) / (G + j + 8e-4)) +
                0.04 * K);
            let ie = vC(w);
            z > 0.1575 && z < 0.167
              ? ((D = gC), (T *= 0.85 + 0.25 * ie))
              : z > 0.1425 && z < 0.1815 && ((D = mC), (T *= 0.78 + 0.3 * ie));
          }
          H > 0 &&
            (O === g || O === x
              ? ((U += 0.0019), (T *= 1.3))
              : (Math.abs(O - g) === 1 || Math.abs(O - x) === 1) &&
                (T *= 0.52)),
            b.set(Math.cos(q) * U, Math.sin(q) * U * 0.84, z),
            y.v(b, D, T),
            w++;
        }
      for (let z = 0; z < v; z++) y.v(b.set(0, 0, m + 0.006), E_, 0.3);
      y.collapse();
      let S = y.geo(!0);
      S.applyMatrix4(
        new rm()
          .makeTranslation(0, 0, a)
          .multiply(new rm().makeRotationFromQuaternion(l))
          .multiply(new rm().makeTranslation(0, 0, -a)),
      ),
        n("sleeve", S);
    }
    let p = {
      fabric: Ii(e),
      rubber: null,
      index: s.length ? s : null,
      knuckle: om[0].base.slice(),
    };
    return (
      i.mirror &&
        (P_(p.fabric), p.index && p.index.forEach(P_), (p.knuckle[0] *= -1)),
      p
    );
  }
  var hm = {
      model: [8, 8, 330, 84],
      maker: [8, 100, 560, 40],
      cal: [8, 146, 560, 40],
      prop: [8, 192, 700, 40],
      safe: [8, 240, 90, 34],
      semi: [110, 240, 90, 34],
      auto: [212, 240, 90, 34],
      rack: [8, 290, 300, 110],
      warn: [330, 290, 420, 110],
      optic: [580, 8, 300, 60],
      light: [580, 76, 300, 60],
      dots: [320, 240, 60, 34],
      r2: [8, 420, 56, 40],
      r4: [72, 420, 56, 40],
      r6: [136, 420, 56, 40],
      r8: [200, 420, 56, 40],
      r10: [264, 420, 56, 40],
      r12: [328, 420, 56, 40],
    },
    Uf = 1024,
    Nf = 512;
  function TC() {
    let i = document.createElement("canvas");
    (i.width = Uf), (i.height = Nf);
    let e = i.getContext("2d");
    e.clearRect(0, 0, Uf, Nf), (e.textBaseline = "middle");
    let t = (u, h, f, p, d = "left") => {
        let [v, g, x, y] = hm[u];
        (e.font = f),
          (e.fillStyle = p),
          (e.textAlign = d),
          e.fillText(h, d === "left" ? v + 2 : v + x / 2, g + y / 2 + 1, x - 4);
      },
      n = '"PingFang SC", "PingFang SC", Arial, sans-serif',
      s = '"PingFang SC", "PingFang SC", monospace',
      o = '"PingFang SC", "PingFang SC", Impact, sans-serif',
      r = "rgba(196,198,194,0.92)";
    t("model", "PAC-9", `700 78px ${o}`, r),
      t("maker", "几猫兵工厂 · 港区装备", `600 30px ${n}`, r),
      t("cal", "CAL 5.8\xD740   SN PA-004217", `500 27px ${s}`, r),
      t("prop", "港务局装备 · 四号泊位武器库", `600 28px ${n}`, r),
      t("safe", "S", `700 30px ${n}`, r, "center"),
      t("semi", "1", `700 30px ${n}`, r, "center"),
      t("auto", "A", `700 30px ${n}`, "rgba(205,60,40,0.95)", "center"),
      t("rack", "B4-07", `800 104px ${o}`, "rgba(214,206,170,0.9)", "center");
    for (let u of [2, 4, 6, 8, 10, 12])
      t("r" + u, "T" + u, `600 30px ${s}`, "rgba(190,192,188,0.85)", "center");
    t("optic", "HX-2 反射瞄具", `700 44px ${n}`, r, "center"),
      t("light", "900 LM  IPX8", `600 40px ${n}`, r, "center");
    {
      let [u, h] = hm.warn;
      (e.fillStyle = r),
        (e.textAlign = "left"),
        (e.font = `600 24px ${n}`),
        [
          "警告：存放前必须清空弹膛",
          "仅限授权突击队员使用",
          "港务安全规程 44/7",
        ].forEach((f, p) => e.fillText(f, u + 2, h + 20 + p * 34));
    }
    {
      let [u, h, f, p] = hm.dots;
      (e.fillStyle = r),
        e.beginPath(),
        e.arc(u + 12, h + p / 2, 7, 0, 7),
        e.fill(),
        (e.fillStyle = "rgba(205,60,40,0.95)"),
        e.beginPath(),
        e.arc(u + 40, h + p / 2, 7, 0, 7),
        e.fill();
    }
    e.globalCompositeOperation = "destination-out";
    let a = 7,
      l = () => ((a = (a * 16807) % 2147483647), a / 2147483647);
    for (let u = 0; u < 2600; u++) {
      e.fillStyle = `rgba(0,0,0,${0.25 + l() * 0.6})`;
      let h = l() < 0.9 ? 1 + l() * 1.5 : 2 + l() * 5;
      e.fillRect(l() * Uf, l() * Nf, h, h * (0.4 + l()));
    }
    let c = new xs(i);
    return (
      (c.colorSpace = Vn),
      (c.anisotropy = 8),
      (c.generateMipmaps = !0),
      (c.minFilter = Ln),
      c
    );
  }
  function F_(i) {
    let e = [],
      t = [],
      n = [],
      s = [];
    for (let [l, c, u, h, f, p, d = 0] of i) {
      let [v, g, x, y] = hm[l],
        b = (f * x) / y,
        m = v / Uf,
        A = (v + x) / Uf,
        _ = 1 - g / Nf,
        M = 1 - (g + y) / Nf,
        E = e.length / 3,
        w;
      if (
        (p === "L"
          ? (w = [
              [c, u - f / 2, -(h + b / 2)],
              [c, u - f / 2, -(h - b / 2)],
              [c, u + f / 2, -(h - b / 2)],
              [c, u + f / 2, -(h + b / 2)],
            ])
          : p === "R"
            ? (w = [
                [c, u - f / 2, -(h - b / 2)],
                [c, u - f / 2, -(h + b / 2)],
                [c, u + f / 2, -(h + b / 2)],
                [c, u + f / 2, -(h - b / 2)],
              ])
            : (w = [
                [c - b / 2, u, -(h - f / 2)],
                [c + b / 2, u, -(h - f / 2)],
                [c + b / 2, u, -(h + f / 2)],
                [c - b / 2, u, -(h + f / 2)],
              ]),
        d)
      ) {
        let z = Math.cos(d),
          H = Math.sin(d),
          O = u,
          q = -h;
        for (let U of w) {
          let T = U[1] - O,
            D = U[2] - q;
          (U[1] = O + T * z - D * H), (U[2] = q + T * H + D * z);
        }
      }
      for (let z of w) e.push(z[0], z[1], z[2]);
      t.push(m, M, A, M, A, _, m, _);
      let S = p === "L" ? [-1, 0, 0] : p === "R" ? [1, 0, 0] : [0, 1, 0];
      for (let z = 0; z < 4; z++) n.push(S[0], S[1], S[2]);
      s.push(E, E + 1, E + 2, E, E + 2, E + 3);
    }
    let o = new nt();
    o.setAttribute("position", new He(e, 3)),
      o.setAttribute("uv", new He(t, 2)),
      o.setAttribute("normal", new He(n, 3)),
      o.setIndex(s);
    let r = new Qt({
        map: TC(),
        transparent: !0,
        roughness: 0.62,
        metalness: 0,
        depthWrite: !1,
        polygonOffset: !0,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
        side: Sn,
      }),
      a = new Qe(o, r);
    return (a.renderOrder = 2), a;
  }
  function U_(i, e) {
    let t = new ji();
    i.forEach((r, a) => (a ? t.lineTo(r[0], r[1]) : t.moveTo(r[0], r[1]))),
      t.closePath();
    let n = new H0(t);
    n.translate(0, 0, -e);
    {
      let r = 1e9,
        a = -1e9,
        l = 1e9,
        c = -1e9;
      for (let f of i)
        (r = Math.min(r, f[0])),
          (a = Math.max(a, f[0])),
          (l = Math.min(l, f[1])),
          (c = Math.max(c, f[1]));
      let u = n.attributes.position,
        h = n.attributes.uv;
      for (let f = 0; f < u.count; f++)
        h.setXY(f, (u.getX(f) - r) / (a - r), (u.getY(f) - l) / (c - l));
    }
    let s = new zn({
        transparent: !0,
        premultipliedAlpha: !0,
        depthWrite: !1,
        side: Sn,
        uniforms: {
          uBright: { value: 7 },
          uSun: { value: Mn.dir.clone() },
          uSunCol: { value: Mn.color.clone() },
          uZen: { value: en.zenith.clone() },
          uHor: { value: en.horizonAway.clone() },
          uTilt: { value: 0.1 },
        },
        vertexShader: `
      varying vec3 vView, vFwd, vRight, vUp, vWPos, vWN; varying vec2 vUv;
      uniform float uTilt;
      void main(){
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0); vView = mv.xyz;
        vFwd = (modelViewMatrix * vec4(0.0, 0.0, -1.0, 0.0)).xyz; vRight = (modelViewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz; vUp = (modelViewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz;
        vWPos = (modelMatrix * vec4(position, 1.0)).xyz;
        vWN = normalize(mat3(modelMatrix) * normalize(vec3(0.0, -uTilt, 1.0)));   // real sights tilt the glass a few degrees
        gl_Position = projectionMatrix * mv;
      }`,
        fragmentShader: `
      varying vec3 vView, vFwd, vRight, vUp, vWPos, vWN; varying vec2 vUv;
      uniform float uBright; uniform vec3 uSun, uSunCol, uZen, uHor;
      void main(){
        vec3 d = normalize(vView), fw = normalize(vFwd);
        float k = max(dot(d, fw), 1e-3);
        vec2 a = vec2(dot(d, normalize(vRight)), dot(d, normalize(vUp))) / k;      // tangent of the angle off the bore axis
        float r = length(a), px = max(fwidth(r), 1e-5);
        float dotR = max(0.0011, px * 0.9), ringW = max(0.00045, px * 0.6);
        float dotI = 1.0 - smoothstep(dotR - px, dotR + px, r);
        float ring = 1.0 - smoothstep(ringW - px * 0.5, ringW + px, abs(r - 0.0128));
        float ang = atan(a.y, a.x);
        float tick = (1.0 - smoothstep(0.0, px * 1.2 + 0.0004, min(abs(a.x), abs(a.y)))) * step(0.0128, r) * (1.0 - smoothstep(0.0165, 0.0175, r));
        float ret = clamp(dotI + ring * 0.8 + tick * 0.8, 0.0, 1.0);
        // faint halo so the bloom has something to hold on to
        ret += 0.05 * exp(-r * r / 0.00002);
        vec3 retCol = vec3(1.0, 0.11, 0.045) * ret * uBright;
        // coated glass: sky/sun reflection through a ruby-teal dichroic coating, stronger at grazing angles
        vec3 wv = normalize(vWPos - cameraPosition); vec3 n = normalize(vWN); if (dot(n, wv) > 0.0) n = -n;
        vec3 rf = reflect(wv, n);
        float fres = pow(1.0 - abs(dot(wv, n)), 3.0);
        vec3 sky = mix(uHor, uZen, clamp(rf.y * 1.4 + 0.2, 0.0, 1.0));
        float sd = max(dot(rf, uSun), 0.0);
        sky += uSunCol * (pow(sd, 6.0) * 0.6 + pow(sd, 90.0) * 6.0);
        // blue -> amber dichroic coating across the glass, a soft diagonal sheen band, and a thin dark edge
        float band = smoothstep(0.25, 0.5, vUv.x * 0.6 + vUv.y) * (1.0 - smoothstep(0.62, 0.95, vUv.x * 0.6 + vUv.y));
        vec3 coat = mix(vec3(0.30, 0.50, 0.95), vec3(1.0, 0.62, 0.28), clamp(fres * 2.2 + vUv.y * 0.75 - 0.15, 0.0, 1.0));
        vec2 e = abs(vUv - 0.5) * 2.0; float edge = smoothstep(0.90, 1.0, max(e.x, e.y));
        float refl = 0.12 + 0.60 * fres + 0.07 * band;
        // faint emitter glow that stays visible off-axis (what you see of a powered sight from the hip)
        vec2 eg = (vUv - vec2(0.5, 0.16)) * vec2(1.0, 1.6); retCol += vec3(1.0, 0.10, 0.04) * 0.20 * exp(-dot(eg, eg) * 60.0) * (1.0 - smoothstep(0.985, 0.9995, k));
        vec3 col = (sky * 1.5 + vec3(0.03, 0.035, 0.045)) * coat * refl * (1.0 - edge) + retCol;
        float alpha = clamp(0.20 + 0.32 * fres + 0.05 * band + 0.6 * edge, 0.0, 0.94);
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
      }),
      o = new Qe(n, s);
    return (o.renderOrder = 5), o;
  }
  function N_() {
    let i = [],
      e = [],
      t = [],
      n = [],
      s = (d, v, g, x, y) => {
        let b = i.length / 3;
        for (let m of [d, v, g, x]) i.push(m[0], m[1], m[2]);
        e.push(0, 0, 1, 0, 1, 1, 0, 1);
        for (let m = 0; m < 4; m++) t.push(y);
        n.push(b, b + 1, b + 2, b, b + 2, b + 3);
      };
    s(
      [-0.13, -0.13, -0.03],
      [0.13, -0.13, -0.03],
      [0.13, 0.13, -0.03],
      [-0.13, 0.13, -0.03],
      0,
    ),
      s(
        [-0.13 * 0.7, -0.13 * 0.7, -0.09],
        [0.13 * 0.7, -0.13 * 0.7, -0.09],
        [0.13 * 0.7, 0.13 * 0.7, -0.09],
        [-0.13 * 0.7, 0.13 * 0.7, -0.09],
        0,
      );
    let r = 0.065,
      a = 0.34;
    s([-r, 0, 0.01], [r, 0, 0.01], [r, 0, -a], [-r, 0, -a], 1),
      s([0, -r, 0.01], [0, r, 0.01], [0, r, -a], [0, -r, -a], 1);
    let l = 0.17,
      c = 0.05,
      u = 0.035;
    s([-l, -c, u], [l, -c, u], [l, c, u], [-l, c, u], 2),
      s([-l, 0, u + c], [l, 0, u + c], [l, 0, u - c], [-l, 0, u - c], 2),
      s(
        [-0.05, -0.05, -0.01],
        [0.05, -0.05, -0.01],
        [0.05, 0.05, -0.01],
        [-0.05, 0.05, -0.01],
        3,
      ),
      s(
        [-0.03, -0.03, 0.02],
        [0.03, -0.03, 0.02],
        [0.03, 0.03, 0.02],
        [-0.03, 0.03, 0.02],
        4,
      );
    let h = new nt();
    h.setAttribute("position", new He(i, 3)),
      h.setAttribute("uv", new He(e, 2)),
      h.setAttribute("aType", new He(t, 1)),
      h.setIndex(n);
    let f = new zn({
        transparent: !0,
        depthWrite: !1,
        blending: hr,
        side: Sn,
        uniforms: {
          uSeed: { value: 0 },
          uInt: { value: 0 },
          uHeat: { value: 0 },
          uJet: { value: 1 },
        },
        vertexShader: `attribute float aType; varying vec2 vUv; varying float vType;
      void main(){ vUv = uv; vType = aType; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `varying vec2 vUv; varying float vType; uniform float uSeed, uInt, uHeat, uJet;
      float h1(float n){ return fract(sin(n * 127.1 + uSeed * 311.7) * 43758.5453); }
      void main(){
        vec2 p = vUv * 2.0 - 1.0; float r = length(p), a = atan(p.y, p.x); float I = 0.0; vec3 tintc = vec3(1.0, 0.50, 0.16);
        if (vType < 0.5) {
          float n1 = 3.0 + floor(h1(1.0) * 3.0), n2 = 5.0 + floor(h1(2.0) * 4.0);
          float pet = pow(abs(cos(a * n1 * 0.5 + h1(3.0) * 6.283)), 5.0) * (0.55 + 0.45 * h1(4.0));
          pet += pow(abs(cos(a * n2 * 0.5 + h1(5.0) * 6.283)), 14.0) * 0.55;
          float reach = 0.35 + 0.65 * pet;
          I = (0.25 + pet) * smoothstep(reach, reach * 0.15, r) * (0.75 + 0.25 * sin(r * 26.0 + h1(6.0) * 20.0));
        } else if (vType < 1.5) {
          float y = vUv.y, x = p.x * (1.0 + 0.5 * sin(y * 17.0 + h1(7.0) * 30.0) * y);
          float wdt = mix(0.20, 0.75, smoothstep(0.0, 0.35, y)) * (1.0 - y * 0.75);
          I = exp(-x * x / (wdt * wdt * 0.35)) * pow(1.0 - y, 1.4) * (0.7 + 0.3 * sin(y * 31.0 + h1(8.0) * 9.0)) * 0.9;
        } else if (vType < 2.5) {
          float u = abs(p.x), len = 0.55 + 0.45 * h1(9.0 + step(0.0, p.x));
          float wv = p.y * (1.0 + u * 3.0) + 0.12 * sin(u * 14.0 + h1(10.0) * 20.0) * u;
          I = exp(-wv * wv * 22.0) * smoothstep(len, 0.06, u) * smoothstep(0.02, 0.10, u) * 0.85 * uJet;
        } else if (vType < 3.5) {
          I = exp(-r * r * 5.0) * 2.4 * smoothstep(1.0, 0.6, r); tintc = vec3(1.0, 0.82, 0.58);
        } else {
          gl_FragColor = vec4(vec3(1.0, 0.28, 0.06) * exp(-r * r * 4.0) * smoothstep(1.0, 0.5, r) * uHeat, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          return;
        }
        vec3 col = mix(tintc, vec3(1.0, 0.90, 0.70), clamp(I * I * 0.7, 0.0, 1.0)) * I * uInt;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
      }),
      p = new Qe(h, f);
    return (p.renderOrder = 10), (p.frustumCulled = !1), p;
  }
  var Wv = { value: 1 },
    AC = `
varying vec3 vObjP; varying vec3 vWNrm; varying vec3 vONrm; uniform float uKind; uniform float uRain;
float dh3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float dn3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dh3(i), dh3(i + vec3(1,0,0)), f.x), mix(dh3(i + vec3(0,1,0)), dh3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(dh3(i + vec3(0,0,1)), dh3(i + vec3(1,0,1)), f.x), mix(dh3(i + vec3(0,1,1)), dh3(i + vec3(1,1,1)), f.x), f.y), f.z); }
vec2 dh2(vec2 p){ return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
vec2 dDrops(vec2 uv, float cell, float seed){ vec2 g = uv / cell, i = floor(g), f = fract(g); float best = 0.0;
  for (int a = -1; a <= 1; a++) for (int b = -1; b <= 1; b++) { vec2 o = vec2(float(a), float(b)); vec2 r = dh2(i + o + seed);
    float keep = step(0.70, fract(r.x * 7.31 + r.y * 3.17)); vec2 c = o + 0.2 + 0.6 * r; float rad = (0.16 + 0.22 * fract(r.x * 13.7)) * keep;
    float d = length(f - c); best = max(best, sqrt(max(rad * rad - d * d, 0.0))); }
  return vec2(best * cell, step(1e-6, best)); }
vec3 dBump(vec3 N, float h){ vec3 dpdx = dFdx(-vViewPosition), dpdy = dFdy(-vViewPosition); float dhx = dFdx(h), dhy = dFdy(h);
  vec3 r1 = cross(dpdy, N), r2 = cross(N, dpdx); float det = dot(dpdx, r1); vec3 g = sign(det) * (dhx * r1 + dhy * r2);
  return normalize(abs(det) * N - g); }
`,
    RC = `
vec3 dP = vObjP; vec3 dAn = abs(vONrm);
vec2 dUV = (dAn.y > dAn.x && dAn.y > dAn.z) ? dP.xz : (dAn.x > dAn.z ? dP.zy : dP.xy);
float dSm = dn3(dP * 36.0), dSm2 = dn3(dP * 150.0 + 7.0), dFine = dn3(dP * 2400.0);
float dHt = 0.0, dR = 0.0;
if (uKind < 0.5) {
  float scuff = smoothstep(0.70, 0.9, dn3(dP * vec3(420.0, 420.0, 26.0) + 3.0));
  float smudge = smoothstep(0.55, 0.8, dn3(dP * 55.0 + 11.0));
  dR = (dSm - 0.5) * 0.20 + (dSm2 - 0.5) * 0.10 + (dFine - 0.5) * 0.08 + scuff * 0.18 - smudge * 0.12;
  dHt = dFine * 0.000010 - scuff * 0.000015;
} else if (uKind < 1.5) {
  float ring = sin(dP.z * 5200.0) * 0.5 + 0.5, streak = dn3(vec3(dP.z * 950.0, 1.0, 2.0));
  dR = (streak - 0.5) * 0.26 + (dSm - 0.5) * 0.14 + (dFine - 0.5) * 0.10;
  dHt = ring * 0.000014 + dFine * 0.000010;
} else {
  float st = dn3(dP * 1500.0) * 0.6 + dn3(dP * 3100.0 + 5.0) * 0.4;
  dR = (dSm - 0.5) * 0.18 + (st - 0.5) * 0.14 - smoothstep(0.6, 0.85, dSm2) * 0.10;
  dHt = st * 0.000075;
}
float dUp = smoothstep(0.30, 0.75, vWNrm.y) * uRain;
vec2 dD1 = dDrops(dUV, 0.0046, 3.0), dD2 = dDrops(dUV + 0.31, 0.0023, 9.0);
float dDrop = max(dD1.y, dD2.y) * dUp, dDropH = max(dD1.x, dD2.x) * dUp;
float dWet = dUp * (0.5 + 0.5 * smoothstep(0.3, 0.7, dSm));
roughnessFactor = clamp(roughnessFactor + dR, 0.10, 1.0);
roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.5, dWet);
roughnessFactor = mix(roughnessFactor, 0.10, dDrop);
diffuseColor.rgb *= 1.0 - 0.18 * dWet;
`,
    CC = `
normal = dBump(normal, dHt + dDropH * 0.32);
`;
  function Bf(i, e) {
    return (
      (i.onBeforeCompile = (t) => {
        (t.uniforms.uKind = { value: e }),
          (t.uniforms.uRain = Wv),
          (t.vertexShader = t.vertexShader
            .replace(
              "#include <common>",
              `#include <common>
varying vec3 vObjP; varying vec3 vWNrm; varying vec3 vONrm;`,
            )
            .replace(
              "#include <begin_vertex>",
              `#include <begin_vertex>
vObjP = position; vONrm = normal; vWNrm = normalize(mat3(modelMatrix) * normal);`,
            )),
          (t.fragmentShader = t.fragmentShader
            .replace(
              "#include <common>",
              `#include <common>
` + AC,
            )
            .replace(
              "#include <roughnessmap_fragment>",
              `#include <roughnessmap_fragment>
` + RC,
            )
            .replace(
              "#include <normal_fragment_maps>",
              `#include <normal_fragment_maps>
` + CC,
            ));
      }),
      (i.customProgramCacheKey = () => "pac9-detail-" + e),
      i
    );
  }
  var gi = W,
    fm = Lt,
    Gv = 30,
    B_ = 150,
    O_ = 720,
    H_ = 26,
    V_ = 300,
    eu = { p: [0.118, -0.122, -0.275], r: [0.034, 0.085, -0.03] },
    qv = { p: [0, -mi.sightY, -0.135], r: [0, 0, 0] },
    tu = { p: [-0.035, 0.004, 0.03], r: [-0.04, 0.62, 0.26] },
    nu = { p: [-0.03, 0.1, -0.02], r: [0.46, 0.22, -0.8] },
    W_ = 2.1,
    G_ = 2.72,
    Yo = (i) => ((i = Fo(i)), i * i * i * (i * (6 * i - 15) + 10)),
    pa = (i, e) => ({ x: 0, v: 0, k: i, c: e });
  function ma(i, e, t) {
    let n = t > 0.012 ? Math.ceil(t / 0.008) : 1,
      s = t / n;
    for (let o = 0; o < n; o++)
      (i.v += ((e - i.x) * i.k - i.v * i.c) * s), (i.x += i.v * s);
    return i.x;
  }
  var i0 = (i, e, t, n = "XYZ") => new fm().setFromEuler(new In(i, e, t, n));
  async function dm(i, cfg, build) {
    cfg = cfg || mi;
    build = build || w_;
    let e = new wt();
    e.name = "viewmodel-" + (cfg.id || "pac9");
    let mods = { damage: 1, rpm: 1, reload: 1, spread: 1, recoil: 1, magAdd: 0, alert: 45 };
    let t = build(cfg),
      W_ = cfg.reloadT || 2.1,
      G_ = cfg.reloadEmptyT || 2.72,
      Gv = cfg.magSize || 30,
      B_ = cfg.reserve || 150,
      O_ = cfg.rpm || 720,
      H_ = cfg.damage || 26,
      V_ = cfg.range || 300,
      qv = { p: [0, -cfg.sightY, -0.135], r: [0, 0, 0] },
      eu = { p: cfg.hipPos || [0.118, -0.122, -0.275], r: cfg.hipRot || [0.034, 0.085, -0.03] },
      tu = { p: cfg.sprintPos || [-0.035, 0.004, 0.03], r: cfg.sprintRot || [-0.04, 0.62, 0.26] },
      nu = { p: cfg.reloadPos || [-0.03, 0.1, -0.02], r: cfg.reloadRot || [0.46, 0.22, -0.8] },
      n = {
        anodized_black: 2,
        gunmetal: 2,
        brass: 4,
        glove_fabric: 3,
        rubber: 4,
      },
      s = (Me) =>
        i.mats.get(Me, { triplanar: !0, vertexColors: !0, scale: n[Me] || 1 }),
      o = (Me, we) => {
        let be = new Qe(Me, we);
        return (
          (be.castShadow = !1),
          (be.receiveShadow = !0),
          (be.frustumCulled = !1),
          be
        );
      },
      r = new Qt({
        color: new Ve(0.0085, 0.009, 0.0105),
        roughness: 0.4,
        metalness: 0.45,
        vertexColors: !0,
      });
    (r.name = "pac9_anodised"), Bf(r, 0);
    let a = new Qt({
      color: 16777215,
      roughness: 0.92,
      metalness: 0,
      vertexColors: !0,
    });
    a.name = "pac9_matte";
    let l = new Qt({
      color: new Ve(0.016, 0.016, 0.0165),
      roughness: 0.5,
      metalness: 0.7,
      vertexColors: !0,
    });
    (l.name = "pac9_phosphate"), Bf(l, 1);
    let c = new Qt({
      color: new Ve(0.0125, 0.0128, 0.0135),
      roughness: 0.62,
      metalness: 0,
      vertexColors: !0,
    });
    (c.name = "pac9_polymer"), Bf(c, 2);
    let u = new Qt({
      color: new Ve(0.105, 0.08, 0.05),
      roughness: 0.62,
      metalness: 0,
      vertexColors: !0,
    });
    (u.name = "pac9_polymer_tan"),
      Bf(u, 2),
      e.add(o(t.ano, r), o(t.gun, l), o(t.poly, c), o(t.plain, a));
    let h = o(t.bolt, l);
    e.add(h);
    let f = new wt(),
      p = new gi().fromArray(cfg.magPos);
    f.position.copy(p);
    let d = o(t.round, s("brass"));
    f.add(o(t.mag, u), d), e.add(f);
    let v = null,
      g = null,
      x = null;
    try {
      (v = F_([
        ["model", -0.0168, -0.0315, 0.064, 0.0095, "L"],
        ["maker", -0.0168, -0.042, 0.064, 0.003, "L"],
        ["cal", -0.0168, -0.0465, 0.064, 0.0028, "L"],
        ["prop", -0.0168, -0.071, 0.066, 0.0026, "L"],
        ["auto", -0.0168, -0.027, -0.0335, 0.0036, "L"],
        ["semi", -0.0168, -0.0262, -0.049, 0.0036, "L"],
        ["safe", -0.0168, -0.0362, -0.062, 0.0036, "L"],
        ["rack", -0.0168, -0.004, -0.205, 0.02, "L"],
        ["warn", -0.0181, -0.01, 0.03, 0.0062, "L"],
        ["optic", -0.0195, 0.0735, 0.021, 0.0024, "L"],
        ["model", 0.0168, -0.0315, 0.068, 0.0095, "R"],
        ["warn", 0.0168, -0.066, 0.066, 0.0075, "R"],
        ["rack", 0.0168, -0.004, -0.205, 0.02, "R"],
        ["auto", 0.0168, -0.027, -0.0335, 0.0036, "R"],
        ["safe", 0.0168, -0.0362, -0.062, 0.0036, "R"],
        ["optic", 0.0195, 0.0735, 0.021, 0.0024, "R"],
        ["cal", 0.0181, 0.0245, -0.055, 0.0026, "R"],
        ["r2", 0, 0.04365, -0.0816, 0.003, "T"],
        ["r4", 0, 0.04365, -0.0616, 0.003, "T"],
        ["r6", 0, 0.04365, 0.0584, 0.003, "T"],
        ["r8", 0, 0.04365, 0.0784, 0.003, "T"],
        ["r10", 0, 0.04365, 0.0984, 0.003, "T"],
        ["r12", 0, 0.04365, 0.1184, 0.003, "T"],
      ])),
        (v.castShadow = !1),
        (v.receiveShadow = !0),
        (v.frustumCulled = !1),
        e.add(v);
    } catch (Me) {
      console.warn("[weapon] markings skipped: " + Me);
    }
    cfg.scale && e.scale.setScalar(cfg.scale),
    (g = U_(
      cfg.window.map((Me) => [
        Me[0] * 1.01,
        (Me[1] - cfg.sightY) * 1.01 + cfg.sightY,
      ]),
      cfg.lensF + 0.0025,
    )),
      (g.frustumCulled = !1),
      e.add(g),
      (x = N_()),
      x.position.fromArray(cfg.muzzle),
      (x.visible = !1),
      e.add(x);
    let y = (Me, we, be) => {
        let Oe = new gi(we[0], we[1], we[2])
          .normalize()
          .applyQuaternion(Me.clone().invert());
        return be && (Oe.x *= -1), [Oe.x, Oe.y, Oe.z];
      },
      b = i0(-0.24, 0, 0).multiply(i0(0, 0, -Math.PI / 2)),
      m = Vv({
        mirror: !1,
        fingers: [
          null,
          [0.62, 1.72, 0.8, 0],
          [0.68, 1.7, 0.8, -0.03],
          [0.74, 1.66, 0.8, -0.09],
        ],
        indexPoses: [
          [0.1, 0.16, 0.1, 0.05],
          [0.46, 1.15, 0.5, 0],
        ],
        thumb: [
          y(b, [-0.85, 0.05, -0.5]),
          y(b, [-0.6, -0.05, -0.8]),
          y(b, [-0.05, -0.2, -0.97]),
        ],
        forearm: y(b, [0.27, -0.44, 0.86]),
        sleeve: 0.34,
      }),
      A = new wt();
    A.quaternion.copy(b),
      A.position
        .fromArray(cfg.grip)
        .sub(new gi(0.006, -0.031, -0.085).applyQuaternion(b));
    let _ = s("glove_fabric");
    A.add(o(m.fabric, _));
    let M = o(m.index[0].clone(), _);
    A.add(M), e.add(A);
    let E = m.index[0].attributes,
      w = m.index[1].attributes,
      S = -1;
    function z(Me) {
      if (Math.abs(Me - S) < 0.004) return;
      S = Me;
      let we = M.geometry.attributes.position,
        be = M.geometry.attributes.normal,
        Oe = E.position.array,
        pt = w.position.array,
        ut = E.normal.array,
        nn = w.normal.array;
      for (let bt = 0; bt < Oe.length; bt++)
        (we.array[bt] = Oe[bt] + (pt[bt] - Oe[bt]) * Me),
          (be.array[bt] = ut[bt] + (nn[bt] - ut[bt]) * Me);
      (we.needsUpdate = !0), (be.needsUpdate = !0);
    }
    let H = i0(0, 0, Math.PI / 2).multiply(i0(0.06, 0, 0)),
      O = Vv({
        mirror: !0,
        fingers: [
          [1.27, 1.42, 0.75, 0.02],
          [1.3, 1.45, 0.75, 0],
          [1.3, 1.45, 0.75, -0.02],
          [1.33, 1.45, 0.75, -0.05],
        ],
        thumb: [
          y(H, [0, 0.25, -0.97], !0),
          y(H, [0.05, 0.1, -0.99], !0),
          y(H, [0, 0, -1], !0),
        ],
        forearm: y(H, [-0.5, -0.35, 0.79], !0),
        sleeve: 0.34,
      }),
      q = new wt();
    q.add(o(O.fabric, _)), e.add(q);
    let U = new gi(0, -0.015, -0.055),
      T = (Me, we, be = U) => ({
        q: Me.clone(),
        p: new gi(we[0], we[1], we[2]).sub(be.clone().applyQuaternion(Me)),
      }),
      D = (Me, we, be, Oe, pt = null) => ({
        q: pt ? pt.clone() : Me.q.clone(),
        p: Me.p.clone().add(new gi(we, be, Oe)),
      }),
      C = i0(0, 0, Math.PI / 2).multiply(i0(0.12, 0, 0)),
      G = T(H, [(cfg.handguard ? cfg.handguard[0] : 0) - 0.015, (cfg.handguard ? cfg.handguard[1] : 0) - 0.062, cfg.handguard ? cfg.handguard[2] : -0.236]),
      j = T(C, [-0.0135, -0.15, -0.0745]),
      N = D(j, -0.035, -0.02, 0.01),
      Q = D(j, -0.06, -0.3, 0.13, C.clone().multiply(i0(-0.5, 0, 0.25))),
      K = D(j, 0, -0.035, 0.004),
      ie = D(j, -0.004, -0.06, 0),
      F = D(j, 0, -0.012, 0),
      X = i0(-0.6, 0, 0).multiply(
        new fm().setFromRotationMatrix(
          new Ye().makeBasis(
            new gi(0, 0, 1),
            new gi(-1, 0, 0),
            new gi(0, -1, 0),
          ),
        ),
      ),
      ne = T(
        X,
        [cfg.handlePos[0] - 0.004, cfg.handlePos[1], cfg.handlePos[2]],
        new gi(0, -0.024, -0.118),
      ),
      re = D(ne, 0, 0, cfg.boltTravel),
      $ = [
        [0, G],
        [0.1, G],
        [0.36, N],
        [0.44, j],
        [0.5, j],
        [0.8, Q],
        [0.98, Q],
        [1.28, K],
        [1.35, j],
        [1.45, ie],
        [1.52, F],
        [1.62, j],
        [1.7, N],
        [2.02, G],
        [9, G],
      ],
      ue = [
        ...$.slice(0, 12),
        [1.7, N],
        [1.96, ne],
        [2.02, ne],
        [2.14, re],
        [2.19, re],
        [2.26, ne],
        [2.36, ne],
        [2.66, G],
        [9, G],
      ],
      me = W_ * 0.224,
      ee = W_ * 0.6405,
      B = G_ * 0.7426,
      P = G_ * 0.7868,
      V = G_ * 0.8051,
      Y = new gi(),
      L = new fm(),
      Z = new fm(),
      J = new gi(),
      oe = new gi(),
      fe = new gi();
    function le(Me, we) {
      let be = 0;
      for (; be < Me.length - 2 && we > Me[be + 1][0]; ) be++;
      let Oe = Me[be],
        pt = Me[be + 1],
        ut = Yo((we - Oe[0]) / Math.max(1e-4, pt[0] - Oe[0]));
      Y.copy(Oe[1].p).lerp(pt[1].p, ut), L.copy(Oe[1].q).slerp(pt[1].q, ut);
    }
    q.position.copy(G.p), q.quaternion.copy(G.q);
    let R = C.clone().invert();
    e.traverse((Me) => {
      Me.layers.set(zc);
    }),
      i.camera.add(e);
    let I =
        Object.values(t).reduce((Me, we) => Me + Kc(we), 0) +
        Kc(m.fabric) +
        Kc(m.index[0]) +
        Kc(O.fabric) +
        (v ? Kc(v.geometry) : 0) +
        2,
      se = 0;
    e.traverse((Me) => {
      Me.isMesh && se++;
    }),
      console.log(
        `[weapon] ${cfg.name}: ${Math.round(I)} tris, ${se} meshes (flash only while firing)`,
      );
    let ae = i.rng && i.rng.fork ? i.rng.fork() : Math.random,
      k = {
        t: 0,
        cooldown: 0,
        prevFire: !1,
        dryDone: !1,
        autoReload: -1,
        reload: null,
        burst: 0,
        lastShot: -9,
        bloom: 0,
        heat: 0,
        smoke: 0,
        smokeTick: 0,
        adsLin: 0,
        adsE: 0,
        sprintT: 0,
        reloadW: 0,
        rackW: 0,
        bobPhase: 0,
        bobAmt: 0,
        finger: 0,
        boltT: 9,
        boltLocked: !1,
        flashT: 0,
        flashDur: 0.05,
        recPhase: 0,
        wasGround: !0,
        lastVy: 0,
        spreadS: 0.0125,
        idleT: 0,
        inspect: -1,
        kZ: pa(520, 30),
        kP: pa(380, 26),
        kY: pa(300, 22),
        kR: pa(300, 20),
        swY: pa(110, 15),
        swP: pa(110, 15),
        jY: pa(140, 13),
        jP: pa(140, 13),
        bump: pa(600, 30),
      },
      ce = { freeze: !1, reloadT: null, empty: !1, flash: !1, noFire: !1 },
      ve = {
        id: cfg.id || "pac9",
        cfg: cfg,
        mods: mods,
        baseMag: Gv,
        baseReserve: B_,
        baseAdsFov: cfg.adsFov || 0,
        reloadT: W_,
        reloadEmptyT: G_,
        scope: !!cfg.scope,
        adsFov: cfg.adsFov || 0,
        name: cfg.name,
        ammo: Gv,
        magSize: Gv,
        reserve: B_,
        state: "idle",
        ads: 0,
        spread: 0.0125,
        damage: H_,
        rpm: O_,
        root: e,
        debug: ce,
        info: { tris: Math.round(I), meshes: se },
        update: Xe,
        reset: _e,
        setVisible(Me) {
          e.visible = !!Me;
        },
        muzzleWorld: Re,
        reloadNow: Fe,
        addAmmo(Me) {
          ve.reserve += Me;
        },
        setWetness(Me) {
          Wv.value = Math.max(0, Math.min(1, +Me || 0));
        },
        snap() {
          k.adsLin = i.input.ads ? 1 : 0;
          for (let Me of [
            "kZ",
            "kP",
            "kY",
            "kR",
            "swY",
            "swP",
            "jY",
            "jP",
            "bump",
          ])
            (k[Me].x = 0), (k[Me].v = 0);
          k.sprintT = i.player.sprinting ? 1 : 0;
        },
      };
    function _e() {
      (ve.ammo = ve.magSize || Gv),
        (ve.reserve = Math.round(B_ * (1 + (mods.magAdd > 0 ? 0.25 : 0)))),
        (ve.state = "idle"),
        (ve.ads = 0),
        Object.assign(k, {
          cooldown: 0,
          prevFire: !1,
          dryDone: !1,
          autoReload: -1,
          reload: null,
          burst: 0,
          lastShot: -9,
          bloom: 0,
          heat: 0,
          smoke: 0,
          adsLin: 0,
          adsE: 0,
          sprintT: 0,
          reloadW: 0,
          boltT: 9,
          boltLocked: !1,
          flashT: 0,
          idleT: 0,
          inspect: -1,
        });
      for (let Me of ["kZ", "kP", "kY", "kR", "swY", "swP", "jY", "jP", "bump"])
        (k[Me].x = 0), (k[Me].v = 0);
      (d.visible = !0),
        (f.visible = !0),
        f.position.copy(p),
        f.quaternion.identity(),
        q.position.copy(G.p),
        q.quaternion.copy(G.q);
    }
    let Te = new Ye();
    function Pe(Me, we) {
      e.updateMatrix(), we.fromArray(Me).applyMatrix4(e.matrix);
      let be = i.camera,
        Oe =
          Math.tan((be.fov * Math.PI) / 360) /
          Math.tan((i.viewCamera.fov * Math.PI) / 360);
      return (
        (we.x *= Oe),
        (we.y *= Oe),
        we.applyQuaternion(be.quaternion).add(be.position)
      );
    }
    function Re(Me = new gi()) {
      return Pe(cfg.muzzle, Me);
    }
    function Fe() {
      if (k.reload || ve.ammo >= ve.magSize || ve.reserve <= 0) return !1;
      let Me = ve.ammo <= 0;
      return (
        (k.reload = { t: 0, T: (Me ? G_ : W_) * mods.reload, empty: Me, f: {} }),
        (k.autoReload = -1),
        i.events.emit("weapon:reload", { phase: "start", empty: Me }),
        !0
      );
    }
    let ze = new gi(),
      We = new gi(),
      Ne = new gi(),
      dt = new gi(),
      xe = new gi(),
      Ie = new gi();
    function Be() {
      let Me = i.player,
        we = i.camera;
      ve.ammo--,
        k.burst++,
        (k.lastShot = k.t),
        (k.heat = Math.min(1.3, k.heat + 0.05));
      let be = ve.spread,
        Oe = ae() * Math.PI * 2,
        pt = Math.tan(be) * Math.sqrt(ae());
      ze
        .set(Math.cos(Oe) * pt, Math.sin(Oe) * pt, -1)
        .normalize()
        .applyQuaternion(we.quaternion),
        Ie.copy(Me.eye || we.position);
      let ut = null,
        pellets = cfg.pellets || 1,
        firstPoint = null;
      for (let pi = 0; pi < pellets; pi++) {
        let pDir = ze;
        if (pi > 0) {
          let so = ae() * Math.PI * 2,
            sp = Math.tan(be * (cfg.pelletSpread || 1)) * Math.sqrt(ae());
          pDir = new gi(Math.cos(so) * sp, Math.sin(so) * sp, -1)
            .normalize()
            .applyQuaternion(we.quaternion);
        }
        try {
          ut = i.combat.playerShot(Ie, pDir, { damage: H_ * mods.damage, range: V_ });
        } catch {}
        if (!firstPoint && ut && ut.point) firstPoint = ut.point;
      }
      firstPoint ? Ne.copy(firstPoint) : Ne.copy(Ie).addScaledVector(ze, V_),
        Re(We);
      let nn = i.fx;
      nn &&
        (nn.tracer && nn.tracer(We, Ne),
        nn.shell &&
          (Pe(cfg.eject, dt),
          xe
            .set(2 + ae() * 1.2, 1.2 + ae() * 0.8, 0.5 - ae() * 0.6)
            .applyQuaternion(we.quaternion),
          Me.vel && xe.add(Me.vel),
          nn.shell(dt, xe))),
        i.render &&
          i.render.lightPool &&
          i.render.lightPool.flash(We, 16756832, 45, 9, 0.05),
        i.events.emit("weapon:fire", {
          origin: Ie,
          dir: ze,
          muzzle: We,
          ads: k.adsE,
          weapon: cfg.id || "pac9",
          radius: mods.alert || 45,
        });
      let bt = bi(1, 0.55, k.adsE) * (Me.crouching ? 0.85 : 1),
        Os = k.burst,
        pn = Os <= 9 ? 1 : 0.38,
        Ti =
          (Os < 4
            ? (ae() - 0.5) * 0.0022
            : Math.sin(Os * 0.57 + k.recPhase) * 0.0042 +
              (ae() - 0.5) * 0.002) * bt;
      Me.addRecoil && Me.addRecoil(0.0068 * pn * bt * (0.85 + ae() * 0.3) * (cfg.recoil || 1) * mods.recoil, Ti),
        Me.addShake && Me.addShake(0.12 * bt * (cfg.recoil || 1)),
        (k.kZ.v += 1.5 * bi(1, 0.6, k.adsE)),
        (k.kP.v += 1.5 * bt),
        (k.kY.v += (ae() - 0.5) * 1 * bt),
        (k.kR.v += (ae() - 0.5) * 1.8 * bt),
        (k.bloom = Math.min(1, k.bloom + 0.17)),
        (k.flashT = k.flashDur = 0.036 + ae() * 0.02);
      let ho = x.material.uniforms;
      (ho.uSeed.value = ae() * 100),
        (ho.uJet.value = 0.6 + ae() * 0.6),
        (x.rotation.z = (ae() - 0.5) * 0.4);
      let Rs = (0.8 + ae() * 0.5) * bi(1, 0.62, k.adsE);
      x.scale.set(Rs, Rs, Rs * (0.8 + ae() * 0.5)),
        (k.boltT = 0),
        ve.ammo <= 0 && ((k.boltLocked = !0), (d.visible = !1));
    }
    function Xe(Me) {
      let we = i.player,
        be = i.input;
      if (!we || !be || !we.alive) {
        (k.prevFire = !1), x && (x.visible = !1);
        return;
      }
      k.t += Me;
      let Oe = !!be.fire && e.visible && !ce.noFire,
        pt = Oe && !k.prevFire;
      (k.prevFire = Oe), Oe || (k.dryDone = !1);
      let ut = !!we.sprinting && !Oe && !be.ads && !k.reload;
      (k.sprintT = kn(k.sprintT, ut ? 1 : 0, 9, Me)),
        be.pressed && be.pressed("reload") && Fe(),
        k.autoReload >= 0 && ((k.autoReload -= Me), k.autoReload < 0 && Fe());
      let nn = 0;
      if (
        (ce.reloadT != null &&
          !k.reload &&
          (k.reload = { t: 0, T: (ce.empty ? G_ : W_) * mods.reload, empty: ce.empty, f: {} }),
        k.reload)
      ) {
        let Je = k.reload;
        ce.reloadT != null ? (Je.t = ce.reloadT) : (Je.t += Me);
        let Pt = Je.t,
          Vt = (Tt, Ai) =>
            Pt >= Ai && !Je.f[Tt]
              ? ((Je.f[Tt] = 1),
                i.events.emit("weapon:reload", { phase: Tt, empty: Je.empty }),
                !0)
              : !1;
        if (
          (Vt("magout", me) && (k.bump.v -= 0.25),
          Pt > 0.86 && !Je.f.fresh && ((Je.f.fresh = 1), (d.visible = !0)),
          Vt("magin", ee))
        ) {
          k.bump.v += 0.55;
          let Tt = Math.min(ve.magSize - ve.ammo, ve.reserve);
          (ve.ammo += Tt), (ve.reserve -= Tt), Je.empty || (k.boltLocked = !1);
        }
        Pt >= 1.5 && !Je.f.tap && ((Je.f.tap = 1), (k.bump.v += 0.4)),
          Je.empty &&
            (Pt >= B &&
              (nn =
                Pt < P
                  ? Yo((Pt - B) / (P - B))
                  : Pt < V
                    ? 1
                    : Math.max(0, 1 - (Pt - V) / 0.035)),
            Vt("bolt", V) &&
              ((k.boltLocked = !1), (k.bump.v += 0.3), (k.kZ.v -= 0.5))),
          le(Je.empty ? ue : $, Pt),
          q.position.copy(Y),
          q.quaternion.copy(L),
          Pt >= me && Pt < ee
            ? (Z.copy(L).multiply(R),
              f.quaternion.copy(Z),
              f.position.copy(p).sub(j.p).applyQuaternion(Z).add(Y))
            : (f.quaternion.identity(), f.position.copy(p));
        let ss = Yo(Pt / 0.3),
          Hs = 1 - Yo((Pt - (Je.T - 0.46)) / 0.4);
        (k.reloadW = Math.min(ss, Hs)),
          (k.rackW = Je.empty ? Yo((Pt - 1.62) / 0.3) * Hs : 0),
          Pt >= Je.T &&
            ce.reloadT == null &&
            ((k.reload = null),
            (k.reloadW = 0),
            (k.rackW = 0),
            i.events.emit("weapon:reload", { phase: "done" }),
            q.position.copy(G.p),
            q.quaternion.copy(G.q));
      }
      k.cooldown -= Me;
      let bt = !k.reload && k.sprintT < 0.45;
      if (Oe && bt && (!cfg.semi || pt))
        if (ve.ammo > 0) {
          let Je = 0;
          for (; k.cooldown <= 0 && ve.ammo > 0 && Je < 3; )
            Be(), (k.cooldown += 60 / (O_ * mods.rpm)), Je++;
        } else
          k.dryDone ||
            ((k.dryDone = !0),
            i.events.emit("weapon:dry", {}),
            (k.bump.v -= 0.08),
            ve.reserve > 0 && (k.autoReload = 0.32));
      k.cooldown < 0 && (k.cooldown = Math.max(k.cooldown, -0.001)),
        k.t - k.lastShot > 0.24 &&
          (k.burst > 0 && (k.recPhase = ae() * 6.28), (k.burst = 0)),
        (k.bloom = Math.max(0, k.bloom - Me * 1.5)),
        k.t - k.lastShot > 0.11 &&
          k.t - k.lastShot < 0.11 + Me * 1.5 &&
          k.heat > 0.4 &&
          (k.smoke = Math.min(1.6, k.heat * 1.3)),
        k.smoke > 0 &&
          ((k.smoke -= Me),
          (k.smokeTick -= Me),
          k.smokeTick <= 0 &&
            i.fx &&
            i.fx.smoke &&
            ((k.smokeTick = 0.085),
            Re(We),
            i.fx.smoke(We, {
              size: 0.1 + k.smoke * 0.06,
              life: 1.3,
              rise: 0.5,
              count: 1,
              alpha: 0.22,
            }))),
        (k.heat = Math.max(0, k.heat - Me * 0.2));
      let Os = !!be.ads && !k.reload && k.sprintT < 0.35;
      (k.adsLin = Zn(k.adsLin + (Os ? Me : -Me) / 0.18, 0, 1)),
        (k.adsE = Yo(k.adsLin)),
        (ve.ads = k.adsE);
      let pn = we.speed || 0,
        Ti = Fo(pn / 6),
        ho = Math.max(
          0.0004,
          (bi(0.0125, 0.0012, k.adsE) +
            Ti * bi(0.013, 0.004, k.adsE) +
            k.bloom * bi(0.0065, 0.0022, k.adsE) +
            (we.onGround === !1 ? 0.022 : 0) -
            (we.crouching ? 0.002 * (1 - k.adsE) : 0)) *
            (cfg.spreadScale || 1) * mods.spread,
        );
      (k.spreadS = kn(k.spreadS, ho, 18, Me)),
        (ve.spread = k.spreadS),
        Oe ||
        !!be.ads ||
        !!k.reload ||
        pn > 0.2 ||
        (be.look && Math.abs(be.look.dx) + Math.abs(be.look.dy) > 0.002) ||
        k.sprintT > 0.1
          ? ((k.idleT = 0),
            k.inspect >= 0 && (k.inspect = Math.max(k.inspect, 2.9)))
          : (k.idleT += Me),
        k.inspect < 0 && k.idleT > 24 && (k.inspect = 0);
      let Un = 0,
        zo = 0,
        $i = 0;
      if (k.inspect >= 0) {
        let Je = (k.inspect += Me);
        (Un = Yo(Je / 0.5) * (1 - Yo((Je - 1.4) / 0.5))),
          (zo = Yo((Je - 1.5) / 0.5) * (1 - Yo((Je - 2.8) / 0.5))),
          ($i = Yo(Je / 0.5) * (1 - Yo((Je - 2.9) / 0.5))),
          Je > 3.5 && ((k.inspect = -1), (k.idleT = 0));
      }
      cfg.scope && (e.visible = !(k.adsE > 0.86)),
        (ve.state = k.reload
        ? "reloading"
        : k.inspect >= 0
          ? "inspect"
          : k.sprintT > 0.5
            ? "sprinting"
            : k.t - k.lastShot < 0.14
              ? "firing"
              : "idle"),
        (k.boltT += Me);
      let ya = 0.072,
        ba = k.boltT < ya ? Math.sin((Math.PI * k.boltT) / ya) : 0;
      k.boltLocked && k.boltT > ya * 0.5 && (ba = Math.max(ba, 0.86)),
        (h.position.z = cfg.boltTravel * Math.max(ba * 0.95, nn)),
        (k.finger = kn(k.finger, (Oe && bt) || ce.flash ? 1 : 0, 30, Me)),
        z(k.finger);
      let Hn = x.material.uniforms;
      if (
        (ce.flash && ((k.flashT = k.flashDur = 0.05), (Hn.uSeed.value = 3.7)),
        (k.flashT -= Me),
        (Hn.uInt.value =
          k.flashT > 0
            ? 9.5 * Math.sqrt(Math.max(0, k.flashT / k.flashDur))
            : 0),
        (Hn.uHeat.value = Fo((k.heat - 0.45) / 0.8) * 2.2),
        (x.visible = Hn.uInt.value > 0 || Hn.uHeat.value > 0.02),
        ce.freeze)
      )
        return;
      let fo = we.onGround !== !1,
        ln = we.vel ? we.vel.y : 0;
      (k.bobAmt = kn(k.bobAmt, fo ? Fo(pn / 3.6) : 0, 8, Me)),
        (k.bobPhase += Me * (pn > 0.3 && fo ? 5.2 + pn * 1.55 : 0));
      let Zo = k.bobPhase,
        yr = k.bobAmt * bi(1, 0.12, k.adsE) * (1 + k.sprintT * 1.4),
        lu = Math.sin(Zo) * 0.006 * yr,
        de =
          (Math.sin(2 * Zo) * 0.0042 -
            Math.pow(0.5 + 0.5 * Math.cos(2 * Zo + 0.6), 4) * 0.0048) *
          yr,
        te = bi(1, 0.3, k.adsE),
        he = k.t,
        pe = bi(1, 0.4, k.adsE);
      if (
        ((k.swY.v += Zn(be.look ? be.look.dx : 0, -0.2, 0.2) * 3.2 * pe),
        (k.swP.v += Zn(be.look ? be.look.dy : 0, -0.2, 0.2) * 2.6 * pe),
        ma(k.swY, 0, Me),
        ma(k.swP, 0, Me),
        (k.swY.x = Zn(k.swY.x, -0.09, 0.09)),
        (k.swP.x = Zn(k.swP.x, -0.07, 0.07)),
        k.wasGround && !fo && ln > 1 && ((k.jY.v -= 0.22), (k.jP.v += 0.7)),
        !k.wasGround && fo)
      ) {
        let Je = Zn(-k.lastVy * 0.06, 0, 0.6);
        (k.jY.v -= Je), (k.jP.v -= Je * 3.2), (k.kR.v += (ae() - 0.5) * Je * 2);
      }
      (k.wasGround = fo),
        fo || (k.lastVy = ln),
        ma(k.jY, fo ? 0 : Zn(-ln * 0.0045, -0.02, 0.024), Me),
        ma(k.jP, fo ? 0 : Zn(ln * 0.012, -0.06, 0.06), Me),
        ma(k.kZ, 0, Me),
        ma(k.kP, 0, Me),
        ma(k.kY, 0, Me),
        ma(k.kR, 0, Me),
        ma(k.bump, 0, Me);
      let ge = be.move ? be.move.x : 0,
        ye = be.move ? be.move.y : 0,
        Le = 1 - k.adsE,
        ke = k.adsE,
        Ue = k.sprintT,
        ct = k.reloadW,
        De = k.rackW,
        it =
          bi(eu.p[0], qv.p[0], ke) +
          tu.p[0] * Ue +
          nu.p[0] * ct +
          lu +
          Math.sin(he * 0.85 + 1) * 0.0012 * te -
          k.swY.x * 0.06 -
          ge * 0.004 * Le -
          0.035 * $i,
        gt =
          bi(eu.p[1], qv.p[1], ke) +
          tu.p[1] * Ue +
          nu.p[1] * ct +
          de +
          Math.sin(he * 1.7) * 0.0016 * te +
          k.swP.x * 0.05 +
          k.jY.x +
          k.bump.x * 0.6 +
          0.045 * $i,
        Ot =
          bi(eu.p[2], qv.p[2], ke) +
          tu.p[2] * Ue +
          nu.p[2] * ct +
          k.kZ.x * 0.55 +
          ye * 0.004 * Le * (1 - Ue),
        xn =
          eu.r[0] * Le +
          tu.r[0] * Ue +
          nu.r[0] * ct -
          0.16 * De +
          Math.sin(he * 1.7 + 0.8) * 0.0035 * te +
          Math.sin(2 * Zo + 0.5) * 0.008 * yr +
          k.swP.x +
          k.jP.x +
          k.kP.x +
          k.bump.x * 1.5 +
          0.3 * $i,
        $t =
          eu.r[1] * Le +
          tu.r[1] * Ue +
          nu.r[1] * ct +
          Math.sin(he * 0.6) * 0.002 * te +
          Math.sin(Zo) * 0.01 * yr +
          k.swY.x +
          k.kY.x +
          0.18 * $i +
          0.25 * zo,
        Ht =
          eu.r[2] * Le +
          tu.r[2] * Ue +
          nu.r[2] * ct +
          0.62 * De +
          Math.sin(Zo) * 0.014 * yr +
          k.swY.x * 0.7 -
          ge * 0.035 * Le +
          k.kR.x -
          0.75 * Un +
          0.55 * zo +
          Math.sin(he * 0.5) * 0.004 * te;
      e.position.set(it, gt, Ot), e.rotation.set(xn, $t, Ht, "YXZ");
    }
    return _e(), ve;
  }
  /*__WEAPON_EXT__*/

  async function PC(i) {
    let e = await dm(
      i,
      i.params.wmodel === "shotgun" ? SHOTGUN : mi,
      i.params.wmodel === "shotgun" ? buildShotgun : w_,
    );
    i.weapon = e;
    let t = e.root,
      n = new gi(0, 1.68, 4),
      s = {
        south: [0.28, -0.01, 1],
        east: [1, 0, 0.25],
        north: [-0.2, -0.01, -1],
        west: [-1, 0, 0.1],
        nw: [-0.75, -0.01, -0.65],
      },
      o = {
        side: [Math.PI, [1.12, 1.3, 0.11], [0, 1.235, 0.11], 30],
        right: [0, [1.12, 1.3, -0.11], [0, 1.235, -0.11], 30],
        top: [Math.PI * 0.86, [0.62, 1.8, -0.42], [0, 1.24, 0.12], 32],
        hands: [Math.PI, [0.4, 1.4, 0.02], [0.02, 1.215, 0.25], 30],
        rhand: [0, [0.36, 1.22, 0.27], [0.03, 1.16, 0.09], 30],
        muzzle: [Math.PI, [0.26, 1.37, 0.98], [0, 1.262, 0.44], 30],
        optic: [Math.PI, [0.2, 1.4, -0.26], [0, 1.31, 0.02], 30],
        lower: [Math.PI, [0.34, 1.26, 0.04], [0, 1.2, 0.03], 30],
      },
      r = window.__setShot,
      a = null;
    function l(u, h = {}) {
      a = u;
      let f = o[u],
        p = i.input,
        d = i.player;
      (p.ads = !1),
        (p.fire = !1),
        (d.sprinting = !1),
        (d.speed = 0),
        (e.debug.reloadT = null),
        (e.debug.flash = !1),
        (e.debug.empty = !1),
        (e.debug.freeze = !!f),
        e.reset();
      let v, g, x;
      if (f)
        i.scene.add(t),
          t.position.set(0, 1.25, 0),
          t.rotation.set(0, f[0], 0, "YXZ"),
          t.traverse((y) => y.layers.set(vf)),
          (v = f[1]),
          (g = f[2]),
          (x = f[3]),
          h.wt != null &&
            ((e.debug.reloadT = +h.wt), (e.debug.empty = !!h.wempty));
      else {
        i.camera.add(t), t.traverse((b) => b.layers.set(zc));
        let y = s[h.wlook] || s.south;
        (v = [n.x, n.y, n.z]),
          (g = [n.x + y[0] * 50, n.y + y[1] * 50, n.z + y[2] * 50]),
          (x = 74),
          u === "ads" && ((p.ads = !0), (x = 52)),
          u === "sprint" && ((d.sprinting = !0), (d.speed = 6)),
          u === "fire" &&
            ((e.debug.flash = !0), h.wads && ((p.ads = !0), (x = 52))),
          (u === "reload" || u === "empty") &&
            ((e.debug.reloadT = h.wt != null ? +h.wt : 0.62),
            (e.debug.empty = u === "empty")),
          u === "empty" && (e.ammo = 0);
      }
      return (
        e.snap(),
        e.update(0.016),
        e.snap(),
        r &&
          r({
            cam: h.cam || [...v, ...g].join(","),
            fov: h.fov || x,
            exposure: h.exposure,
          }),
        { cam: v, target: g }
      );
    }
    window.__setShot = (u) => {
      u && u.wpose ? l(u.wpose, u) : r && r(u);
    };
    let c = l(i.params.wpose || "hip", i.params);
    return {
      cam: c.cam,
      target: c.target,
      update(u) {
        e.update(u), a === "fire" && (e.debug.flash = !0);
      },
    };
  }
  var ex = {};
  br(ex, { TUNE: () => Ui, create: () => Em, showcase: () => VC });
  var iu = class {
    constructor() {
      (this.bones = []),
        (this.index = {}),
        (this.slots = {}),
        (this.order = []);
    }
    bone(e, t, n = 0, s = 0, o = 0) {
      let r = t ? this.bones[this.index[t]] : null;
      if (t && !r) throw new Error("rig: unknown parent bone " + t);
      let a = {
        name: e,
        parent: r ? r.i : -1,
        local: [n, s, o],
        world: [
          n + (r ? r.world[0] : 0),
          s + (r ? r.world[1] : 0),
          o + (r ? r.world[2] : 0),
        ],
        i: this.bones.length,
      };
      return (this.index[e] = a.i), this.bones.push(a), a;
    }
    add(e, t, n, s = [1, 1, 1], o = !0) {
      let r = this.bones[this.index[t]];
      if (!r) throw new Error("rig: unknown bone " + t);
      let a = n;
      a.attributes.normal || a.computeVertexNormals();
      for (let p of Object.keys(a.attributes))
        p !== "position" &&
          p !== "normal" &&
          p !== "uv" &&
          a.deleteAttribute(p);
      let l = a.attributes.position.count;
      a.attributes.uv ||
        a.setAttribute("uv", new et(new Float32Array(l * 2), 2)),
        a.translate(r.world[0], r.world[1], r.world[2]);
      let c = new Float32Array(l * 3),
        u = new Uint16Array(l * 4),
        h = new Float32Array(l * 4),
        f = a.attributes.normal;
      for (let p = 0; p < l; p++) {
        let d = o ? 0.74 + 0.26 * (f.getY(p) * 0.5 + 0.5) : 1;
        (c[p * 3] = s[0] * d),
          (c[p * 3 + 1] = s[1] * d),
          (c[p * 3 + 2] = s[2] * d),
          (u[p * 4] = r.i),
          (h[p * 4] = 1);
      }
      return (
        a.setAttribute("color", new et(c, 3)),
        a.setAttribute("skinIndex", new et(u, 4)),
        a.setAttribute("skinWeight", new et(h, 4)),
        this.slots[e] || ((this.slots[e] = []), this.order.push(e)),
        this.slots[e].push(a),
        this
      );
    }
    build(e) {
      let t = (e || this.order).filter(
          (o) => this.slots[o] && this.slots[o].length,
        ),
        n = t.map((o) => {
          let r = this.slots[o],
            l = r.some((u) => !u.index)
              ? r.map((u) => (u.index ? u.toNonIndexed() : u))
              : r,
            c = sa(l, !1);
          return c.index ? c.toNonIndexed() : c;
        }),
        s = sa(n, !0);
      return (
        s.computeBoundingSphere(),
        s.computeBoundingBox(),
        {
          geometry: s,
          slots: t,
          bones: this.bones,
          tris: s.attributes.position.count / 3,
        }
      );
    }
  };
  function pm(
    i,
    e,
    {
      castShadow: t = !0,
      receiveShadow: n = !0,
      radius: s = 1.5,
      center: o = [0, 0.5, 0],
      extra: r = null,
    } = {},
  ) {
    let a = i.bones.map((p) => {
      let d = new Fa();
      return (
        (d.name = p.name), d.position.set(p.local[0], p.local[1], p.local[2]), d
      );
    });
    i.bones.forEach((p, d) => {
      p.parent >= 0 && a[p.parent].add(a[d]);
    });
    let l = new wt(),
      c = new ka(
        i.geometry,
        i.slots.map((p) => e[p]),
      );
    (c.castShadow = t),
      (c.receiveShadow = n),
      l.add(c),
      i.bones.forEach((p, d) => {
        p.parent < 0 && c.add(a[d]);
      }),
      l.updateMatrixWorld(!0);
    let u = new k0(a);
    c.bind(u),
      (c.boundingSphere = new Dn(new W(o[0], o[1], o[2]), s)),
      (c.boundingBox = new $n(
        new W(o[0] - s, o[1] - s, o[2] - s),
        new W(o[0] + s, o[1] + s, o[2] + s),
      ));
    let h = {};
    a.forEach((p) => {
      h[p.name] = p;
    });
    let f = { group: l, mesh: c, bones: h, skeleton: u, extraMesh: null };
    if (r) {
      let p = new ka(
        r.def.geometry,
        r.def.slots.map((d) => e[d]),
      );
      (p.castShadow = !1),
        (p.receiveShadow = !1),
        (p.renderOrder = 5),
        l.add(p),
        p.updateMatrixWorld(!0),
        p.bind(u, c.bindMatrix),
        (p.boundingSphere = new Dn(new W(o[0], o[1], o[2]), r.radius || s)),
        (p.boundingBox = new $n().setFromCenterAndSize(
          p.boundingSphere.center,
          new W(1, 1, 1).multiplyScalar(2 * (r.radius || s)),
        )),
        (f.extraMesh = p);
    }
    return f;
  }
  function q_(i, e, t, n, s, o, r, a) {
    let l = e * e + t * t,
      c = Math.sqrt(Math.max(l - o * o, 1e-6));
    (i.abd = Math.atan2(t, e) - Math.atan2(-c, s * o)),
      i.abd > Math.PI
        ? (i.abd -= 2 * Math.PI)
        : i.abd < -Math.PI && (i.abd += 2 * Math.PI);
    let u = Math.hypot(c, n),
      h = (r + a) * 0.995,
      f = Math.abs(r - a) + 0.03;
    (i.reach = u / (r + a)), u > h ? (u = h) : u < f && (u = f);
    let p = Math.atan2(n, c),
      d = (r * r + u * u - a * a) / (2 * r * u),
      v = (r * r + a * a - u * u) / (2 * r * a),
      g = Math.acos(d < -1 ? -1 : d > 1 ? 1 : d),
      x = Math.acos(v < -1 ? -1 : v > 1 ? 1 : v);
    return (i.hip = g - p), (i.knee = -(Math.PI - x)), i;
  }
  var Ss = [1.15, 1.15, 1.15],
    vm = [0.95, 0.96, 0.97],
    Ts = [1, 0.34, 0.08],
    s0 = [0.1, 0.11, 0.12],
    ga = [0.035, 0.035, 0.038],
    Of = [1, 0.7, 0.07],
    As = [1, 1, 1],
    Yn = [2.4, 2.5, 2.6],
    an = [0.45, 0.46, 0.48],
    IC = [9, 9, 9.6],
    zC = [5.5, 4, 1.6],
    va = Math.PI / 2,
    ft = (i, e, t, n = 0.008) => Wi(i, e, t, n),
    Ce = (i, e, t, n, s = 0, o = 0, r = 0, a = 1) =>
      Dc(i, { p: [e, t, n], r: [s, o, r], s: a }),
    ds = (i, e, t, n = 12) => ot(i, e, t, n),
    Ro = (i, e, t, n = 12) => Dc(ot(i, e, t, n), { r: [0, 0, -va] }),
    Si = (i, e, t, n = 12) => Dc(ot(i, e, t, n), { r: [va, 0, 0] }),
    mm = new W(),
    gm = new W(),
    X_ = new Lt(),
    DC = new W(0, 1, 0),
    Y_ = new Ye(),
    LC = new W(1, 1, 1);
  function su(i, e, t, n = t, s = 8) {
    mm.set(i[0], i[1], i[2]), gm.set(e[0], e[1], e[2]);
    let o = mm.distanceTo(gm),
      r = ot(n, t, o, s);
    return (
      X_.setFromUnitVectors(DC, gm.clone().sub(mm).normalize()),
      Y_.compose(mm.clone().add(gm).multiplyScalar(0.5), X_, LC),
      r.applyMatrix4(Y_),
      r
    );
  }
  var Ur = (i, e = 14, t = 10, n = 1, s = 1, o = 1) => {
      let r = new ls(i, e, t);
      return r.scale(n, s, o), r;
    },
    $_ = (i, e, t) => Ce(Ro(0.0075, 0.0075, 0.006, 6), i, e, t),
    Yv = (i, e, t) => Ce(ds(0.0075, 0.0075, 0.006, 6), i, e, t),
    kC = (i, e, t) => Ce(Si(0.0075, 0.0075, 0.006, 6), i, e, t),
    $v = {
      stand: 0.72,
      L1: 0.4,
      L2: 0.42,
      l0: 0.075,
      hipX: 0.165,
      hipY: -0.01,
      hipZ: 0.4,
      footX: 0.275,
      footZ: [0.37, 0.37, -0.42, -0.42],
      legs: ["FL", "FR", "RL", "RR"],
      side: [1, -1, 1, -1],
      fore: [1, 1, -1, -1],
      muzzle: [0, 0, 0.43],
      eye: [0, 0, 0.14],
      footR: 0.046,
    };
  function Z_() {
    let i = $v,
      e = new iu();
    e.bone("root", null, 0, 0, 0),
      e.bone("body", "root", 0, i.stand, 0),
      e.bone("neck", "body", 0, 0.06, 0.49),
      e.bone("head", "neck", 0, 0.13, 0.12),
      e.bone("turret", "body", 0, 0.152, -0.03),
      e.bone("gun", "turret", 0, 0.095, 0.02),
      e.bone("antenna", "body", -0.105, 0.15, -0.46),
      e.bone("beacon", "body", 0.105, 0.2, -0.455);
    for (let n = 0; n < 4; n++) {
      let s = i.legs[n],
        o = i.side[n];
      e.bone("abd" + s, "body", o * i.hipX, i.hipY, i.fore[n] * i.hipZ),
        e.bone("thigh" + s, "abd" + s, o * i.l0, 0, 0),
        e.bone("shin" + s, "thigh" + s, 0, -i.L1, 0);
    }
    let t = (n, s, o, r, a) => e.add(n, s, o, r, a);
    t("metal", "body", Ce(ft(0.27, 0.2, 0.98, 0.02), 0, -0.01, 0), an),
      t("shell", "body", Ce(ft(0.35, 0.05, 0.3, 0.014), 0, 0.125, 0.33), Ss),
      t("shell", "body", Ce(ft(0.35, 0.05, 0.36, 0.014), 0, 0.125, -0.012), Ss),
      t(
        "shell",
        "body",
        Ce(ft(0.1, 0.052, 0.36, 0.01), 0, 0.126, -0.012 + 0),
        vm,
      );
    for (let n of [-0.15, 0.15])
      for (let s of [0.21, 0.45, -0.17, 0.145])
        t("metal", "body", Yv(n, 0.152, s), Yn);
    t("metal", "body", Ce(ft(0.31, 0.03, 0.25, 0.006), 0, 0.112, -0.335), As);
    for (let n = 0; n < 10; n++)
      t(
        "metal",
        "body",
        Ce(ft(0.007, 0.062, 0.225, 0.002), -0.126 + n * 0.028, 0.155, -0.335),
        Yn,
      );
    t("metal", "body", Ce(ft(0.3, 0.012, 0.02, 0.003), 0, 0.186, -0.24), an),
      t("metal", "body", Ce(ft(0.3, 0.012, 0.02, 0.003), 0, 0.186, -0.43), an);
    for (let n of [1, -1]) {
      t(
        "shell",
        "body",
        Ce(ft(0.032, 0.15, 0.31, 0.012), n * 0.15, 0.022, -0.075),
        Ss,
      ),
        t(
          "shell",
          "body",
          Ce(ft(0.032, 0.15, 0.135, 0.012), n * 0.15, 0.022, 0.1625),
          vm,
        ),
        t(
          "metal",
          "body",
          Fn(
            [
              [n * 0.168, 0.06, 0.125],
              [n * 0.182, 0.06, 0.135],
              [n * 0.182, 0.06, 0.19],
              [n * 0.168, 0.06, 0.2],
            ],
            0.005,
            5,
          ),
          Yn,
        ),
        t(
          "shell",
          "body",
          Ce(ft(0.034, 0.016, 0.135, 0.004), n * 0.151, -0.035, 0.1625),
          Of,
        ),
        t(
          "shell",
          "body",
          Ce(ft(0.034, 0.042, 0.46, 0.008), n * 0.151, -0.078, 0),
          Ts,
        ),
        t(
          "shell",
          "body",
          Ce(ft(0.028, 0.1, 0.11, 0.008), n * 0.146, 0.01, 0.305),
          s0,
        );
      for (let s = 0; s < 4; s++)
        t(
          "metal",
          "body",
          Ce(
            ft(0.004, 0.012, 0.085, 0.001),
            n * 0.161,
            -0.02 + s * 0.022,
            0.305,
          ),
          an,
        );
      for (let s of [-0.035, 0.08])
        for (let o of [-0.21, 0.06, 0.115, 0.21])
          t("metal", "body", $_(n * 0.167, s, o), Yn);
      t(
        "metal",
        "body",
        Fn(
          [
            [n * 0.135, 0.148, -0.19],
            [n * 0.135, 0.205, -0.16],
            [n * 0.135, 0.212, 0],
            [n * 0.135, 0.205, 0.43],
            [n * 0.135, 0.148, 0.465],
          ],
          0.0105,
          6,
        ),
        Yn,
      );
      for (let s of [0, 0.26])
        t(
          "metal",
          "body",
          Ce(ds(0.008, 0.008, 0.06, 6), n * 0.135, 0.178, s),
          Yn,
        );
      t(
        "shell",
        "body",
        Fn(
          [
            [n * 0.118, -0.105, -0.36],
            [n * 0.132, -0.118, -0.2],
            [n * 0.13, -0.112, 0.1],
            [n * 0.118, -0.1, 0.36],
          ],
          0.009,
          5,
        ),
        ga,
      ),
        t(
          "metal",
          "body",
          Ce(new Ci(0.02, 0.005, 5, 10), n * 0.17, 0.085, -0.335, 0, va, 0),
          Yn,
        );
    }
    t("shell", "body", Ce(ft(0.3, 0.15, 0.075, 0.018), 0, -0.005, 0.505), Ts),
      t("shell", "body", Ce(ft(0.2, 0.07, 0.02, 0.006), 0, 0.012, 0.545), s0);
    for (let n = 0; n < 6; n++)
      t(
        "shell",
        "body",
        Ce(
          ft(0.05, 0.034, 0.014, 0.003),
          -0.125 + n * 0.05,
          -0.098,
          0.538,
          0,
          0,
          0,
        ),
        n % 2 ? s0 : Of,
      );
    for (let n of [-0.115, 0.115])
      t("metal", "body", Ce(Si(0.021, 0.021, 0.014, 10), n, 0.012, 0.547), an),
        t(
          "glow",
          "body",
          Ce(Si(0.015, 0.015, 0.004, 10), n, 0.012, 0.556),
          [6.5, 4.6, 2.2],
          !1,
        );
    t("metal", "body", Ce(ft(0.24, 0.095, 0.56, 0.02), 0, -0.145, 0), As),
      t("shell", "body", Ce(ft(0.246, 0.03, 0.09, 0.006), 0, -0.14, 0.12), Ts),
      t("shell", "body", Ce(ft(0.246, 0.03, 0.09, 0.006), 0, -0.14, -0.12), Ts),
      t("shell", "body", Ce(ft(0.29, 0.15, 0.05, 0.014), 0, 0, -0.495), Ss),
      t("shell", "body", Ce(ft(0.17, 0.05, 0.012, 0.004), 0, 0.03, -0.523), s0),
      t(
        "glow",
        "body",
        Ce(ft(0.13, 0.012, 0.004, 0.001), 0, 0.03, -0.531),
        [5, 0.3, 0.1],
        !1,
      ),
      t(
        "metal",
        "body",
        Ce(Si(0.022, 0.022, 0.02, 10), 0.085, -0.035, -0.525),
        Yn,
      ),
      t(
        "metal",
        "body",
        Ce(new Ci(0.024, 0.006, 5, 10), -0.07, -0.05, -0.528, va, 0, 0),
        Yn,
      );
    for (let n of [-0.125, 0.125])
      for (let s of [-0.055, 0.055]) t("metal", "body", kC(n, s, -0.523), Yn);
    t(
      "shell",
      "body",
      Fn(
        [
          [0.09, 0.15, -0.2],
          [0.13, 0.2, -0.16],
          [0.12, 0.2, -0.08],
          [0.09, 0.165, -0.05],
        ],
        0.009,
        5,
      ),
      ga,
    ),
      t(
        "metal",
        "neck",
        su([0, -0.02, -0.02], [0, 0.11, 0.1], 0.045, 0.036, 10),
        an,
      );
    for (let n = 0; n < 3; n++) {
      let s = 0.2 + n * 0.28;
      t(
        "shell",
        "neck",
        su(
          [0, -0.02 + 0.13 * s - 0.008, -0.02 + 0.12 * s - 0.0075],
          [0, -0.02 + 0.13 * s + 0.008, -0.02 + 0.12 * s + 0.0075],
          0.052,
          0.052,
          10,
        ),
        ga,
      );
    }
    t("shell", "neck", Ce(ft(0.13, 0.05, 0.1, 0.012), 0, -0.01, -0.03), Ss),
      t(
        "shell",
        "neck",
        Fn(
          [
            [0.05, -0.02, -0.04],
            [0.07, 0.05, 0.02],
            [0.06, 0.11, 0.07],
            [0.045, 0.12, 0.1],
          ],
          0.007,
          5,
        ),
        ga,
      ),
      t("shell", "head", Ce(ft(0.19, 0.118, 0.25, 0.03), 0, 0, 0), Ss),
      t(
        "shell",
        "head",
        Ce(ft(0.168, 0.074, 0.03, 0.012), 0, -0.004, 0.118),
        s0,
      ),
      t(
        "lens",
        "head",
        Ce(ft(0.128, 0.024, 0.006, 0.002), 0, 0.006, 0.1345),
        [1, 1, 1],
        !1,
      );
    for (let n of [-0.056, 0.056])
      t("metal", "head", Ce(Si(0.015, 0.015, 0.012, 10), n, -0.022, 0.132), an),
        t(
          "metal",
          "head",
          Ce(Si(0.009, 0.009, 0.004, 8), n, -0.022, 0.139),
          [0.1, 0.12, 0.2],
        );
    t("shell", "head", Ce(ft(0.062, 0.008, 0.2, 0.003), 0, 0.06, -0.005), Ts),
      t("metal", "head", Ce(Ro(0.032, 0.032, 0.214, 12), 0, 0, -0.055), an);
    for (let n of [1, -1])
      t(
        "shell",
        "head",
        Ce(Ro(0.022, 0.022, 0.006, 10), n * 0.108, 0, -0.055),
        Ts,
      );
    t("metal", "head", Ce(ds(0.036, 0.036, 0.026, 14), 0, 0.072, -0.05), an),
      t(
        "metal",
        "head",
        Ce(ds(0.037, 0.037, 0.006, 14), 0, 0.074, -0.05),
        [0.2, 0.3, 0.5],
      ),
      t("metal", "head", Ce(ft(0.12, 0.03, 0.13, 0.008), 0, -0.068, 0.02), As);
    for (let n of [-0.08, 0.08])
      for (let s of [-0.09, 0.07]) t("metal", "head", Yv(n, 0.061, s), Yn);
    t("metal", "turret", Ce(ds(0.105, 0.118, 0.034, 18), 0, 0, 0), an),
      t("metal", "turret", Ce(ft(0.18, 0.02, 0.16, 0.005), 0, 0.026, 0), As);
    for (let n of [1, -1])
      t(
        "shell",
        "turret",
        Ce(ft(0.028, 0.115, 0.15, 0.012), n * 0.078, 0.085, 0.005),
        Ss,
      ),
        t(
          "metal",
          "turret",
          Ce(Ro(0.022, 0.022, 0.008, 10), n * 0.094, 0.095, 0.02),
          Yn,
        );
    t("shell", "gun", Ce(ft(0.108, 0.086, 0.21, 0.016), 0, 0, -0.012), Ss),
      t(
        "shell",
        "gun",
        Ce(ft(0.11, 0.02, 0.212, 0.006), 0, -0.022, -0.012),
        Ts,
      ),
      t("metal", "gun", Ce(Si(0.035, 0.035, 0.11, 12), 0, 0, 0.145), an);
    for (let n = 0; n < 4; n++)
      t(
        "metal",
        "gun",
        Ce(Si(0.039, 0.039, 0.008, 12), 0, 0, 0.105 + n * 0.026),
        As,
      );
    t("metal", "gun", Ce(Si(0.022, 0.024, 0.3, 12), 0, 0, 0.25), As),
      t("metal", "gun", Ce(Si(0.036, 0.036, 0.06, 10), 0, 0, 0.395), an),
      t(
        "metal",
        "gun",
        Ce(ft(0.08, 0.012, 0.025, 0.003), 0, 0, 0.395),
        [0.15, 0.15, 0.15],
      ),
      t(
        "metal",
        "gun",
        Ce(Ro(0.056, 0.056, 0.06, 14), 0.084, -0.004, -0.045),
        an,
      ),
      t(
        "metal",
        "gun",
        Ce(Ro(0.02, 0.02, 0.066, 8), 0.084, -0.004, -0.045),
        zC,
      ),
      t("metal", "gun", Ce(ft(0.036, 0.036, 0.095, 0.008), -0.03, 0.06, 0), an),
      t(
        "glow",
        "gun",
        Ce(Si(0.011, 0.011, 0.003, 8), -0.03, 0.06, 0.049),
        [1.6, 0.12, 0.05],
        !1,
      ),
      t(
        "shell",
        "gun",
        Fn(
          [
            [0.05, -0.03, -0.11],
            [0.06, -0.07, -0.13],
            [0.04, -0.09, -0.1],
          ],
          0.008,
          5,
        ),
        ga,
      ),
      t(
        "metal",
        "body",
        Ce(ds(0.022, 0.026, 0.05, 10), 0.105, 0.175, -0.455),
        an,
      ),
      t(
        "glow",
        "beacon",
        Ce(Ur(0.02, 10, 6, 1, 1.25, 1), 0, 0.012, 0),
        [14, 5.5, 0.5],
        !1,
      ),
      t("metal", "antenna", Ce(ds(0.011, 0.014, 0.05, 8), 0, 0.025, 0), an),
      t("metal", "antenna", Ce(ds(0.0028, 0.005, 0.62, 5), 0, 0.36, 0), an),
      t("shell", "antenna", Ce(Ur(0.009, 6, 4), 0, 0.67, 0), Ts);
    for (let n = 0; n < 4; n++) {
      let s = i.legs[n],
        o = i.side[n],
        r = "abd" + s,
        a = "thigh" + s,
        l = "shin" + s;
      t("metal", r, Ce(Si(0.06, 0.06, 0.17, 14), -o * 0.02, 0, 0), an),
        t("shell", r, Ce(ft(0.11, 0.05, 0.155, 0.014), o * 0, 0.058, 0), Ss),
        t("metal", r, Ce(Si(0.03, 0.03, 0.18, 8), -o * 0.02, 0, 0), Yn),
        t("shell", a, Ce(Ro(0.078, 0.078, 0.07, 18), 0, 0, 0), Ss),
        t("shell", a, Ce(Ro(0.081, 0.081, 0.016, 18), o * 0.012, 0, 0), Ts),
        t("metal", a, Ce(Ro(0.048, 0.048, 0.082, 12), 0, 0, 0), an);
      for (let c = 0; c < 5; c++) {
        let u = c * 1.2566;
        t(
          "metal",
          a,
          $_(o * 0.039, Math.cos(u) * 0.062, Math.sin(u) * 0.062),
          Yn,
        );
      }
      t(
        "shell",
        a,
        Ce(ft(0.062, i.L1 - 0.07, 0.1, 0.022), 0, -i.L1 * 0.5 - 0.005, 0.004),
        Ss,
      ),
        t(
          "metal",
          a,
          Ce(ft(0.044, i.L1 - 0.04, 0.06, 0.012), 0, -i.L1 * 0.5, -0.035),
          an,
        ),
        t("shell", a, Ce(ft(0.065, 0.045, 0.103, 0.01), 0, -0.145, 0.004), Ts),
        t("shell", a, Ce(ft(0.064, 0.012, 0.102, 0.004), 0, -0.26, 0.004), s0),
        t(
          "metal",
          a,
          su([0, -0.06, -0.082], [0, -i.L1 * 0.62, -0.078], 0.021, 0.021, 10),
          Yn,
        ),
        t(
          "metal",
          a,
          su(
            [0, -i.L1 * 0.62, -0.078],
            [0, -i.L1 + 0.025, -0.058],
            0.009,
            0.009,
            6,
          ),
          IC,
        ),
        t("metal", a, Ce(ft(0.05, 0.03, 0.035, 0.006), 0, -0.055, -0.07), As),
        t(
          "shell",
          a,
          Fn(
            [
              [o * 0.036, -0.02, 0.05],
              [o * 0.044, -0.13, 0.062],
              [o * 0.042, -0.28, 0.058],
              [o * 0.034, -i.L1 + 0.03, 0.035],
            ],
            0.0065,
            5,
          ),
          ga,
        ),
        t("metal", a, Ce(Ro(0.05, 0.05, 0.086, 14), 0, -i.L1, 0), an),
        t("shell", a, Ce(Ro(0.036, 0.036, 0.092, 12), 0, -i.L1, 0), vm),
        t(
          "metal",
          l,
          Ce(ds(0.03, 0.021, i.L2 - 0.08, 10), 0, -(i.L2 - 0.08) / 2 - 0.01, 0),
          an,
        ),
        t("shell", l, Ce(ft(0.052, 0.21, 0.04, 0.014), 0, -0.14, 0.02), Ss),
        t("shell", l, Ce(ft(0.054, 0.02, 0.042, 0.006), 0, -0.215, 0.02), Ts),
        t("metal", l, Ce(ft(0.03, 0.06, 0.05, 0.008), 0, -0.02, -0.03), As),
        t("metal", l, Ce(ds(0.024, 0.03, 0.03, 10), 0, -i.L2 + 0.085, 0), Yn),
        t(
          "shell",
          l,
          Ce(
            Ur(i.footR + 0.002, 12, 8, 1, 0.86, 1.08),
            0,
            -i.L2 + i.footR * 0.86,
            0.004,
          ),
          ga,
        );
    }
    return e.build(["shell", "metal", "glow", "lens"]);
  }
  var xm = {
    rotors: [
      [0.33, 0.035, 0.3],
      [-0.33, 0.035, 0.3],
      [0.33, 0.035, -0.3],
      [-0.33, 0.035, -0.3],
    ],
    gimbal: [0, -0.095, 0.275],
    ball: [0, -0.072, 0],
    gun: [0, -0.085, -0.1],
    muzzle: [0, -0.032, 0.27],
    lamp: [0, -0.066, 0.025],
  };
  function FC() {
    let i = [
      [0.176, -0.036],
      [0.196, -0.032],
      [0.206, 0],
      [0.202, 0.03],
      [0.19, 0.04],
      [0.178, 0.032],
      [0.173, 0],
      [0.176, -0.036],
    ].map((e) => new Ae(e[0], e[1]));
    return new ar(i, 28);
  }
  function j_() {
    let i = xm,
      e = new iu(),
      t = new iu(),
      n = (l, c, u, h, f) => {
        e.bone(l, c, u, h, f), t.bone(l, c, u, h, f);
      };
    n("root", null, 0, 0, 0), n("body", "root", 0, 0, 0);
    for (let l = 0; l < 4; l++)
      n("rotor" + l, "body", i.rotors[l][0], i.rotors[l][1], i.rotors[l][2]);
    n("gimbalYaw", "body", i.gimbal[0], i.gimbal[1], i.gimbal[2]),
      n("ball", "gimbalYaw", i.ball[0], i.ball[1], i.ball[2]),
      n("lamp", "ball", i.lamp[0], i.lamp[1], i.lamp[2]),
      n("gun", "body", i.gun[0], i.gun[1], i.gun[2]),
      n("strobeG", "body", 0, 0, 0),
      n("strobeR", "body", 0, 0, 0),
      n("strobeW", "body", 0, 0, 0);
    let s = (l, c, u, h, f) => e.add(l, c, u, h, f);
    s("shell", "body", Ce(Ur(1, 20, 12, 0.118, 0.074, 0.27), 0, 0.02, 0), Ss),
      s(
        "shell",
        "body",
        Ce(ot(1, 0.9, 1, 20), 0, 0.02, 0.165, va, 0, 0, [0.094, 0.05, 0.06]),
        Ts,
      ),
      s(
        "shell",
        "body",
        Ce(ot(1, 1, 1, 20), 0, 0.02, -0.02, va, 0, 0, [0.121, 0.012, 0.0765]),
        s0,
      ),
      s("shell", "body", Ce(ft(0.118, 0.014, 0.2, 0.005), 0, 0.089, -0.03), vm),
      s("shell", "body", Ce(ft(0.03, 0.006, 0.2, 0.002), 0, 0.0975, -0.03), Ts);
    for (let l of [-0.05, 0.05])
      for (let c of [-0.12, 0.06]) s("metal", "body", Yv(l, 0.097, c), Yn);
    s("metal", "body", Ce(ft(0.175, 0.06, 0.37, 0.016), 0, -0.035, -0.005), an),
      s(
        "metal",
        "body",
        Ce(ft(0.12, 0.075, 0.11, 0.014), 0, 0.005, -0.265),
        As,
      ),
      s("shell", "body", Ce(ft(0.124, 0.02, 0.03, 0.005), 0, 0.03, -0.3), Ts),
      s(
        "glow",
        "body",
        Ce(ft(0.05, 0.006, 0.003, 0.001), 0, 0, -0.321),
        [0.3, 1.6, 0.4],
        !1,
      );
    for (let l of [1, -1]) {
      for (let c = 0; c < 4; c++)
        s(
          "metal",
          "body",
          Ce(
            ft(0.004, 0.01, 0.06, 0.001),
            l * 0.0885,
            -0.045 + c * 0.016,
            -0.06,
          ),
          [0.2, 0.2, 0.2],
        );
      s(
        "metal",
        "body",
        Fn(
          [
            [l * 0.075, -0.055, 0.13],
            [l * 0.135, -0.175, 0.16],
            [l * 0.135, -0.192, 0.11],
            [l * 0.135, -0.192, -0.14],
            [l * 0.135, -0.175, -0.19],
            [l * 0.075, -0.055, -0.15],
          ],
          0.0085,
          6,
          !1,
          0.5,
        ),
        Yn,
      );
      for (let c of [0.07, -0.1])
        s(
          "shell",
          "body",
          Ce(Si(0.0135, 0.0135, 0.07, 8), l * 0.135, -0.192, c),
          ga,
        );
      s(
        "metal",
        "body",
        su([l * 0.04, 0.07, -0.17], [l * 0.085, 0.37, -0.27], 0.004, 0.002, 5),
        an,
      ),
        s(
          "metal",
          "body",
          Ce(ds(0.008, 0.01, 0.025, 6), l * 0.04, 0.078, -0.17),
          Yn,
        );
    }
    s("metal", "body", Ce(ds(0.007, 0.007, 0.04, 6), 0, 0.105, 0.1), Yn),
      s("shell", "body", Ce(ds(0.034, 0.036, 0.018, 14), 0, 0.132, 0.1), Ss),
      s("metal", "body", Ce(ft(0.07, 0.03, 0.09, 0.008), 0, -0.075, 0.235), As);
    let o = FC();
    for (let l = 0; l < 4; l++) {
      let [c, u, h] = i.rotors[l],
        f = Math.sign(c),
        p = Math.sign(h);
      s(
        "metal",
        "body",
        su([f * 0.07, 0, p * 0.09], [c, u - 0.05, h], 0.017, 0.015, 8),
        an,
      ),
        s(
          "shell",
          "body",
          Ce(
            ft(0.07, 0.045, 0.07, 0.014),
            f * 0.085,
            0,
            p * 0.1,
            0,
            f * p * 0.74,
            0,
          ),
          Ss,
        ),
        s(
          "shell",
          "body",
          Fn(
            [
              [f * 0.09, 0.02, p * 0.12],
              [f * 0.18, 0.012, p * 0.19],
              [c - f * 0.05, u - 0.03, h - p * 0.04],
            ],
            0.005,
            5,
          ),
          ga,
        ),
        s("metal", "body", Ce(ds(0.04, 0.03, 0.075, 12), c, u - 0.05, h), an),
        s("metal", "body", Ce(ds(0.042, 0.042, 0.012, 12), c, u - 0.02, h), Yn),
        s("shell", "body", Ce(o.clone(), c, u, h), Ss),
        s(
          "shell",
          "body",
          Ce(new Ci(0.196, 0.0085, 6, 28), c, u + 0.036, h, va, 0, 0),
          Ts,
        );
      for (let v = 0; v < 3; v++) {
        let g = v * 2.094 + 0.5 + l;
        s(
          "metal",
          "body",
          Ce(
            ft(0.145, 0.007, 0.016, 0.002),
            c + Math.cos(g) * 0.105,
            u - 0.022,
            h - Math.sin(g) * 0.105,
            0,
            g,
            0,
          ),
          an,
        );
      }
      for (let v = -1; v <= 1; v++) {
        let g = Math.atan2(p, f) + v * 0.2;
        s(
          "shell",
          "body",
          Ce(
            ft(0.012, 0.05, 0.036, 0.003),
            c + Math.cos(g) * 0.205,
            u,
            h + Math.sin(g) * 0.205,
            0,
            -g,
            0,
          ),
          v === 0 ? s0 : Of,
        );
      }
      s("metal", "rotor" + l, Ce(ds(0.017, 0.02, 0.03, 8), 0, -0.002, 0), Yn),
        s(
          "metal",
          "rotor" + l,
          Ce(ft(0.158, 0.0035, 0.03, 0.001), 0.088, 0.008, 0, 0.22, 0, 0),
          an,
        ),
        s(
          "metal",
          "rotor" + l,
          Ce(ft(0.158, 0.0035, 0.03, 0.001), -0.088, 0.008, 0, -0.22, 0, 0),
          an,
        ),
        s(
          "shell",
          "rotor" + l,
          Ce(ft(0.02, 0.004, 0.031, 0.001), 0.158, 0.008, 0, 0.22, 0, 0),
          Of,
        ),
        s(
          "shell",
          "rotor" + l,
          Ce(ft(0.02, 0.004, 0.031, 0.001), -0.158, 0.008, 0, -0.22, 0, 0),
          Of,
        );
      let d = new O0(0.03, 0.168, 24, 1);
      d.rotateX(-va),
        t.add("disc", "body", Ce(d, c, u + 0.008, h), [1, 1, 1], !1);
    }
    s(
      "glow",
      "strobeR",
      Ce(Ur(0.012, 8, 6), 0.33 + 0.215, 0.035, 0.3),
      [10, 0.4, 0.2],
      !1,
    ),
      s(
        "glow",
        "strobeR",
        Ce(Ur(0.012, 8, 6), 0.33 + 0.215, 0.035, -0.3),
        [10, 0.4, 0.2],
        !1,
      ),
      s(
        "glow",
        "strobeG",
        Ce(Ur(0.012, 8, 6), -0.33 - 0.215, 0.035, 0.3),
        [0.3, 9, 1],
        !1,
      ),
      s(
        "glow",
        "strobeG",
        Ce(Ur(0.012, 8, 6), -0.33 - 0.215, 0.035, -0.3),
        [0.3, 9, 1],
        !1,
      ),
      s("glow", "strobeW", Ce(Ur(0.011, 8, 6), 0, 0.05, -0.325), [9, 9, 9], !1),
      s(
        "metal",
        "gimbalYaw",
        Ce(ds(0.036, 0.036, 0.014, 12), 0, -0.004, 0),
        an,
      ),
      s(
        "metal",
        "gimbalYaw",
        Ce(ft(0.156, 0.01, 0.03, 0.003), 0, -0.014, 0),
        As,
      );
    for (let l of [1, -1])
      s(
        "metal",
        "gimbalYaw",
        Ce(ft(0.009, 0.075, 0.03, 0.003), l * 0.0735, -0.05, 0),
        As,
      );
    s("metal", "ball", Ce(Ur(0.06, 18, 12), 0, 0, 0), an),
      s("metal", "ball", Ce(Ro(0.013, 0.013, 0.142, 8), 0, 0, 0), Yn),
      s("metal", "ball", Ce(Si(0.031, 0.036, 0.03, 14), 0, 0.004, 0.048), As),
      s(
        "lens",
        "ball",
        Ce(Si(0.025, 0.025, 0.004, 14), 0, 0.004, 0.0645),
        [1, 1, 1],
        !1,
      ),
      s(
        "metal",
        "ball",
        Ce(Si(0.012, 0.012, 0.01, 8), 0.03, 0.036, 0.04),
        [0.1, 0.12, 0.2],
      ),
      s(
        "metal",
        "ball",
        Ce(
          Si(0.019, 0.023, 0.045, 10),
          i.lamp[0],
          i.lamp[1],
          i.lamp[2] - 0.022,
        ),
        an,
      ),
      s(
        "glow",
        "lamp",
        Ce(Si(0.016, 0.016, 0.003, 10), 0, 0, 0.001),
        [11, 9.8, 7.6],
        !1,
      );
    {
      let u = new Ua(1.25, 9, 20, 6, !0);
      u.translate(0, -9 / 2, 0),
        u.rotateX(-va),
        t.add("cone", "lamp", u, [1, 1, 1], !1);
    }
    s("metal", "gun", Ce(ft(0.05, 0.03, 0.05, 0.006), 0, 0.012, 0), As),
      s("metal", "gun", Ce(Ro(0.012, 0.012, 0.07, 8), 0, -0.005, 0), Yn),
      s("metal", "gun", Ce(ft(0.052, 0.046, 0.13, 0.008), 0, -0.032, 0), As),
      s("shell", "gun", Ce(ft(0.054, 0.012, 0.05, 0.003), 0, -0.02, -0.03), Ts);
    for (let l of [-0.014, 0.014])
      s("metal", "gun", Ce(Si(0.0085, 0.0085, 0.2, 8), l, -0.032, 0.16), an),
        s("metal", "gun", Ce(Si(0.012, 0.012, 0.03, 8), l, -0.032, 0.255), As);
    s("metal", "gun", Ce(ft(0.045, 0.012, 0.012, 0.002), 0, -0.032, 0.2), Yn),
      s(
        "metal",
        "gun",
        Ce(ft(0.03, 0.05, 0.05, 0.006), 0.04, -0.035, -0.02),
        an,
      );
    let r = e.build(["shell", "metal", "glow", "lens"]),
      a = t.build(["disc", "cone"]);
    return (r.extra = a), r;
  }
  var Zv = {
      hp: 45,
      boltDamage: 7,
      boltSpeed: 70,
      burst: 3,
      burstGap: 0.12,
      telegraph: 0.55,
      cooldown: [1.9, 3.3],
      rangeMin: 12,
      rangeMax: 25,
      altMin: 4,
      altMax: 8,
      maxSpeed: 8,
      patrolSpeed: 3,
      accel: 11,
      spreadFar: 0.065,
      spreadNear: 0.018,
      fireRange: 42,
      explodeRadius: 3,
      explodeDamage: 30,
    },
    Pn = Zv,
    // V44：自杀无人机自爆参数（可调：src/config/balance.js → enemies.suicideDrone）
    DroneTune =
      (window.SX_BALANCE &&
        window.SX_BALANCE.enemies &&
        window.SX_BALANCE.enemies.suicideDrone) ||
      {},
    $o = new W(),
    iz = new W(),
    Bs = new W(),
    Co = new W(),
    sz = new W(),
    ou = new W(),
    Hf = new W(0, 1, 0),
    J_ = new W(0, -1, 0),
    ym = [8, 4, 0.7],
    UC = [14, 1, 0.35],
    K_ = (i, e) => {
      let t = (i - e) % (Math.PI * 2);
      return (
        t > Math.PI ? (t -= Math.PI * 2) : t < -Math.PI && (t += Math.PI * 2), t
      );
    },
    bl = (i, e, t) => (i < e ? e : i > t ? t : i);
  function Q_(i, e, t, n) {
    let s = i.G,
      o = i.rng,
      r = t.lensBase.clone(),
      a = pm(
        e,
        {
          shell: t.shell,
          metal: t.metal,
          glow: t.glow,
          lens: r,
          disc: t.disc,
          cone: t.cone,
        },
        { radius: 0.9, center: [0, 0, 0], extra: { def: e.extra, radius: 10 } },
      ),
      l = a.bones;
    (a.group.rotation.order = "YXZ"), (a.group.visible = !1);
    let c = s.mats.label("G-" + String(n + 11), {
        color: "black",
        font: "stencil",
        distress: 0.35,
      }),
      u = 0.105,
      h = Math.min(0.045, u / (c.aspect || 3)),
      f = new rn(u, h);
    f.rotateX(-Math.PI / 2), f.rotateY(Math.PI);
    let p = new Qe(f, c.material);
    p.position.set(0, 0.0985, -0.085),
      (p.castShadow = !1),
      (p.receiveShadow = !0),
      l.body.add(p);
    let d = {
      id: 0,
      type: "gull",
      pos: a.group.position,
      alive: !1,
      hp: Pn.hp,
      active: !1,
      rig: a,
      lens: r,
      vel: new W(),
      yaw: 0,
      pitch: 0,
      roll: 0,
      home: new W(),
      lastKnown: new W(),
      sensor: new W(),
      fwd: new W(0, 0, 1),
      muzzle: new W(),
      mode: "patrol",
      los: !1,
      seeT: 0,
      noSeeT: 0,
      senseT: 0,
      exposure: 0,
      modeT: 0,
      passive: !1,
      hasToken: !1,
      orbitA: 0,
      orbitDir: 1,
      orbitR: 16,
      alt: 6,
      hoverY: 0,
      phase: 0,
      ceil: 1e9,
      ceilT: 0,
      flipT: 0,
      avoid: new W(),
      atk: "idle",
      atkT: 0,
      cool: 1,
      shots: 0,
      smokeT: 0,
      feeler: 0,
      strobeT: 0,
      flare: 0,
      lensC: [ym[0], ym[1], ym[2]],
      dieT: 0,
      spin: 0,
      lostRotor: 0,
      gy: 0,
      gp: 0,
      loop: null,
      sweep: 0,
      thr: 1,
      damage(y, b, m, A) {
        return d.alive
          ? ((d.hp -= y),
            s.events.emit("enemy:hit", {
              enemy: d,
              point: b,
              part: A || "body",
            }),
            m &&
              (d.vel.addScaledVector(m, Math.min(3, y * 0.09)),
              (d.roll += (o() - 0.5) * 0.5),
              (d.pitch += (o() - 0.5) * 0.4)),
            i.provoke(d),
            d.hp <= 0 ? (v(m), !0) : !1)
          : !1;
      },
      _activate(y, b = {}) {
        (d.active = !0),
          (d.alive = !0),
          (d.hp = Pn.hp),
          (d.passive = !!b.passive),
          d.pos.copy(y),
          d.home.copy(y),
          d.vel.set(0, 0, 0),
          (d.yaw = b.yaw ?? o() * 6.283),
          (d.pitch = d.roll = 0),
          (d.mode = b.state === "alert" ? "investigate" : "patrol"),
          (d.modeT = 8),
          d.lastKnown.copy(b.target || (s.player ? s.player.pos : y)),
          (d.los = !1),
          (d.seeT = d.noSeeT = 0),
          (d.exposure = 0),
          (d.senseT = o() * 0.2),
          (d.hasToken = !1),
          (d.orbitDir = o() < 0.5 ? 1 : -1),
          (d.orbitR = Pn.rangeMin + 2 + o() * (Pn.rangeMax - Pn.rangeMin - 5)),
          (d.alt =
            b.hover ?? Pn.altMin + 0.8 + o() * (Pn.altMax - Pn.altMin - 1.6)),
          (d.hoverFixed = b.hover != null),
          (d.patrolR = b.patrolRadius ?? 4 + o() * 5),
          (d.phase = o() * 6.283),
          (d.orbitA = o() * 6.283),
          (d.ceil = 1e9),
          (d.flipT = 3 + o() * 4),
          (d.atk = "idle"),
          (d.cool = 1 + o() * 1.5),
          (d.dieT = 0),
          (d.spin = 0),
          (d.lostRotor = -1),
          (d.flare = 0),
          (d.thr = 1);
        for (let m = 0; m < 4; m++) l["rotor" + m].scale.setScalar(1);
        if (
          (l.lamp.scale.setScalar(1),
          l.body.rotation.set(0, 0, 0),
          (a.group.visible = !0),
          a.group.rotation.set(0, d.yaw, 0),
          s.audio && s.audio.loop && !d.loop)
        )
          try {
            d.loop = s.audio.loop("gull_rotor", { pos: d.pos, gain: 0.5 });
          } catch {
            d.loop = null;
          }
      },
      _deactivate() {
        if (
          ((d.active = !1),
          (d.alive = !1),
          (a.group.visible = !1),
          i.releaseToken(d),
          d.loop)
        ) {
          try {
            d.loop.stop();
          } catch {}
          d.loop = null;
        }
      },
      _raycast(y, b, m, A) {
        let E = y.x - d.pos.x,
          w = (y.y - d.pos.y + 0.03) * 2.3,
          S = y.z - d.pos.z,
          z = b.x,
          H = b.y * 2.3,
          O = b.z,
          q = z * z + H * H + O * O,
          U = E * z + w * H + S * O,
          T = E * E + w * w + S * S - 0.5 * 0.5,
          D = U * U - q * T;
        if (D < 0) return !1;
        let C = (-U - Math.sqrt(D)) / q;
        return C < 0 || C > m || C >= A.dist
          ? !1
          : ((A.dist = C),
            (A.part = "body"),
            (A.enemy = d),
            A.point.copy(y).addScaledVector(b, C),
            A.normal.copy(A.point).sub(d.pos),
            (A.normal.y *= 2.3),
            A.normal.normalize(),
            !0);
      },
      _update(y) {
        d.alive ? x(y) : g(y);
      },
    };
    function v(y) {
      (d.alive = !1),
        i.releaseToken(d),
        (d.dieT = 0),
        (d.lostRotor = Math.floor(o() * 4)),
        l["rotor" + d.lostRotor].scale.setScalar(1e-4),
        $o
          .set(xm.rotors[d.lostRotor][0], 0.05, xm.rotors[d.lostRotor][2])
          .applyAxisAngle(Hf, d.yaw)
          .add(d.pos),
        s.fx.sparks($o, Hf, 14),
        s.fx.debris($o, { count: 3 }),
        s.fx.smoke($o, { size: 0.5, life: 1 }),
        (d.spin = (o() < 0.5 ? -1 : 1) * (5 + o() * 3)),
        (d.vel.y += 1.5),
        y && d.vel.addScaledVector(y, 2.5),
        l.lamp.scale.setScalar(1e-4),
        l.strobeG.scale.setScalar(1e-4),
        l.strobeR.scale.setScalar(1e-4),
        l.strobeW.scale.setScalar(1e-4),
        r.color.setRGB(0.3, 0.05, 0.02),
        s.events.emit("enemy:killed", { enemy: d, pos: d.pos, type: "gull" });
    }
    function g(y) {
      if (d.trainTarget) {
        d.dieT += y;
        try {
          s.fx.explosion(d.pos, 0.55);
          s.fx.sparks(d.pos, Hf, 8);
          s.fx.smoke(d.pos, { size: 0.32, life: 0.6, rise: 0.4 });
        } catch (e) {}
        i.retire(d);
        return;
      }
      (d.dieT += y),
        (d.vel.y -= 9.5 * y),
        (d.vel.x *= 1 - 0.4 * y),
        (d.vel.z *= 1 - 0.4 * y),
        (d.spin += Math.sign(d.spin) * 7 * y),
        (d.yaw += d.spin * y),
        (d.roll += d.spin * 0.35 * y),
        (d.pitch += 0.9 * y);
      let b = d.vel.length(),
        m = b * y,
        A = d.dieT > 5 || d.pos.y < -3;
      if (!A && b > 0.01) {
        Bs.copy(d.vel).multiplyScalar(1 / b);
        let _ = s.physics.raycast(d.pos, Bs, m + 0.3);
        _ && (d.pos.copy(_.point).addScaledVector(_.normal, 0.2), (A = !0));
      }
      A || d.pos.addScaledVector(d.vel, y),
        a.group.rotation.set(d.pitch, d.yaw, d.roll);
      for (let _ = 0; _ < 4; _++)
        _ !== d.lostRotor &&
          (l["rotor" + _].rotation.y +=
            (_ % 3 === 0 ? 1 : -1) * 30 * Math.max(0.2, 1 - d.dieT * 0.5) * y);
      (d.smokeT -= y),
        d.smokeT <= 0 &&
          ((d.smokeT = 0.045),
          s.fx.smoke(d.pos, {
            size: 0.45,
            life: 1.3,
            color: 1381914,
            rise: 0.6,
          }),
          o() < 0.5 &&
            ($o.set(o() - 0.5, o(), o() - 0.5).normalize(),
            s.fx.sparks(d.pos, $o, 3))),
        d.loop &&
          (d.loop.setPos(d.pos),
          d.loop.setPitch(Math.max(0.4, 1.25 - d.dieT * 0.4)),
          d.loop.setGain(0.5)),
        A &&
          (s.fx.explosion(d.pos, 1.2),
          s.combat &&
            s.combat.explode &&
            s.combat.explode(
              d.pos,
              Pn.explodeRadius,
              Pn.explodeDamage,
              "enemy",
            ),
          i.retire(d));
    }
    function x(y) {
      let b = s.player,
        m = i.t;
      if (d.trainTarget) {
        if (!d.alive) return;
        let ph = d.trainPhase || 0;
        let tx = d.home.x + Math.sin(m * 0.42 + ph) * 2.2;
        let tz = d.home.z + Math.cos(m * 0.36 + ph * 1.3) * 2.2;
        let ty = d.alt + Math.sin(m * 1.15 + ph) * 0.35;
        let k = Math.min(1, y * 2.4);
        d.pos.x += (tx - d.pos.x) * k;
        d.pos.y += (ty - d.pos.y) * k;
        d.pos.z += (tz - d.pos.z) * k;
        d.vel.set(0, 0, 0);
        if (b && b.alive) d.yaw = Math.atan2(b.pos.x - d.pos.x, b.pos.z - d.pos.z);
        d.pitch = Math.sin(m * 0.9 + ph) * 0.06;
        d.roll = Math.sin(m * 1.3 + ph) * 0.08;
        a.group.rotation.set(d.pitch, d.yaw, d.roll);
        for (let r = 0; r < 4; r++)
          l["rotor" + r].rotation.y += (r % 3 === 0 ? 1 : -1) * 34 * y;
        if (d.lens && d.lens.color) {
          let pulse = 0.55 + 0.45 * Math.sin(m * 4 + ph);
          d.lens.color.setRGB(0.25, 1.15 * pulse, 1.45 * pulse);
        }
        return;
      }
      if (d.variant === "drone") {
        if (!d.alive) return;
        if (b && b.alive) {
          let tx = b.eye.x - d.pos.x,
            ty = b.pos.y + 1.05 - d.pos.y,
            tz = b.eye.z - d.pos.z,
            dd = Math.hypot(tx, ty, tz) || 1,
            sp = DroneTune.speed || 10.5;
          (d.vel.x += (tx / dd * sp - d.vel.x) * Math.min(1, y * 2.6)),
            (d.vel.y += (ty / dd * sp - d.vel.y) * Math.min(1, y * 2.6)),
            (d.vel.z += (tz / dd * sp - d.vel.z) * Math.min(1, y * 2.6)),
            d.pos.addScaledVector(d.vel, y),
            (d.yaw = Math.atan2(d.vel.x, d.vel.z)),
            (d.pitch = Math.atan2(d.vel.y, Math.hypot(d.vel.x, d.vel.z)) * 0.45);
          for (let k = 0; k < 4; k++)
            l["rotor" + k].rotation.y += (k % 3 === 0 ? 1 : -1) * 38 * y;
          a.group.rotation.set(d.pitch, d.yaw, d.roll);
          d.strobeT -= y;
          if (d.strobeT <= 0 && l.strobeR) { d.strobeT = 0.12; l.strobeR.scale.setScalar(2.2); }
          if (l.strobeR && l.strobeR.scale.x > 1.2) l.strobeR.scale.multiplyScalar(1 - Math.min(1, y * 8));
          if (
            dd < (DroneTune.triggerRadius || 1.9) ||
            d.pos.distanceTo(b.pos) < (DroneTune.triggerDistance || 1.5)
          ) {
            try { s.fx.explosion(d.pos, 1.5); } catch (e) {}
            try {
              s.combat.explode(
                d.pos,
                DroneTune.explodeRadius || 4.4,
                DroneTune.explodeDamage || 44,
                "enemy",
              );
            } catch (e) {}
            s.events.emit("enemy:killed", { enemy: d, pos: d.pos, type: "gull" });
            i.retire(d);
          }
        }
        return;
      }
      d.fwd.set(Math.sin(d.yaw), 0, Math.cos(d.yaw)),
        d.sensor.set(0, -0.17, 0.27).applyAxisAngle(Hf, d.yaw).add(d.pos),
        i.think(d, y, 0.4);
      let A = d.mode === "engage",
        _ = d.hp < Pn.hp * 0.5,
        M = Pn.patrolSpeed,
        E,
        w,
        S;
      if (A && b) {
        M = Pn.maxSpeed;
        let P = d.atk !== "idle";
        (d.flipT -= y),
          d.flipT <= 0 &&
            ((d.flipT = 3 + o() * 5),
            o() < 0.6 && (d.orbitDir = -d.orbitDir),
            (d.orbitR = bl(
              d.orbitR + (o() - 0.5) * 6,
              Pn.rangeMin + 1,
              Pn.rangeMax - 2,
            ))),
          d.noSeeT > 1.5
            ? ((E = d.lastKnown.x),
              (S = d.lastKnown.z),
              (w = d.lastKnown.y + d.alt + 1),
              (d.orbitA = Math.atan2(
                d.pos.z - d.lastKnown.z,
                d.pos.x - d.lastKnown.x,
              )))
            : ((d.orbitA += ((d.orbitDir * (P ? 0.9 : 3.6)) / d.orbitR) * y),
              (E = b.pos.x + Math.cos(d.orbitA) * d.orbitR),
              (S = b.pos.z + Math.sin(d.orbitA) * d.orbitR),
              (w = b.pos.y + d.alt));
      } else
        d.mode === "investigate" || d.mode === "search"
          ? ((M = 5.5),
            (d.orbitA += 0.5 * y),
            (E = d.lastKnown.x + Math.cos(d.orbitA) * 4.5),
            (S = d.lastKnown.z + Math.sin(d.orbitA) * 4.5),
            (w = d.lastKnown.y + Math.min(d.alt, 5.5)))
          : ((d.orbitA += 0.28 * y * d.orbitDir),
            (E = d.home.x + Math.cos(d.orbitA) * d.patrolR),
            (S = d.home.z + Math.sin(d.orbitA) * d.patrolR),
            (w = d.hoverFixed ? d.alt : d.home.y));
      w > d.ceil && (w = d.ceil),
        !d.hoverFixed && w < 2.2 && (w = 2.2),
        Co.set(
          (E - d.pos.x) * 2.2 - d.vel.x * 2.4,
          (w - d.pos.y) * 5 - d.vel.y * 3.6,
          (S - d.pos.z) * 2.2 - d.vel.z * 2.4,
        ),
        (d.feeler = (d.feeler + 1) % 3);
      let z = Math.hypot(d.vel.x, d.vel.z);
      if (d.feeler === 0 && z > 0.6) {
        Bs.set(d.vel.x / z, 0, d.vel.z / z);
        let P = 2.2 + z * 0.5,
          V = s.physics.raycast(d.pos, Bs, P);
        if (V) {
          let Y = 1 - V.dist / P;
          d.avoid.copy(V.normal).multiplyScalar(26 * Y),
            (d.avoid.y += 9 * Y),
            Y > 0.5 && ((d.orbitDir = -d.orbitDir), (d.flipT = 2.5));
        }
      } else if (d.feeler === 1) {
        let P = s.physics.raycast(d.pos, J_, 2.4);
        P && !d.hoverFixed && (d.avoid.y += (2.4 - P.dist) * 10);
      } else if (d.feeler === 2 && ((d.ceilT -= y * 3), d.ceilT <= 0)) {
        d.ceilT = 0.35;
        let P = s.physics.raycast(d.pos, Hf, 4);
        d.ceil = P ? d.pos.y + P.dist - 1.3 : 1e9;
      }
      Co.add(d.avoid),
        d.avoid.multiplyScalar(Math.exp(-6 * y)),
        _ &&
          ((Co.x += Math.sin(m * 7.3 + d.phase) * 5),
          (Co.z += Math.cos(m * 6.1 + d.phase) * 5),
          (Co.y += Math.sin(m * 9.7) * 3));
      let H = Co.length();
      H > Pn.accel && Co.multiplyScalar(Pn.accel / H),
        d.vel.addScaledVector(Co, y);
      let O = d.vel.length();
      O > M && (d.vel.multiplyScalar(M / O), (O = M));
      for (let P = 0; P < 3; P++) {
        let V = P === 0 ? d.vel.x : P === 1 ? d.vel.y : d.vel.z;
        if (Math.abs(V) < 0.02) continue;
        let Y = V > 0 ? 1 : -1,
          L = P === 1 ? 0.35 : 0.62;
        Bs.set(P === 0 ? Y : 0, P === 1 ? Y : 0, P === 2 ? Y : 0);
        let Z = s.physics.raycast(d.pos, Bs, Math.abs(V) * y + L);
        Z &&
          (d.vel.setComponent(P, -V * 0.25),
          d.avoid.setComponent(P, d.avoid.getComponent(P) - Y * 8),
          Z.dist < L &&
            d.pos.setComponent(P, d.pos.getComponent(P) - Y * (L - Z.dist)));
      }
      if ((d.pos.addScaledVector(d.vel, y), !d.hoverFixed)) {
        let P = s.physics.groundHeight(d.pos.x, d.pos.z, d.pos.y + 0.5) + 1.1;
        d.pos.y < P && ((d.pos.y = P), d.vel.y < 0 && (d.vel.y = 0));
      }
      let q = d.yaw;
      if ((A || d.mode === "search" || d.mode === "investigate") && b) {
        let P = A && d.noSeeT < 1.5 ? b.pos : d.lastKnown;
        q = Math.atan2(P.x - d.pos.x, P.z - d.pos.z);
      } else z > 0.4 && (q = Math.atan2(d.vel.x, d.vel.z));
      let U = K_(q, d.yaw);
      d.yaw += bl(U, -3.2 * y, 3.2 * y);
      let T = Math.cos(d.yaw),
        D = Math.sin(d.yaw),
        C = Co.x * D + Co.z * T,
        G = Co.x * T - Co.z * D,
        j = bl(C * 0.04, -0.42, 0.42),
        N = bl(-G * 0.04, -0.42, 0.42);
      _ &&
        ((j += Math.sin(m * 11 + d.phase) * 0.1),
        (N += Math.cos(m * 8.7 + d.phase * 2) * 0.13));
      let Q = 1 - Math.exp(-7 * y);
      (d.pitch += (j - d.pitch) * Q),
        (d.roll += (N - d.roll) * Q),
        a.group.rotation.set(d.pitch, d.yaw, d.roll),
        (l.body.position.y =
          Math.sin(m * 2.1 + d.phase) * 0.045 +
          Math.sin(m * 3.7 + d.phase * 1.7) * 0.018),
        (d.thr += (1 + bl(Co.y * 0.03, -0.25, 0.4) + z * 0.02 - d.thr) * Q);
      let K = 41 * d.thr * y;
      (l.rotor0.rotation.y += K),
        (l.rotor1.rotation.y -= K * 1.03),
        (l.rotor2.rotation.y -= K * 0.98),
        (l.rotor3.rotation.y += K * 1.01);
      let ie = (m * 0.9 + d.phase * 0.1) % 1,
        F = ie < 0.05 || (ie > 0.13 && ie < 0.18) ? 1 : 1e-4;
      if (
        (l.strobeR.scale.setScalar(F),
        l.strobeG.scale.setScalar(F),
        l.strobeW.scale.setScalar(ie > 0.5 && ie < 0.56 ? 1 : 1e-4),
        A && b)
      )
        ou.set(b.pos.x, b.pos.y + 1.1, b.pos.z);
      else if (d.mode !== "patrol")
        (d.sweep += y),
          ou.set(
            d.lastKnown.x + Math.sin(d.sweep * 0.9) * 3,
            d.lastKnown.y,
            d.lastKnown.z + Math.cos(d.sweep * 0.7) * 3,
          );
      else {
        d.sweep += y;
        let P = d.yaw + Math.sin(d.sweep * 0.5 + d.phase) * 0.9;
        ou.set(
          d.pos.x + Math.sin(P) * 5,
          d.pos.y - (d.hoverFixed ? 1.6 : 5),
          d.pos.z + Math.cos(P) * 5,
        );
      }
      $o.copy(ou).sub(d.sensor);
      let X = $o.x * T - $o.z * D,
        ne = $o.x * D + $o.z * T,
        re = $o.y,
        $ = Math.atan2(X, ne),
        ue = bl(Math.atan2(-re, Math.hypot(X, ne)), -0.5, 1.5),
        me = 1 - Math.exp(-9 * y);
      (d.gy += K_($, d.gy) * me),
        (d.gp += (ue - d.gp) * me),
        (l.gimbalYaw.rotation.y = d.gy),
        (l.ball.rotation.x = d.gp - d.pitch),
        (l.gun.rotation.x = bl(d.gp, -0.2, 1.3) - d.pitch);
      let ee = A ? UC : ym,
        B = 1 + d.flare * 3.2 + (A ? 0 : Math.sin(m * 3 + d.phase) * 0.15);
      for (let P = 0; P < 3; P++)
        d.lensC[P] += (ee[P] - d.lensC[P]) * (1 - Math.exp(-8 * y));
      if (
        (r.color.setRGB(d.lensC[0] * B, d.lensC[1] * B, d.lensC[2] * B),
        (d.flare = Math.max(0, d.flare - y * 1.5)),
        d.muzzle.set(0, -0.12, 0.17).applyAxisAngle(Hf, d.yaw).add(d.pos),
        (d.cool -= y),
        d.atk === "idle")
      )
        A &&
          d.los &&
          d.cool <= 0 &&
          b &&
          b.alive &&
          Math.abs(U) < 0.35 &&
          d.pos.distanceTo(b.pos) < Pn.fireRange &&
          i.requestToken(d) &&
          ((d.atk = "tele"),
          (d.atkT = Pn.telegraph),
          s.events.emit("enemy:telegraph", {
            enemy: d,
            type: "gull",
            time: Pn.telegraph,
            pos: d.pos,
          }));
      else if (d.atk === "tele")
        (d.atkT -= y),
          (d.flare = Math.min(1, d.flare + y * 4.5)),
          A
            ? d.atkT <= 0 &&
              ((d.atk = "burst"),
              (d.shots = Pn.burst),
              (d.atkT = 0),
              (d.lead = 0.2 + o() * 0.65))
            : ((d.atk = "idle"), i.releaseToken(d));
      else if (
        d.atk === "burst" &&
        ((d.atkT -= y), (d.flare = 1), d.atkT <= 0)
      ) {
        if (((d.atkT = Pn.burstGap), d.shots--, b)) {
          let P = d.muzzle.distanceTo(b.pos),
            V = P / Pn.boltSpeed;
          ou.set(
            b.pos.x + b.vel.x * V * d.lead,
            b.pos.y + 1.05,
            b.pos.z + b.vel.z * V * d.lead,
          ),
            Bs.copy(ou).sub(d.muzzle).normalize();
          let Y =
            (Pn.spreadFar + (Pn.spreadNear - Pn.spreadFar) * d.exposure) *
            (1 + i.playerSpeed * 0.45) *
            (_ ? 1.5 : 1);
          (Bs.x += (o() - 0.5) * 2 * Y),
            (Bs.y += (o() - 0.5) * 2 * Y),
            (Bs.z += (o() - 0.5) * 2 * Y),
            Bs.normalize(),
            i.fireBolt(d.muzzle, Bs, d),
            s.fx.muzzleFlash(d.muzzle, Bs, { scale: 0.55 }),
            s.events.emit("enemy:fire", {
              enemy: d,
              pos: d.muzzle,
              dir: Bs,
              type: "gull",
            }),
            d.vel.addScaledVector(Bs, -0.35);
        }
        d.shots <= 0 &&
          ((d.atk = "idle"),
          (d.cool = Pn.cooldown[0] + o() * (Pn.cooldown[1] - Pn.cooldown[0])),
          i.releaseToken(d));
      }
      _ &&
        ((d.smokeT -= y),
        d.smokeT <= 0 &&
          ((d.smokeT = 0.16),
          s.fx.smoke(d.pos, {
            size: 0.3,
            life: 1.1,
            color: 2500652,
            rise: 0.8,
          }),
          o() < 0.15 && s.fx.sparks(d.pos, J_, 2))),
        d.loop &&
          (d.loop.setPos(d.pos),
          d.loop.setPitch(
            0.85 + d.thr * 0.2 + (_ ? Math.sin(m * 13) * 0.05 : 0),
          ));
    }
    return d;
  }
  var Kv = {
      hp: 140,
      shotDamage: 5,
      burst: 4,
      burstGap: 0.11,
      telegraph: 0.5,
      cooldown: [1.8, 3],
      runSpeed: 4.5,
      stalkSpeed: 2,
      patrolSpeed: 1.5,
      accel: 7,
      turnRate: 2.5,
      rangeMin: 8,
      rangeMax: 18,
      spreadFar: 0.12,
      spreadNear: 0.045,
      lungeRange: 3,
      lungeDamage: 15,
      lungeCooldown: 3.5,
      lungeSpeed: 9.5,
      replan: 0.6,
      smokeBelow: 0.4,
    },
    Gt = Kv,
    ni = $v,
    ps = new W(),
    ru = new W(),
    Po = new W(),
    Io = new W(),
    eM = new W(),
    Vf = new W(),
    jv = new W(0, 1, 0),
    bm = { abd: 0, hip: 0, knee: 0, reach: 0 },
    _m = [8, 4, 0.7],
    NC = [14, 1, 0.35],
    Mm = (i, e) => {
      let t = (i - e) % (Math.PI * 2);
      return (
        t > Math.PI ? (t -= Math.PI * 2) : t < -Math.PI && (t += Math.PI * 2), t
      );
    },
    uo = (i, e, t) => (i < e ? e : i > t ? t : i),
    wm = [
      [0, 3],
      [1, 2],
    ];
  function xa(i, e, t, n, s) {
    return (i.v += ((e - i.x) * t - i.v * n) * s), (i.x += i.v * s), i.x;
  }
  function iM(i, e, t, n) {
    let s = i.G,
      o = i.rng,
      r = t.lensBase.clone(),
      a = pm(
        e,
        { shell: t.shell, metal: t.metal, glow: t.glow, lens: r },
        { radius: 1.5, center: [0, 0.6, 0] },
      ),
      l = a.bones;
    a.group.visible = !1;
    let c = [],
      u = [],
      h = [];
    for (let T = 0; T < 4; T++)
      c.push(l["abd" + ni.legs[T]]),
        u.push(l["thigh" + ni.legs[T]]),
        h.push(l["shin" + ni.legs[T]]);
    let f = s.mats.label("H-" + String(n + 3).padStart(2, "0"), {
        color: "black",
        font: "stencil",
        distress: 0.3,
      }),
      p = 0.2,
      d = Math.min(0.085, p / (f.aspect || 3)),
      v = new rn(p, d);
    v.rotateY(Math.PI / 2), v.translate(0.1675, 0.03, -0.085);
    let g = new rn(p, d);
    g.rotateY(-Math.PI / 2), g.translate(-0.1675, 0.03, -0.085);
    let x = i.mergeSimple([v, g]),
      y = new Qe(x, f.material);
    (y.castShadow = !1), (y.receiveShadow = !0), l.body.add(y);
    let b = [0, 1, 2, 3].map(() => ({
        p: new W(),
        from: new W(),
        to: new W(),
        slide: new W(),
      })),
      m = {
        id: 0,
        type: "hound",
        pos: a.group.position,
        alive: !1,
        hp: Gt.hp,
        active: !1,
        rig: a,
        lens: r,
        feet: b,
        yaw: 0,
        speed: 0,
        yawRate: 0,
        home: new W(),
        lastKnown: new W(),
        goal: new W(),
        firePos: new W(),
        firePlayer: new W(),
        sensor: new W(),
        fwd: new W(0, 0, 1),
        muzzle: new W(),
        headPos: new W(),
        push: new W(),
        mode: "patrol",
        los: !1,
        seeT: 0,
        noSeeT: 0,
        senseT: 0,
        exposure: 0,
        modeT: 0,
        passive: !1,
        hasToken: !1,
        es: "move",
        esT: 0,
        cool: 1,
        shots: 0,
        bursts: 0,
        lungeCd: 0,
        path: null,
        wp: 0,
        planT: 0,
        hasGoal: !1,
        waitT: 0,
        moveT: 0,
        stuckT: 0,
        sw: -1,
        swT: 0,
        swDur: 0.2,
        lastPair: 1,
        idleT: 0,
        lift: 0.08,
        sY: { x: 0, v: 0 },
        sP: { x: 0, v: 0 },
        sR: { x: 0, v: 0 },
        sL: { x: 0, v: 0 },
        sA: { x: 0, v: 0 },
        sA2: { x: 0, v: 0 },
        crouch: 0,
        tyaw: 0,
        tpitch: 0,
        hyaw: 0,
        hpitch: 0,
        flare: 0,
        lensC: [_m[0], _m[1], _m[2]],
        smokeT: 0,
        phase: 0,
        scan: 0,
        dieT: 0,
        vy: 0,
        dieRoll: 0,
        diePitch: 0,
        wreck: !1,
        sink: 0,
        loop: null,
        prevSpeed: 0,
        maxSpeed: Gt.patrolSpeed,
        damage(T, D, C, G) {
          if (!m.alive) return !1;
          let dmg = T;
          if (m.shieldHp > 0 && C) {
            let sfx = Math.sin(m.yaw), sfz = Math.cos(m.yaw);
            if (C.x * sfx + C.z * sfz < -0.25) {
              dmg *= G === "weak" ? 0.35 : 0.15;
              m.shieldHp -= T * (G === "weak" ? 0.7 : 0.9);
              m.shieldFlash = 0.12;
              try { s.events.emit("sx:shield-hit", { enemy: m, point: D }); } catch (e) {}
              if (m.shieldHp <= 0) {
                m.shieldHp = 0;
                if (m.shieldMesh) m.shieldMesh.visible = !1;
                try { s.events.emit("sx:shield-break", { enemy: m }); } catch (e) {}
              }
            }
          }
          if (
            ((m.hp -= dmg),
            s.events.emit("enemy:hit", {
              enemy: m,
              point: D,
              part: G || "body",
            }),
            C)
          ) {
            let j = Math.cos(m.yaw),
              N = Math.sin(m.yaw),
              Q = Math.min(1.6, T / 28),
              K = C.x * N + C.z * j,
              ie = C.x * j - C.z * N;
            (m.sL.v += ie * 1.4 * Q),
              (m.sR.v += -ie * 3.2 * Q),
              (m.sP.v += K * 2.4 * Q * (G === "weak" ? 1.6 : 1)),
              (m.sY.v -= 0.5 * Q);
          }
          return i.provoke(m), m.hp <= 0 ? (q(C), !0) : !1;
        },
        _activate(T, D = {}) {
          (m.active = !0),
            (m.alive = !0),
            (m.wreck = !1),
            (m.hp = Gt.hp),
            (m.passive = !!D.passive),
            (m.sink = 0),
            m.pos.copy(T),
            (m.pos.y = s.physics.groundHeight(T.x, T.z, T.y + 1)),
            m.home.copy(m.pos),
            (m.yaw = D.yaw ?? o() * 6.283),
            (m.speed = 0),
            (m.yawRate = 0),
            m.push.set(0, 0, 0),
            (m.mode = D.state === "alert" ? "investigate" : "patrol"),
            (m.modeT = 10),
            (m.modeSeen = m.mode),
            m.lastKnown.copy(D.target || (s.player ? s.player.pos : T)),
            (m.los = !1),
            (m.seeT = m.noSeeT = 0),
            (m.exposure = 0),
            (m.senseT = o() * 0.2),
            (m.hasToken = !1),
            (m.patrolR = D.patrolRadius ?? 7),
            (m.patrolLine = D.patrolLine || null),
            (m.patrolI = 0),
            (m.es = "move"),
            (m.cool = 0.6 + o()),
            (m.lungeCd = 0.3),
            (m.path = null),
            (m.hasGoal = !1),
            (m.waitT = o() * 1.5),
            (m.planT = 0),
            (m.sw = -1),
            (m.idleT = 0),
            (m.crouch = 0),
            (m.feelT = 0),
            (m.blocked = !1),
            (m.flare = 0),
            (m.phase = o() * 6.283),
            (m.dieT = 0),
            (m.tyaw = m.hyaw = 0),
            (m.tpitch = m.hpitch = 0);
          for (let C of [m.sY, m.sP, m.sR, m.sL, m.sA, m.sA2])
            (C.x = 0), (C.v = 0);
          for (let C = 0; C < 4; C++) A(b[C].p, C, m.pos.x, m.pos.z, m.yaw);
          if (
            (l.neck.rotation.set(0, 0, 0),
            l.gun.rotation.set(0, 0, 0),
            (a.group.visible = !0),
            O(0.016),
            s.audio && s.audio.loop && !m.loop)
          )
            try {
              m.loop = s.audio.loop("hound_servo", { pos: m.pos, gain: 0 });
            } catch {
              m.loop = null;
            }
        },
        _deactivate() {
          if (
            ((m.active = !1),
            (m.alive = !1),
            (m.wreck = !1),
            (a.group.visible = !1),
            i.releaseToken(m),
            m.loop)
          ) {
            try {
              m.loop.stop();
            } catch {}
            m.loop = null;
          }
        },
        _raycast(T, D, C, G) {
          let j = !1,
            sc = m.hitScale || 1;
          sM(T, D, m.headPos, 0.155 * sc, C, G) &&
            ((G.part = "weak"), (G.enemy = m), (j = !0));
          let N = Math.cos(m.yaw),
            Q = Math.sin(m.yaw),
            K = m.pos.y + ni.stand + m.sY.x - m.crouch;
          return (
            ps.set(m.pos.x - Q * 0.45 * sc, K + 0.03, m.pos.z - N * 0.45 * sc),
            ru.set(m.pos.x + Q * 0.47 * sc, K + 0.03, m.pos.z + N * 0.47 * sc),
            nM(T, D, ps, ru, 0.27 * sc, C, G) &&
              ((G.part = "body"), (G.enemy = m), (j = !0)),
            (ps.y = ru.y = m.pos.y + (K - m.pos.y) * 0.45),
            nM(T, D, ps, ru, 0.25 * sc, C, G) &&
              ((G.part = "body"), (G.enemy = m), (j = !0)),
            j
          );
        },
        _update(T) {
          m.alive ? S(T) : U(T);
        },
      };
    function A(T, D, C, G, j) {
      let N = ni.side[D] * ni.footX,
        Q = ni.footZ[D],
        K = Math.cos(j),
        ie = Math.sin(j);
      return T.set(C + N * K + Q * ie, 0, G - N * ie + Q * K), T;
    }
    function _(T, D) {
      if (m.fixed) {
        (m.hasGoal = !1), (m.maxSpeed = 0), (m.path = null);
        return;
      }
      (!D && m.hasGoal && m.goal.distanceToSquared(T) < 0.25) ||
        (m.goal.copy(T), (m.hasGoal = !0), (m.planT = 0), (m.stuckT = 0));
    }
    function M() {
      m.planT = Gt.replan + o() * 0.15;
      let T = null;
      try {
        T = s.physics.nav.findPath(m.pos, m.goal);
      } catch {
        T = null;
      }
      (m.path = T && T.length ? T : null),
        (m.wp = 0),
        m.path &&
          m.path.length > 1 &&
          m.path[0].distanceToSquared(m.pos) < 0.36 &&
          (m.wp = 1);
    }
    function E(T, D) {
      if (!m.hasGoal) return (m.maxSpeed = 0), !0;
      (m.planT -= T), m.planT <= 0 && M();
      let C = m.goal;
      if (m.path) {
        for (
          ;
          m.wp < m.path.length - 1 &&
          Math.hypot(m.path[m.wp].x - m.pos.x, m.path[m.wp].z - m.pos.z) < 0.55;

        )
          m.wp++;
        C = m.path[Math.min(m.wp, m.path.length - 1)];
      }
      let G = m.goal.x - m.pos.x,
        j = m.goal.z - m.pos.z,
        N = Math.hypot(G, j);
      if (N < 0.45) return (m.hasGoal = !1), (m.maxSpeed = 0), !0;
      let Q = C.x - m.pos.x,
        K = C.z - m.pos.z;
      m.wantYaw = Math.atan2(Q, K);
      let ie = Math.abs(Mm(m.wantYaw, m.yaw));
      return (
        (m.maxSpeed =
          ie > 1.1 ? 0 : Math.min(D * (1 - ie * 0.5), 0.4 + N * 2.6)),
        !1
      );
    }
    function w() {
      let T = s.player;
      if (!T) return;
      let D = 1 / 0,
        C = T.eye || T.pos,
        G = (Q, K) => {
          let ie = Math.hypot(Q.x - T.pos.x, Q.z - T.pos.z);
          if (
            ie < (m.rangeMin || Gt.rangeMin) ||
            ie > (m.rangeMax || Gt.rangeMax) ||
            (s.physics.nav.isWalkable && !s.physics.nav.isWalkable(Q.x, Q.z))
          )
            return;
          let F = Math.hypot(Q.x - m.pos.x, Q.z - m.pos.z) * 0.9 + K + o() * 3,
            X = Q.x - T.pos.x,
            ne = Q.z - T.pos.z;
          for (let re of i.list) {
            if (
              re === m ||
              !re.alive ||
              re.type !== "hound" ||
              re.mode !== "engage"
            )
              continue;
            let $ = re.es === "move" ? re.firePos : re.pos,
              ue = $.x - T.pos.x,
              me = $.z - T.pos.z,
              ee =
                (X * ue + ne * me) /
                (Math.hypot(X, ne) * Math.hypot(ue, me) + 1e-4);
            ee > 0.86 && (F += (14 * (ee - 0.86)) / 0.14),
              Math.hypot(Q.x - $.x, Q.z - $.z) < 3 && (F += 16);
          }
          F >= D ||
            (Vf.set(Q.x, Q.y + 0.95, Q.z),
            s.physics.lineOfSight(Vf, C) || (F += 22),
            F < D && ((D = F), m.firePos.set(Q.x, Q.y, Q.z)));
        },
        j = s.level && s.level.coverPoints;
      if (j) for (let Q = 0; Q < j.length; Q++) G(j[Q], -2);
      for (let Q = 0; Q < 7; Q++) {
        let K = s.physics.nav.randomPoint(T.pos, m.rangeMax || Gt.rangeMax);
        K && G(K, 0);
      }
      let N = Math.atan2(m.pos.z - T.pos.z, m.pos.x - T.pos.x);
      for (let Q = 0; Q < 5; Q++) {
        let K = N + (o() - 0.5) * 2.6,
          ie = (m.rangeMin || Gt.rangeMin) + 1 + o() * ((m.rangeMax || Gt.rangeMax) - (m.rangeMin || Gt.rangeMin) - 2);
        Io.set(T.pos.x + Math.cos(K) * ie, T.pos.y, T.pos.z + Math.sin(K) * ie),
          (Io.y = s.physics.groundHeight(Io.x, Io.z, T.pos.y + 1)),
          G(Io, 1);
      }
      D === 1 / 0 && m.firePos.copy(m.pos),
        m.firePlayer.copy(T.pos),
        _(m.firePos, !0),
        (m.es = "move"),
        (m.esT = 0),
        (m.moveT = 0),
        (m.bursts = 0);
    }
    function S(T) {
      let D = s.player,
        C = i.t;
      m.fwd.set(Math.sin(m.yaw), 0, Math.cos(m.yaw)),
        m.sensor.copy(m.headPos),
        i.think(m, T, 0.55),
        m.mode !== m.modeSeen &&
          ((m.modeSeen = m.mode),
          (m.hasGoal = !1),
          (m.path = null),
          (m.waitT = 0),
          m.mode === "engage"
            ? w()
            : (m.es === "tele" || m.es === "burst") &&
              (i.releaseToken(m), (m.es = "move"))),
        (m.wantYaw = m.yaw),
        (m.maxSpeed = 0),
        (m.cool -= T),
        (m.lungeCd -= T);
      if (m.shieldMesh && m.shieldFlash > 0) {
        m.shieldFlash = Math.max(0, m.shieldFlash - T);
        if (m.shieldMesh.material)
          m.shieldMesh.material.emissiveIntensity = 0.6 + m.shieldFlash * 14;
      }
      let G = null,
        j = null,
        N = 0,
        Q = !1,
        K = D ? Math.hypot(D.pos.x - m.pos.x, D.pos.z - m.pos.z) : 1e9;
      if (m.boss && m.alive) {
        m.bossT += T;
        let maxHp = m.maxHp || 1600;
        if (m.bossPhase === 0 && m.hp < maxHp * 0.66) {
          m.bossPhase = 1;
          s.events.emit("sx:boss-phase", { enemy: m, phase: 1 });
          try {
            for (let k = 0; k < 2; k++)
              s.enemies.spawn("drone", new W(m.pos.x + (k ? 3.4 : -3.4), m.pos.y + 4, m.pos.z + 2.2), { state: "alert" });
          } catch (e) {}
        }
        if (m.bossPhase === 1 && m.hp < maxHp * 0.33) {
          m.bossPhase = 2;
          s.events.emit("sx:boss-phase", { enemy: m, phase: 2 });
          try {
            for (let k = 0; k < 2; k++)
              s.enemies.spawn("drone", new W(m.pos.x + (k ? 4.5 : -4.5), m.pos.y + 4, m.pos.z - 2.2), { state: "alert" });
          } catch (e) {}
        }
        m.volleyCd -= T;
        if (m.volleyCd <= 0 && m.los && D && D.alive) {
          m.volleyCd = m.bossPhase >= 2 ? 4.6 : 6.4;
          let bx = D.pos.x - m.muzzle.x,
            by = D.pos.y + 1 - m.muzzle.y,
            bz = D.pos.z - m.muzzle.z,
            bl = Math.hypot(bx, by, bz) || 1;
          (bx /= bl), (by /= bl), (bz /= bl);
          for (let k = -1; k <= 1; k++) {
            let ang = k * 0.075,
              cx = Math.cos(ang),
              sx = Math.sin(ang),
              dx = bx * cx - bz * sx,
              dz = bx * sx + bz * cx,
              dir = new W(dx, by, dz);
            try {
              s.combat.enemyShot(m.muzzle, dir, { damage: 12, range: 200 });
              s.fx.tracer(m.muzzle, new W(m.muzzle.x + dx * 40, m.muzzle.y + by * 40, m.muzzle.z + dz * 40), {
                color: 16733440,
                speed: 320,
                width: 0.06,
              });
            } catch (e) {}
          }
          s.events.emit("enemy:fire", { enemy: m, pos: m.muzzle, type: "hound" });
        }
        m.stompCd -= T;
        if (K < 4.2 && m.stompCd <= 0 && D && D.alive) {
          m.stompCd = 4.4;
          try {
            D.damage(18, m.pos);
            D.addShake(0.55);
          } catch (e) {}
          s.events.emit("enemy:melee", { enemy: m, pos: m.pos });
        }
      }
      if (m.fixed) {
        if (D && D.alive && m.los) {
          (m.mode = "engage"), (m.noSeeT = 0), (m.seeT = 3);
        }
        if (m.es === "move" || m.es === "patrol" || m.es === "investigate") {
          (m.es = "aim"), (m.esT = 0), (m.moveT = 0);
        }
        (m.hasGoal = !1), (m.maxSpeed = 0);
      }
      if (m.mode === "patrol") {
        if (m.hasGoal) E(T, Gt.patrolSpeed) && (m.waitT = 1.5 + o() * 3);
        else if (((m.waitT -= T), m.waitT <= 0))
          if (m.patrolLine)
            (m.patrolI = (m.patrolI + 1) % m.patrolLine.length),
              _(m.patrolLine[m.patrolI], !0);
          else {
            let I = s.physics.nav.randomPoint(m.home, m.patrolR);
            I ? _(I, !0) : (m.waitT = 1);
          }
      } else if (m.mode === "investigate" || m.mode === "search") {
        j = m.lastKnown;
        let I = Math.hypot(m.lastKnown.x - m.pos.x, m.lastKnown.z - m.pos.z);
        I > 2.2
          ? (_(m.lastKnown), E(T, I < 8 ? Gt.stalkSpeed : Gt.runSpeed))
          : ((m.hasGoal = !1),
            (m.scan += T),
            (m.wantYaw = m.yaw + Math.sin(m.scan * 0.8) * 0.9),
            (j = null));
      } else if (D) {
        (G = D.pos), (j = D.pos);
        let I = Math.atan2(D.pos.x - m.pos.x, D.pos.z - m.pos.z);
        switch (
          ((m.es === "move" || m.es === "aim" || m.es === "cool") &&
            K < Gt.lungeRange &&
            m.lungeCd <= 0 &&
            D.alive &&
            ((m.es = "wind"),
            (m.esT = 0.28),
            i.releaseToken(m),
            s.events.emit("enemy:telegraph", {
              enemy: m,
              type: "hound",
              time: 0.28,
              pos: m.pos,
              melee: !0,
            })),
          m.es)
        ) {
          case "move": {
            m.moveT += T;
            let se = E(T, m.runSpeed || Gt.runSpeed),
              ae = K > (m.rangeMin || Gt.rangeMin) - 1 && K < (m.rangeMax || Gt.rangeMax) + 2;
            se || (m.moveT > 1.4 && m.los && ae && o() < T * 0.7) || m.moveT > 7
              ? ((m.es = "aim"), (m.esT = 0), (m.hasGoal = !1))
              : D.pos.distanceToSquared(m.firePlayer) > 49 && w();
            break;
          }
          case "aim":
          case "cool": {
            (m.wantYaw = I),
              (m.esT += T),
              (m.elite || m.laser) &&
                m.los &&
                D &&
                D.alive &&
                !m.boss &&
                (() => {
                  m.laserT = (m.laserT || 0) - T;
                  if (m.laserT > 0) return;
                  m.laserT = 0.055;
                  try {
                    s.fx.tracer(m.muzzle, D.eye, {
                      color: 16724736,
                      speed: 3200,
                      width: 0.005,
                      trail: false,
                      intensity: 7,
                    });
                  } catch (e) {}
                })(),
              m.los
                ? K < (m.rangeMin || Gt.rangeMin) - 3 && m.esT > 0.8
                  ? w()
                  : m.cool <= 0 &&
                    D.alive &&
                    Math.abs(Mm(I - m.yaw, m.tyaw)) < 0.14 &&
                    i.requestToken(m) &&
                    ((m.es = "tele"),
                    (m.esT = m.telegraph || (m.elite ? 1.0 : Gt.telegraph)),
                    s.events.emit("enemy:telegraph", {
                      enemy: m,
                      type: "hound",
                      time: m.telegraph || (m.elite ? 1.0 : Gt.telegraph),
                      pos: m.pos,
                    }))
                : (m.noSeeT > 1.1 || m.esT > 3) && w();
            break;
          }
          case "tele": {
            (m.wantYaw = I),
              (m.esT -= T),
              (m.flare = Math.min(1, m.flare + T * 5)),
              (N = 0.05),
              m.esT <= 0 &&
                ((m.es = "burst"), (m.shots = m.burstCount || (m.boss ? 3 : m.elite ? 1 : Gt.burst)), (m.esT = 0));
            break;
          }
          case "burst": {
            (m.wantYaw = I),
              (m.esT -= T),
              (m.flare = 1),
              (N = 0.05),
              m.esT <= 0 && ((m.esT = Gt.burstGap), m.shots--, z(D)),
              m.shots <= 0 &&
                (i.releaseToken(m),
                (m.cool =
                  (Gt.cooldown[0] + o() * (Gt.cooldown[1] - Gt.cooldown[0])) *
                  (m.coolMul || (m.boss ? 0.68 : m.elite ? 1.25 : 1))),
                m.bursts++,
                m.bursts >= 1 + (o() < 0.4 ? 1 : 0)
                  ? w()
                  : ((m.es = "cool"), (m.esT = 0)));
            break;
          }
          case "wind": {
            (m.wantYaw = I),
              (m.esT -= T),
              (N = 0.16),
              (m.sP.v += 3 * T),
              m.esT <= 0 &&
                ((m.es = "lunge"),
                (m.esT = 0.36),
                (m.speed = Gt.lungeSpeed),
                (m.yaw = I));
            break;
          }
          case "lunge": {
            (Q = !0),
              (m.esT -= T),
              (m.wantYaw = I),
              (m.maxSpeed = Gt.lungeSpeed),
              (m.speed = Gt.lungeSpeed),
              K < 1.35 &&
                D.alive &&
                (D.damage(m.lungeDamage || Gt.lungeDamage, m.pos),
                s.events.emit("enemy:melee", { enemy: m, pos: m.pos }),
                (m.esT = 0),
                (m.sP.v -= 4)),
              m.esT <= 0 &&
                ((m.es = "recover"),
                (m.esT = 0.55),
                (m.lungeCd = Gt.lungeCooldown),
                (m.speed *= 0.3));
            break;
          }
          case "recover": {
            (m.esT -= T), (m.wantYaw = I), m.esT <= 0 && w();
            break;
          }
        }
      }
      let ie = Mm(m.wantYaw, m.yaw),
        F = uo(ie * 6, -Gt.turnRate, Gt.turnRate) * (Q ? 2 : 1);
      (m.yawRate += (F - m.yawRate) * (1 - Math.exp(-10 * T))),
        (m.yaw += m.yawRate * T);
      let X = m.maxSpeed > m.speed ? Gt.accel : -Gt.accel * 1.4;
      (m.prevSpeed = m.speed),
        (m.speed = Q
          ? m.speed
          : uo(m.speed + X * T, 0, Math.max(m.maxSpeed, 0))),
        !Q && X < 0 && m.speed < m.maxSpeed && (m.speed = m.maxSpeed);
      let ne = Math.sin(m.yaw),
        re = Math.cos(m.yaw);
      for (let I of i.list) {
        if (I === m || I.type !== "hound" || !I.active) continue;
        let se = m.pos.x - I.pos.x,
          ae = m.pos.z - I.pos.z,
          k = Math.hypot(se, ae);
        if (k < 1.7 && k > 0.001) {
          let ce = ((1.7 - k) * 2.2) / k;
          (m.push.x += se * ce * T * 6), (m.push.z += ae * ce * T * 6);
        }
      }
      if (D && !Q && K < 1.25 && K > 0.001) {
        let I = ((1.25 - K) * 3) / K;
        (m.push.x += (m.pos.x - D.pos.x) * I * T * 6),
          (m.push.z += (m.pos.z - D.pos.z) * I * T * 6);
      }
      m.push.multiplyScalar(Math.exp(-5 * T));
      let $ = m.pos.x + (ne * m.speed + m.push.x) * T,
        ue = m.pos.z + (re * m.speed + m.push.z) * T,
        me = s.physics.nav;
      if (((m.feelT -= T), m.feelT <= 0 && m.speed > 0.3)) {
        (m.feelT = 0.12),
          Io.set(m.pos.x, m.pos.y + 0.55, m.pos.z),
          Po.set(ne, 0, re);
        let I = s.physics.raycast(Io, Po, 0.75 + m.speed * 0.12);
        m.blocked = !!I;
      } else m.speed <= 0.3 && (m.blocked = !1);
      ((me.isWalkable && !me.isWalkable($, ue)) ||
        (m.blocked && !Q) ||
        (m.blocked && Q && m.esT < 0.3)) &&
        (m.blocked
          ? (($ = m.pos.x + m.push.x * T),
            (ue = m.pos.z + m.push.z * T),
            (m.yawRate += (m.phase > 3.14 ? 1 : -1) * 4 * T))
          : me.isWalkable($, m.pos.z)
            ? (ue = m.pos.z)
            : me.isWalkable(m.pos.x, ue)
              ? ($ = m.pos.x)
              : (($ = m.pos.x), (ue = m.pos.z)),
        (m.speed *= 0.6),
        (m.stuckT += T),
        m.stuckT > 0.5 &&
          ((m.stuckT = 0),
          (m.planT = 0),
          m.mode === "engage" && m.es === "move"
            ? w()
            : m.mode === "patrol" && (m.hasGoal = !1))),
        (m.pos.x = $),
        (m.pos.z = ue),
        (m.pos.y +=
          (s.physics.groundHeight($, ue, m.pos.y + 0.6) - m.pos.y) *
          (1 - Math.exp(-12 * T))),
        H(T),
        (m.crouch += (N - m.crouch) * (1 - Math.exp(-12 * T)));
      let ee = Math.cos(m.yaw),
        B = Math.sin(m.yaw),
        P = 0,
        V = 0,
        Y = 0,
        L = 0.05,
        Z = m.pos.y + ni.stand + m.sY.x - m.crouch;
      if (G) {
        let I = G.x - m.pos.x,
          se = G.z - m.pos.z,
          ae = G.y + 1 - (Z + 0.25);
        (P = Math.atan2(I * ee - se * B, I * B + se * ee)),
          (V = uo(Math.atan2(-ae, Math.hypot(I, se)), -0.9, 0.35));
      } else (m.scan += T * 0.5), (P = Math.sin(m.scan * 0.9 + m.phase) * 1.1);
      if (j) {
        let I = j.x - m.pos.x,
          se = j.z - m.pos.z,
          ae = j.y + 1.2 - (Z + 0.2);
        (Y = uo(Math.atan2(I * ee - se * B, I * B + se * ee), -1.2, 1.2)),
          (L = uo(Math.atan2(-ae, Math.hypot(I, se)), -0.6, 0.5));
      } else
        Y =
          Math.sin(i.t * 0.7 + m.phase) * 0.5 + uo(m.yawRate * 0.25, -0.6, 0.6);
      let J = uo(4.5 * T, 0, 1);
      (m.tyaw += uo(Mm(P, m.tyaw), -J, J)),
        (m.tpitch += (V - m.tpitch) * (1 - Math.exp(-10 * T)));
      let oe = 1 - Math.exp(-7 * T);
      (m.hyaw += (Y - m.hyaw) * oe), (m.hpitch += (L - m.hpitch) * oe), O(T);
      let fe = (i.t * (m.mode === "patrol" ? 0.8 : 2.2) + m.phase) % 1;
      l.beacon.scale.setScalar(fe < 0.12 || (fe > 0.22 && fe < 0.3) ? 1 : 1e-4);
      let le = m.mode === "engage" ? NC : _m,
        R = 1 + m.flare * 3.5;
      for (let I = 0; I < 3; I++)
        m.lensC[I] += (le[I] - m.lensC[I]) * (1 - Math.exp(-8 * T));
      r.color.setRGB(m.lensC[0] * R, m.lensC[1] * R, m.lensC[2] * R),
        (m.flare = Math.max(0, m.flare - T * 2)),
        m.hp < Gt.hp * Gt.smokeBelow &&
          ((m.smokeT -= T),
          m.smokeT <= 0 &&
            ((m.smokeT = 0.2),
            ps.set(m.pos.x - ne * 0.3, Z + 0.2, m.pos.z - re * 0.3),
            s.fx.smoke(ps, {
              size: 0.35,
              life: 1.3,
              color: 2303272,
              rise: 0.9,
            }),
            o() < 0.2 && s.fx.sparks(ps, jv, 3))),
        m.loop &&
          (m.loop.setPos(m.pos),
          m.loop.setGain(
            uo(0.12 + m.speed * 0.12 + Math.abs(m.yawRate) * 0.1, 0, 0.8),
          ),
          m.loop.setPitch(0.8 + m.speed * 0.08));
    }
    function z(T) {
      let D = Math.cos(m.yaw + m.tyaw),
        C = Math.sin(m.yaw + m.tyaw);
      Io.setFromMatrixPosition(l.gun.matrixWorld),
        (Io.lengthSq() < 1e-6 || Math.abs(Io.x - m.pos.x) > 2) &&
          Io.set(m.pos.x, m.pos.y + ni.stand + 0.25, m.pos.z),
        Vf.set(T.pos.x, T.pos.y + 1, T.pos.z),
        Po.copy(Vf).sub(Io).normalize(),
        m.muzzle.copy(Io).addScaledVector(Po, 0.43);
      let G =
        (Gt.spreadFar + (Gt.spreadNear - Gt.spreadFar) * m.exposure) *
        (1 + i.playerSpeed * 0.3) *
        (m.spreadMul || (m.boss ? 0.8 : m.elite ? 0.45 : 1));
      (Po.x += (o() - 0.5) * 2 * G),
        (Po.y += (o() - 0.5) * 2 * G),
        (Po.z += (o() - 0.5) * 2 * G),
        Po.normalize();
      let j = s.physics.raycast(m.muzzle, Po, 200),
        Q = s.combat.enemyShot(m.muzzle, Po, {
          damage: m.shotDamage || (m.boss ? 13 : m.elite ? 26 : Gt.shotDamage),
          range: 240,
        })
          ? m.muzzle.distanceTo(Vf)
          : j
            ? j.dist
            : 90;
      eM.copy(m.muzzle).addScaledVector(Po, Q),
        s.fx.tracer(m.muzzle, eM, {
          color: 16760944,
          speed: 260,
          width: 0.035,
        }),
        s.fx.muzzleFlash(m.muzzle, Po, { scale: 0.9 }),
        s.render &&
          s.render.lightPool &&
          s.render.lightPool.flash(m.muzzle, 16756832, 22, 7, 0.05),
        s.events.emit("enemy:fire", {
          enemy: m,
          pos: m.muzzle,
          dir: Po,
          type: "hound",
        }),
        (m.sP.v += 1.1),
        (m.sY.v -= 0.25);
    }
    function H(T) {
      let D = Math.sin(m.yaw) * m.speed + m.push.x,
        C = Math.cos(m.yaw) * m.speed + m.push.z,
        G = m.speed > 0.15 || Math.abs(m.yawRate) > 0.25;
      if (m.sw < 0) {
        m.idleT = G ? 0 : m.idleT + T;
        let j = m.speed + Math.abs(m.yawRate) * 0.5,
          N = uo(0.27 - j * 0.026, 0.14, 0.27),
          Q = -1,
          K = 0;
        for (let F = 0; F < 2; F++) {
          let X = 0;
          for (let ne of wm[F]) {
            A(ps, ne, m.pos.x + D * N, m.pos.z + C * N, m.yaw + m.yawRate * N);
            let re = Math.hypot(ps.x - b[ne].p.x, ps.z - b[ne].p.z);
            re > X && (X = re);
          }
          F !== m.lastPair && (X *= 1.25), X > K && ((K = X), (Q = F));
        }
        let ie = G ? 0.09 : m.idleT > 0.25 ? 0.035 : 1e9;
        if (Q >= 0 && K > ie) {
          (m.sw = Q),
            (m.swT = 0),
            (m.swDur = N),
            (m.lift = 0.065 + Math.min(0.09, j * 0.02));
          for (let F of wm[Q]) {
            let X = b[F];
            X.from.copy(X.p),
              A(
                X.to,
                F,
                m.pos.x + D * N * 1.5,
                m.pos.z + C * N * 1.5,
                m.yaw + m.yawRate * N * 1.5,
              ),
              (X.to.y = s.physics.groundHeight(X.to.x, X.to.z, m.pos.y + 0.6));
          }
        }
      } else {
        m.swT += T / m.swDur;
        let j = m.swT >= 1 ? 1 : m.swT,
          N = j * j * (3 - 2 * j);
        for (let Q of wm[m.sw]) {
          let K = b[Q];
          K.p.lerpVectors(K.from, K.to, N),
            (K.p.y += Math.sin(Math.PI * j) * m.lift);
        }
        if (m.swT >= 1) {
          let Q = b[wm[m.sw][0]];
          s.events.emit("enemy:step", {
            pos: Q.p,
            type: "hound",
            enemy: m,
            speed: m.speed,
          }),
            (m.sY.v -= 0.12 + m.speed * 0.03),
            (m.lastPair = m.sw),
            (m.sw = -1);
        }
      }
    }
    function O(T) {
      let D = Math.cos(m.yaw),
        C = Math.sin(m.yaw),
        G = (b[0].p.y + b[1].p.y) * 0.5,
        j = (b[2].p.y + b[3].p.y) * 0.5,
        N = (b[0].p.y + b[2].p.y) * 0.5,
        Q = (b[1].p.y + b[3].p.y) * 0.5,
        K = (G + j) * 0.5 - m.pos.y,
        ie = T > 0 ? (m.speed - m.prevSpeed) / T : 0,
        F = Math.atan2(j - G, 0.8) * 0.6 + uo(ie * 0.006, -0.07, 0.07),
        X =
          Math.atan2(N - Q, 0.55) * 0.6 +
          uo(m.yawRate * m.speed * 0.02, -0.12, 0.12),
        ne = K * 0.45 - Math.min(0.05, m.speed * 0.011);
      m.alive || ((F = m.diePitch), (X = m.dieRoll), (ne = 0)),
        m.alive &&
          (xa(m.sY, ne, 160, 17, T),
          xa(m.sP, F, 130, 15, T),
          xa(m.sR, X, 130, 15, T),
          xa(m.sL, 0, 110, 13, T));
      let re = m.alive ? Math.sin(i.t * 1.7 + m.phase) * 0.004 : 0,
        $ = m.sL.x,
        ue = ni.stand + m.sY.x - m.crouch + re,
        me = m.sP.x,
        ee = m.sR.x;
      (a.group.rotation.y = m.yaw),
        l.body.position.set($, ue, 0),
        l.body.rotation.set(me, 0, ee),
        (l.turret.rotation.y = m.tyaw),
        (l.gun.rotation.x = m.tpitch - me * 0.5),
        l.head.rotation.set(m.hpitch, m.hyaw, 0),
        xa(m.sA, uo(-ie * 0.03 - me, -0.6, 0.6), 60, 5, T),
        xa(m.sA2, uo(m.yawRate * 0.12 - ee, -0.6, 0.6), 60, 5, T),
        l.antenna.rotation.set(m.sA.x, 0, m.sA2.x);
      let B = Math.cos(me),
        P = Math.sin(me),
        V = Math.cos(ee),
        Y = Math.sin(ee);
      for (let L = 0; L < 4; L++) {
        let Z = b[L].p,
          J = Z.x - m.pos.x,
          oe = Z.y + ni.footR * 0.6 - m.pos.y,
          fe = Z.z - m.pos.z,
          le = J * D - fe * C - $,
          R = oe - ue,
          I = J * C + fe * D,
          se = R * B + I * P,
          ae = -R * P + I * B,
          k = le * V + se * Y,
          ce = -le * Y + se * V;
        q_(
          bm,
          k - ni.side[L] * ni.hipX,
          ce - ni.hipY,
          ae - ni.fore[L] * ni.hipZ,
          ni.side[L],
          ni.l0,
          ni.L1,
          ni.L2 - ni.footR * 0.6,
        ),
          (c[L].rotation.z = bm.abd),
          (u[L].rotation.x = bm.hip),
          (h[L].rotation.x = bm.knee);
      }
      a.group.updateMatrixWorld(!0),
        m.headPos.setFromMatrixPosition(l.head.matrixWorld);
    }
    function q(T) {
      (m.alive = !1),
        i.releaseToken(m),
        (m.dieT = 0),
        (m.vy = 0),
        (m.es = "move"),
        l.beacon.scale.setScalar(1e-4),
        (m.dieRoll = (o() < 0.5 ? -1 : 1) * (0.25 + o() * 0.3)),
        (m.diePitch = (o() - 0.5) * 0.25),
        (m.sR.v += m.dieRoll * 3),
        (m.sP.v += (o() - 0.5) * 2);
      for (let D = 0; D < 4; D++) {
        let C = b[D];
        m.sw >= 0 && (C.p.y = m.pos.y);
        let G = m.yaw,
          j = ni.side[D] * (0.16 + o() * 0.2),
          N = ni.fore[D] * (0.05 + o() * 0.22) + (o() - 0.5) * 0.1;
        C.slide.set(
          j * Math.cos(G) + N * Math.sin(G),
          0,
          -j * Math.sin(G) + N * Math.cos(G),
        );
      }
      (m.sw = -1),
        (m.speed *= 0.3),
        ps.copy(m.headPos),
        s.fx.sparks(ps, jv, 16),
        s.fx.debris(ps, { count: 4 }),
        s.events.emit("enemy:killed", { enemy: m, pos: m.pos, type: "hound" }),
        i.addWreck(m);
    }
    function U(T) {
      if (m.sink > 0) {
        (m.sink += T), (m.pos.y -= 0.22 * T), m.sink > 3.2 && i.retire(m);
        return;
      }
      m.dieT += T;
      let D = m.dieT;
      if (D < 2.2) {
        let C = 0.215 - ni.stand;
        (m.vy -= 9.8 * T * (D < 0.12 ? 0.3 : 1)),
          (m.sY.x += m.vy * T),
          m.sY.x < C &&
            ((m.sY.x = C),
            m.vy < -1.2 &&
              (s.events.emit("enemy:step", {
                pos: m.pos,
                type: "hound",
                enemy: m,
                speed: 5,
                crash: !0,
              }),
              s.fx.dust(m.pos, jv)),
            (m.vy = -m.vy * 0.22)),
          xa(m.sP, m.diePitch, 60, 9, T),
          xa(m.sR, m.dieRoll, 60, 9, T),
          xa(m.sL, 0, 40, 8, T);
        let G = Math.exp(-3.2 * T);
        for (let N = 0; N < 4; N++) {
          let Q = b[N];
          (Q.p.x += Q.slide.x * (1 - G)),
            (Q.p.z += Q.slide.z * (1 - G)),
            Q.slide.multiplyScalar(G);
        }
        (m.pos.x += Math.sin(m.yaw) * m.speed * T),
          (m.pos.z += Math.cos(m.yaw) * m.speed * T),
          (m.speed *= Math.exp(-5 * T)),
          (m.hpitch += (0.55 - m.hpitch) * (1 - Math.exp(-5 * T))),
          (m.hyaw += (m.dieRoll - m.hyaw) * (1 - Math.exp(-3 * T))),
          (m.tpitch += (0.3 - m.tpitch) * (1 - Math.exp(-4 * T)));
        let j = D < 1.2 ? (Math.sin(D * 60) > 0.2 ? 1 - D / 1.2 : 0.05) : 0.02;
        r.color.setRGB(6 * j + 0.05, 0.6 * j + 0.01, 0.2 * j), O(T);
      }
      if (D < 6.5)
        (m.smokeT -= T),
          m.smokeT <= 0 &&
            ((m.smokeT = D < 2 ? 0.09 : 0.2),
            ps.set(
              m.pos.x + (o() - 0.5) * 0.4,
              m.pos.y + 0.42,
              m.pos.z + (o() - 0.5) * 0.4,
            ),
            s.fx.smoke(ps, {
              size: 0.5 + o() * 0.3,
              life: 1.8,
              color: 1513499,
              rise: 1.1,
            }),
            D < 4 &&
              o() < 0.55 &&
              (ru.set(o() - 0.5, 1, o() - 0.5).normalize(),
              s.fx.sparks(ps, ru, D < 1 ? 8 : 3)),
            D < 3.5 &&
              o() < 0.4 &&
              s.fx.smoke(ps, {
                size: 0.22,
                life: 0.45,
                color: 16742946,
                rise: 1.6,
              }));
      else if (!m.wreck && ((m.wreck = !0), m.loop)) {
        try {
          m.loop.stop();
        } catch {}
        m.loop = null;
      }
      m.loop && m.loop.setGain(Math.max(0, 0.4 - D * 0.3));
    }
    return m;
  }
  function sM(i, e, t, n, s, o) {
    let r = i.x - t.x,
      a = i.y - t.y,
      l = i.z - t.z,
      c = r * e.x + a * e.y + l * e.z,
      u = r * r + a * a + l * l - n * n,
      h = c * c - u;
    if (h < 0) return !1;
    let f = -c - Math.sqrt(h);
    return f < 0 || f > s || f >= o.dist
      ? !1
      : ((o.dist = f),
        o.point.copy(i).addScaledVector(e, f),
        o.normal.copy(o.point).sub(t).normalize(),
        !0);
  }
  var au = new W(),
    Jv = new W(),
    tM = new W();
  function nM(i, e, t, n, s, o, r) {
    au.copy(n).sub(t), Jv.copy(i).sub(t);
    let a = au.dot(au),
      l = au.dot(e),
      c = au.dot(Jv),
      u = e.dot(Jv),
      h = a - l * l,
      f = h > 1e-8 ? (c - l * u) / h : 0;
    return (
      (f = f < 0 ? 0 : f > 1 ? 1 : f),
      tM.copy(t).addScaledVector(au, f),
      sM(i, e, tM, s, o, r)
    );
  }
  var Ui = {
      gull: Zv,
      hound: Kv,
      sightRange: 45,
      sightCone: 200,
      loseSight: 4,
      searchTime: 8,
      hearRadius: 45,
      maxTokens: 2,
      maxTokensCrowd: 3,
      tokenGap: 1.25,
      exposureUp: 0.1,
      exposureDown: 0.45,
      poolGulls: 10,
      poolHounds: 12,
      maxWrecks: 5,
      maxBolts: 32,
    },
    BC = Math.cos(((Ui.sightCone / 2) * Math.PI) / 180),
    oM = new W(),
    pz = new W(),
    Qv = new W(),
    rM = new Lt(),
    aM = new Ye(),
    lM = new W(1, 1, 1),
    OC = new W(0, 0, 1),
    mz = new W(0, -1, 0),
    cM = new W(),
    uM = new W();
  async function Em(i) {
    let e = il(+((i.params && i.params.eseed) || 9001)),
      t = [],
      n = [],
      s = new wt();
    (s.name = "enemies"), i.scene.add(s);
    let o = i.mats.emissive(16777215, 1),
      r = o && o.isMeshBasicMaterial ? o.clone() : new Nn();
    r.color.setRGB(1, 1, 1), (r.vertexColors = !0), (r.needsUpdate = !0);
    let a = i.mats.emissive(16752704, 6),
      l = a && a.isMeshBasicMaterial ? a : new Nn({ color: 16752704 }),
      c = o && o.toneMapped !== void 0 ? o.toneMapped : !0,
      u = {
        shell: i.mats.get("armor_white", { triplanar: !0, vertexColors: !0 }),
        metal: i.mats.get("gunmetal", { triplanar: !0, vertexColors: !0 }),
        glow: r,
        lensBase: l,
        disc: new Nn({
          color: 789775,
          transparent: !0,
          opacity: 0.42,
          depthWrite: !1,
          side: Sn,
          toneMapped: c,
        }),
        cone: new zn({
          uniforms: {
            uColor: { value: new Ve(1, 0.9, 0.74) },
            uGain: { value: 0.085 },
          },
          vertexShader: `
        #include <common>
        #include <skinning_pars_vertex>
        varying float vT; varying vec3 vN; varying vec3 vV;
        void main() {
          #include <beginnormal_vertex>
          #include <skinbase_vertex>
          #include <skinnormal_vertex>
          #include <begin_vertex>
          #include <skinning_vertex>
          vec4 mv = modelViewMatrix * vec4(transformed, 1.0);
          vN = normalMatrix * objectNormal; vV = -mv.xyz; vT = 1.0 - uv.y;
          gl_Position = projectionMatrix * mv;
        }`,
          fragmentShader: `
        uniform vec3 uColor; uniform float uGain;
        varying float vT; varying vec3 vN; varying vec3 vV;
        void main() {
          float f = abs(dot(normalize(vN), normalize(vV)));
          f = f * f * (3.0 - 2.0 * f);
          float t = clamp(vT, 0.0, 1.0);
          float k = pow(1.0 - t, 1.7) * (0.35 + 0.65 * smoothstep(0.0, 0.06, t));
          gl_FragColor = vec4(uColor * (uGain * f * k), 1.0);
        }`,
          transparent: !0,
          blending: hr,
          depthWrite: !1,
          side: Sn,
          fog: !1,
        }),
      },
      h = {
        G: i,
        rng: e,
        list: t,
        t: 0,
        playerSpeed: 0,
        tokens: 0,
        tokenT: -9,
        lastType: "",
        wantT: { gull: -9, hound: -9 },
        mergeSimple: (T) => sa(T, !1),
        requestToken(T) {
          if (T.hasToken) return !0;
          let D = 0;
          for (let Q of t) Q.alive && D++;
          let C = D > 5 ? Ui.maxTokensCrowd : Ui.maxTokens,
            G = h.t - h.tokenT,
            j = T.type === "gull" ? "hound" : "gull",
            N =
              h.lastType === T.type &&
              h.t - h.wantT[j] < 0.5 &&
              G < Ui.tokenGap * 2.2;
          return h.tokens >= C || G < Ui.tokenGap || N
            ? ((h.wantT[T.type] = h.t), !1)
            : (h.tokens++,
              (h.tokenT = h.t),
              (h.lastType = T.type),
              (T.hasToken = !0),
              !0);
        },
        releaseToken(T) {
          T.hasToken &&
            ((T.hasToken = !1), (h.tokens = Math.max(0, h.tokens - 1)));
        },
        think(T, D, C) {
          let G = i.player;
          if (T.passive || !G) {
            T.los = !1;
            return;
          }
          if (((T.senseT -= D), T.senseT <= 0)) {
            T.senseT = 0.11 + e() * 0.08;
            let j = !1;
            if (G.alive !== !1) {
              let N = G.eye || G.pos,
                Q = N.x - T.sensor.x,
                K = N.y - T.sensor.y,
                ie = N.z - T.sensor.z,
                F = Math.hypot(Q, K, ie);
              if (F < Ui.sightRange) {
                let X = Math.hypot(Q, ie) || 1e-4,
                  ne = (Q * T.fwd.x + ie * T.fwd.z) / X;
                (T.mode === "engage" || ne > BC || F < 3.5) &&
                  (j = i.physics.lineOfSight(T.sensor, N));
              }
            }
            T.los = j;
          }
          T.los
            ? ((T.seeT += D),
              (T.noSeeT = 0),
              T.lastKnown.copy(G.pos),
              (T.exposure = Math.min(1, T.exposure + D * Ui.exposureUp)))
            : ((T.noSeeT += D),
              (T.seeT = Math.max(0, T.seeT - D * 0.6)),
              (T.exposure = Math.max(0, T.exposure - D * Ui.exposureDown))),
            T.mode === "engage"
              ? (T.noSeeT > Ui.loseSight || G.alive === !1) &&
                ((T.mode = "search"),
                (T.modeT = Ui.searchTime + e() * 3),
                h.releaseToken(T))
              : T.los && T.seeT > (T.mode === "patrol" ? C : C * 0.45)
                ? ((T.mode = "engage"),
                  (T.noSeeT = 0),
                  i.events.emit("enemy:alert", { enemy: T }),
                  h.rally(T.pos, 18, G.pos, T))
                : T.mode !== "patrol" &&
                  ((T.modeT -= D),
                  T.modeT <= 0 &&
                    ((T.mode = "patrol"),
                    (T.home.x = T.pos.x),
                    (T.home.z = T.pos.z)));
        },
        rally(T, D, C, G) {
          for (let j of t)
            j === G ||
              !j.alive ||
              j.passive ||
              j.mode === "engage" ||
              j.pos.distanceToSquared(T) > D * D ||
              (j.lastKnown.copy(C),
              (j.mode = "investigate"),
              (j.modeT = 9 + e() * 4));
        },
        provoke(T) {
          let D = i.player;
          !D ||
            T.passive ||
            !T.alive ||
            (T.mode !== "engage" &&
              (T.lastKnown.copy(D.pos),
              (T.mode = "investigate"),
              (T.modeT = 10),
              (T.seeT = 1),
              (T.senseT = 0)),
            h.rally(T.pos, 20, D.pos, T));
        },
        fireBolt(T, D, C) {
          let G = null;
          for (let j = 0; j < g.length; j++)
            if (!g[j].on) {
              G = g[j];
              break;
            }
          G &&
            ((G.on = !0),
            (G.life = 1.3),
            G.pos.copy(T),
            G.dir.copy(D),
            G.from.copy(T),
            (G.len = 0));
        },
        addWreck(T) {
          for (n.push(T); n.length > Ui.maxWrecks; ) {
            let D = n.shift();
            D.active && (D.sink = 0.001);
          }
        },
        retire(T) {
          T._deactivate();
          let D = t.indexOf(T);
          D >= 0 && t.splice(D, 1),
            (D = n.indexOf(T)),
            D >= 0 && n.splice(D, 1);
        },
      },
      f = j_(),
      p = Z_(),
      d = [],
      v = [];
    for (let T = 0; T < Ui.poolGulls; T++) {
      let D = Q_(h, f, u, T);
      d.push(D), s.add(D.rig.group);
    }
    for (let T = 0; T < Ui.poolHounds; T++) {
      let D = iM(h, p, u, T);
      v.push(D), s.add(D.rig.group);
    }
    let g = [];
    for (let T = 0; T < Ui.maxBolts; T++)
      g.push({
        on: !1,
        life: 0,
        len: 0,
        pos: new W(),
        dir: new W(),
        from: new W(),
      });
    let x = new Ys(0.016, 0.03, 1, 6, 1);
    x.rotateX(Math.PI / 2), x.translate(0, 0, -0.5);
    let y = i.mats.emissive(16738858, 14),
      b =
        y && y.isMeshBasicMaterial
          ? y
          : new Nn({ color: new Ve(16738858).multiplyScalar(14) }),
      m = new Sr(x, b, Ui.maxBolts);
    (m.frustumCulled = !1),
      (m.castShadow = !1),
      (m.receiveShadow = !1),
      (m.count = 0),
      m.instanceMatrix.setUsage(bo),
      s.add(m);
    let A = {
      point: new W(),
      normal: new W(),
      dist: 0,
      surface: "concrete",
      enemy: null,
      part: null,
      dir: new W(),
      from: "enemy",
    };
    function _(T) {
      let D = i.player,
        C = 0;
      for (let G = 0; G < g.length; G++) {
        let j = g[G];
        if (!j.on) continue;
        let N = Ui.gull.boltSpeed * T;
        j.life -= T;
        let Q = i.physics.raycast(j.pos, j.dir, N),
          K = Q ? Q.dist : N,
          ie = !1;
        if (
          (D &&
            D.alive !== !1 &&
            (oM.copy(j.pos).addScaledVector(j.dir, K),
            cM.set(D.pos.x, D.pos.y + 0.35, D.pos.z),
            uM.set(D.pos.x, D.pos.y + (D.crouching ? 1 : 1.5), D.pos.z),
            HC(j.pos, oM, cM, uM) < 0.36 * 0.36 && (ie = !0)),
          ie)
        ) {
          D.damage(Ui.gull.boltDamage, j.from), (j.on = !1);
          continue;
        }
        if (Q) {
          A.point.copy(Q.point),
            A.normal.copy(Q.normal),
            (A.dist = Q.dist),
            (A.surface = Q.surface),
            A.dir.copy(j.dir),
            i.events.emit("impact", A),
            (j.on = !1);
          continue;
        }
        if (j.life <= 0) {
          j.on = !1;
          continue;
        }
        j.pos.addScaledVector(j.dir, N),
          (j.len = Math.min(1.5, j.len + N)),
          rM.setFromUnitVectors(OC, j.dir),
          lM.set(1, 1, Math.max(0.2, j.len)),
          aM.compose(j.pos, rM, lM),
          m.setMatrixAt(C++, aM);
      }
      (C || m.count) && ((m.count = C), (m.instanceMatrix.needsUpdate = !0));
    }
    let M = null,
      E = !1,
      w = 0,
      S = new W(),
      z = 0;
    function H(T) {
      if (!E) {
        E = !0;
        try {
          M =
            i.render && i.render.lightPool && i.render.lightPool.acquire
              ? i.render.lightPool.acquire()
              : null;
        } catch {
          M = null;
        }
        M &&
          M.light &&
          (M.light.color.setRGB(1, 0.9, 0.75), (M.light.distance = 9));
      }
      if (!M || !M.light) return;
      let D = null,
        C = 3600,
        G = i.camera ? i.camera.position : null;
      for (let N of t) {
        if (N.type !== "gull" || !N.alive) continue;
        let Q = G ? N.pos.distanceToSquared(G) : 0;
        Q < C && ((C = Q), (D = N));
      }
      let j = 0;
      if (D) {
        if (((w -= T), w <= 0)) {
          w = 0.1;
          let N = D.yaw + D.gy,
            Q = Math.cos(D.gp);
          Qv.set(Math.sin(N) * Q, -Math.sin(D.gp), Math.cos(N) * Q).normalize();
          let K = i.physics.raycast(D.sensor, Qv, 14);
          S.copy(D.sensor).addScaledVector(Qv, (K ? K.dist : 8) - 0.6),
            (z = K ? 1 : 0.3);
        }
        (j = 26 * z), M.light.position.lerp(S, 1 - Math.exp(-12 * T));
      }
      M.light.intensity += (j - M.light.intensity) * (1 - Math.exp(-8 * T));
    }
    let O = 1,
      q = 0,
      U = {
        list: t,
        TUNE: Ui,
        spawn(T, D, C = {}) {
          let G = T === "gull" || T === "drone" ? d : T === "hound" || T === "elite" || T === "boss" || T === "marksman" || T === "heavy" || T === "turret" ? v : null;
          if (!G) return null;
          let j = null;
          for (let N of G)
            if (!N.active) {
              j = N;
              break;
            }
          if (!j && (T === "hound" || T === "elite" || T === "boss" || T === "marksman" || T === "heavy" || T === "turret") && n.length) {
            let N = n[0];
            h.retire(N), (j = N);
          }
          if (!j) return null;
          (j.id = O++), t.push(j), j._activate(D, C);
          // 变体标记（type 保持不变，避免音频/统计分支失配）
          (j.variant = T === "gull" || T === "hound" ? "" : T),
            (j.elite = T === "elite" || T === "boss"),
            (j.boss = T === "boss"),
            (j.hitScale = T === "boss" ? 1.8 : T === "elite" ? 1.15 : T === "heavy" ? 1.28 : T === "turret" ? 1.15 : 1),
            (j.hitRadiusSq = T === "boss" ? 5.2 : T === "elite" ? 2.2 : T === "heavy" ? 3.4 : T === "turret" ? 2.4 : T === "marksman" ? 2.0 : 1.7);
          if (j.rig && j.rig.group) j.rig.group.scale.setScalar(T === "boss" ? 1.8 : T === "elite" ? 1.15 : T === "heavy" ? 1.22 : T === "turret" ? 1.12 : 1);
          // 重置变体专有状态（对象池复用）
          (j.fixed = !1),
            (j.rangeMin = 0), (j.rangeMax = 0), (j.burstCount = 0), (j.shotDamage = 0),
            (j.telegraph = 0), (j.laser = !1), (j.coolMul = 0), (j.spreadMul = 0),
            (j.runSpeed = 0), (j.shieldHp = 0), (j.maxShield = 0), (j.shieldFlash = 0);
          if (T === "drone") {
            j.hp = 26; j.maxHp = 26;
            if (j.lens && j.lens.color) j.lens.color.setRGB(7, 0.45, 0.18);
          } else if (T === "elite") {
            j.hp = 230; j.maxHp = 230;
            if (j.lens && j.lens.color) j.lens.color.setRGB(6.5, 0.35, 0.2);
          } else if (T === "marksman") {
            j.hp = 95; j.maxHp = 95;
            j.rangeMin = 20; j.rangeMax = 44; j.burstCount = 1;
            j.shotDamage = 27; j.telegraph = 1.15; j.laser = !0;
            j.coolMul = 1.35; j.spreadMul = 0.32; j.runSpeed = 3.3;
            if (j.lens && j.lens.color) j.lens.color.setRGB(7.5, 0.25, 0.15);
          } else if (T === "heavy") {
            j.hp = 320; j.maxHp = 320; j.shieldHp = 240; j.maxShield = 240;
            j.rangeMin = 5; j.rangeMax = 15; j.runSpeed = 2.4;
            j.lungeDamage = 24; j.coolMul = 0.85; j.shotDamage = 6;
            if (j.lens && j.lens.color) j.lens.color.setRGB(2.2, 3.2, 7.5);
          } else if (T === "turret") {
            j.hp = 420; j.maxHp = 420;
            j.rangeMin = 6; j.rangeMax = 30; j.burstCount = 5;
            j.shotDamage = 8; j.telegraph = 0.6; j.coolMul = 1.0;
            j.spreadMul = 0.45; j.runSpeed = 0; j.fixed = !0;
            if (j.lens && j.lens.color) j.lens.color.setRGB(7.5, 1.6, 0.3);
          } else if (T === "boss") {
            j.hp = 1600; j.maxHp = 1600;
            j.bossPhase = 0; j.bossT = 0; j.volleyCd = 6; j.stompCd = 4;
            if (j.lens && j.lens.color) j.lens.color.setRGB(8, 0.3, 0.12);
          }
          // 重装盾卫：正面护盾网格
          if (T === "heavy" && j.rig && j.rig.group && !j.shieldMesh) {
            try {
              let sg = new Ys(0.62, 0.62, 1.1, 20, 1, -Math.PI * 0.4, Math.PI * 0.8);
              let sm = new Qt({ color: 0x2b3740, metalness: 0.85, roughness: 0.32, transparent: !0, opacity: 0.8, side: Sn, emissive: 0x0a1a22, emissiveIntensity: 0.6 });
              let mesh = new Qe(sg, sm);
              mesh.position.set(0, 0.8, 0.05);
              mesh.castShadow = !1; mesh.receiveShadow = !0;
              j.rig.group.add(mesh);
              j.shieldMesh = mesh;
            } catch (e) {}
          }
          if (j.shieldMesh) {
            j.shieldMesh.visible = T === "heavy";
            if (T === "heavy" && j.shieldMesh.material) j.shieldMesh.material.opacity = 0.8;
          }
          if (j.rig && j.rig.bones) {
            let legNames = ["abdFL","thighFL","shinFL","abdFR","thighFR","shinFR","abdRL","thighRL","shinRL","abdRR","thighRR","shinRR"];
            for (let li = 0; li < legNames.length; li++)
              if (j.rig.bones[legNames[li]])
                j.rig.bones[legNames[li]].scale.setScalar(T === "turret" ? 0.01 : 1);
          }
          i.events.emit("enemy:spawn", { enemy: j });
          return j;
        },
        raycast(T, D, C = 300) {
          let G = null;
          for (let j = 0; j < t.length; j++) {
            let N = t[j];
            if (!N.alive) continue;
            let Q = N.pos.x - T.x,
              K = N.pos.y + (N.type === "hound" ? 0.6 * (N.hitScale || 1) : 0) - T.y,
              ie = N.pos.z - T.z,
              F = Q * D.x + K * D.y + ie * D.z;
            F < -1.5 ||
              F > C + 1.5 ||
              Q * Q + K * K + ie * ie - F * F > (N.hitRadiusSq || 1.7) ||
              (G ||
                (G = {
                  dist: 1 / 0,
                  point: new W(),
                  normal: new W(),
                  enemy: null,
                  part: "body",
                }),
              N._raycast(T, D, C, G));
          }
          return G && G.enemy ? G : null;
        },
        aliveCount() {
          let T = 0;
          for (let D of t) D.alive && T++;
          return T;
        },
        clear() {
          for (let T of d) T.active && T._deactivate();
          for (let T of v) T.active && T._deactivate();
          (t.length = 0), (n.length = 0), (h.tokens = 0);
          for (let T of g) T.on = !1;
          (m.count = 0), M && M.light && (M.light.intensity = 0);
        },
        alert(T, D = 40) {
          for (let C of t)
            !C.alive ||
              C.passive ||
              C.mode === "engage" ||
              C.pos.distanceToSquared(T) > D * D ||
              (C.lastKnown.copy(T),
              (C.lastKnown.y = Math.max(0, T.y - 1.6)),
              C.mode === "patrol" &&
                i.events.emit("enemy:alert", { enemy: C, noise: !0 }),
              (C.mode = "investigate"),
              (C.modeT = 9 + e() * 4));
        },
        update(T) {
          if (T <= 0) return;
          T > 0.05 && (T = 0.05), (h.t += T), (q -= T);
          let D = i.player;
          if (D) {
            let C = D.vel ? Math.hypot(D.vel.x, D.vel.z) : D.speed || 0;
            h.playerSpeed += (C - h.playerSpeed) * (1 - Math.exp(-6 * T));
          }
          for (let C = t.length - 1; C >= 0; C--) t[C]._update(T);
          _(T), H(T);
        },
        debug: {
          ctx: h,
          gulls: d,
          hounds: v,
          wrecks: n,
          bolts: g,
          mats: u,
          tris: { gull: f.tris + f.extra.tris, hound: p.tris },
        },
      };
    return (
      i.events.on("weapon:fire", (T) => {
        if (q > 0) return;
        q = 0.3;
        let D = (T && (T.origin || T.muzzle)) || (i.player && i.player.pos);
        D && U.alert(D, (T && T.radius) || Ui.hearRadius);
      }),
      i.events.on("explosion", (T) => {
        T && T.pos && U.alert(T.pos, 30);
      }),
      i.events.on("game:state", (T) => {
        T && T.state === "title" && U.clear();
      }),
      U
    );
  }
  var o0 = new W(),
    r0 = new W(),
    a0 = new W();
  function HC(i, e, t, n) {
    o0.copy(e).sub(i), r0.copy(n).sub(t), a0.copy(i).sub(t);
    let s = o0.dot(o0),
      o = r0.dot(r0),
      r = r0.dot(a0),
      a,
      l;
    if (s <= 1e-9 && o <= 1e-9) return a0.dot(a0);
    if (s <= 1e-9) (a = 0), (l = Math.min(1, Math.max(0, r / o)));
    else {
      let f = o0.dot(a0);
      if (o <= 1e-9) (l = 0), (a = Math.min(1, Math.max(0, -f / s)));
      else {
        let p = o0.dot(r0),
          d = s * o - p * p;
        (a = d > 1e-9 ? Math.min(1, Math.max(0, (p * r - f * o) / d)) : 0),
          (l = (p * a + r) / o),
          l < 0
            ? ((l = 0), (a = Math.min(1, Math.max(0, -f / s))))
            : l > 1 && ((l = 1), (a = Math.min(1, Math.max(0, (p - f) / s))));
      }
    }
    let c = a0.x + o0.x * a - r0.x * l,
      u = a0.y + o0.y * a - r0.y * l,
      h = a0.z + o0.z * a - r0.z * l;
    return c * c + u * u + h * h;
  }
  async function VC(i) {
    let e = await Em(i);
    i.enemies = e;
    let t = (l, c, u) => new W(l, c, u),
      n = i.params.eshow || "both",
      s = [3, 1.45, 3.9],
      o = [0.5, 0.95, 0],
      r = 2.6;
    if (n === "gull")
      e.spawn("gull", t(0, 1.6, 0), {
        passive: !0,
        hover: 1.6,
        patrolRadius: 0.02,
        yaw: 0.7,
      }),
        (s = [1.25, 1.95, 1.45]),
        (o = [0, 1.52, 0]),
        (r = 1.2);
    else if (n === "hound")
      e.spawn("hound", t(0, 0, 0), {
        passive: !0,
        yaw: 0.9,
        patrolLine: [t(1.6, 0, 1.3), t(-1.6, 0, -1.3)],
      }),
        (s = [2.1, 1, 2.3]),
        (o = [0.5, 0.62, 0.4]),
        (r = 1.25);
    else if (n === "fight")
      e.spawn("hound", t(-7, 0, -9), { state: "alert" }),
        e.spawn("hound", t(8, 0, -7), { state: "alert" }),
        e.spawn("hound", t(0, 0, -14), { state: "alert" }),
        e.spawn("gull", t(-5, 6, -13), { state: "alert" }),
        e.spawn("gull", t(9, 6, -11), { state: "alert" }),
        (s = [5, 2.6, 10]),
        (o = [0, 2.2, -5]),
        (r = 7);
    else if (n === "dead") {
      let l = e.spawn("hound", t(0, 0, 0), { passive: !0, yaw: 0.8 }),
        c = e.spawn("gull", t(-1.6, 3.4, -0.5), {
          passive: !0,
          hover: 3.4,
          patrolRadius: 0.02,
        });
      e.spawn("hound", t(2.2, 0, -1.6), {
        passive: !0,
        yaw: -0.6,
        patrolLine: [t(2.2, 0, -1.6), t(3.4, 0, -3)],
      });
      for (let u = 0; u < 30; u++) e.update(1 / 60);
      l.damage(999, l.pos, t(0.6, 0, -0.8), "body");
      for (let u = 0; u < 110; u++) e.update(1 / 60);
      c.damage(999, c.pos, t(0, 0, 1), "body"),
        (s = [2.6, 1.3, 3.2]),
        (o = [0, 0.5, 0]),
        (r = 0.42);
    } else
      e.spawn("gull", t(-0.9, 2.2, -0.2), {
        passive: !0,
        hover: 2.2,
        patrolRadius: 0.25,
        yaw: 0.5,
      }),
        e.spawn("hound", t(0.2, 0, 0.6), {
          passive: !0,
          yaw: 1.2,
          patrolLine: [t(2.6, 0, 1.2), t(-1.8, 0, 0.2)],
        });
    i.params.epre != null && (r = +i.params.epre);
    for (let l = 0, c = Math.round(r * 60); l < c; l++) e.update(1 / 60);
    let a = !!i.params.efreeze;
    return {
      cam: s,
      target: o,
      update(l) {
        a || e.update(l);
      },
    };
  }
  var tx = 4,
    nx = -90,
    WC = 450,
    GC = {
      0: "北",
      45: "东北",
      90: "东",
      135: "东南",
      180: "南",
      225: "西南",
      270: "西",
      315: "西北",
    },
    ix = 2 * Math.PI * 19;
  function li(i, e, t) {
    let n = document.createElement(i);
    return e && (n.className = e), t != null && (n.innerHTML = t), n;
  }
  function hM(i) {
    let e = document.getElementById("ui"),
      t = li("div", "hud");
    t.setAttribute("aria-hidden", "true");
    let n = li("div", "h-compass"),
      s = li("div", "h-tape"),
      o = "";
    for (let k = nx; k <= WC; k += 5) {
      let ce = (k - nx) * tx,
        ve = ((k % 360) + 360) % 360,
        _e = ve % 45 === 0,
        Te = ve % 15 === 0;
      (o += `<i class="${_e ? "mj" : Te ? "md" : "mn"}" style="left:${ce}px"></i>`),
        _e
          ? (o += `<b class="${ve % 90 === 0 ? "card" : "ic"}" style="left:${ce}px">${GC[ve]}</b>`)
          : ve % 15 === 0 &&
            (o += `<b class="num" style="left:${ce}px">${String(ve).padStart(3, "0")}</b>`);
    }
    s.innerHTML = o;
    let r = li("div", "h-tape-wrap");
    r.appendChild(s);
    let a = li("div", "h-cmarks"),
      l = li("div", "h-heading", "000");
    n.append(r, li("i", "h-needle"), a, l);
    let c = li(
        "div",
        "h-obj",
        '<div class="h-k">任务目标</div><div class="h-obj-t"></div><div class="h-relays"><span>中继</span><i></i><i></i><i></i><b>0/3</b></div>',
      ),
      u = c.querySelector(".h-obj-t"),
      h = c.querySelector(".h-relays"),
      f = h.querySelector("b"),
      p = [...h.querySelectorAll("i")],
      d = li("div", "h-warn"),
      v = li(
        "div",
        "h-cross",
        '<i class="c-t"></i><i class="c-b"></i><i class="c-l"></i><i class="c-r"></i><i class="c-dot"></i>',
      ),
      g = v.querySelectorAll("i"),
      x = li("div", "h-hit", "<i></i><i></i><i></i><i></i>"),
      y = li("div", "h-arcs"),
      b = [];
    for (let k = 0; k < 4; k++) {
      let ce = li(
        "div",
        "h-arc",
        '<svg viewBox="-100 -100 200 200"><path d="M -38 -84 A 92 92 0 0 1 38 -84" /><path class="tip" d="M -7 -97 L 0 -106 L 7 -97" /></svg>',
      );
      y.appendChild(ce),
        b.push({ el: ce, life: 0, src: new W(), op: -1, rot: 1e9 });
    }
    let m = li(
        "div",
        "h-prompt",
        `<svg viewBox="-24 -24 48 48"><circle class="bg" r="19"/><circle class="fg" r="19" stroke-dasharray="${ix.toFixed(2)}" stroke-dashoffset="${ix.toFixed(2)}" transform="rotate(-90)"/></svg><span class="h-key">E</span><span class="h-plabel"></span>`,
      ),
      A = m.querySelector(".fg"),
      _ = m.querySelector(".h-key"),
      M = m.querySelector(".h-plabel"),
      E = li("div", "h-feed"),
      w = li("div", "h-msg"),
      S = li(
        "div",
        "h-health",
        '<div class="h-k">生命状态</div><div class="h-hp-row"><b class="h-hp-n">100</b><div class="h-hp-bar">' +
          "<i></i>".repeat(10) +
          "</div></div>",
      ),
      z = S.querySelector(".h-hp-n"),
      H = [...S.querySelectorAll(".h-hp-bar i")],
      O = li(
        "div",
        "h-ammo",
        '<div class="h-cue"></div><div class="h-ammo-row"><b class="h-ammo-n">30</b><span class="h-ammo-r">120</span></div><div class="h-pips"></div><div class="h-wname"></div>',
      ),
      q = O.querySelector(".h-ammo-n"),
      U = O.querySelector(".h-ammo-r"),
      T = O.querySelector(".h-pips"),
      D = O.querySelector(".h-wname"),
      C = O.querySelector(".h-cue"),
      G = li("div", "h-marks");
    t.append(G, n, c, d, y, v, x, m, E, w, S, O), e.appendChild(t);
    let j = li(
      "div",
      "comms",
      '<span class="comms-who">指挥中心</span><span class="comms-t"></span>',
    );
    j.setAttribute("role", "status"), j.setAttribute("aria-live", "polite");
    let N = j.querySelector(".comms-t");
    e.appendChild(j);
    let Q = !1,
      K = 420,
      ie = innerWidth,
      F = innerHeight,
      X = {
        ammo: -1,
        mag: -1,
        reserve: -1,
        name: null,
        cue: null,
        low: null,
        hp: -1,
        hpSeg: -1,
        hurt: null,
        head: -1,
        tapeX: 1e9,
        gap: -1,
        crossOn: null,
        promptOn: null,
        promptText: null,
        promptT: -1,
        promptKey: null,
        marksOn: null,
        done: -1,
        total: -1,
      },
      ne = [],
      re = "",
      $ = 0,
      ue = 0,
      me = [],
      ee = null,
      B = 0,
      P = 0,
      V = 0,
      Y = 0,
      L = 0,
      Z = [],
      J = [],
      oe = new W(),
      fe = null,
      le = -1;
    function R() {
      (ie = innerWidth),
        (F = innerHeight),
        (K = n.clientWidth || Math.min(420, ie * 0.6)),
        (X.tapeX = 1e9),
        (X.gap = -1);
      for (let k of J) (k.lastC = 1e9), (k.lastW = "");
    }
    addEventListener("resize", R),
      i.events.on("player:hitEnemy", (k) => {
        I.hitmarker(
          k && k.killed
            ? "kill"
            : k && (k.weak || k.part === "weak")
              ? "weak"
              : "hit",
        ),
          k &&
            k.killed &&
            k.weak &&
            fe &&
            le === i.time.frame &&
            !fe.weak &&
            ((fe.weak = !0), (fe.el.innerHTML += "<em>弱点命中</em>"));
      }),
      i.events.on("enemy:killed", (k) => {
        let nameMap = {
          gull: "机械飞鸥", hound: "机械猎犬",
          drone: "自爆无人机", elite: "精英猎犬", boss: "港区主控",
          marksman: "狙击猎犬", heavy: "重装盾卫", turret: "固定炮台", target: "训练靶机",
        };
        let variant = k && k.enemy && k.enemy.variant;
        let ce =
          nameMap[variant] ||
          nameMap[k && (k.type || (k.enemy && k.enemy.type))] ||
          "机械守卫";
        (fe = I.feed(`<b>${ce}</b> 已摧毁`)), (le = i.time.frame);
      }),
      i.events.on("player:hit", (k) => {
        if (!k || !k.fromPos) return;
        let ce = b[0];
        for (let ve of b) {
          if (ve.life <= 0) {
            ce = ve;
            break;
          }
          ve.life < ce.life && (ce = ve);
        }
        ce.src.copy(k.fromPos), (ce.life = 1.5), (ce.max = 1.5);
      });
    let I = {
      root: t,
      show(k) {
        (k = !!k), k !== Q && ((Q = k), t.classList.toggle("on", k), k && R());
      },
      setObjective(k) {
        (k = k || ""),
          k !== re &&
            ((re = k),
            ($ = 0),
            (ue = 0),
            (u.textContent = ""),
            c.classList.toggle("has", !!k),
            c.classList.remove("flash"),
            c.offsetWidth,
            c.classList.add("flash"));
      },
      setRelays(k, ce) {
        if (!(k === X.done && ce === X.total)) {
          if (ce !== X.total) {
            p.forEach((ve) => ve.remove()), (p = []);
            for (let ve = 0; ve < ce; ve++) {
              let _e = document.createElement("i");
              h.insertBefore(_e, f), p.push(_e);
            }
          }
          (X.done = k),
            (X.total = ce),
            p.forEach((ve, _e) => ve.classList.toggle("cut", _e < k)),
            (f.textContent = `${k}/${ce}`),
            h.classList.toggle("all", k >= ce && ce > 0);
        }
      },
      setMarkers(k) {
        for (let ce of J) ce.cEl.remove(), ce.wEl.remove();
        J = (k || []).map((ce) => {
          let ve = li(
              "div",
              "h-cm " + (ce.kind || "relay"),
              `<i></i><b>${ce.short || ""}</b><span></span>`,
            ),
            _e = li(
              "div",
              "h-wm " + (ce.kind || "relay"),
              `<i></i><b>${ce.short || ""}</b><span></span>`,
            );
          return (
            a.appendChild(ve),
            G.appendChild(_e),
            {
              ...ce,
              cEl: ve,
              wEl: _e,
              cDist: ve.querySelector("span"),
              wDist: _e.querySelector("span"),
              lastD: -1,
              lastC: 1e9,
              lastW: "",
              vis: null,
            }
          );
        });
      },
      setPrompt(k, ce = 0) {
        let ve = !!k;
        if (
          (ve !== X.promptOn &&
            ((X.promptOn = ve),
            m.classList.toggle("on", ve),
            i.input.setPrompt && i.input.setPrompt(ve)),
          !ve)
        )
          return;
        let _e = i.input.touch
          ? "交互"
          : i.input.gamepad && !i.input.locked
            ? "Y"
            : "E";
        _e !== X.promptKey &&
          ((X.promptKey = _e),
          (_.textContent = _e),
          _.classList.toggle("wide", _e.length > 1));
        let Te = `按住 ${_e} · ${k}`;
        Te !== X.promptText && ((X.promptText = Te), (M.textContent = Te));
        let Pe = Math.round(ce * 200) / 200;
        Pe !== X.promptT &&
          ((X.promptT = Pe),
          A.setAttribute("stroke-dashoffset", (ix * (1 - Pe)).toFixed(2)),
          m.classList.toggle("busy", Pe > 0));
      },
      radio(k, ce = 4.5) {
        k && me.push({ text: k, secs: ce });
      },
      clearRadio() {
        (me.length = 0), (ee = null), j.classList.remove("on");
      },
      warn(k, ce = 3) {
        (d.textContent = k),
          (Y = ce),
          d.classList.remove("on"),
          d.offsetWidth,
          d.classList.add("on");
      },
      message(k, ce = 3) {
        (w.textContent = k || ""),
          (L = k ? ce : 0),
          w.classList.toggle("on", !!k);
      },
      feed(k) {
        let ce = li("div", "h-fl", k);
        E.appendChild(ce);
        let ve = { el: ce, life: 4.2, weak: !1 };
        for (Z.push(ve); Z.length > 4; ) Z.shift().el.remove();
        return ve;
      },
      hitmarker(k = "hit") {
        x.className = "h-hit " + k;
        let ce = k === "weak" || k === "kill" ? 1.5 : 1.15;
        try {
          x.animate(
            [
              { opacity: 1, transform: `translate(-50%,-50%) scale(${ce})` },
              {
                opacity: 1,
                transform: "translate(-50%,-50%) scale(1)",
                offset: 0.35,
              },
              { opacity: 0, transform: "translate(-50%,-50%) scale(0.92)" },
            ],
            { duration: k === "kill" ? 420 : 240, easing: "ease-out" },
          );
        } catch {}
      },
      reset() {
        (me.length = 0), (ee = null), j.classList.remove("on");
        for (let k of Z) k.el.remove();
        Z.length = 0;
        for (let k of b) k.life = 0;
        (Y = 0),
          d.classList.remove("on"),
          I.message(""),
          I.setPrompt(null),
          I.setObjective(""),
          (X.hp = -1);
      },
      update: se,
    };
    function se(k) {
      if ((ae(k), !Q)) return;
      let ce = i.player,
        ve = i.weapon || {},
        _e = i.camera,
        Te = ce.ads || 0,
        Pe = ((-ce.yaw * 180) / Math.PI) % 360;
      Pe < 0 && (Pe += 360);
      let Re = Math.round((K / 2 - (Pe - nx) * tx) * 2) / 2;
      Re !== X.tapeX &&
        ((X.tapeX = Re), (s.style.transform = `translate3d(${Re}px,0,0)`));
      let Fe = Math.round(Pe) % 360;
      Fe !== X.head &&
        ((X.head = Fe), (l.textContent = String(Fe).padStart(3, "0")));
      let ze = Te < 0.5;
      if (
        (ze !== X.marksOn && ((X.marksOn = ze), G.classList.toggle("off", !ze)),
        J.length)
      ) {
        _e.updateMatrixWorld(),
          _e.matrixWorldInverse.copy(_e.matrixWorld).invert();
        let we = K / 2 - 14;
        for (let be of J) {
          let Oe = be.pos.x - ce.pos.x,
            pt = be.pos.z - ce.pos.z,
            ut = Math.round(Math.hypot(Oe, pt));
          if (ut !== be.lastD) {
            be.lastD = ut;
            let Un = ut + "米";
            (be.cDist.textContent = Un), (be.wDist.textContent = Un);
          }
          let nn = (Math.atan2(Oe, -pt) * 180) / Math.PI - Pe;
          nn = ((nn + 540) % 360) - 180;
          let bt = Math.round(Math.max(-we, Math.min(we, nn * tx)));
          bt !== be.lastC &&
            ((be.lastC = bt),
            (be.cEl.style.transform = `translate3d(${bt}px,0,0)`),
            be.cEl.classList.toggle("edge", Math.abs(bt) >= we)),
            oe
              .set(
                be.pos.x,
                be.pos.y + (be.kind === "extract" ? 1.2 : 1.9),
                be.pos.z,
              )
              .project(_e);
          let Os,
            pn,
            Ti = !1;
          if (
            (oe.z > 1 && ((Ti = !0), (oe.x = -oe.x), (oe.y = -oe.y)),
            Ti || Math.abs(oe.x) > 0.9 || Math.abs(oe.y) > 0.82)
          ) {
            Ti = !0;
            let Un = Math.max(
              Math.abs(oe.x) / 0.9,
              Math.abs(oe.y) / 0.82,
              0.001,
            );
            if (((oe.x /= Un), (oe.y /= Un), oe.z > 1)) {
              let zo = Math.max(Math.abs(oe.x) / 0.9, Math.abs(oe.y) / 0.82);
              zo < 0.999 && ((oe.x /= zo), (oe.y /= zo));
            }
          }
          (Os = Math.round((oe.x * 0.5 + 0.5) * ie)),
            (pn = Math.round((-oe.y * 0.5 + 0.5) * F));
          let ho = !Ti && Math.hypot(oe.x, oe.y * 0.6) < 0.16,
            Rs =
              Os +
              "," +
              pn +
              (Ti ? "o" : "") +
              (ut < 3 ? "n" : "") +
              (ho ? "d" : "");
          Rs !== be.lastW &&
            ((be.lastW = Rs),
            (be.wEl.style.transform = `translate3d(${Os}px,${pn}px,0)`),
            be.wEl.classList.toggle("offscreen", Ti),
            be.wEl.classList.toggle("near", ut < 3),
            be.wEl.classList.toggle("dim", ho));
        }
      }
      let We = Te <= 0.6 && ce.alive && ve.state !== "reloading_hidden";
      if (
        (We !== X.crossOn && ((X.crossOn = We), v.classList.toggle("off", !We)),
        We)
      ) {
        let we = typeof ve.spread == "number" ? ve.spread : 0.012,
          be = (_e.fov * Math.PI) / 360,
          Oe =
            (Math.tan(we) / Math.tan(be)) * (F / 2) +
            4 +
            (ce.sprinting ? 10 : 0);
        (Oe = Math.round(Math.max(4, Math.min(70, Oe)) * 2) / 2),
          Oe !== X.gap &&
            ((X.gap = Oe),
            (g[0].style.transform = `translate3d(-50%,${-Oe}px,0) translateY(-100%)`),
            (g[1].style.transform = `translate3d(-50%,${Oe}px,0)`),
            (g[2].style.transform = `translate3d(${-Oe}px,-50%,0) translateX(-100%)`),
            (g[3].style.transform = `translate3d(${Oe}px,-50%,0)`));
      }
      let Ne = Math.max(1, Math.min(60, ve.magSize | 0 || 30)),
        dt = Math.max(0, ve.ammo | 0),
        xe = Math.max(0, ve.reserve | 0);
      if (
        (Ne !== X.mag &&
          ((X.mag = Ne),
          (T.innerHTML = "<i></i>".repeat(Ne)),
          (ne = [...T.children]),
          (X.ammo = -1)),
        dt !== X.ammo)
      ) {
        (X.ammo = dt), (q.textContent = String(dt).padStart(2, "0"));
        for (let we = 0; we < ne.length; we++)
          ne[we].className = we < dt ? "" : "off";
      }
      xe !== X.reserve &&
        ((X.reserve = xe), (U.textContent = String(xe).padStart(3, "0"))),
        ve.name !== X.name &&
          ((X.name = ve.name), (D.textContent = ve.name || ""));
      let Ie = dt <= Math.ceil(Ne * 0.27),
        Be =
          ve.state === "reloading"
            ? "换弹中"
            : dt === 0
              ? xe > 0
                ? i.input.touch
                  ? "换弹"
                  : "R · 换弹"
                : "弹药耗尽"
              : Ie
                ? "弹药不足"
                : "";
      Be !== X.cue &&
        ((X.cue = Be),
        (C.textContent = Be),
        (C.className =
          "h-cue" +
          (Be ? " on" : "") +
          (dt === 0 && ve.state !== "reloading" ? " urgent" : ""))),
        Ie !== X.low && ((X.low = Ie), O.classList.toggle("low", Ie));
      let Xe = Math.max(0, Math.ceil(ce.health)),
        Me = ce.health < ce.maxHealth - 0.5;
      if (Xe !== X.hp) {
        (X.hp = Xe), (z.textContent = String(Xe));
        let we = Math.ceil((Xe / ce.maxHealth) * H.length);
        if (we !== X.hpSeg) {
          X.hpSeg = we;
          for (let be = 0; be < H.length; be++)
            H[be].className = be < we ? "" : "off";
          S.classList.toggle("crit", we <= 3);
        }
      }
      Me !== X.hurt && ((X.hurt = Me), S.classList.toggle("on", Me));
      for (let we of b) {
        if (we.life <= 0) {
          we.op !== 0 && ((we.op = 0), (we.el.style.opacity = "0"));
          continue;
        }
        we.life -= k;
        let be =
            Math.atan2(we.src.x - ce.pos.x, -(we.src.z - ce.pos.z)) + ce.yaw,
          Oe = Math.round((be * 180) / Math.PI);
        Oe !== we.rot &&
          ((we.rot = Oe),
          (we.el.style.transform = `translate(-50%,-50%) rotate(${Oe}deg)`));
        let pt = Math.round(Math.min(1, Math.max(0, we.life / 0.6)) * 20) / 20;
        pt !== we.op && ((we.op = pt), (we.el.style.opacity = String(pt)));
      }
      if ($ < re.length) {
        ue += k * 46;
        let we = Math.min(re.length, Math.floor(ue));
        we !== $ && (($ = we), (u.textContent = re.slice(0, we)));
      }
      Y > 0 && ((Y -= k), Y <= 0 && d.classList.remove("on")),
        L > 0 && ((L -= k), L <= 0 && w.classList.remove("on"));
      for (let we = Z.length - 1; we >= 0; we--) {
        let be = Z[we];
        (be.life -= k),
          be.life <= 0
            ? (be.el.remove(), Z.splice(we, 1))
            : be.life < 0.6 &&
              !be.out &&
              ((be.out = !0), be.el.classList.add("out"));
      }
    }
    function ae(k) {
      if (!ee) {
        if (!me.length) return;
        (ee = me.shift()),
          (B = 0),
          (P = 0),
          (V = ee.secs),
          (N.textContent = ""),
          j.classList.add("on"),
          i.events.emit("radio:line", { text: ee.text });
      }
      let ce = ee.text;
      if (B < ce.length) {
        P += k * 58;
        let ve = Math.min(ce.length, Math.floor(P));
        ve !== B && ((B = ve), (N.textContent = ce.slice(0, ve)));
      } else
        (V -= k),
          V <= 0 && ((ee = null), me.length || j.classList.remove("on"));
    }
    return R(), I;
  }
