/* =====================================================================
   V32 · 核心底座：模拟时钟 / 最小堆调度器（WP32-7）
   createClock()  ：跑在模拟时间上，受 timeScale 影响，可整组取消
   realClock      ：界面动效用真实时间，游戏暂停不影响
   ===================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SXClock = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function MinHeap(less) {
    this.items = [];
    this.less = less;
  }
  MinHeap.prototype.size = function () { return this.items.length; };
  MinHeap.prototype.peek = function () { return this.items[0]; };
  MinHeap.prototype.push = function (item) {
    var a = this.items;
    a.push(item);
    var i = a.length - 1;
    while (i > 0) {
      var p = (i - 1) >> 1;
      if (!this.less(a[i], a[p])) break;
      var t = a[i]; a[i] = a[p]; a[p] = t;
      i = p;
    }
    return item;
  };
  MinHeap.prototype.pop = function () {
    var a = this.items;
    if (!a.length) return undefined;
    var top = a[0];
    var last = a.pop();
    if (a.length) {
      a[0] = last;
      var i = 0;
      for (;;) {
        var l = i * 2 + 1;
        var r = l + 1;
        var m = i;
        if (l < a.length && this.less(a[l], a[m])) m = l;
        if (r < a.length && this.less(a[r], a[m])) m = r;
        if (m === i) break;
        var t = a[i]; a[i] = a[m]; a[m] = t;
        i = m;
      }
    }
    return top;
  };
  MinHeap.prototype.rebuild = function (predicate) {
    var kept = [];
    for (var i = 0; i < this.items.length; i++) {
      if (predicate(this.items[i])) kept.push(this.items[i]);
    }
    this.items = [];
    for (var j = 0; j < kept.length; j++) this.push(kept[j]);
  };

  function nowMs() {
    try {
      if (typeof performance !== "undefined" && performance && typeof performance.now === "function") {
        return performance.now();
      }
    } catch (e) { /* ignore */ }
    return Date.now();
  }

  /**
   * createClock(options)
   *  - options.now: 可选，返回毫秒的函数。提供时 tick() 忽略参数，按真实经过时间推进（realClock 用）。
   *  - options.timeScale: 初始倍率，默认 1。
   */
  function createClock(options) {
    options = options || {};
    var t = 0;
    var seq = 0;
    var scale = typeof options.timeScale === "number" && isFinite(options.timeScale)
      ? Math.max(0, options.timeScale) : 1;
    var realNow = typeof options.now === "function" ? options.now : null;
    var lastReal = realNow ? realNow() : 0;
    var heap = new MinHeap(function (a, b) {
      return a.at !== b.at ? a.at < b.at : a.seq < b.seq;
    });

    function schedule(when, fn, group, every, interval) {
      if (typeof fn !== "function") return function () {};
      var handle = {
        at: when,
        fn: fn,
        group: group == null ? "default" : String(group),
        seq: seq++,
        dead: false,
        every: every || 0,
        interval: interval || 0
      };
      heap.push(handle);
      var cancel = function () {
        handle.dead = true;
        // 立即从堆里移除，避免长任务表泄漏；堆小，O(n) 可接受
        heap.rebuild(function (h) { return !h.dead; });
      };
      cancel.group = handle.group;
      cancel.at = handle.at;
      handle.cancel = cancel;
      return cancel;
    }

    function advance(delta) {
      if (!isFinite(delta) || delta < 0 || scale <= 0) return 0;
      var step = delta * scale;
      t += step;
      var guard = 0;
      while (heap.size() && heap.peek().at <= t) {
        var h = heap.pop();
        if (h.dead) continue;
        if (h.every > 0) {
          // 周期任务：从原定时间推进，保证长期不漂移；一次 tick 最多补 10000 次
          h.at += h.interval;
          h.seq = seq++;
          heap.push(h);
        }
        try { h.fn(t); } catch (e) {
          // 调度器不吞业务错误：交给 errors.guard 包装的 fn 处理；这里只保证后续任务继续
          if (typeof console !== "undefined" && console.error) console.error("[clock] task failed", e);
        }
        if (++guard > 100000) break;
      }
      return step;
    }

    return {
      get now() { return t; },
      get timeScale() { return scale; },
      set timeScale(v) {
        if (typeof v === "number" && isFinite(v)) scale = Math.max(0, v);
      },
      get size() { return heap.size(); },
      after: function (sec, fn, group) {
        var delay = typeof sec === "number" && isFinite(sec) ? Math.max(0, sec) : 0;
        return schedule(t + delay, fn, group, 0, 0);
      },
      every: function (sec, fn, group) {
        var interval = typeof sec === "number" && isFinite(sec) ? Math.max(0.0001, sec) : 0.0001;
        return schedule(t + interval, fn, group, 1, interval);
      },
      cancelGroup: function (group) {
        var g = group == null ? "default" : String(group);
        for (var i = 0; i < heap.items.length; i++) {
          if (heap.items[i].group === g) heap.items[i].dead = true;
        }
        heap.rebuild(function (h) { return !h.dead; });
        return g;
      },
      cancelAll: function () {
        var items = heap.items;
        for (var i = 0; i < items.length; i++) items[i].dead = true;
        heap.rebuild(function () { return false; });
      },
      tick: function (dt) {
        if (realNow) {
          var cur = realNow();
          var delta = (cur - lastReal) / 1000;
          lastReal = cur;
          return advance(delta);
        }
        return advance(typeof dt === "number" && isFinite(dt) ? dt : 0);
      },
      /** 只推进时间，不触发任务（用于测试或快进） */
      advance: function (dt) {
        if (!isFinite(dt) || dt <= 0 || scale <= 0) return 0;
        var step = dt * scale;
        t += step;
        return step;
      },
      reset: function () {
        heap.rebuild(function () { return false; });
        t = 0;
        seq = 0;
        lastReal = realNow ? realNow() : 0;
      }
    };
  }

  function createRealClock(nowFn) {
    return createClock({ now: typeof nowFn === "function" ? nowFn : nowMs, timeScale: 1 });
  }

  var realClock = createRealClock();

  return {
    MinHeap: MinHeap,
    createClock: createClock,
    createRealClock: createRealClock,
    realClock: realClock
  };
});
