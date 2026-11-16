/* packages/sim/rng.js — 可复现随机流（mulberry32），禁止 Math.random
 * UMD 链：Node require('./math.js') 传递同一个 SALT_SIM 命名空间。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./math.js'));
  else root.SALT_SIM = factory(root.SALT_SIM || {});
})(typeof globalThis !== 'undefined' ? globalThis : this, function (S) {
  'use strict';
  S = S || {};

  /** mulberry32：32 位状态，周期 2^32，返回值 [0,1)。 */
  function createRng(seed) {
    var a = (seed >>> 0) || 0x9e3779b9;
    function next() {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t = Math.imul(t ^ (t >>> 7), t | 61) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    next.seed = a;
    return next;
  }

  /** FNV-1a 32 位，用来把流名字混入种子。 */
  function hashName(name) {
    var h = 0x811c9dc5;
    var str = String(name);
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function mixSeed(seed, h) {
    var x = ((seed >>> 0) ^ h) >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
    x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
    return (x ^ (x >>> 16)) >>> 0;
  }

  /**
   * 命名随机流：同一个 seed 下每个流独立、可复现、互不干扰。
   * @returns {{seed:number, stream:function(string):function():number, fork:function(string):object}}
   */
  function createStreams(seed) {
    var rootSeed = (seed === undefined ? 1 : seed) >>> 0;
    var cache = Object.create(null);
    var api = {
      seed: rootSeed,
      stream: function (name) {
        var key = String(name);
        if (!cache[key]) cache[key] = createRng(mixSeed(rootSeed, hashName(key)));
        return cache[key];
      },
      /** 派生一条独立的子流集合；不消耗父流状态，同名 fork 永远是同一种子。 */
      fork: function (name) {
        return createStreams(api.forkSeed(name));
      },
      /** 不消耗流状态、只计算派生种子（测试/网络同步用）。 */
      forkSeed: function (name) {
        return mixSeed(rootSeed, hashName('fork:' + String(name)));
      },
    };
    return api;
  }

  S.rng = {
    createRng: createRng,
    createStreams: createStreams,
    hashName: hashName,
  };
  return S;
});
