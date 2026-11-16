/* packages/sim/damage.js — 伤害管线：pre → armor → difficulty → apply → post
 * UMD 链：Node require('./weapons.js')。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./weapons.js'));
  else root.SALT_SIM = factory(root.SALT_SIM || {});
})(typeof globalThis !== 'undefined' ? globalThis : this, function (S) {
  'use strict';
  S = S || {};

  var ORDER = ['pre', 'armor', 'difficulty', 'apply', 'post'];

  function num(v, d) {
    return typeof v === 'number' && Number.isFinite(v) ? v : d;
  }

  /**
   * 伤害管线。每个阶段按注册顺序执行；阶段函数签名 (ev, res, ctx)。
   * ev 为调用方事件（可带 amount/armor/health/difficulty/mods/...）；
   * res 为本次结果 {amount,absorbed,blocked,killed,final,trace,stopped}；
   * ctx 为管线配置（difficulty 等）。
   */
  function createDamagePipeline(opts) {
    opts = opts || {};
    var stages = { pre: [], armor: [], difficulty: [], apply: [], post: [] };
    var ctx = {
      difficulty: num(opts.difficulty, 1),
      armorPierce: num(opts.armorPierce, 0),
      minDamage: num(opts.minDamage, 0),
    };

    function use(stage, fn) {
      if (!stages[stage]) throw new Error('unknown damage stage: ' + stage);
      if (typeof fn !== 'function') throw new TypeError('stage handler must be a function');
      stages[stage].push(fn);
      return api;
    }

    function set(stage, fn) {
      if (!stages[stage]) throw new Error('unknown damage stage: ' + stage);
      if (typeof fn !== 'function') throw new TypeError('stage handler must be a function');
      stages[stage] = [fn];
      return api;
    }

    function clear(stage) {
      if (stage === undefined) {
        for (var i = 0; i < ORDER.length; i++) stages[ORDER[i]] = [];
      } else if (stages[stage]) stages[stage] = [];
      return api;
    }

    if (opts.defaults !== false) {
      stages.pre.push(function (ev, res) {
        if (ev.cancelled) res.stopped = true;
      });
      stages.armor.push(function (ev, res) {
        if (res.stopped) return;
        if (ev.ignoreArmor) return;
        var armor = Math.max(0, num(ev.armor, 0));
        // armorPierce 0..1：0 = 护甲完全吸收，1 = 无视护甲
        var usable = armor * (1 - Math.max(0, Math.min(1, ctx.armorPierce)));
        var absorb = Math.min(res.amount, usable);
        res.amount -= absorb;
        res.absorbed += absorb;
        ev.armor = armor - absorb;
      });
      stages.difficulty.push(function (ev, res) {
        if (res.stopped) return;
        var d = num(ev.difficulty, ctx.difficulty);
        res.amount *= d;
      });
      stages.apply.push(function (ev, res) {
        if (res.stopped) return;
        // V38：最低伤害在 apply 阶段生效，且 final 记录真正扣掉的血量。
        var amount = Math.max(ctx.minDamage, res.amount);
        if (typeof ev.health === 'number') {
          var before = ev.health;
          ev.health = Math.max(0, before - amount);
          res.applied = before - ev.health;
        } else {
          res.applied = amount;
        }
      });
      stages.post.push(function (ev, res) {
        if (res.stopped) return;
        res.final = res.applied != null ? res.applied : Math.max(ctx.minDamage, res.amount);
        if (typeof ev.health === 'number') res.killed = ev.health <= 0;
      });
    }

    function run(ev) {
      ev = ev || {};
      var res = {
        ev: ev,
        amount: num(ev.amount, 0),
        absorbed: 0,
        blocked: false,
        stopped: false,
        killed: false,
        final: 0,
        applied: null,
        stage: '',
        trace: [],
      };
      for (var i = 0; i < ORDER.length; i++) {
        var stage = ORDER[i];
        res.stage = stage;
        res.trace.push(stage);
        var list = stages[stage];
        for (var k = 0; k < list.length; k++) {
          list[k](ev, res, ctx);
          if (res.stopped) break;
        }
        if (res.stopped) break;
      }
      if (!res.stopped) {
        res.final = res.applied != null ? res.applied : Math.max(ctx.minDamage, res.amount);
      }
      return res;
    }

    var api = {
      ORDER: ORDER,
      ctx: ctx,
      use: use,
      set: set,
      clear: clear,
      run: run,
      stages: stages,
    };
    return api;
  }

  S.damage = {
    createDamagePipeline: createDamagePipeline,
    ORDER: ORDER,
  };
  return S;
});
