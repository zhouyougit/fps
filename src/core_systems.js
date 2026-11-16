/* =====================================================================
   SALTLINE · core_systems.js — V32 系统注册表
   新功能以系统对象注册，避免继续对 G.* 打猴子补丁。
   系统接口：{ id, deps:[], init(ctx), fixedUpdate(cmd,h), update(dt,alpha),
              onState(next,prev), dispose() }
   ===================================================================== */
(function (root) {
  "use strict";

  function createSystems(ctx) {
    var list = [];
    var byId = Object.create(null);
    var order = null;
    var started = false;
    var errors = null;
    var guardCounts = Object.create(null);

    function report(sys, phase, e) {
      try {
        if (root.SXErrors) root.SXErrors.report(e, { system: sys.id || "system", phase: phase });
        else if (root.console) console.error("[system] " + (sys.id || "?") + "." + phase, e);
      } catch (_) {}
    }

    function guard(sys, phase, fn, args) {
      if (!sys || typeof fn !== "function") return undefined;
      try { return fn.apply(sys, args || []); } catch (e) {
        var key = (sys.id || "?") + "::" + phase;
        var n = (guardCounts[key] = (guardCounts[key] || 0) + 1);
        // 首次 + 每 300 次上报，避免 60Hz 失败系统冲掉错误环
        if (n === 1 || n % 300 === 0) report(sys, phase, e);
        return undefined;
      }
    }

    function topo() {
      var out = [], seen = Object.create(null), visiting = Object.create(null);
      function visit(sys) {
        if (!sys || seen[sys.id]) return;
        if (visiting[sys.id]) return; // 循环依赖：忽略，按注册顺序
        visiting[sys.id] = 1;
        var deps = sys.deps || [];
        for (var i = 0; i < deps.length; i++) {
          var d = byId[deps[i]];
          if (d) visit(d);
        }
        visiting[sys.id] = 0;
        seen[sys.id] = 1;
        out.push(sys);
      }
      for (var i = 0; i < list.length; i++) visit(list[i]);
      return out;
    }

    var api = {
      register: function (sys) {
        if (!sys || !sys.id) throw new Error("[systems] 系统必须有 id");
        if (byId[sys.id]) {
          if (root.console) console.warn("[systems] 重复注册 " + sys.id + "，已忽略");
          return api;
        }
        byId[sys.id] = sys;
        list.push(sys);
        if (started) {
          guard(sys, "init", sys.init, [ctx]);
          order = topo(); // 运行期注册：重新计算依赖顺序，不能让 deps 失效
        } else {
          order = null;
        }
        return api;
      },
      get: function (id) { return byId[id] || null; },
      all: function () { return list.slice(); },
      initAll: function () {
        started = true;
        order = topo();
        for (var i = 0; i < order.length; i++) guard(order[i], "init", order[i].init, [ctx]);
        return api;
      },
      fixedUpdate: function (cmd, h) {
        var arr = order || list;
        for (var i = 0; i < arr.length; i++) guard(arr[i], "fixedUpdate", arr[i].fixedUpdate, [cmd, h]);
      },
      update: function (dt, alpha) {
        var arr = order || list;
        for (var i = 0; i < arr.length; i++) guard(arr[i], "update", arr[i].update, [dt, alpha]);
      },
      onState: function (next, prev) {
        var arr = order || list;
        for (var i = 0; i < arr.length; i++) guard(arr[i], "onState", arr[i].onState, [next, prev]);
      },
      dispose: function () {
        var arr = (order || list).slice();
        for (var i = 0; i < arr.length; i++) guard(arr[i], "dispose", arr[i].dispose, []);
        list.length = 0;
        byId = Object.create(null);
        order = null;
        started = false;
      },
      errors: function () { return errors; }
    };
    return api;
  }

  root.SXSystems = { create: createSystems };
  if (typeof module === "object" && module.exports) module.exports = root.SXSystems;
})(typeof globalThis !== "undefined" ? globalThis : this);
