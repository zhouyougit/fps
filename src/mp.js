
  /* =====================================================================
     V36 · 联机对战客户端 / 协议 2.0（二进制快照、预测回放、比赛状态机）
     兼容 V16 · 联机对战客户端 的 JSON 协议与扩展挂载点。
     ===================================================================== */
  var MP = (function () {
    var G, T, MapKit;
    var ws = null, active = false, joining = false, joined = false;
    var selfId = null, selfNid = null, room = "harbor-1", playerName = "", mapId = "harbor", modeId = "tdm";
    var rx = { msg: 0, snap: 0, binary: 0, pong: 0 };
    var url = "";
    var remotes = new Map();
    var roster = new Map();
    var baseline = new Map();
    var serverSelf = null;
    var prevUpdate = null, origPlayerUpdate = null;
    var sendAcc = 0, seq = 0, inputTick = 0, lastPing = 0, pingMs = null;
    var ui = null, hud = null, pause = null, deadUi = null, scoreUi = null;
    var matchEl = null, capsEl = null, bannerEl = null;
    var mpDead = false, scoreData = null, scoreVisible = false, myKills = 0, myDeaths = 0, myTeam = 0;
    var respawnAt = 0, streak = 0, protectShown = false, hitDirEl = null;
    var fireHandler = null, reloadHandler = null, switchHandler = null;
    var names = ["猫-七", "猫-九", "猫-十三", "猫-二七", "猫-零", "猫-拾"];
    var session = 0, reconnectTimer = null, reconnectAttempts = 0, fatalConn = false, manualClose = false;
    var conn = null;
    var net = {
      protocol: 2, caps: [], bin: false,
      snapBinary: 0, snapJson: 0, decodeErrors: 0, lastBinaryAt: 0, lastSnapAt: 0, lastTick: 0,
      commandsSent: 0, ackDropped: 0, remoteShots: 0, hitEvents: 0, killEvents: 0,
      rejectedShots: 0, localShots: 0, lost: false, joinedAt: 0, ackFrames: 0, ackFrameDropped: 0,
      cmdBackoff: 0
    };
    // V48：服务端 tick 在负载下若落后于客户端 60Hz 输入，命令队列会堆满。
    // 预测队列过长时暂停发新命令，等 ACK 排空，避免服务端 queue_full / 断线。
    var MAX_PENDING_SEND = 90;
    var match = {
      state: "warmup", mode: "tdm", overtime: false, timeLeft: null, timeLeftAt: 0,
      teams: [0, 0], caps: {}, capsList: [], note: "", capsVisible: false
    };
    var tickRate = 30, cmdRate = 30, serverTickBase = 0, serverTimeBase = 0, serverWallBase = 0, serverWallAt = 0;
    var interpMs = 67, snapTick = 0;
    var INTERP_TICKS = 2, INTERP_MIN_MS = 60, INTERP_MAX_MS = 120;
    var TAG_MIN_MS = 33, HIT_UI_MIN_MS = 60, HUD_THROTTLE_MS = 100;
    var tagPool = [], TAG_POOL_MAX = 16;
    var hudPending = Object.create(null), hudFlushAt = -1e9;
    var interpPos = { x: 0, y: 0, z: 0 }, muzzleTmp = { x: 0, y: 0, z: 0 };
    var rayDir = { x: 0, y: 0, z: 0 };
    var mpPerf = {
      interpUses: 0, tagUpdates: 0, tagWrites: 0, tagSkips: 0,
      textWrites: 0, textSkips: 0, hudFlushes: 0,
      hitQueued: 0, hitWrites: 0, disposed: 0
    };
    var pending = [], lastAcked = 0, ackedTotal = 0, lastAckAt = 0;
    var predWorld = null, predTuning = undefined;
    var viewOffset = { x: 0, y: 0, z: 0 };
    var lastSelfSnap = null, lastSelfSnapAt = 0, lastServerPos = null, justRespawn = false;
    var reconcileErrs = [], reconcile = { count: 0, hard: 0, smooth: 0, lastError: 0, maxError: 0 };
    var pendingShots = [], shotSeq = 0;
    var bannerTimer = null, roundTimer = null, voteTimer = null;
    var tmpV = null, tmpV2 = null, tmpV3 = null, tmpDir = null;
    var avatarProp = null;
    var idMap = null, suppressWeaponNet = false, forceJson = false;

    function nowMs() { return performance.now(); }
    function num(v, d) { return typeof v === "number" && Number.isFinite(v) ? v : d; }
    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
    function idKey(id) { return String(id); }
    function sameId(a, b) { return a != null && b != null && String(a) === String(b); }

    /* ---- V39 · 本地化：播报 / 大厅 / 计分板 / 连接错误码统一走 SXI18n.t ----
       词典缺键（旧构建没有 i18n_extra）时回退中文兜底串，保证 v32–v38 行为不变。 */
    function i18nApi() {
      try { return (typeof window !== "undefined" && window.SXI18n) || null; } catch (e) { return null; }
    }
    function i18nHas(key) {
      var I = i18nApi();
      if (!I) return false;
      try {
        if (typeof I.has === "function") return !!I.has(key);
        return !!(I.dict && I.dict["zh-CN"] && I.dict["zh-CN"][key] != null);
      } catch (e) { return false; }
    }
    /** mpT(key, vars, 中文兜底) */
    function mpT(key, vars, zh) {
      var I = i18nApi();
      if (I && typeof I.t === "function" && i18nHas(key)) {
        try { return I.t(key, vars); } catch (e) {}
      }
      var s = zh == null ? key : String(zh);
      if (vars) {
        s = s.replace(/\{(\w+)\}/g, function (_, name) {
          return vars[name] == null ? "" : String(vars[name]);
        });
      }
      return s;
    }
    function teamName(team) {
      return team === 1 ? mpT("hud.team.red", null, "红队") : mpT("hud.team.blue", null, "蓝队");
    }
    function teamShort(team) {
      return team === 1 ? mpT("ui2.mp.team.short.red", null, "红") : mpT("ui2.mp.team.short.blue", null, "蓝");
    }
    /** 把 root 下所有 data-i18n 节点按当前语言重写（不依赖 ext_ui2 的 refresh） */
    function applyDomKeys(root) {
      if (!root || typeof root.querySelectorAll !== "function") return 0;
      var list, n = 0;
      try { list = root.querySelectorAll("[data-i18n]"); } catch (e) { return 0; }
      for (var i = 0; i < list.length; i++) {
        var el2 = list[i];
        var key = el2.getAttribute("data-i18n");
        if (!key) continue;
        var vars = null;
        var raw = el2.getAttribute("data-i18n-vars");
        if (raw) { try { vars = JSON.parse(raw); } catch (e) { vars = null; } }
        var v = mpT(key, vars, el2.__mpZh != null ? el2.__mpZh : null);
        if (el2.textContent !== v) el2.textContent = v;
        n++;
      }
      return n;
    }

    /* ---- id / nid 映射：二进制快照用数值 netId，JSON 消息用字符串 id ---- */
    function idMaps() {
      if (idMap) return idMap;
      var n = net2();
      idMap = (n && n.IdMap) ? new n.IdMap() : {
        byNid: Object.create(null), byId: Object.create(null),
        clear: function () { this.byNid = Object.create(null); this.byId = Object.create(null); },
        register: function (id, nid) {
          if (id == null && nid == null) return null;
          var sid = String(id != null ? id : nid);
          var nidv = nid != null ? nid : (id != null ? id : null);
          this.byNid[String(nidv)] = sid;
          this.byId[sid] = nidv;
          return sid;
        },
        resolve: function (id) {
          if (id == null) return null;
          var k = String(id);
          if (this.byNid[k] != null) return this.byNid[k];
          if (this.byId[k] != null) return k;
          return k;
        }
      };
      return idMap;
    }
    function resetIdMap() { idMaps().clear(); selfNid = null; }
    function registerId(id, nid) { return idMaps().register(id, nid); }
    /** 任意协议 id（数值 netId / 字符串 id）-> 字符串逻辑 id；未知 id 原样字符串化。 */
    function resolveId(id) { return idMaps().resolve(id); }
    function dist3(a, b) {
      if (!a || !b) return Infinity;
      var dx = num(a.x, 0) - num(b.x, 0), dy = num(a.y, 0) - num(b.y, 0), dz = num(a.z, 0) - num(b.z, 0);
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    function vecFrom(v) {
      if (!v) return null;
      if (Array.isArray(v)) return { x: num(v[0], 0), y: num(v[1], 0), z: num(v[2], 0) };
      if (typeof v === "object") return { x: num(v.x, 0), y: num(v.y, 0), z: num(v.z, 0) };
      return null;
    }

    /* ---- V38 · DOM 引用缓存 / 文本门控 / 100ms 节流 / 可复用对象 ---- */
    var HUD_SELECTORS = {
      room: "[data-mp-room]", team: "[data-mp-team]", score: "[data-mp-score]",
      count: "[data-mp-count]", kd: "[data-mp-kd]", time: "[data-mp-time]", ping: "[data-mp-ping]"
    };
    var MATCH_SELECTORS = { mode: "[data-mp-mode-label]", state: "[data-mp-state]", ot: "[data-mp-ot]" };
    var hudRefs = null, matchRefs = null, capRefs = null, deadRefs = null, scoreRefs = null;
    var hudCacheOff = false;

    function primeHudRefs() {
      hudRefs = {};
      if (!hud) return hudRefs;
      for (var k in HUD_SELECTORS) {
        if (Object.prototype.hasOwnProperty.call(HUD_SELECTORS, k)) hudRefs[k] = hud.querySelector(HUD_SELECTORS[k]);
      }
      return hudRefs;
    }
    /** 缓存命中时不再触发 querySelector；测试可通过 testHudCache(false) 对比旧路径。 */
    function hudRef(name) {
      if (!hudCacheOff && hudRefs && hudRefs[name] !== undefined) return hudRefs[name];
      return hud ? hud.querySelector(HUD_SELECTORS[name]) : null;
    }
    function primeDomRefs() {
      primeHudRefs();
      matchRefs = null; capRefs = null; deadRefs = null; scoreRefs = null;
      if (matchEl) {
        matchRefs = {};
        for (var k in MATCH_SELECTORS) {
          if (Object.prototype.hasOwnProperty.call(MATCH_SELECTORS, k)) matchRefs[k] = matchEl.querySelector(MATCH_SELECTORS[k]);
        }
      }
      if (capsEl) {
        capRefs = ["A", "B", "C"].map(function (id) {
          var cell = capsEl.querySelector("[data-cap=\"" + id + "\"]");
          return { cell: cell, em: cell ? cell.querySelector("em") : null, label: cell ? cell.querySelector("span") : null };
        });
      }
      deadRefs = deadUi ? { sub: deadUi.querySelector(".s") } : null;
      if (scoreUi) {
        scoreRefs = {
          tbody: scoreUi.querySelector("tbody"),
          sub: scoreUi.querySelector("[data-mp-score-sub]"),
          h3: scoreUi.querySelector("h3")
        };
      }
    }
    function deadSub() {
      return deadRefs ? deadRefs.sub : (deadUi ? deadUi.querySelector(".s") : null);
    }
    /** 值不变不写 textContent；比较结果本地缓存，避免读取布局。 */
    function setText(node, v) {
      if (!node) return false;
      if (node._mpText === v) { mpPerf.textSkips++; return false; }
      node._mpText = v;
      node.textContent = v;
      mpPerf.textWrites++;
      return true;
    }
    function queueHudValue(name, v) { hudPending[name] = v; }
    /** score / ping / count 统一按 100ms 节流，只写最后一次值。 */
    function flushHudText(now) {
      now = now == null ? nowMs() : now;
      if (now - hudFlushAt < HUD_THROTTLE_MS) return false;
      var any = false, wrote = false;
      for (var k in hudPending) {
        any = true;
        if (setText(hudRef(k), hudPending[k])) wrote = true;
        delete hudPending[k];
      }
      if (!any) return false;
      hudFlushAt = now;
      if (wrote) mpPerf.hudFlushes++;
      return wrote;
    }
    function recomputeInterp() {
      interpMs = clamp(Math.round(INTERP_TICKS * 1000 / Math.max(1, tickRate)), INTERP_MIN_MS, INTERP_MAX_MS);
      return interpMs;
    }
    function perfStats() {
      return {
        interpMs: interpMs, interpTicks: INTERP_TICKS,
        interpUses: mpPerf.interpUses, remotes: remotes.size,
        tagUpdates: mpPerf.tagUpdates, tagWrites: mpPerf.tagWrites, tagSkips: mpPerf.tagSkips,
        textWrites: mpPerf.textWrites, textSkips: mpPerf.textSkips, hudFlushes: mpPerf.hudFlushes,
        hitQueued: mpPerf.hitQueued, hitWrites: mpPerf.hitWrites, disposed: mpPerf.disposed,
        tagPool: tagPool.length, interpScratch: interpPos, muzzleScratch: muzzleTmp
      };
    }
    function queueHitmarker(kind) {
      kind = kind || "hit";
      var rank = kind === "kill" ? 3 : kind === "head" ? 2 : 1;
      var now = nowMs();
      mpPerf.hitQueued++;
      if (rank > hitUi.rank) { hitUi.rank = rank; hitUi.kind = kind; }
      if (now - hitUi.at >= HIT_UI_MIN_MS) { flushHitmarker(now); return; }
      if (!hitUi.timer) {
        hitUi.timer = setTimeout(function () {
          hitUi.timer = 0;
          flushHitmarker(nowMs());
        }, Math.max(16, HIT_UI_MIN_MS - (now - hitUi.at)));
      }
    }
    function flushHitmarker(now) {
      var kind = hitUi.kind || "hit";
      if (hitUi.timer) { clearTimeout(hitUi.timer); hitUi.timer = 0; }
      hitUi.at = now;
      hitUi.rank = 0;
      hitUi.kind = "hit";
      try { G.hud.hitmarker(kind); } catch (e) {}
      mpPerf.hitWrites++;
    }
    function resetTag(tag) {
      if (!tag) return;
      tag.style.display = "none";
      tag.style.transform = "translate3d(-9999px,-9999px,0) translate(-50%,-100%)";
      tag._mpX = NaN; tag._mpY = NaN; tag._mpVis = null; tag._mpTeam = -1; tag._mpOp = null;
    }
    function releaseTag(r) {
      var tag = r && r.tagEl;
      if (r) r.tagEl = null;
      if (!tag) return;
      resetTag(tag);
      if (tagPool.length < TAG_POOL_MAX) tagPool.push(tag);
      else if (tag.remove) { try { tag.remove(); } catch (e) {} }
    }
    function clearTagPool() {
      for (var i = 0; i < tagPool.length; i++) { try { if (tagPool[i].remove) tagPool[i].remove(); } catch (e) {} }
      tagPool.length = 0;
    }
    var hitUi = { at: 0, rank: 0, kind: "hit", timer: 0 };

    // 服务端只支持 tdm / chaos / domination；未知模式不再默认 tdm（服务端会回 error）。
    function modeKey(mode) {
      var m = String(mode == null ? "" : mode).toLowerCase();
      if (!m) return "";
      if (m === "dom" || m === "control" || m === "capture") return "domination";
      if (m === "pve" || m === "coop" || m === "survival") return "coop";
      if (m === "bomb" || m === "defuse") return "bomb";
      if (m === "tdm" || m === "chaos" || m === "domination") return m;
      return "";
    }
    var MODE_ZH = { tdm: "团队死斗", chaos: "大乱战", domination: "据点争夺", bomb: "爆破", coop: "潮汐防线" };
    var MAP_ZH = { harbor: "港区", depot: "冷库", ship: "货轮", core: "核心舱" };
    var MAP_TITLE_ZH = { harbor: "四号泊位", depot: "冷链仓库", ship: "外锚地", core: "核心舱" };
    function modeText() {
      if (MODE_ZH[modeId]) return mpT("ui2.mp.modeName." + modeId, null, MODE_ZH[modeId]);
      return mpT("ui2.mp.modeName.other", null, "对战");
    }
    function modeTeamSize() {
      if (modeId === "tdm" || modeId === "bomb") return mpT("ui2.mp.teamsize." + modeId, null, "4v4");
      if (modeId === "chaos") return mpT("ui2.mp.teamsize.chaos", null, "6v6");
      if (modeId === "domination") return mpT("ui2.mp.teamsize.domination", null, "5v5");
      if (modeId === "coop") return mpT("ui2.mp.teamsize.coop", null, "1–4 人");
      return "";
    }
    function modeLabel() { return modeText() + (modeTeamSize() ? " · " + modeTeamSize() : ""); }
    function mapName(id) {
      var key = MAP_ZH[id] ? id : "harbor";
      return mpT("ui2.mp.map." + key, null, MAP_ZH[id] || MAP_ZH.harbor);
    }
    function mapTitle(id) {
      var key = MAP_TITLE_ZH[id] ? id : "harbor";
      return mpT("ui2.mp.mapTitle." + key, null, MAP_TITLE_ZH[id] || MAP_TITLE_ZH.harbor);
    }

    function net2() { return typeof window !== "undefined" ? window.SX_NET2 : null; }

    function defaultUrl() {
      try {
        var q = new URLSearchParams(location.search).get("mp");
        if (q) return q;
        var ls = localStorage.getItem("saltline.mp.url");
        if (ls) return ls;
        if (location.protocol.indexOf("https") === 0) {
          return "wss://" + location.hostname + ":9100";
        }
        if (location.protocol.indexOf("http") === 0 && location.hostname && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
          return "ws://" + location.hostname + ":9100";
        }
      } catch (e) {}
      return "ws://172.16.17.189:9100";
    }

    function el(tag, cls, text) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      return e;
    }
    function htmlEl(tag, cls, html) {
      var e = el(tag, cls);
      if (html != null) e.innerHTML = html;
      return e;
    }

    function sanitizeName(name) {
      var n = net2();
      if (n && n.sanitizeName) return n.sanitizeName(name, "猫");
      return String(name == null ? "" : name).replace(/[\u0000-\u001f\u007f<>"'&\\]/g, "").replace(/\s+/g, " ").trim().slice(0, 16) || "猫";
    }
    function esc(s) {
      return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
        return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
      });
    }
    /** 服务器错误码 -> 词典键；词典缺该码时用服务器原文，再回退通用兜底 */
    function friendly(code, message) {
      var key = code == null ? "" : String(code);
      var I = i18nApi();
      if (!I || typeof I.t !== "function") {
        var n0 = net2();
        if (n0 && n0.friendlyError) return n0.friendlyError(code, message);
        return message || ("服务器错误" + (key ? "（" + key + "）" : ""));
      }
      var ek = key ? "ui2.mp.err." + key : "";
      if (ek && i18nHas(ek)) return mpT(ek, null, null);
      var raw = (typeof message === "string" && message.trim()) ? String(message).slice(0, 160) : "";
      if (raw) return raw;
      if (key) return mpT("ui2.mp.err.withCode", { code: key.slice(0, 32) }, "服务器错误（{code}）");
      return mpT("ui2.mp.err.server", null, "服务器错误");
    }
    function checkUrl(raw) {
      var n = net2();
      var res = (n && n.validateUrl) ? n.validateUrl(raw) : null;
      if (res && !res.ok) {
        var ek = res.error ? "ui2.mp.err." + res.error : "";
        if (ek && i18nHas(ek)) res.message = mpT(ek, null, res.message);
        else if (!res.message) res.message = mpT("ui2.mp.err.bad_url", null, "只允许 ws:// 或 wss:// 地址");
        return res;
      }
      if (res) return res;
      var u = String(raw || "").trim();
      if (!/^wss?:\/\//i.test(u)) {
        return { ok: false, error: "bad_scheme", message: mpT("ui2.mp.err.bad_scheme", null, "只允许 ws:// 或 wss:// 地址") };
      }
      return { ok: true, url: u };
    }

    /* ------------------------------------------------------------ CSS / UI */
    /** 记录 data-i18n 节点的中文原文，词典缺键时作兜底 */
    function primeZh(root) {
      if (!root || typeof root.querySelectorAll !== "function") return 0;
      var list;
      try { list = root.querySelectorAll("[data-i18n]"); } catch (e) { return 0; }
      for (var i = 0; i < list.length; i++) {
        var node = list[i];
        if (node.__mpZh == null) node.__mpZh = node.textContent;
      }
      return list.length;
    }
    function mpMenuLabel() { return mpT("ui2.menu.mp", null, "联机对战"); }
    function applyTitleEntry() {
      var list = document.querySelectorAll('[data-x="mp"]');
      var label = mpMenuLabel();
      for (var i = 0; i < list.length; i++) {
        if (list[i].textContent !== label) list[i].textContent = label;
      }
    }
    /** 语言切换 / 启动后：静态骨架按 data-i18n 重绘，动态文本（状态/据点/计分板）重新渲染 */
    function applyLang() {
      try {
        var roots = [ui, hud, matchEl, capsEl, pause, deadUi, scoreUi, bannerEl];
        for (var i = 0; i < roots.length; i++) {
          if (!roots[i]) continue;
          primeZh(roots[i]);
          applyDomKeys(roots[i]);
        }
        if (scoreUi) {
          var extra = [scoreUi._round, scoreUi._load, scoreUi._vote];
          for (var j = 0; j < extra.length; j++) {
            if (!extra[j]) continue;
            primeZh(extra[j]);
            applyDomKeys(extra[j]);
          }
        }
        applyTitleEntry();
        try { if (window.__SX_NET) window.__SX_NET.modes = modesMap(); } catch (e) {}
        // 队伍名只写文本、不改可见性，标题界面也安全
        updateTeamHud();
        if (scoreRefs && scoreRefs.h3) {
          setText(scoreRefs.h3, mpT("ui2.mp.score.title", { mode: modeText() }, "计分板 · " + modeText()));
        }
        // 只在联机 HUD 已显示时重绘动态部分：标题界面不能把状态条/回合横幅点亮
        if (active || (hud && hud.classList.contains("on"))) {
          if (matchEl && matchRefs) setMatchState(match.state);
          renderCaps();
          if (scoreVisible) renderScore();
          refreshObjective();
          refreshMapHud();
        }
      } catch (e) {}
    }

    function style() {
      var css = "" +
        ".x-mp{position:absolute;inset:0;z-index:80;display:none;pointer-events:auto;color:var(--bone);}" +
        ".x-mp.on{display:block;}" +
        ".x-mp-veil{position:absolute;inset:0;background:rgba(5,7,9,.95);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);}" +
        ".x-mp-panel{position:relative;max-width:540px;margin:0 auto;top:50%;transform:translateY(-50%);padding:28px 30px;border:1px solid rgba(232,228,218,.18);background:rgba(11,13,15,.9);}" +
        ".x-mp-panel h2{font:900 40px/1 var(--f-display);letter-spacing:.12em;margin:8px 0 4px;}" +
        ".x-mp-sub{font:500 12px/1.6 var(--f-mono);color:var(--steel);letter-spacing:.08em;margin-bottom:16px;}" +
        ".x-mp-row{display:flex;align-items:center;gap:12px;margin:10px 0;}" +
        ".x-mp-row label{width:70px;font:600 10px/1.4 var(--f-mono);letter-spacing:.14em;color:var(--steel);}" +
        ".x-mp-row input{flex:1;min-width:0;background:rgba(255,255,255,.04);border:1px solid rgba(232,228,218,.18);color:var(--bone);font:500 13px/1.4 var(--f-label);padding:9px 10px;outline:none;}" +
        ".x-mp-row input:focus{border-color:var(--signal);}" +
        ".x-mp-row select{flex:1;min-width:0;background:rgba(255,255,255,.04);border:1px solid rgba(232,228,218,.18);color:var(--bone);font:500 13px/1.4 var(--f-label);padding:9px 10px;outline:none;}" +
        ".x-mp-status{min-height:20px;font:500 11px/1.5 var(--f-mono);color:var(--signal);margin:10px 0;}" +
        ".x-mp-actions{display:flex;gap:10px;margin-top:6px;}" +
        ".x-mp-note{margin-top:14px;font:500 10px/1.5 var(--f-mono);color:var(--steel);}" +
        ".x-mp-hud{position:absolute;left:50%;top:calc(78px + var(--sat));transform:translateX(-50%);z-index:62;display:none;pointer-events:none;padding:6px 12px;background:rgba(5,7,9,.66);border:1px solid rgba(232,228,218,.14);font:600 10px/1.4 var(--f-mono);letter-spacing:.12em;white-space:nowrap;}" +
        ".x-mp-hud.on{display:flex;gap:14px;}" +
        ".x-mp-hud b{color:var(--signal);font-weight:600;}" +
        ".x-mp-pause{position:absolute;inset:0;z-index:82;display:none;pointer-events:auto;background:rgba(4,6,8,.72);}" +
        ".x-mp-pause.on{display:block;}" +
        ".x-mp-pause .box{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);padding:26px 30px;border:1px solid rgba(232,228,218,.2);background:rgba(10,12,14,.95);text-align:center;}" +
        ".x-mp-pause h3{font:900 30px/1.1 var(--f-display);letter-spacing:.14em;margin:0 0 14px;}" +
        ".x-mp-pause .btn{display:block;width:220px;margin:8px auto;}" +
        ".x-mp-tag{position:absolute;left:0;top:0;transform:translate(-50%,-100%);will-change:transform;contain:layout style;pointer-events:none;z-index:58;font:600 11px/1.3 var(--f-label);color:var(--bone);text-shadow:0 1px 3px #000;white-space:nowrap;}" +
        ".x-mp-tag b{display:block;font-weight:600;letter-spacing:.04em;}" +
        ".x-mp-tag i{display:block;width:64px;height:4px;margin-top:2px;background:rgba(0,0,0,.55);}" +
        ".x-mp-tag i em{display:block;height:100%;transform-origin:left;background:#9cff6a;}" +
        ".x-mp-tag .bot{display:inline-block;margin-left:4px;padding:0 3px;font:600 8px/1.5 var(--f-mono);letter-spacing:.08em;color:#0b0d0f;background:#ffd166;}" +
        ".x-mp-tag.team1 b{color:#ff8a7a;}" +
        ".x-mp-tag.team0 b{color:#7fc8ff;}" +
        ".x-mp-dead{position:absolute;inset:0;z-index:78;display:none;pointer-events:none;background:radial-gradient(circle at 50% 45%,rgba(80,0,0,.15),rgba(0,0,0,.55));}" +
        ".x-mp-dead.on{display:block;}" +
        ".x-mp-dead .t{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);text-align:center;font:900 38px/1.1 var(--f-display);letter-spacing:.14em;color:#ff8a6a;text-shadow:0 2px 18px #000;}" +
        ".x-mp-dead .s{position:absolute;left:50%;top:54%;transform:translate(-50%,-50%);font:500 12px/1.5 var(--f-mono);letter-spacing:.12em;color:var(--bone-dim);}" +
        ".x-mp-score{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:79;display:none;min-width:520px;max-width:86vw;padding:20px 24px;background:rgba(7,9,11,.94);border:1px solid rgba(232,228,218,.2);pointer-events:none;}" +
        ".x-mp-score.on{display:block;}" +
        ".x-mp-score h3{margin:0 0 6px;font:900 22px/1 var(--f-display);letter-spacing:.16em;color:var(--signal);}" +
        ".x-mp-score-sub{margin:0 0 12px;font:500 10px/1.5 var(--f-mono);letter-spacing:.1em;color:var(--steel);}" +
        ".x-mp-score table{width:100%;border-collapse:collapse;font:500 12px/1.6 var(--f-mono);}" +
        ".x-mp-score th{color:var(--steel);text-align:left;font-weight:500;letter-spacing:.12em;padding-bottom:6px;}" +
        ".x-mp-score td{padding:4px 0;border-top:1px solid rgba(232,228,218,.08);}" +
        ".x-mp-score td.k{color:var(--signal);}" +
        ".x-mp-score .bot{display:inline-block;margin-left:5px;padding:0 3px;font:600 8px/1.6 var(--f-mono);letter-spacing:.08em;color:#0b0d0f;background:#ffd166;}" +
        ".x-mp-hud .kd{color:var(--bone);}" +
        ".x-mp-hud .team0{color:#7fc8ff;}" +
        ".x-mp-hud .team1{color:#ff8a7a;}" +
        ".x-mp-round{position:absolute;left:50%;top:36%;transform:translate(-50%,-50%);z-index:81;display:none;pointer-events:none;text-align:center;padding:22px 34px;background:rgba(6,8,10,.86);border:1px solid rgba(232,228,218,.2);}" +
        ".x-mp-round.on{display:block;}" +
        ".x-mp-round .t{font:900 36px/1.1 var(--f-display);letter-spacing:.14em;color:var(--signal);}" +
        ".x-mp-round .s{margin-top:8px;font:500 12px/1.5 var(--f-mono);color:var(--bone-dim);letter-spacing:.1em;}" +
        ".x-mp-vote{position:absolute;left:50%;top:58%;transform:translate(-50%,-50%);z-index:81;display:none;pointer-events:auto;padding:16px 20px;background:rgba(6,8,10,.9);border:1px solid rgba(232,228,218,.2);text-align:center;}" +
        ".x-mp-vote.on{display:block;}" +
        ".x-mp-vote .t{font:600 11px/1.4 var(--f-mono);letter-spacing:.14em;color:var(--signal);margin-bottom:10px;}" +
        ".x-mp-vote .opts{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;}" +
        ".x-mp-vote button{min-width:100px;}" +
        ".x-mp-vote button.sel{border-color:var(--signal);color:var(--signal);}" +
        ".x-mp-loading{position:absolute;inset:0;z-index:85;display:none;align-items:center;justify-content:center;flex-direction:column;gap:10px;background:rgba(5,7,9,.86);pointer-events:none;}" +
        ".x-mp-loading.on{display:flex;}" +
        ".x-mp-loading b{font:900 30px/1.1 var(--f-display);letter-spacing:.16em;color:var(--signal);}" +
        ".x-mp-loading span{font:500 11px/1.4 var(--f-mono);letter-spacing:.14em;color:var(--steel);}" +
        ".x-hit-dir{position:absolute;left:50%;top:50%;width:150px;height:150px;margin:-75px 0 0 -75px;pointer-events:none;opacity:0;z-index:60;}" +
        ".x-hit-dir.on{opacity:1;}" +
        ".x-hit-dir i{position:absolute;left:50%;top:2px;width:3px;height:22px;margin-left:-1px;background:linear-gradient(#ff5a5a,rgba(255,90,90,0));box-shadow:0 0 12px rgba(255,90,90,.8);}" +
        ".x-hit-dir::after{content:'';position:absolute;left:50%;top:0;width:0;height:0;margin-left:-7px;border-left:7px solid transparent;border-right:7px solid transparent;border-top:10px solid #ff5a5a;}" +
        ".x-mp-match{position:absolute;left:50%;top:calc(112px + var(--sat));transform:translateX(-50%);z-index:62;display:none;align-items:center;gap:10px;pointer-events:none;padding:4px 10px;background:rgba(5,7,9,.5);border:1px solid rgba(232,228,218,.1);font:600 9px/1.4 var(--f-mono);letter-spacing:.12em;color:var(--steel);white-space:nowrap;}" +
        ".x-mp-match.on{display:flex;}" +
        ".x-mp-match b{color:var(--signal);font-weight:600;}" +
        ".x-mp-match .ot{color:#ffd166;}" +
        ".x-mp-caps{position:absolute;left:50%;top:calc(142px + var(--sat));transform:translateX(-50%);z-index:62;display:none;gap:6px;pointer-events:none;}" +
        ".x-mp-caps.on{display:flex;}" +
        ".x-mp-cap{display:flex;align-items:center;gap:5px;padding:3px 7px;background:rgba(5,7,9,.58);border:1px solid rgba(232,228,218,.12);font:600 9px/1.4 var(--f-mono);letter-spacing:.08em;color:var(--steel);}" +
        ".x-mp-cap b{font:900 12px/1 var(--f-display);}" +
        ".x-mp-cap i{display:block;width:42px;height:3px;background:rgba(255,255,255,.16);}" +
        ".x-mp-cap i em{display:block;height:100%;width:0;background:currentColor;transition:width .2s linear;}" +
        ".x-mp-cap.team0{color:#7fc8ff;}" +
        ".x-mp-cap.team1{color:#ff8a7a;}" +
        ".x-mp-cap.contested{color:#ffd166;}" +
        ".x-mp-banner{position:absolute;left:50%;top:22%;transform:translate(-50%,-50%);z-index:83;display:none;pointer-events:none;padding:8px 18px;background:rgba(6,8,10,.88);border-left:2px solid var(--signal);font:600 12px/1.5 var(--f-mono);letter-spacing:.12em;color:var(--bone);text-align:center;max-width:80vw;}" +
        ".x-mp-banner.on{display:block;}";
      var s = document.createElement("style");
      s.textContent = css;
      document.head.appendChild(s);
    }

    function buildUI() {
      style();
      ui = el("div", "x-mp");
      ui.innerHTML =
        '<div class="x-mp-veil"></div><div class="x-mp-panel">' +
          '<div class="m-k" data-i18n="ui2.mp.kicker">几猫 · 联机对战</div>' +
          '<h2 data-i18n="ui2.mp.title">多人对战</h2>' +
          '<div class="x-mp-sub" data-i18n="ui2.mp.sub">2–12 人 · 30Hz 权威服务器 · 协议 2.0 二进制 · 据点争夺</div>' +
          '<div class="x-mp-row"><label data-i18n="ui2.mp.lobby.name">呼号</label><input data-mp-name maxlength="16"></div>' +
          '<div class="x-mp-row"><label data-i18n="ui2.mp.lobby.room">房间</label><input data-mp-room maxlength="24" value="harbor-1"></div>' +
          '<div class="x-mp-row"><label data-i18n="ui2.mp.lobby.map">地图</label><select data-mp-map>' +
            '<option value="harbor" data-i18n="ui2.mp.mapOpt.harbor">四号泊位 · 港区</option>' +
            '<option value="depot" data-i18n="ui2.mp.mapOpt.depot">冷链仓库 · 室内</option>' +
            '<option value="ship" data-i18n="ui2.mp.mapOpt.ship">外锚地 · 货轮甲板</option>' +
            '<option value="core" data-i18n="ui2.mp.mapOpt.core">核心舱 · 反应堆</option>' +
          '</select></div>' +
          '<div class="x-mp-row"><label data-i18n="ui2.mp.lobby.mode">模式</label><select data-mp-mode>' +
            '<option value="tdm" data-i18n="ui2.mp.mode.tdm">团队死斗 · 4v4</option>' +
            '<option value="chaos" data-i18n="ui2.mp.mode.chaos">大乱战 · 6v6</option>' +
            '<option value="domination" data-i18n="ui2.mp.mode.domination">据点争夺 · 5v5</option>' +
          '</select></div>' +
          '<div class="x-mp-row"><label data-i18n="ui2.mp.lobby.url">服务器</label><input data-mp-url></div>' +
          '<div class="x-mp-status"></div>' +
          '<div class="x-mp-actions"><button class="btn primary" data-mp-join data-i18n="ui2.mp.lobby.join">加入战斗</button>' +
          '<button class="btn" data-mp-back data-i18n="ui2.mp.lobby.back">返回</button></div>' +
          '<p class="x-mp-note" data-i18n="ui2.mp.lobby.note">V36：二进制快照 · 预测回放 · 服务器权威命中 · 断线重连 3 次（1s/2s/4s）</p>' +
        '</div>';
      document.getElementById("ui").appendChild(ui);
      ui.querySelector("[data-mp-name]").value = localStorage.getItem("saltline.mp.name") || names[Math.floor(Math.random() * names.length)];
      ui.querySelector("[data-mp-url]").value = defaultUrl();
      ui.querySelector("[data-mp-map]").value = localStorage.getItem("saltline.mp.map") || "harbor";
      ui.querySelector("[data-mp-mode]").value = localStorage.getItem("saltline.mp.mode") || "tdm";
      ui.querySelector("[data-mp-back]").onclick = function () { closeLobby(); };
      ui.querySelector("[data-mp-join]").onclick = function () {
        var n = ui.querySelector("[data-mp-name]").value.trim() || "猫";
        var r = ui.querySelector("[data-mp-room]").value.trim() || "harbor-1";
        var u = ui.querySelector("[data-mp-url]").value.trim() || defaultUrl();
        var mp = ui.querySelector("[data-mp-map]").value || "harbor";
        var md = ui.querySelector("[data-mp-mode]").value || "tdm";
        var checked = checkUrl(u);
        if (!checked.ok) { ui.querySelector(".x-mp-status").textContent = checked.message; return; }
        u = checked.url;
        localStorage.setItem("saltline.mp.name", n);
        localStorage.setItem("saltline.mp.url", u);
        localStorage.setItem("saltline.mp.map", mp);
        localStorage.setItem("saltline.mp.mode", md);
        join(u, n, r, mp, md);
      };
      hud = htmlEl("div", "x-mp-hud", '<b data-mp-room>harbor-1</b><span class="team0" data-mp-team>' +
        teamName(0) + '</span><span data-mp-score>0 : 0</span><span data-mp-count>' +
        mpT("ui2.mp.online", { n: 0 }, "{n} 在线") + '</span><span class="kd" data-mp-kd>0K / 0D</span>' +
        '<span data-mp-time>--:--</span><span data-mp-ping>-- ms</span>');
      document.getElementById("ui").appendChild(hud);
      matchEl = htmlEl("div", "x-mp-match", '<span data-mp-mode-label>' + modeText() + '</span><b data-mp-state>' +
        mpT("ui2.mp.state.warmup", null, "热身") + '</b><span class="ot" data-mp-ot></span>');
      document.getElementById("ui").appendChild(matchEl);
      capsEl = el("div", "x-mp-caps", "");
      ["A", "B", "C"].forEach(function (id) {
        var c = el("div", "x-mp-cap");
        c.setAttribute("data-cap", id);
        var b = el("b", null, id);
        var bar = el("i", null, "");
        var em = el("em", null, "");
        bar.appendChild(em);
        var label = el("span", null, mpT("ui2.mp.cap.neutral", null, "中立"));
        c.appendChild(b); c.appendChild(bar); c.appendChild(label);
        capsEl.appendChild(c);
      });
      document.getElementById("ui").appendChild(capsEl);
      bannerEl = el("div", "x-mp-banner", "");
      document.getElementById("ui").appendChild(bannerEl);
      pause = htmlEl("div", "x-mp-pause",
        '<div class="box"><h3 data-i18n="ui2.mp.pause.title">联机暂停</h3>' +
        '<button class="btn primary" data-mp-resume data-i18n="ui2.mp.pause.resume">继续</button>' +
        '<button class="btn" data-mp-exit data-i18n="ui2.mp.pause.exit">退出联机</button></div>');
      document.getElementById("ui").appendChild(pause);
      deadUi = htmlEl("div", "x-mp-dead", '<div class="t" data-i18n="ui2.mp.death.title">阵亡</div>' +
        '<div class="s">' + mpT("ui2.mp.death.respawn", null, "3 秒后重生") + '</div>');
      document.getElementById("ui").appendChild(deadUi);
      scoreUi = htmlEl("div", "x-mp-score", '<h3>' +
        mpT("ui2.mp.score.title", { mode: modeText() }, "计分板 · " + modeText()) + '</h3>' +
        '<div class="x-mp-score-sub" data-mp-score-sub></div><table><thead><tr>' +
        '<th data-i18n="ui2.mp.score.th.callsign">呼号</th>' +
        '<th data-i18n="ui2.mp.score.th.team">队伍</th>' +
        '<th data-i18n="ui2.mp.score.th.kills">击杀</th>' +
        '<th data-i18n="ui2.mp.score.th.deaths">死亡</th>' +
        '<th data-i18n="ui2.mp.score.th.ping">延迟</th>' +
        '</tr></thead><tbody></tbody></table>');
      document.getElementById("ui").appendChild(scoreUi);
      hitDirEl = htmlEl("div", "x-hit-dir", "<i></i>");
      document.getElementById("ui").appendChild(hitDirEl);
      var roundUi = htmlEl("div", "x-mp-round", '<div class="t" data-mp-round-t></div>' +
        '<div class="s" data-mp-round-s>' + mpT("ui2.mp.round.next", null, "下一回合即将开始") + '</div>');
      document.getElementById("ui").appendChild(roundUi);
      scoreUi._round = roundUi;
      var loadUi = htmlEl("div", "x-mp-loading", '<b data-mp-load-t></b>' +
        '<span data-i18n="ui2.mp.loading">正在准备地图 · 编译着色器</span>');
      document.getElementById("ui").appendChild(loadUi);
      scoreUi._load = loadUi;
      var voteUi = htmlEl("div", "x-mp-vote", '<div class="t" data-i18n="ui2.mp.vote.title">下一张地图</div><div class="opts"></div>');
      document.getElementById("ui").appendChild(voteUi);
      scoreUi._vote = voteUi;
      addEventListener("keydown", function (e) {
        if (e.code !== "Tab" || !active) return;
        e.preventDefault(); e.stopImmediatePropagation();
        scoreVisible = !scoreVisible;
        scoreUi.classList.toggle("on", scoreVisible);
        if (scoreVisible) renderScore();
      }, true);
      pause.querySelector("[data-mp-resume]").onclick = function () { pause.classList.remove("on"); try { G.input.requestLock(); } catch (e) {} };
      pause.querySelector("[data-mp-exit]").onclick = function () { leave(); };
      addEventListener("keydown", function (e) {
        if (e.code !== "Escape" || !active) return;
        e.preventDefault(); e.stopImmediatePropagation();
        pause.classList.add("on"); try { G.input.exitLock(); } catch (err) {}
      }, true);
      // V38：所有固定步会读的节点在构建结束时只查一次
      primeDomRefs();
      // V39：静态骨架首绘（词典未就绪时用中文原文兜底），之后随 sx:lang 重绘
      applyLang();
    }

    function addTitleEntry() {
      var acts = document.querySelector(".m-title .m-actions");
      if (!acts || acts.querySelector('[data-x="mp"]')) return;
      var b = el("button", "btn", mpMenuLabel());
      b.setAttribute("data-x", "mp");
      b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); openLobby(); });
      acts.insertBefore(b, acts.children[1] || null);
    }

    function openLobby() {
      ui.classList.add("on");
      ui.querySelector(".x-mp-status").textContent = "";
      ui.querySelector("[data-mp-url]").value = defaultUrl();
      hideBanner();
    }
    function closeLobby() { ui.classList.remove("on"); }
    function showStatus(t) { if (ui) ui.querySelector(".x-mp-status").textContent = t || ""; }

    function showBanner(text, secs) {
      if (!bannerEl) return;
      bannerEl.textContent = text || "";
      bannerEl.classList.toggle("on", !!text);
      clearTimeout(bannerTimer);
      if (text && secs) bannerTimer = setTimeout(function () { bannerEl.classList.remove("on"); }, secs * 1000);
    }
    function hideBanner() { if (bannerEl) bannerEl.classList.remove("on"); clearTimeout(bannerTimer); }

    /* ------------------------------------------------------------ 连接 */
    function join(u, name, r, map, mode) {
      var checked = checkUrl(u);
      if (!checked.ok) { showStatus(checked.message); return false; }
      u = checked.url;
      if (joining || active) {
        if (active) return false;
      }
      joining = true;
      playerName = sanitizeName(name);
      room = String(r || "harbor-1").slice(0, 24);
      mapId = (map === "depot" || map === "ship" || map === "core") ? map : "harbor";
      modeId = modeKey(mode);
      url = u;
      net.bin = false;
      net.caps = [];
      net.ackFrames = 0;
      net.ackFrameDropped = 0;
      lastAckAt = 0;
      manualClose = false;
      fatalConn = false;
      reconnectAttempts = 0;
      clearReconnect();
      conn = { url: u, name: playerName, room: room, map: mapId, mode: modeId };
      showStatus(mpT("ui2.mp.conn.connecting", { url: u }, "连接 {url} …"));
      closeSocket();
      connect(false);
      return true;
    }

    function closeSocket() {
      var old = ws;
      ws = null;
      if (!old) return;
      try {
        old.onopen = old.onmessage = old.onerror = old.onclose = null;
        old.close();
      } catch (e) {}
    }

    function connect(isReconnect) {
      if (!conn) return;
      var gen = ++session;
      var wsUrl = conn.url;
      try {
        ws = new WebSocket(wsUrl);
        ws.binaryType = "arraybuffer";
      } catch (e) {
        joining = false;
        showStatus(mpT("ui2.mp.conn.invalid", { msg: (e && e.message ? e.message : e) }, "地址无效：{msg}"));
        return;
      }
      var sock = ws;
      sock.onopen = function () {
        if (gen !== session) return;
        if (!conn) return;
        try {
          sock.send(JSON.stringify({
            t: "join", name: conn.name, room: conn.room, map: conn.map, mode: conn.mode,
            caps: ["bin"], protocol: 2, version: 2
          }));
        } catch (e) {}
        if (isReconnect) showStatus(mpT("ui2.mp.conn.reconnected", null, "已重新连接，等待服务器恢复…"));
        else showStatus(mpT("ui2.mp.conn.ready", null, "已连接，等待服务器分配…"));
      };
      sock.onerror = function () {
        if (gen !== session) return;
        if (!joined) showStatus(mpT("ui2.mp.conn.failed", null, "连接失败，检查服务器与网络"));
      };
      sock.onclose = function (ev) {
        if (gen !== session) return;
        onSocketClose(ev);
      };
      sock.onmessage = function (ev) {
        if (gen !== session) return;
        onWsMessage(ev, gen);
      };
    }

    function clearReconnect() {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    function onSocketClose(ev) {
      joining = false;
      if (manualClose || !conn) { net.lost = false; return; }
      var code = ev && ev.code;
      if (code === 4001 || code === 4008) {
        fatalConn = true;
        showBanner(code === 4001 ? friendly("room_full") : friendly("rate_limit"), 6);
        showStatus(code === 4001 ? friendly("room_full") : friendly("rate_limit"));
        if (!active) closeLobby();
        return;
      }
      if (fatalConn) {
        showBanner(mpT("ui2.mp.conn.closed", { reason: friendly(null, (ev && ev.reason) || "") }, "连接已关闭 · {reason}"), 6);
        return;
      }
      net.lost = true;
      if (!active && !joined) {
        showStatus(mpT("ui2.mp.conn.lost", null, "连接已断开，正在重试…"));
      }
      scheduleReconnect();
    }

    function scheduleReconnect() {
      clearReconnect();
      if (reconnectAttempts >= 3) {
        showBanner(mpT("ui2.mp.conn.reconnectFailed", null, "重连失败 · 已断开"), 6);
        showStatus(mpT("ui2.mp.conn.reconnectFailedStatus", null, "重连失败：服务器不可达"));
        try { leave(true); } catch (e) {}
        return;
      }
      var attempt = ++reconnectAttempts;
      var delay = 1000 * Math.pow(2, attempt - 1);
      var text = mpT("ui2.mp.conn.retry", { s: delay / 1000, n: attempt }, "连接中断 · {s}s 后重连（{n}/3）");
      showBanner(text, Math.max(3, delay / 1000 + 1));
      showStatus(text);
      reconnectTimer = setTimeout(function () {
        reconnectTimer = null;
        if (manualClose || !conn || fatalConn) return;
        connect(true);
      }, delay);
    }

    function onWsMessage(ev, gen) {
      var data = ev && ev.data;
      if (typeof data === "string") {
        var m = null;
        try { m = JSON.parse(data); } catch (e) { net.decodeErrors++; return; }
        if (m && typeof m === "object") onMsg(m);
        return;
      }
      if (data instanceof ArrayBuffer) { onBinary(data, gen); return; }
      if (data && typeof data.byteLength === "number" && !(data instanceof Blob)) {
        try { onBinary(data.buffer ? data.buffer.slice(data.byteOffset || 0, (data.byteOffset || 0) + data.byteLength) : data, gen); } catch (e) {}
        return;
      }
      if (typeof Blob !== "undefined" && data instanceof Blob) {
        var g = gen;
        data.arrayBuffer().then(function (buf) { if (g === session) onBinary(buf, g); }).catch(function () {});
      }
    }

    function onBinary(buf, gen) {
      if (gen !== session) return;
      var N = window.SALT_NET;
      if (!N) { net.decodeErrors++; return; }
      // 先按 first byte 分流：ACK 小帧（OP.ACK=5）不走快照解码
      var op = -1;
      try { op = new DataView(buf).getUint8(0); } catch (e) {}
      if (op === 5 || (N.OP && op === N.OP.ACK)) {
        var ackMsg = null;
        try { ackMsg = N.decodeAck ? N.decodeAck(buf) : null; } catch (e) { ackMsg = null; }
        if (ackMsg && ackMsg.seq != null) applyAckFrame(ackMsg.seq);
        return;
      }
      if (!N.decodeSnapshot) { net.decodeErrors++; return; }
      var snap = null;
      try { snap = N.decodeSnapshot(buf); } catch (e) { net.decodeErrors++; return; }
      if (!snap || !snap.players) return;
      net.bin = true;
      net.snapBinary++;
      net.lastBinaryAt = nowMs();
      rx.binary++;
      syncClock(snap.tick, null);
      applyBinarySnapshot(snap);
    }

    /* ------------------------------------------------------------ 时钟 / 快照 */
    function syncClock(tick, serverTime) {
      if (typeof tick === "number" && tick > 0) {
        serverTickBase = tick;
        serverTimeBase = nowMs();
        net.lastTick = tick;
      }
      if (typeof serverTime === "number" && serverTime > 0) {
        serverWallBase = serverTime;
        serverWallAt = nowMs();
      }
    }
    function estimatedServerTick() {
      if (!serverTimeBase) return net.lastTick || 0;
      return serverTickBase + Math.floor((nowMs() - serverTimeBase) / 1000 * tickRate);
    }
    function estimatedServerTime() {
      if (!serverWallAt) return Date.now();
      return serverWallBase + (nowMs() - serverWallAt);
    }
    function viewTick() {
      return Math.max(0, estimatedServerTick() - Math.round(interpMs / 1000 * tickRate));
    }

    function syncRoster(list) {
      (list || []).forEach(function (p) {
        if (!p || p.id == null) return;
        var pid = registerId(resolveId(p.id), p.nid != null ? p.nid : p.netId);
        var k = idKey(pid);
        var r = roster.get(k) || { id: pid };
        if (typeof p.name === "string" && p.name) r.name = sanitizeName(p.name);
        if (p.team != null) r.team = p.team === 1 ? 1 : 0;
        if (p.kills != null) r.kills = p.kills | 0;
        if (p.deaths != null) r.deaths = p.deaths | 0;
        if (p.ping != null) r.ping = p.ping | 0;
        if (p.bot != null) r.bot = !!p.bot;
        if (p.isBot != null) r.bot = !!p.isBot;
        if (p.ai != null) r.bot = !!p.ai;
        roster.set(k, r);
      });
    }
    function rosterOf(id) { return roster.get(idKey(resolveId(id))) || {}; }
    function displayName(id) {
      if (id == null) return "几猫";
      if (sameId(resolveId(id), selfId)) return playerName || "你";
      var r = rosterOf(id);
      return r.name || "几猫";
    }
    function isBotPlayer(p) {
      if (!p) return false;
      if (p.bot || p.isBot || p.ai) return true;
      var n = String(p.name || rosterOf(p.id).name || "");
      return /(^|[-_\s])(bot|ai)([-_\s]|$)|机器人/i.test(n);
    }

    function normalizePlayer(raw, binary) {
      var rid = resolveId(raw.id);
      var k = idKey(rid);
      var r = roster.get(k) || {};
      var x = num(raw.x, num(r.x, 0));
      var y = num(raw.y, num(r.y, 0));
      var z = num(raw.z, num(r.z, 0));
      var hp = raw.hp != null ? num(raw.hp, 100) : num(r.hp, 100);
      var armor = raw.armor != null ? num(raw.armor, 50) : num(r.armor, 50);
      var alive = raw.alive != null ? raw.alive !== false : (r.alive != null ? r.alive !== false : hp > 0);
      if (hp <= 0 && raw.alive == null) alive = false;
      var p = {
        id: rid,
        name: raw.name ? sanitizeName(raw.name) : (r.name || ("猫-" + k.slice(-2))),
        x: x, y: y, z: z,
        yaw: raw.yaw != null ? num(raw.yaw, 0) : num(r.yaw, 0),
        pitch: raw.pitch != null ? num(raw.pitch, 0) : num(r.pitch, 0),
        hp: hp, armor: armor,
        alive: alive,
        team: raw.team != null ? (raw.team === 1 ? 1 : 0) : (r.team === 1 ? 1 : 0),
        crouch: raw.crouch != null ? !!raw.crouch : !!r.crouch,
        spawnProtect: raw.spawnProtect != null ? !!raw.spawnProtect : !!r.spawnProtect,
        onGround: raw.onGround != null ? !!raw.onGround : (r.onGround != null ? !!r.onGround : true),
        seq: raw.seq != null ? raw.seq : r.seq,
        state: raw.state != null ? raw.state : (r.state || 0),
        kills: raw.kills != null ? raw.kills | 0 : (r.kills | 0),
        deaths: raw.deaths != null ? raw.deaths | 0 : (r.deaths | 0),
        bot: raw.bot != null ? !!raw.bot : (r.bot != null ? !!r.bot : isBotPlayer({ id: rid, name: raw.name || r.name })),
        bin: !!binary,
        tick: snapTick
      };
      return p;
    }

    /* 快照帧合并（纯逻辑在 ext_net2.mergeFrame，Node 可单测）：
       full（baseline===0）按本帧集合重建 baseline 并返回离开玩家；
       增量帧沿用 baseline 中未出现的玩家。 */
    function mergeSnapshotFrame(players, full) {
      var n = net2();
      if (n && n.mergeFrame) return n.mergeFrame(baseline, players, full);
      var out = new Map(), incoming = {};
      for (var i = 0; i < players.length; i++) {
        var p = players[i];
        if (!p || p.id == null) continue;
        var k = idKey(p.id);
        var old = full ? null : baseline.get(k);
        var merged = {};
        if (old) for (var a in old) merged[a] = old[a];
        for (var b in p) merged[b] = p[b];
        merged.id = p.id;
        out.set(k, merged);
        incoming[k] = 1;
      }
      var removed = [];
      baseline.forEach(function (v, k) {
        if (incoming[k]) return;
        if (full) removed.push(k);
        else out.set(k, v);
      });
      return { list: Array.from(out.values()), removed: removed };
    }

    function applyBinarySnapshot(s) {
      snapTick = s.tick || snapTick;
      serverSelf = null;
      var full = !s.baseline || s.baseline === 0;
      var raws = [];
      for (var i = 0; i < s.players.length; i++) {
        var raw = s.players[i];
        if (!raw || raw.id == null) continue;
        var mapped = {};
        for (var b in raw) mapped[b] = raw[b];
        mapped.id = resolveId(raw.id);   // 数值 netId -> 字符串 id
        raws.push(mapped);
      }
      syncRoster(raws);
      var frame = mergeSnapshotFrame(raws, full);
      var list = [];
      for (var j = 0; j < frame.list.length; j++) list.push(normalizePlayer(frame.list[j], true));
      baseline.clear();
      for (var m = 0; m < list.length; m++) baseline.set(idKey(list[m].id), list[m]);
      for (var r = 0; r < frame.removed.length; r++) {
        var key = frame.removed[r];
        removeRemote(key);
        roster.delete(key);
      }
      net.lastSnapAt = nowMs();
      applyPlayers(list, full);
    }

    function applyJsonSnapshot(m) {
      if (!m.players) return;
      snapTick = m.tick || snapTick;
      syncClock(m.tick, m.ts || null);
      syncRoster(m.players);
      baseline.clear();
      var list = [];
      for (var i = 0; i < m.players.length; i++) {
        var p = normalizePlayer(m.players[i], false);
        baseline.set(idKey(p.id), p);
        list.push(p);
      }
      net.snapJson++;
      net.lastSnapAt = nowMs();
      applyPlayers(list, false);
    }

    function applyPlayers(list, full) {
      var self = null;
      var seen = {};
      for (var i = 0; i < list.length; i++) {
        var p = list[i];
        var pid = resolveId(p.id);
        if (pid != null) p.id = pid;
        if (sameId(pid, selfId)) {
          self = p;
          // 旧 bug 会在快照里把自己渲染成远端模型：发现即清理
          if (remotes.has(idKey(pid))) removeRemote(pid);
          continue;
        }
        seen[idKey(pid)] = 1;
        upsertRemote(p);
      }
      if (full) {
        var remove = [];
        remotes.forEach(function (r, k) { if (!seen[k]) remove.push(k); });
        remove.forEach(removeRemote);
      }
      if (self) applySelf(self);
      queueHudValue("count", mpT("ui2.mp.online", { n: list.length }, "{n} 在线"));
      flushHudText();
      window.__MPSNAP = list;
    }

    function applySelf(p) {
      serverSelf = p;
      if (p.alive === false) {
        if (!mpDead) die(rosterOf(p.id).killer || mpT("ui2.mp.killer.other", null, "对手"));
        return;
      }
      if (mpDead) {
        revive(p);
        return;
      }
      if (typeof p.hp === "number") G.player.health = p.hp;
      if (typeof p.armor === "number") G.player.armor = p.armor;
      if (p.spawnProtect && !protectShown) { protectShown = true; try { G.hud.warn(mpT("ui2.mp.protect", null, "出生保护 · 2 秒"), 2); } catch (e) {} }
      if (!p.spawnProtect) protectShown = false;
      if (!G.player.pos || (G.player.pos.x === 0 && G.player.pos.y === 0 && G.player.pos.z === 0)) {
        G.player.pos.set(p.x, p.y, p.z);
      }
      reconcileSelf(p);
    }

    function resolveAck(raw) {
      var n = net2();
      if (n && n.resolveAck) return n.resolveAck(raw, lastAcked);
      var v = Number(raw);
      if (!Number.isFinite(v) || v < 0) return null;
      // v >= lastAcked 直接采用（ACK 帧是 u32 完整序号，可能 >1024）
      if (v >= lastAcked) return v;
      var cand = (lastAcked & ~255) | (v & 255);
      if (cand < lastAcked - 128) cand += 256;
      if (cand > lastAcked + 128) cand -= 256;
      return cand;
    }

    /* ack 清理逻辑（ACK 帧 / 快照 self.seq 兜底共用） */
    function dropAckedPending(ack) {
      var n = net2();
      var dropped = (n && n.dropAcked) ? n.dropAcked(pending, ack) : 0;
      if (!(n && n.dropAcked)) {
        while (pending.length && pending[0].seq <= ack) { pending.shift(); dropped++; }
      }
      net.ackDropped += dropped;
      ackedTotal += dropped;
      return dropped;
    }
    /** 处理 OP.ACK 二进制小帧：只前进，不回退。 */
    function applyAckFrame(rawSeq) {
      var v = Number(rawSeq);
      if (!Number.isFinite(v) || v < 0) return 0;
      var n = net2();
      var next = (n && n.nextAck) ? n.nextAck(lastAcked, v) : Math.max(lastAcked, v);
      net.ackFrames++;
      lastAckAt = nowMs();
      if (next <= lastAcked) return 0;
      lastAcked = next;
      var dropped = dropAckedPending(lastAcked);
      net.ackFrameDropped += dropped;
      return dropped;
    }

    function estimateServerVel(p) {
      var dt = lastSelfSnapAt ? Math.max(1 / 60, (nowMs() - lastSelfSnapAt) / 1000) : 1 / 30;
      if (lastSelfSnap && lastSelfSnapAt) {
        var vx = (p.x - lastSelfSnap.x) / dt;
        var vz = (p.z - lastSelfSnap.z) / dt;
        var vy = (p.y - lastSelfSnap.y) / dt;
        return { x: clamp(vx, -8, 8), y: clamp(vy, -12, 12), z: clamp(vz, -8, 8) };
      }
      return { x: G.player.vel ? G.player.vel.x : 0, y: G.player.vel ? G.player.vel.y : 0, z: G.player.vel ? G.player.vel.z : 0 };
    }

    function replayTarget(p) {
      if (!predWorld || !window.SALT_SIM) return null;
      var cmds = [];
      for (var i = 0; i < pending.length; i++) cmds.push(pending[i].cmd);
      var base = {
        pos: { x: p.x, y: p.y, z: p.z },
        vel: estimateServerVel(p),
        yaw: G.player.yaw || p.yaw,
        pitch: G.player.pitch || p.pitch || 0,
        onGround: p.onGround !== false,
        health: p.hp
      };
      var step = 1 / Math.max(1, cmdRate);
      var n = net2();
      if (n && n.replay) {
        try { return n.replay(predWorld, base, cmds, step, predTuning); } catch (e) {}
      }
      try {
        var st = window.SALT_SIM.createPlayerState(predWorld, base.pos, predTuning);
        st.pos.x = base.pos.x; st.pos.y = base.pos.y; st.pos.z = base.pos.z;
        st.vel.x = base.vel.x; st.vel.y = base.vel.y; st.vel.z = base.vel.z;
        st.yaw = base.yaw; st.pitch = base.pitch; st.onGround = base.onGround;
        for (var j = 0; j < cmds.length; j++) window.SALT_SIM.stepPlayer(st, cmds[j], predWorld, step, predTuning);
        return st;
      } catch (e) { return null; }
    }

    function reconcileSelf(p) {
      if (!active || mpDead) return;
      // ACK 小帧优先；超过 1 秒没有 ACK 帧时用快照里的 self.seq 兜底（u8 回绕）
      var ackFallback = !lastAckAt || (nowMs() - lastAckAt) > 1000;
      var ack = ackFallback && p.seq != null ? resolveAck(p.seq) : null;
      if (ack != null && ack > lastAcked) {
        lastAcked = ack;
        dropAckedPending(ack);
      }
      var tele = lastServerPos && dist3(p, lastServerPos) > 8;
      if (tele) resetPrediction();
      lastServerPos = { x: p.x, y: p.y, z: p.z };
      var targetState = replayTarget(p);
      var target = targetState && targetState.pos ? targetState.pos : { x: p.x, y: p.y, z: p.z };
      var cur = G.player.pos;
      var err = dist3(cur, target);
      if (!Number.isFinite(err)) err = 0;
      var hard = justRespawn || err > 1.2;
      if (justRespawn) justRespawn = false;
      reconcile.count++;
      reconcile.lastError = err;
      if (err > reconcile.maxError) reconcile.maxError = err;
      reconcileErrs.push(err);
      if (reconcileErrs.length > 240) reconcileErrs.shift();
      if (hard) {
        G.player.pos.set(target.x, target.y, target.z);
        if (targetState && targetState.vel) G.player.vel.set(targetState.vel.x, targetState.vel.y, targetState.vel.z);
        if (targetState && targetState.onGround != null) G.player.onGround = targetState.onGround;
        viewOffset.x = viewOffset.y = viewOffset.z = 0;
        reconcile.hard++;
      } else {
        var ox = cur.x - target.x, oy = cur.y - target.y, oz = cur.z - target.z;
        viewOffset.x += ox; viewOffset.y += oy; viewOffset.z += oz;
        var ol = Math.sqrt(viewOffset.x * viewOffset.x + viewOffset.y * viewOffset.y + viewOffset.z * viewOffset.z);
        if (ol > 1.0) { var k = 1.0 / ol; viewOffset.x *= k; viewOffset.y *= k; viewOffset.z *= k; }
        G.player.pos.set(target.x, target.y, target.z);
        if (targetState && targetState.vel) G.player.vel.set(targetState.vel.x, targetState.vel.y, targetState.vel.z);
        if (targetState && targetState.onGround != null) G.player.onGround = targetState.onGround;
        if (err > 0.015) reconcile.smooth++;
      }
      lastSelfSnap = { x: p.x, y: p.y, z: p.z, tick: snapTick };
      lastSelfSnapAt = nowMs();
    }

    function resetPrediction() {
      pending.length = 0;
      // 不回 0：否则 ack>1024 会被当成 u8 回绕，pending 永远清不掉
      var na = net2();
      lastAcked = (na && na.clampAck) ? na.clampAck(lastAcked, seq) : Math.max(lastAcked, seq);
      viewOffset.x = viewOffset.y = viewOffset.z = 0;
      lastSelfSnap = null;
      lastSelfSnapAt = 0;
      lastServerPos = null;
      justRespawn = true;
    }

    function p95(arr) {
      if (!arr.length) return 0;
      var a = arr.slice().sort(function (x, y) { return x - y; });
      return a[Math.min(a.length - 1, Math.floor(a.length * 0.95))] || 0;
    }

    /* ------------------------------------------------------------ 消息 */
    function onMsg(m) {
      rx.msg++;
      if (!m || typeof m.t !== "string") return;
      if (m.t === "welcome") { onWelcome(m); return; }
      if (m.t === "snap") { if (m.players) { rx.snap++; applyJsonSnapshot(m); } return; }
      if (m.t === "pong") {
        rx.pong++;
        var ts = num(m.ts, null);
        if (ts != null) {
          var rtt = nowMs() - ts;
          if (rtt >= 0 && rtt < 8000) pingMs = rtt;
        }
        syncClock(m.tick, m.serverTime);
        return;
      }
      if (m.t === "error") {
        var code = m.code || "error";
        var text = friendly(code, m.message);
        showStatus(mpT("ui2.mp.conn.server", { text: text }, "服务器：{text}"));
        if (active) showBanner(text, 5);
        if (code === "room_full" || code === "full" || code === "dev_disabled" || code === "version_mismatch" || code === "protocol_mismatch") {
          fatalConn = true;
        }
        joining = false;
        return;
      }
      if (m.t === "join") {
        if (m.player) {
          syncRoster([m.player]);   // 注册 nid -> id 映射 + 名字
          var jp = normalizePlayer(m.player, false);
          if (!sameId(jp.id, selfId)) upsertRemote(jp);
        }
        return;
      }
      if (m.t === "leave") {
        // leave 可能只带数值 nid（或同时带 id/nid）
        var lid = resolveId(m.id != null ? m.id : m.nid);
        removeRemote(lid);
        var lk = idKey(lid);
        roster.delete(lk);
        baseline.delete(lk);
        return;
      }
      if (m.t === "hit") { onHit(m); return; }
      if (m.t === "kill") { onKill(m); return; }
      if (m.t === "respawn") { onRespawn(m); return; }
      if (m.t === "score") { onScore(m); return; }
      if (m.t === "roundEnd") { onRoundEnd(m); return; }
      if (m.t === "roundStart") { onRoundStart(m); return; }
      if (m.t === "overtime") { onOvertime(m); return; }
      if (m.t === "teamChange") { onTeamChange(m); return; }
      if (m.t === "voteStart") { onVoteStart(m); return; }
      if (m.t === "mapChange") { onMapChange(m); return; }
      if (m.t === "matchState" || m.t === "gameState" || m.t === "phase" || m.t === "state") { onMatchState(m); return; }
      if (m.t === "caps" || m.t === "points") { applyCaps(m.caps || m.points || m); return; }
      if (m.t === "fire" || m.t === "shot" || m.t === "fireEvent") {
        if (m.by != null && !sameId(resolveId(m.by), selfId)) onRemoteFire(m);
        else if (m.rejected || m.ok === false) onFireReject(m);
        return;
      }
      if (m.t === "fireReject" || m.t === "shotReject" || m.t === "shotRejected") { onFireReject(m); return; }
      if (m.t === "reload" || m.t === "reloadStart") { onRemoteReload(m); return; }
      if (m.t === "reloadDone") { onReloadDone(m); return; }
      if (m.t === "switch" || m.t === "weaponSwitch") { onRemoteSwitch(m); return; }
      if (m.t === "weapon") { onWeaponMsg(m); return; }
      if (m.t === "pointCaptured" || m.t === "pointNeutralized") { onCapEvent(m); return; }
      if (m.t === "domination") { onDomination(m); return; }
    }

    function onWelcome(m) {
      fatalConn = false;
      reconnectAttempts = 0;
      clearReconnect();
      net.lost = false;
      // 重建 id<->nid 映射：welcome.id 是字符串 id，welcome.nid 是数值 netId
      resetIdMap();
      if (m.id != null) {
        selfNid = m.nid != null ? m.nid : (m.netId != null ? m.netId : null);
        selfId = registerId(m.id, selfNid);   // nid 缺失时回退原 id
      }
      if (m.players) {
        m.players.forEach(function (p) { if (p && p.id != null) registerId(p.id, p.nid != null ? p.nid : p.netId); });
      }
      if (m.team != null) myTeam = m.team === 1 ? 1 : 0;
      tickRate = Math.max(1, num(m.tickRate, 30));
      cmdRate = tickRate;
      recomputeInterp();
      if (m.mode) modeId = modeKey(m.mode);
      if (m.mapId) mapId = (m.mapId === "depot" || m.mapId === "ship" || m.mapId === "core") ? m.mapId : "harbor";
      if (!forceJson && m.caps && m.caps.indexOf && m.caps.indexOf("bin") >= 0) { net.bin = true; net.caps = m.caps.slice(); }
      if (m.protocol != null) net.protocol = num(m.protocol, 2);
      syncClock(m.tick, m.serverTime);
      if (m.players) {
        syncRoster(m.players);
        baseline.clear();
        m.players.forEach(function (p) {
          if (p && p.id != null) { var np = normalizePlayer(p, false); baseline.set(idKey(np.id), np); }
        });
      }
      if (m.room) room = m.room;
      if (m.state || m.matchState) match.state = m.state || m.matchState;
      else match.state = (m.players && m.players.length >= 2) ? "live" : "warmup";
      match.mode = modeId;
      showStatus("");
      if (active) {
        updateTeamHud();
        refreshMapHud();
        setMatchState(match.state);
        showBanner(mpT("ui2.mp.conn.resumed", { room: room }, "已重连 · {room}"), 3);
        return;
      }
      enter(m);
    }

    /* ------------------------------------------------------------ 比赛状态 */
    function onScore(m) {
      scoreData = m;
      if (m.mode) modeId = modeKey(m.mode);
      if (m.mapId && m.mapId !== mapId) applyMap(m.mapId);
      if (m.players) {
        syncRoster(m.players);
        for (var si = 0; si < m.players.length; si++) {
          if (sameId(resolveId(m.players[si].id), selfId)) {
            myKills = m.players[si].kills | 0;
            myDeaths = m.players[si].deaths | 0;
            break;
          }
        }
      }
      if (m.teams) match.teams = [m.teams[0] | 0, m.teams[1] | 0];
      if (typeof m.timeLeft === "number") { match.timeLeft = m.timeLeft; match.timeLeftAt = nowMs(); }
      match.overtime = !!m.overtime;
      if (m.caps || m.points || m.objectives) applyCaps(m.caps || m.points || m.objectives);
      updateScoreText();
      setText(hudRef("kd"), mpT("ui2.mp.hud.killsDeaths", { k: myKills, d: myDeaths }, "{k}K / {d}D"));
      setText(hudRef("time"), formatTime(displayTimeLeft()));
      if (m.state) setMatchState(m.state);
      else if (match.overtime) setMatchState("overtime");
      else if (match.state !== "roundEnd" && match.state !== "vote") setMatchState("live");
      if (scoreVisible) renderScore();
    }

    function displayTimeLeft() {
      if (match.timeLeft == null) return null;
      if (match.state === "live" || match.state === "overtime") {
        return Math.max(0, match.timeLeft - (nowMs() - match.timeLeftAt) / 1000);
      }
      return match.timeLeft;
    }
    function formatTime(sec) {
      if (sec == null || !Number.isFinite(sec)) return "--:--";
      var s = Math.max(0, Math.ceil(sec));
      return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
    }

    var STATE_ZH = {
      warmup: "热身", countdown: "准备", live: "进行中", roundEnd: "回合结束",
      vote: "地图投票", mapLoad: "载入中", overtime: "加时", draw: "平局", teamChange: "队伍调整"
    };
    function stateLabel(s) {
      if (STATE_ZH[s]) return mpT("ui2.mp.state." + s, null, STATE_ZH[s]);
      return s || mpT("ui2.mp.state.live", null, "进行中");
    }

    function setMatchState(s, detail) {
      if (!s) s = "live";
      if (s === "playing") s = "live";
      match.state = s;
      if (detail) match.note = detail;
      if (matchEl) {
        if (!matchEl.classList.contains("on")) matchEl.classList.add("on");
        if (matchRefs) {
          setText(matchRefs.mode, modeLabel());
          setText(matchRefs.state, stateLabel(s));
          setText(matchRefs.ot, (s === "overtime" || match.overtime) ? mpT("ui2.mp.state.overtime", null, "加时") : "");
        }
        var otOn = s === "overtime" || match.overtime;
        if (matchEl.classList.contains("overtime") !== otOn) matchEl.classList.toggle("overtime", otOn);
      }
      if (s === "live") { hideRound(); }
      else if (s === "warmup") {
        showRound(mpT("ui2.mp.state.warmup", null, "热身"), mpT("ui2.mp.round.warmupSub", null, "等待玩家 · 自由活动"), 0);
      } else if (s === "countdown") {
        showRound(mpT("ui2.mp.state.countdown", null, "准备"), detail || mpT("ui2.mp.round.countdownSub", null, "即将开始"), 0);
      } else if (s === "vote") { /* voteStart 负责显示 */ }
      else if (s === "mapLoad") showLoading(mapTitle(mapId));
      else if (s === "overtime") {
        showBanner(mpT("ui2.mp.banner.overtime", { detail: detail || mpT("ui2.mp.sec", { n: 60 }, "{n} 秒") }, "加时 · {detail}"), 3);
      }
    }

    function onMatchState(m) {
      var s = m.state || m.matchState || m.phase;
      if (m.mode) modeId = modeKey(m.mode);
      if (m.teams) match.teams = [m.teams[0] | 0, m.teams[1] | 0];
      if (typeof m.timeLeft === "number") { match.timeLeft = m.timeLeft; match.timeLeftAt = nowMs(); }
      if (m.overtime != null) match.overtime = !!m.overtime;
      if (m.caps || m.points) applyCaps(m.caps || m.points);
      setMatchState(s || "live", m.countdown != null ? mpT("ui2.mp.sec", { n: m.countdown }, "{n} 秒") : (m.note || ""));
      if (m.players) syncRoster(m.players);
      if (scoreVisible) renderScore();
    }

    function onRoundEnd(m) {
      match.state = "roundEnd";
      // 服务端 roundEnd.teams 将改为据点分（domination）；优先用它，score 仅兜底
      var n2 = net2();
      var teams = (n2 && n2.roundTeams) ? n2.roundTeams(m, match.teams) : (m.teams || m.score || match.teams || [0, 0]);
      match.teams = [teams[0] | 0, teams[1] | 0];
      updateScoreText();
      var draw = !!m.draw || m.winnerTeam === -1 || m.winnerTeam == null;
      var title = draw
        ? mpT("ui2.mp.round.draw", null, "平局")
        : (m.winnerTeam === 0 ? mpT("ui2.mp.round.blueWin", null, "蓝队胜利") : mpT("ui2.mp.round.redWin", null, "红队胜利"));
      var reason = m.reason === "score" ? mpT("ui2.mp.reason.score", null, "比分达成")
        : m.reason === "time" ? mpT("ui2.mp.reason.time", null, "时间结束")
        : m.reason === "dev" ? mpT("ui2.mp.reason.dev", null, "管理员结束")
        : "";
      var sub = mpT("ui2.mp.round.sub", {
        score: (teams[0] | 0) + " : " + (teams[1] | 0),
        reason: reason ? " · " + reason : "",
        next: mpT("ui2.mp.round.next", null, "下一回合即将开始")
      }, "{score}{reason} · {next}");
      showRound(title, sub, 0);
      setMatchState("roundEnd");
      scoreData = scoreData || {};
      scoreData.teams = match.teams.slice();
      if (scoreVisible) renderScore();
      try { G.audio.play("alert", { gain: 0.6, pitch: draw ? 0.72 : 0.9 }); } catch (e) {}
      try { G.hud.message(title, 5); } catch (e) {}
      if (m.winner) syncRoster([m.winner]);
    }

    function onRoundStart(m) {
      hideRound();
      var vu = scoreUi && scoreUi._vote;
      if (vu) vu.classList.remove("on");
      if (m.mapId && m.mapId !== mapId) applyMap(m.mapId);
      if (m.teams) { match.teams = [m.teams[0] | 0, m.teams[1] | 0]; updateScoreText(); }
      // 回合开始时若带 slot/wpn/mag/reserve，写回本地武器（没有字段时保持旧行为）
      if (m.slot != null || m.wpn != null || m.mag != null || m.reserve != null) applyWeaponState(m);
      match.overtime = false;
      scoreData = null;
      myKills = 0; myDeaths = 0; streak = 0;
      setText(hudRef("kd"), mpT("ui2.mp.hud.killsDeaths", { k: 0, d: 0 }, "{k}K / {d}D"));
      setMatchState("live");
      try { G.hud.message(mpT("ui2.mp.msg.newRound", null, "新回合开始"), 3); } catch (e) {}
    }

    function onOvertime(m) {
      match.overtime = true;
      if (typeof m.seconds === "number") match.timeLeft = m.seconds;
      match.timeLeftAt = nowMs();
      var secs = m.seconds || 60;
      setMatchState("overtime", mpT("ui2.mp.sec", { n: secs }, "{n} 秒"));
      try { G.audio.play("alert", { gain: 0.7, pitch: 0.78 }); } catch (e) {}
      try { G.hud.message(mpT("ui2.mp.msg.overtime", { n: secs }, "加时赛 · {n} 秒"), 4); } catch (e) {}
    }

    function onTeamChange(m) {
      if (m.id == null) return;
      var tid = resolveId(m.id);
      if (m.team != null) {
        var k = idKey(tid);
        var r = roster.get(k) || { id: tid };
        r.team = m.team === 1 ? 1 : 0;
        roster.set(k, r);
      }
      var toTeam = m.team === 1 ? 1 : 0;
      if (sameId(resolveId(m.id), selfId)) {
        myTeam = toTeam;
        updateTeamHud();
        showBanner(mpT("ui2.mp.team.change", { team: teamName(myTeam) }, "队伍调整 · {team}"), 4);
        try { G.hud.message(mpT("ui2.mp.team.moved", { team: teamName(myTeam) }, "已换队至{team}"), 4); } catch (e) {}
      } else {
        removeRemote(tid);
        showBanner(mpT("ui2.mp.team.movedOther", { name: displayName(tid), team: teamName(toTeam) }, "{name} 换队至{team}"), 3);
      }
    }

    function onVoteStart(m) {
      setMatchState("vote");
      var vu = scoreUi && scoreUi._vote;
      if (!vu) return;
      renderVote(m.maps, m.current);
      vu.classList.add("on");
      if (m.endsIn) {
        clearTimeout(voteTimer);
        voteTimer = setTimeout(function () { vu.classList.remove("on"); }, Math.max(1, m.endsIn) * 1000);
      }
    }

    function renderVote(maps, current) {
      var vu = scoreUi && scoreUi._vote;
      if (!vu) return;
      var box = vu.querySelector(".opts");
      if (!box) return;
      while (box.firstChild) box.removeChild(box.firstChild);
      var list = [];
      if (Array.isArray(maps)) list = maps;
      else if (maps && typeof maps === "object") list = Object.keys(maps).map(function (k) { return { id: k, name: maps[k] }; });
      if (!list.length) list = [{ id: "harbor" }, { id: "depot" }, { id: "ship" }, { id: "core" }];
      list.forEach(function (it) {
        var id = typeof it === "string" ? it : (it.id || it.mapId || it.key);
        // 已知地图一律走词典（服务器下发的名字是中文，英文模式下会漏）
        var name = MAP_ZH[id] != null
          ? mapName(id)
          : (typeof it === "string" || !it.name ? String(it) : it.name);
        if (!id) return;
        var b = el("button", "btn", name);
        b.setAttribute("data-vote", id);
        b.onclick = function () {
          box.querySelectorAll("[data-vote]").forEach(function (x) { x.classList.remove("sel"); });
          b.classList.add("sel");
          send({ t: "vote", map: id });
        };
        if (id === current) b.classList.add("sel");
        box.appendChild(b);
      });
    }

    function onMapChange(m) {
      setMatchState("mapLoad");
      if (m.mapId) applyMap(m.mapId);
      setTimeout(function () { if (active && match.state === "mapLoad") setMatchState("live"); }, 1200);
    }

    /* ------------------------------------------------------------ 据点 */
    function defaultCapPositions() {
      var spec = mapSpec();
      var out = [];
      var relays = spec && spec.relays;
      if (Array.isArray(relays) && relays.length >= 3) {
        for (var i = 0; i < 3; i++) out.push({ x: relays[i].pos[0], y: relays[i].pos[1], z: relays[i].pos[2] });
      } else {
        var fallback = {
          harbor: [{ x: -10, y: 0, z: 10 }, { x: 0, y: 0, z: -4 }, { x: 12, y: 0, z: 6 }],
          depot: [{ x: -18, y: 0, z: 8 }, { x: 0, y: 0, z: 0 }, { x: 18, y: 0, z: 8 }],
          ship: [{ x: -16, y: 0.3, z: 0 }, { x: 0, y: 0.3, z: 5 }, { x: 16, y: 0.3, z: 0 }],
          core: [{ x: -12, y: 0.4, z: 0 }, { x: 0, y: 0.4, z: 0 }, { x: 12, y: 0.4, z: 0 }]
        };
        out = fallback[mapId] || fallback.harbor;
      }
      return out;
    }

    function ensureCaps() {
      var pos = defaultCapPositions();
      ["A", "B", "C"].forEach(function (id, i) {
        if (!match.caps[id]) match.caps[id] = { id: id, owner: -1, progress: 0, contested: false, pos: pos[i] };
      });
      match.capsList = ["A", "B", "C"].map(function (id) { return match.caps[id]; });
      match.capsVisible = modeId === "domination";
    }

    function normalizeOwner(v) {
      if (v === 0 || v === "0" || v === "blue" || v === "team0") return 0;
      if (v === 1 || v === "1" || v === "red" || v === "team1") return 1;
      return -1;
    }

    function applyCaps(raw) {
      var arr = raw;
      if (arr && !Array.isArray(arr)) {
        if (arr.caps) arr = arr.caps;
        else if (arr.points) arr = arr.points;
        else if (arr.objectives) arr = arr.objectives;
        else if (arr.controlPoints) arr = arr.controlPoints;
        else {
          arr = Object.keys(arr).map(function (k) {
            var v = arr[k];
            if (!v || typeof v !== "object") return null;
            var o = {}; for (var p in v) o[p] = v[p];
            if (o.id == null) o.id = k;
            return o;
          }).filter(Boolean);
        }
      }
      if (!Array.isArray(arr) || !arr.length) {
        if (modeId === "domination") { ensureCaps(); renderCaps(); }
        return;
      }
      ensureCaps();
      match.capsVisible = true;
      var used = {};
      arr.forEach(function (it, idx) {
        if (!it) return;
        var id = String(it.id || it.name || it.point || it.key || "ABC".charAt(idx)).toUpperCase();
        if (id.length > 1) {
          var m = /([ABC])/.exec(id);
          id = m ? m[1] : "ABC".charAt(idx);
        }
        var cap = match.caps[id] || { id: id, owner: -1, progress: 0, contested: false };
        var owner = it.owner != null ? it.owner : (it.team != null ? it.team : (it.heldBy != null ? it.heldBy : it.controller));
        cap.owner = normalizeOwner(owner);
        var pr = it.progress != null ? num(it.progress, 0) : (it.capture != null ? num(it.capture, 0) : (it.cap != null ? num(it.cap, 0) : 0));
        if (pr > 1) pr = pr / 100;
        cap.progress = clamp(pr, 0, 1);
        cap.contested = !!it.contested || !!it.inContest;
        var p = vecFrom(it.pos || it.position);
        if (p) cap.pos = p;
        match.caps[id] = cap;
        used[id] = 1;
      });
      ["A", "B", "C"].forEach(function (id) { if (!used[id] && !match.caps[id]) match.caps[id] = { id: id, owner: -1, progress: 0, contested: false }; });
      match.capsList = ["A", "B", "C"].map(function (id) { return match.caps[id]; });
      renderCaps();
    }

    function renderCaps() {
      if (!capsEl) return;
      var show = modeId === "domination" || match.capsVisible;
      if (capsEl.classList.contains("on") !== show) capsEl.classList.toggle("on", show);
      ["A", "B", "C"].forEach(function (id, idx) {
        var c = match.caps[id] || { owner: -1, progress: 0, contested: false };
        var ref = capRefs && capRefs[idx];
        var cell = ref ? ref.cell : capsEl.querySelector('[data-cap="' + id + '"]');
        if (!cell) return;
        var cls = "x-mp-cap";
        if (c.owner === 0) cls += " team0"; else if (c.owner === 1) cls += " team1"; else cls += " neutral";
        if (c.contested) cls += " contested";
        if (cell.className !== cls) cell.className = cls;
        var em = ref ? ref.em : cell.querySelector("em");
        if (em) {
          var w = Math.round(clamp(c.progress || 0, 0, 1) * 100) + "%";
          if (em.style.width !== w) em.style.width = w;
        }
        var label = ref ? ref.label : cell.querySelector("span");
        setText(label, c.contested
          ? mpT("ui2.mp.cap.contested", null, "争夺中")
          : (c.owner === 0 || c.owner === 1) ? teamName(c.owner) : mpT("ui2.mp.cap.neutral", null, "中立"));
      });
    }

    function capsSummary() {
      return ["A", "B", "C"].map(function (id) {
        var c = match.caps[id] || { owner: -1, progress: 0, contested: false };
        var own = c.contested
          ? mpT("ui2.mp.cap.contestedShort", null, "争夺")
          : (c.owner === 0 || c.owner === 1) ? teamShort(c.owner) : mpT("ui2.mp.cap.neutral", null, "中立");
        return id + " " + own + (c.progress ? " " + Math.round(c.progress * 100) + "%" : "");
      }).join(" · ");
    }

    /* ------------------------------------------------------------ 得分 / 计分板 */
    function onScorePlayer(p) { syncRoster([p]); }
    function updateTeamHud() {
      var teamEl = hudRef("team");
      if (!teamEl) return;
      setText(teamEl, teamName(myTeam));
      var cls = myTeam ? "team1" : "team0";
      if (teamEl.className !== cls) teamEl.className = cls;
    }

    function renderScore() {
      if (!scoreUi) return;
      var tb = scoreRefs ? scoreRefs.tbody : scoreUi.querySelector("tbody");
      if (!tb) return;
      while (tb.firstChild) tb.removeChild(tb.firstChild);
      var sub = scoreRefs ? scoreRefs.sub : scoreUi.querySelector("[data-mp-score-sub]");
      if (sub) {
        var parts = [mpT("ui2.mp.score.mode", { mode: modeLabel() }, "模式 · {mode}")];
        if (modeId === "domination") parts.push(mpT("ui2.mp.score.caps", { caps: capsSummary() }, "据点 {caps}"));
        var teams = scoreData && scoreData.teams ? scoreData.teams : match.teams;
        parts.push(mpT("ui2.mp.score.teams", { a: (teams && teams[0]) | 0, b: (teams && teams[1]) | 0 }, "蓝 {a} : {b} 红"));
        if (match.overtime) parts.push(mpT("ui2.mp.state.overtime", null, "加时"));
        setText(sub, parts.join(" · "));
      }
      var h3 = scoreRefs ? scoreRefs.h3 : scoreUi.querySelector("h3");
      setText(h3, mpT("ui2.mp.score.title", { mode: modeText() }, "计分板 · {mode}"));
      var list = (scoreData && scoreData.players) ? scoreData.players.slice() : [];
      if (!list.length) {
        remotes.forEach(function (r, k) {
          list.push({ id: r.id, name: r.name, team: r.team, kills: 0, deaths: 0 });
        });
        if (selfId != null) list.push({ id: selfId, name: playerName, team: myTeam, kills: myKills, deaths: myDeaths });
      }
      list.sort(function (a, b) { return (b.kills | 0) - (a.kills | 0); });
      list.forEach(function (p) {
        var row = document.createElement("tr");
        var nameTd = document.createElement("td");
        nameTd.textContent = (sameId(resolveId(p.id), selfId) ? "▶ " : "") + (p.name ? sanitizeName(p.name) : displayName(p.id));
        var bot = isBotPlayer(p);
        if (bot) { var b = el("span", "bot", mpT("ui2.mp.bot", null, "BOT")); nameTd.appendChild(b); }
        var teamTd = document.createElement("td");
        teamTd.className = (p.team === 1 ? "team1" : "team0");
        teamTd.textContent = teamShort(p.team === 1 ? 1 : 0);
        var kTd = document.createElement("td");
        kTd.className = "k"; kTd.textContent = String(p.kills | 0);
        var dTd = document.createElement("td"); dTd.textContent = String(p.deaths | 0);
        var pTd = document.createElement("td");
        pTd.textContent = p.ping != null ? (p.ping + " ms") : (sameId(resolveId(p.id), selfId) && pingMs != null ? Math.round(pingMs) + " ms" : "--");
        row.appendChild(nameTd); row.appendChild(teamTd); row.appendChild(kTd); row.appendChild(dTd); row.appendChild(pTd);
        tb.appendChild(row);
      });
    }

    /* ------------------------------------------------------------ 战斗事件 */
    function onHit(m) {
      net.hitEvents++;
      var fp = m.point ? vecFrom(m.point) : (m.from ? vecFrom(m.from) : null);
      if (sameId(resolveId(m.victim), selfId)) {
        var dmg = num(m.dmg, 0);
        if (dmg > 0) G.player.health = Math.max(0, (G.player.health == null ? 100 : G.player.health) - dmg);
        try { G.events.emit("player:hit", { amount: dmg, fromPos: fp }); } catch (e) {}
        if (hitDirEl && m.from) {
          var f = vecFrom(m.from);
          if (f) {
            var dx = f.x - G.player.pos.x, dz = f.z - G.player.pos.z;
            var ang = Math.atan2(dx, -dz) - G.player.yaw;
            hitDirEl.style.transform = "rotate(" + ang.toFixed(3) + "rad)";
            hitDirEl.classList.add("on");
            clearTimeout(hitDirEl._t);
            hitDirEl._t = setTimeout(function () { hitDirEl.classList.remove("on"); }, 850);
          }
        }
      }
      if (sameId(resolveId(m.by), selfId)) {
        queueHitmarker(m.hs || m.part === "head" ? "kill" : "hit");
        try { G.audio.play("impact", { gain: 0.45, pitch: m.hs ? 1.6 : 1.3 }); } catch (e) {}
      }
    }

    function onKill(m) {
      net.killEvents++;
      var byName = m.byName ? sanitizeName(m.byName) : displayName(m.by);
      var vicName = m.victimName ? sanitizeName(m.victimName) : displayName(m.victim);
      safeFeed(mpT("ui2.mp.feed.kill", { by: byName, victim: vicName }, "{by} ▸ {victim}") +
        (m.hs ? mpT("ui2.mp.feed.hs", null, " · 爆头") : "") +
        (m.wpn ? mpT("ui2.mp.feed.wpn", { wpn: weaponShort(m.wpn) }, " · {wpn}") : ""));
      // 热身击杀（服务端 m.warmup）只播报，不计入个人 K/D、不触发阵亡界面
      if (m.warmup) {
        if (scoreVisible) renderScore();
        return;
      }
      if (sameId(resolveId(m.by), selfId)) {
        myKills++; streak++;
        try { G.audio.play("objective_done", { gain: 0.4, pitch: 1.25 }); } catch (e) {}
        if (streak >= 2 && streak <= 5) {
          try {
            G.hud.warn(mpT("ui2.mp.streak." + streak, null, STREAK_ZH[streak]) + " · " +
              mpT("ui2.mp.streak.count", { n: streak }, "连杀 {n}"), 2.2);
          } catch (e) {}
        }
        setText(hudRef("kd"), mpT("ui2.mp.hud.killsDeaths", { k: myKills, d: myDeaths }, "{k}K / {d}D"));
      }
      if (sameId(resolveId(m.victim), selfId)) {
        myDeaths++; streak = 0; protectShown = false;
        try { G.audio.play("death", { gain: 0.6 }); } catch (e) {}
        die(byName);
      } else {
        var r = remotes.get(idKey(resolveId(m.victim)));
        if (r) { r.dead = true; }
      }
      if (scoreVisible) renderScore();
    }

    function onRespawn(m) {
      if (m.id == null) return;
      if (sameId(resolveId(m.id), selfId)) { revive(m); return; }
      var r = remotes.get(idKey(resolveId(m.id)));
      if (r) {
        r.dead = false;
        r.grp.visible = true;
        r.samples.length = 0;
        if (m.x != null) r.grp.position.set(m.x, m.y, m.z);
        if (m.wpn) r.lastWpn = m.wpn;
      }
    }

    function safeFeed(text) {
      try {
        var it = G.hud.feed("");
        if (it && it.el) it.el.textContent = String(text || "").slice(0, 180);
      } catch (e) {}
    }

    var WPN_SHORT_ZH = { pac9: "九式", breaker12: "破门锤", dmr: "长眼", smg: "短哨", lmg: "重锚", sidearm: "侧牙" };
    var STREAK_ZH = { 2: "双杀", 3: "三杀", 4: "四杀", 5: "五杀" };
    /** 击杀播报里的武器短名：复用军械库词典 ui2.ar.weapon.<wid>.short */
    function weaponShort(w) {
      if (WPN_SHORT_ZH[w]) return mpT("ui2.ar.weapon." + w + ".short", null, WPN_SHORT_ZH[w]);
      return String(w || mpT("ui2.mp.weapon.unknown", null, "武器")).slice(0, 12);
    }

    function onRemoteFire(m) {
      net.remoteShots++;
      var r = remotes.get(idKey(m.by));
      var muzzle = vecFrom(m.muzzle) || (r ? remoteMuzzle(r) : null);
      if (!muzzle) return;
      var dir = vecFrom(m.dir);
      var end = vecFrom(m.point) || vecFrom(m.hitPoint) || vecFrom(m.hit);
      if (!end) {
        if (!dir) return;
        var L = Math.hypot(dir.x, dir.y, dir.z) || 1;
        dir = { x: dir.x / L, y: dir.y / L, z: dir.z / L };
        end = { x: muzzle.x + dir.x * 45, y: muzzle.y + dir.y * 45, z: muzzle.z + dir.z * 45 };
      } else if (!dir) {
        dir = { x: end.x - muzzle.x, y: end.y - muzzle.y, z: end.z - muzzle.z };
        var L2 = Math.hypot(dir.x, dir.y, dir.z) || 1;
        dir = { x: dir.x / L2, y: dir.y / L2, z: dir.z / L2 };
      }
      if (tmpV && tmpV2 && G.fx) {
        tmpV.set(muzzle.x, muzzle.y, muzzle.z);
        tmpV2.set(end.x, end.y, end.z);
        try { G.fx.tracer(tmpV, tmpV2, { color: 0xffd27a, speed: 180 }); } catch (e) {}
        if (tmpDir) tmpDir.set(dir.x, dir.y, dir.z);
        try { if (G.fx.muzzleFlash && tmpDir) G.fx.muzzleFlash(tmpV, tmpDir, { scale: 0.72 }); } catch (e) {}
      }
      var dist = dist3(muzzle, { x: G.player.pos.x, y: G.player.pos.y + 1.6, z: G.player.pos.z });
      var gain = clamp(1 / (1 + dist / 18), 0.04, 1);
      var pitch = m.wpn === "breaker12" ? 0.82 : m.wpn === "dmr" ? 0.94 : m.wpn === "smg" ? 1.08 : m.wpn === "sidearm" ? 1.16 : 1.0;
      try { G.audio.play("rifle_shot", { pos: [muzzle.x, muzzle.y, muzzle.z], gain: gain, pitch: pitch, jitter: 0.02 }); } catch (e) {}
      if (r) { r.fireT = 0.08; r.lastWpn = m.wpn || r.lastWpn; }
    }

    function onRemoteReload(m) {
      if (m.id == null || sameId(resolveId(m.id), selfId)) return;
      var r = remotes.get(idKey(resolveId(m.id)));
      if (!r) return;
      if (m.phase === "done" || m.t === "reloadDone") { r.reloadT = 0; return; }
      var dur = m.ms != null ? clamp(num(m.ms, 1350) / 1000, 0.25, 5) : 1.35;
      r.reloadT = dur;
      r.reloadDur = dur;
      if (m.wpn) r.lastWpn = m.wpn;
      var pos = remoteMuzzle(r);
      var d = dist3(pos, { x: G.player.pos.x, y: G.player.pos.y + 1.6, z: G.player.pos.z });
      try { G.audio.play("reload_magout", { pos: [pos.x, pos.y, pos.z], gain: clamp(1 / (1 + d / 12), 0.05, 1) }); } catch (e) {}
    }

    function onRemoteSwitch(m) {
      if (m.id == null || sameId(resolveId(m.id), selfId)) return;
      var r = remotes.get(idKey(resolveId(m.id)));
      if (!r) return;
      r.lastWpn = m.wpn || m.weapon || r.lastWpn;
      r.reloadT = 0.35;
      var pos = remoteMuzzle(r);
      try { G.audio.play("reload_bolt", { pos: [pos.x, pos.y, pos.z], gain: 0.25 }); } catch (e) {}
    }

    /** 服务端权威换弹完成：写回自枪弹药并清远端换弹动画。 */
    function onReloadDone(m) {
      if (m.id != null && !sameId(resolveId(m.id), selfId)) {
        var r = remotes.get(idKey(resolveId(m.id)));
        if (r) r.reloadT = 0;
        return;
      }
      if (m.mag != null || m.reserve != null || m.wpn != null) applyWeaponState(m);
    }

    /** weapon / weaponSwitch 消息：自己的写回武器，别人的只更新 lastWpn。 */
    function onWeaponMsg(m) {
      if (m.id != null && !sameId(resolveId(m.id), selfId)) { onRemoteSwitch(m); return; }
      if (m.slot != null || m.wpn != null || m.mag != null || m.reserve != null || m.ammo != null) applyWeaponState(m);
    }

    function onFireReject(m) {
      net.rejectedShots++;
      m = m || {};
      var n = net2();
      var shot = null;
      if (n && n.takeShotForReject) {
        shot = n.takeShotForReject(pendingShots, m.shotSeq != null ? m.shotSeq : m.seq).shot;
      } else {
        shot = pendingShots.length ? pendingShots.pop() : null;
      }
      var w = G.weapon;
      if (w) {
        if (n && n.rollbackAmmo) { n.rollbackAmmo(w, m, shot); syncWeaponHud(); }
        else if (shot) {
          var ammo = m.mag != null ? m.mag : m.ammo;
          if (ammo != null) w.ammo = Math.min(w.magSize || 30, ammo | 0);
          else if (shot.ammoBefore != null) w.ammo = Math.min(w.magSize || 30, shot.ammoBefore | 0);
          if (m.reserve != null) w.reserve = m.reserve | 0;
          else if (shot.reserveBefore != null) w.reserve = shot.reserveBefore | 0;
          syncWeaponHud();
        }
      }
      try { G.audio.play("rifle_dry", { gain: 0.9 }); } catch (e) {}
      showBanner(friendly(m.code || m.reason || "fire_rejected", m.message), 2.5);
    }

    /* ---- 服务端武器状态写回（respawn / roundStart / reloadDone / weapon） ---- */
    function applyWeaponState(m) {
      if (!m || !G || !G.weapon) return false;
      var w = G.weapon;
      var changed = false;
      var slot = m.slot != null ? (m.slot | 0) : (m.activeIndex != null ? m.activeIndex | 0 : null);
      if (slot != null && w.list && w.list[slot]) {
        if ((w.activeIndex | 0) !== slot) {
          suppressWeaponNet = true;
          try {
            if (typeof w.select === "function") w.select(slot);
            else w.activeIndex = slot;
          } catch (e) {} finally { suppressWeaponNet = false; }
        }
        changed = true;
      }
      var ammo = m.mag != null ? m.mag : (m.ammo != null ? m.ammo : null);
      if (ammo != null && Number.isFinite(Number(ammo))) {
        var cap = w.magSize != null ? w.magSize | 0 : 999;
        w.ammo = clamp(Number(ammo) | 0, 0, cap);
        changed = true;
      }
      if (m.reserve != null && Number.isFinite(Number(m.reserve))) {
        w.reserve = Math.max(0, Number(m.reserve) | 0);
        changed = true;
      }
      if (changed) syncWeaponHud();
      return changed;
    }

    function syncWeaponHud() {
      try {
        var w = G.weapon;
        if (!w || !G.hud || !G.hud.setSlots) return;
        var slots = (w.slots && w.slots.length) ? w.slots
          : (w.list ? w.list.map(function (x) { return { short: x.short, ammo: x.ammo }; })
            : [{ short: mpT("ui2.ar.weapon.pac9.short", null, "九式"), ammo: w.ammo }]);
        var gren = 0;
        try { if (window.__SX && window.__SX.S) gren = window.__SX.S.grenades | 0; } catch (e) {}
        G.hud.setSlots(slots, w.activeIndex | 0, gren);
      } catch (e) {}
    }

    /* ---- 据点事件 ---- */
    function capIdOf(v) {
      var s = String(v == null ? "" : v).toUpperCase();
      var m = /([ABC])/.exec(s);
      if (m) return m[1];
      return s.length === 1 && "ABC".indexOf(s) >= 0 ? s : null;
    }

    function updateScoreText() {
      queueHudValue("score", match.teams[0] + " : " + match.teams[1]);
      flushHudText();
    }

    function onCapEvent(m) {
      if (!m) return;
      ensureCaps();
      match.capsVisible = true;
      var captured = m.t === "pointCaptured";
      var id = capIdOf(m.id);
      if (id) {
        var cap = match.caps[id] || { id: id, owner: -1, progress: 0, contested: false };
        cap.owner = captured ? normalizeOwner(m.owner) : -1;
        cap.progress = captured ? 1 : 0;
        cap.contested = false;
        match.caps[id] = cap;
        match.capsList = ["A", "B", "C"].map(function (k) { return match.caps[k]; });
        renderCaps();
        safeFeed(captured
          ? mpT("ui2.mp.feed.capture", { id: id, team: teamName(cap.owner === 1 ? 1 : 0) }, "据点 {id} · {team}占领")
          : mpT("ui2.mp.feed.neutral", { id: id }, "据点 {id} · 已中立"));
      }
      if (Array.isArray(m.teams) && m.teams.length >= 2) {
        match.teams = [m.teams[0] | 0, m.teams[1] | 0];
        updateScoreText();
      }
      if (scoreVisible) renderScore();
    }

    function onDomination(m) {
      if (!m) return;
      var pts = m.points || m.caps || m.objectives;
      if (pts) applyCaps(pts);
      if (Array.isArray(m.teams) && m.teams.length >= 2) {
        match.teams = [m.teams[0] | 0, m.teams[1] | 0];
        updateScoreText();
      }
      if (typeof m.timeLeft === "number") { match.timeLeft = m.timeLeft; match.timeLeftAt = nowMs(); }
      if (scoreVisible) renderScore();
    }

    /* ------------------------------------------------------------ 远端模型 */
    function makeTag(name, team, bot) {
      // V38：姓名板 DOM 池化，8 人房反复进退/换图不再创建/销毁节点
      var tag = tagPool.length ? tagPool.pop() : null;
      if (!tag) {
        tag = el("div", "x-mp-tag");
        var b = el("b");
        var nm = el("span", "nm");
        var botEl = el("span", "bot", "BOT");
        var bar = el("i");
        var em = el("em");
        b.appendChild(nm); b.appendChild(botEl);
        bar.appendChild(em);
        tag.appendChild(b); tag.appendChild(bar);
        tag._nm = nm; tag._bot = botEl; tag._em = em;
        document.getElementById("ui").appendChild(tag);
      }
      tag.className = "x-mp-tag " + (team === 1 ? "team1" : "team0");
      tag._nm.textContent = name;
      tag._nm._mpText = name;
      tag._bot.style.display = bot ? "" : "none";
      tag._em.style.transform = "scaleX(1)";
      tag.style.opacity = "1";
      tag._mpText = null; tag._mpOp = "1";
      resetTag(tag);
      return tag;
    }

    // V43：优先使用 src/mp_avatar.js 的高细节程序化士兵；缺失时回退到 V36 方盒模型。
    function buildRemoteModel(p) {
      try {
        if (window.SX_MP_AVATAR && window.SX_MP_AVATAR.build) {
          var rig = window.SX_MP_AVATAR.build(T, p.team === 1 ? 1 : 0, { bot: isBotPlayer(p) });
          rig.mats = rig.mats || [rig.fabric, rig.accent];
          return rig;
        }
      } catch (e) {
        console.error("[mp] avatar build failed, using legacy model", e);
      }
      return buildLegacyRemoteModel(p);
    }

    function buildLegacyRemoteModel(p) {
      var teamCol = new T.Color(p.team === 1 ? 0xff6a55 : 0x4fa8ff);
      var suit = new T.MeshStandardMaterial({ color: teamCol, roughness: 0.62, metalness: 0.18 });
      var suitDark = new T.MeshStandardMaterial({ color: 0x222a30, roughness: 0.55, metalness: 0.4 });
      var plate = new T.MeshStandardMaterial({ color: 0x39434a, roughness: 0.42, metalness: 0.62 });
      var accent = new T.MeshStandardMaterial({ color: 0x0d1113, emissive: teamCol, emissiveIntensity: 1.8, roughness: 0.3, metalness: 0.5 });
      var skin = new T.MeshStandardMaterial({ color: 0xd6b79a, roughness: 0.85 });
      var visor = new T.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x2c8fb0, emissiveIntensity: 1.8, roughness: 0.18, metalness: 0.8 });
      var grp = new T.Group();
      grp.name = "mp-player";
      var hips = new T.Group(); hips.position.y = 0.92; grp.add(hips);
      var torso = new T.Mesh(new T.BoxGeometry(0.58, 0.62, 0.32), suit); torso.position.y = 0.32; torso.castShadow = true; hips.add(torso);
      var chest = new T.Mesh(new T.BoxGeometry(0.64, 0.3, 0.36), plate); chest.position.y = 0.48; hips.add(chest);
      var rig = new T.Mesh(new T.BoxGeometry(0.46, 0.2, 0.4), suitDark); rig.position.set(0, 0.3, 0.02); hips.add(rig);
      var back = new T.Mesh(new T.BoxGeometry(0.42, 0.46, 0.2), suitDark); back.position.set(0, 0.34, 0.25); hips.add(back);
      var chevron = new T.Mesh(new T.BoxGeometry(0.16, 0.05, 0.02), accent); chevron.position.set(0.18, 0.52, 0.19); hips.add(chevron);
      for (var si = 0; si < 2; si++) {
        var shoulder = new T.Mesh(new T.BoxGeometry(0.2, 0.16, 0.3), plate);
        shoulder.position.set(si ? -0.38 : 0.38, 0.58, 0); hips.add(shoulder);
      }
      var head = new T.Group(); head.position.y = 0.82; hips.add(head);
      var neck = new T.Mesh(new T.CylinderGeometry(0.08, 0.09, 0.1, 8), skin); neck.position.y = -0.02; head.add(neck);
      var face = new T.Mesh(new T.SphereGeometry(0.17, 16, 12), skin); face.position.y = 0.14; face.castShadow = true; head.add(face);
      var helmet = new T.Mesh(new T.SphereGeometry(0.2, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), plate); helmet.position.y = 0.18; head.add(helmet);
      var brim = new T.Mesh(new T.BoxGeometry(0.34, 0.04, 0.12), suitDark); brim.position.set(0, 0.17, -0.16); head.add(brim);
      var visorM = new T.Mesh(new T.BoxGeometry(0.27, 0.07, 0.03), visor); visorM.position.set(0, 0.12, -0.17); head.add(visorM);
      var mask = new T.Mesh(new T.BoxGeometry(0.16, 0.1, 0.1), suitDark); mask.position.set(0, 0.02, -0.14); head.add(mask);
      var shield = new T.Mesh(new T.SphereGeometry(1.08, 16, 10), new T.MeshBasicMaterial({ color: teamCol, transparent: true, opacity: 0.13, side: T.DoubleSide, depthWrite: false }));
      shield.position.y = 1.02; shield.visible = false; grp.add(shield);

      var legs = [], arms = [];
      for (var li = 0; li < 2; li++) {
        var legPivot = new T.Group();
        legPivot.position.set(li ? -0.15 : 0.15, 0.92, 0);
        var thigh = new T.Mesh(new T.BoxGeometry(0.19, 0.4, 0.22), suit); thigh.position.y = -0.2; thigh.castShadow = true; legPivot.add(thigh);
        var knee = new T.Group(); knee.position.y = -0.4; legPivot.add(knee);
        var shin = new T.Mesh(new T.BoxGeometry(0.16, 0.38, 0.18), suitDark); shin.position.y = -0.19; knee.add(shin);
        var boot = new T.Mesh(new T.BoxGeometry(0.2, 0.14, 0.3), plate); boot.position.set(0, -0.42, -0.04); knee.add(boot);
        grp.add(legPivot); legs.push(legPivot);
      }
      for (var ai = 0; ai < 2; ai++) {
        var armPivot = new T.Group();
        armPivot.position.set(ai ? -0.4 : 0.4, 1.46, 0);
        var upper = new T.Mesh(new T.BoxGeometry(0.14, 0.34, 0.18), suit); upper.position.y = -0.17; upper.castShadow = true; armPivot.add(upper);
        var elbow = new T.Group(); elbow.position.y = -0.34; armPivot.add(elbow);
        var fore = new T.Mesh(new T.BoxGeometry(0.12, 0.3, 0.16), suitDark); fore.position.y = -0.15; elbow.add(fore);
        var glove = new T.Mesh(new T.BoxGeometry(0.12, 0.1, 0.16), plate); glove.position.y = -0.32; elbow.add(glove);
        grp.add(armPivot); arms.push(armPivot);
      }
      var rifle = new T.Mesh(new T.BoxGeometry(0.09, 0.12, 0.78), suitDark);
      rifle.position.set(0.3, 1.32, -0.3); rifle.rotation.x = -0.06; grp.add(rifle);
      var mag = new T.Mesh(new T.BoxGeometry(0.07, 0.18, 0.14), plate); mag.position.set(0.3, 1.18, -0.22); grp.add(mag);
      var sight = new T.Mesh(new T.BoxGeometry(0.06, 0.08, 0.16), accent); sight.position.set(0.3, 1.43, -0.35); grp.add(sight);
      return {
        grp: grp, hips: hips, torso: torso, head: head, legL: legs[0], legR: legs[1],
        armL: arms[0], armR: arms[1], shield: shield, rifle: rifle, mag: mag,
        magBase: { y: 1.18, z: -0.22 },
        muzzleLocal: { x: 0.3, y: 1.32, z: -0.3 },
        mats: [suit, accent], lastHp: -1
      };
    }

    function setRemoteTeam(r, team) {
      if (!r || r.team === team) return;
      r.team = team;
      var fab = new T.Color(team === 1 ? 0x6f5a42 : 0x46545d);
      var acc = new T.Color(team === 1 ? 0xff6a55 : 0x4fa8ff);
      if (r.teamMats) r.teamMats.forEach(function (it) {
        var m = it.m;
        if (!m) return;
        if (m.color) m.color.copy(it.kind === "fabric" ? fab : acc);
        if (m.emissive) m.emissive.copy(acc);
      });
      else if (r.mats) r.mats.forEach(function (m) {
        if (m.color) m.color.copy(acc);
        if (m.emissive) m.emissive.copy(acc);
      });
      if (r.shield && r.shield.material && r.shield.material.color) r.shield.material.color.copy(acc);
      if (r.tagEl) r.tagEl.className = "x-mp-tag " + (team === 1 ? "team1" : "team0");
    }

    function upsertRemote(p) {
      var k = idKey(p.id);
      var r = remotes.get(k);
      if (!r) {
        r = buildRemoteModel(p);
        if (r.mag && !r.magBase) r.magBase = { y: r.mag.position.y, z: r.mag.position.z };
        r.id = p.id; r.hist = []; r.samples = []; r.name = p.name || "几猫"; r.phase = 0;
        r.lodFar = false; r.lodAt = 0; r.shieldOn = false;
        r.dead = false; r.team = p.team; r.lastHp = -1; r.fireT = 0; r.reloadT = 0; r.reloadDur = 1.35;
        r.los = true; r.losT = 0; r.lastTick = -1;
        r.tagAt = 0; r.tagX = NaN; r.tagY = NaN; r.tagVis = null;
        r.tagEl = makeTag(r.name, p.team, isBotPlayer(p));
        document.getElementById("ui").appendChild(r.tagEl);
        G.scene.add(r.grp);
        remotes.set(k, r);
      }
      setRemoteTeam(r, p.team);
      if (p.name && p.name !== r.name) {
        r.name = p.name;
        if (r.tagEl) setText(r.tagEl._nm, p.name);
      }
      r.p = p;
      r.grp.visible = true;
      r.shieldOn = !!p.spawnProtect && p.alive !== false;
      r.shield.visible = r.shieldOn && !r.lodFar;
      if (r.lastHp !== p.hp || r.dead !== (p.alive === false)) {
        r.lastHp = p.hp;
        r.dead = p.alive === false;
        var hb = r.tagEl && r.tagEl._em;
        if (hb) {
          var scale = "scaleX(" + clamp((p.hp || 0) / 100, 0, 1).toFixed(3) + ")";
          if (hb.style.transform !== scale) hb.style.transform = scale;
        }
        var op = p.alive === false ? "0" : "1";
        if (r.tagEl && r.tagEl._mpOp !== op) { r.tagEl.style.opacity = op; r.tagEl._mpOp = op; }
      }
      var t = nowMs();
      var sample = {
        t: t, tick: snapTick, x: p.x, y: p.y, z: p.z,
        yaw: p.yaw || 0, pitch: p.pitch || 0, crouch: !!p.crouch, dead: p.alive === false
      };
      var n = r.samples.length;
      if (n && r.samples[n - 1].tick === snapTick) r.samples[n - 1] = sample;
      else r.samples.push(sample);
      if (r.samples.length > 12) r.samples.shift();
    }

    /** 释放单个远端：几何/材质逐个 dispose（去重、跳过共享标记），姓名板回收进池。 */
    function disposeObject3D(o, seen) {
      if (!o || o.__mpShared) return 0;
      var n = 0;
      if (o.geometry && !o.geometry.__mpShared && seen.indexOf(o.geometry) < 0) {
        seen.push(o.geometry);
        try { o.geometry.dispose(); n++; } catch (e) {}
      }
      var mats = o.material;
      if (Array.isArray(mats)) {
        for (var i = 0; i < mats.length; i++) {
          var mi = mats[i];
          if (!mi || mi.__mpShared || seen.indexOf(mi) >= 0) continue;
          seen.push(mi);
          try { mi.dispose(); n++; } catch (e) {}
        }
      } else if (mats && !mats.__mpShared && seen.indexOf(mats) < 0) {
        seen.push(mats);
        try { mats.dispose(); n++; } catch (e) {}
      }
      return n;
    }
    function disposeRemote(r) {
      if (!r) return 0;
      var n = 0;
      if (r.grp) {
        var seen = [];
        if (G && G.scene) G.scene.remove(r.grp);
        try {
          if (typeof r.grp.traverse === "function") r.grp.traverse(function (o) { n += disposeObject3D(o, seen); });
        } catch (e) {}
      }
      releaseTag(r);
      if (r.samples) r.samples.length = 0;
      if (r.hist) r.hist.length = 0;
      r.grp = null;
      r.p = null;
      mpPerf.disposed += n;
      return n;
    }
    function removeRemote(id) {
      var rid = resolveId(id);
      var k = idKey(rid);
      var r = remotes.get(k);
      if (!r) return false;
      disposeRemote(r);
      remotes.delete(k);
      return true;
    }
    /** 换图 / 退房统一走 dispose，避免只 remove 不释放造成泄漏。 */
    function clearRemotes() {
      var ids = [];
      remotes.forEach(function (r, k) { ids.push(k); });
      for (var i = 0; i < ids.length; i++) removeRemote(ids[i]);
    }

    function remoteMuzzle(r) {
      var yaw = r.grp.rotation.y;
      var rx = Math.cos(yaw), rz = -Math.sin(yaw);
      var fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      var ml = r.muzzleLocal || { x: 0.06, y: 1.192, z: -0.97 };
      var crouch = r.p && r.p.crouch ? 0.22 : 0;
      // V38：枪口位置复用模块级对象（调用方立即消费，不持有引用）
      // V43：枪口随新步枪的胸前挂点移动，而不是旧的固定 0.3/1.32。
      muzzleTmp.x = r.grp.position.x + rx * ml.x - fx * ml.z;
      muzzleTmp.y = r.grp.position.y + ml.y - crouch;
      muzzleTmp.z = r.grp.position.z + rz * ml.x - fz * ml.z;
      return muzzleTmp;
    }

    /* V38：每远端每帧 0 分配 —— 不创建 stime 闭包 / {x,y,z}；samples.indexOf 改下标循环。
       姓名板改用 transform 定位，30Hz 更新 + 位移/显隐变化门控，8 人房不再刷 left/top。 */
    var _upNow = 0, _upFrameMs = 1 / 30, _upDt = 0;

    function sampleTime(samples, i, anchorT, anchorTick, frameMs) {
      return anchorT + (samples[i].tick - anchorTick) * frameMs;
    }

    // V49：距离 LOD。> far 时只渲染 3 mesh 的轮廓替身，避免远距离仍付全身细节。
    function updateRemoteLod(r, now) {
      if (now - (r.lodAt || 0) < 250) return;
      r.lodAt = now;
      var cfg = (window.SX_AVATAR_CONFIG && window.SX_AVATAR_CONFIG.lod) || {};
      var farD = cfg.far == null ? 55 : cfg.far;
      var ref = (G.camera && G.camera.position) || (G.player && G.player.pos);
      if (!ref || !r.grp) return;
      var dx = r.grp.position.x - ref.x, dy = r.grp.position.y - ref.y, dz = r.grp.position.z - ref.z;
      var far = dx * dx + dy * dy + dz * dz > farD * farD;
      if (far === !!r.lodFar) return;
      r.lodFar = far;
      if (r.far) r.far.visible = far;
      if (r.hips) r.hips.visible = !far;
      if (r.legL) r.legL.visible = !far;
      if (r.legR) r.legR.visible = !far;
      if (r.weapon) r.weapon.visible = !far;
      if (r.shield) r.shield.visible = !far && !!r.shieldOn;
      if (r.blob) r.blob.visible = !far;
      mpPerf.lodToggles = (mpPerf.lodToggles || 0) + 1;
    }

    function updateRemoteEach(r) {
      var samples = r.samples;
      if (!samples.length || !r.grp) return;
      var now = _upNow, frameMs = _upFrameMs, dt = _upDt;
      var last = samples[samples.length - 1];
      var anchorT = last.t, anchorTick = last.tick, lastT = anchorT;
      var target = now - interpMs;
      var a = last, b = last, k = 0, px, py, pz;
      if (samples.length === 1 || target <= sampleTime(samples, 0, anchorT, anchorTick, frameMs)) {
        a = b = samples[0];
        px = a.x; py = a.y; pz = a.z;
      } else if (target >= lastT) {
        a = last;
        var dt2 = Math.min(0.1, Math.max(0, (target - lastT) / 1000));
        var prev = samples.length > 1 ? samples[samples.length - 2] : null;
        var vx = 0, vz = 0;
        if (prev) {
          var sampleDt = Math.max(0.001, Math.max(1, last.tick - prev.tick) * frameMs / 1000);
          vx = (last.x - prev.x) / sampleDt;
          vz = (last.z - prev.z) / sampleDt;
        }
        px = last.x + vx * dt2; py = last.y; pz = last.z + vz * dt2;
        b = last;
      } else {
        var ia = 0, ib = 0;
        for (var i = 0; i < samples.length - 1; i++) {
          if (sampleTime(samples, i, anchorT, anchorTick, frameMs) <= target &&
            sampleTime(samples, i + 1, anchorT, anchorTick, frameMs) >= target) { ia = i; ib = i + 1; break; }
        }
        a = samples[ia]; b = samples[ib];
        var ta = sampleTime(samples, ia, anchorT, anchorTick, frameMs);
        var tb = sampleTime(samples, ib, anchorT, anchorTick, frameMs);
        var span = tb - ta;
        k = span > 0 ? clamp((target - ta) / span, 0, 1) : 0;
        px = a.x + (b.x - a.x) * k; py = a.y + (b.y - a.y) * k; pz = a.z + (b.z - a.z) * k;
      }
      // 模块级 scratch 复用：跨帧引用不变，测试可断言
      interpPos.x = px; interpPos.y = py; interpPos.z = pz;
      mpPerf.interpUses++;
      r.grp.position.set(px, py, pz);
      var dy = (b.yaw || 0) - (a.yaw || 0);
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      r.grp.rotation.y = (a.yaw || 0) + dy * k;
      updateRemoteLod(r, now);
      var sp = Math.hypot(b.x - a.x, b.z - a.z) / Math.max(0.001, (b.t - a.t) / 1000);
      var walk = clamp(sp / 4.4, 0, 1);
      var crouch = !!b.crouch;
      r.phase += dt * (1.3 + sp * 1.8 + (crouch ? 0.25 : 0));
      var stride = Math.sin(r.phase);
      var breathe = Math.sin(r.phase * 0.55) * 0.01;
      var swing = stride * (0.20 + walk * 0.58);
      // V43：蹲伏改为屈膝 + 降髋，不再整体压扁模型
      if (!avatarProp) avatarProp = (window.SX_AVATAR_CONFIG && window.SX_AVATAR_CONFIG.proportions) || {};
      var hipTarget = crouch ? (avatarProp.crouchHip || 0.70) : (avatarProp.standHip || 0.92);
      r.hips.position.y += (hipTarget - r.hips.position.y) * Math.min(1, dt * 10);
      r.grp.scale.y = 1;
      if (crouch) {
        r.legL.rotation.x = 0.62; r.legR.rotation.x = 0.43;
        if (r.kneeL) r.kneeL.rotation.x = -1.02;
        if (r.kneeR) r.kneeR.rotation.x = -0.88;
      } else {
        r.legL.rotation.x = swing; r.legR.rotation.x = -swing;
        if (r.kneeL) r.kneeL.rotation.x = Math.max(0, -swing) * 0.75 + walk * 0.05;
        if (r.kneeR) r.kneeR.rotation.x = Math.max(0, swing) * 0.75 + walk * 0.05;
      }
      r.torso.rotation.x = 0.035 + walk * 0.07 + (crouch ? 0.20 : 0) + breathe * 0.6;
      r.torso.position.y = breathe + Math.abs(stride) * 0.01 * walk;
      r.head.rotation.x = clamp((b.pitch || 0) * 0.7, -0.62, 0.55) - r.torso.rotation.x * 0.45;
      r.head.rotation.y = 0;
      // 持枪姿势：右臂握把、左臂托护木；行走只做小幅摆臂，不做“双手下垂摆动”
      var sway = Math.sin(r.phase * 0.9) * 0.02 * walk;
      // 由 tools/perf/probe_avatar.mjs 网格搜索标定：双手贴合握把/护木
      if (r.armR) { r.armR.rotation.x = 1.30 + sway; r.armR.rotation.z = -0.50; }
      if (r.armL) { r.armL.rotation.x = 1.10 - sway; r.armL.rotation.z = 0.40; }
      if (r.elbowR) r.elbowR.rotation.x = -1.30;
      if (r.elbowL) r.elbowL.rotation.x = 0;
      if (r.weapon) r.weapon.position.set(0.06, 1.18 + breathe * 0.8, -0.34);
      if (r.rifle) r.rifle.rotation.x = -0.06;
      if (r.fireT > 0) {
        r.fireT = Math.max(0, r.fireT - dt);
        if (r.weapon) r.weapon.position.z = -0.34 + r.fireT * 0.35;
        if (r.rifle) r.rifle.rotation.x = -0.06 - r.fireT * 1.1;
        if (r.armR) r.armR.rotation.x = 1.30 + r.fireT * 0.8;
      }
      if (r.reloadT > 0) {
        /* V39 远端换弹：枪口下压 + 弹匣脱离 + 左手回撤；V43 适配新枪挂点。 */
        r.reloadT = Math.max(0, r.reloadT - dt);
        var rdur = r.reloadDur || 1.35;
        var prog = clamp(1 - r.reloadT / rdur, 0, 1);
        var dip = Math.sin(prog * Math.PI);
        if (r.rifle) r.rifle.rotation.x = -0.06 - dip * 0.34;
        if (r.mag) {
          var mb = r.magBase || { y: -0.135, z: 0.015 };
          r.mag.position.y = mb.y - dip * 0.18;
          r.mag.position.z = mb.z + dip * 0.05;
        }
        if (r.armL) r.armL.rotation.x = 1.10 - dip * 0.35;
        if (r.armR) r.armR.rotation.x = 1.30 - dip * 0.12;
        if (r.elbowL) r.elbowL.rotation.x = -dip * 0.55;
      } else if (r.mag) {
        var mb2 = r.magBase || { y: -0.135, z: 0.015 };
        r.mag.position.y = mb2.y; r.mag.position.z = mb2.z;
      }
      if (r.dead) {
        r.grp.rotation.z += (1.38 - r.grp.rotation.z) * Math.min(1, dt * 7);
        r.grp.rotation.x += (0.16 - r.grp.rotation.x) * Math.min(1, dt * 7);
        if (r.armL) { r.armL.rotation.x = 0.25; r.armL.rotation.z = 0.15; }
        if (r.armR) { r.armR.rotation.x = 0.10; r.armR.rotation.z = -0.10; }
        if (r.elbowL) r.elbowL.rotation.x = -0.25;
        if (r.elbowR) r.elbowR.rotation.x = -0.20;
      } else {
        r.grp.rotation.z += (0 - r.grp.rotation.z) * Math.min(1, dt * 10);
        r.grp.rotation.x += (0 - r.grp.rotation.x) * Math.min(1, dt * 10);
      }
      if (!r.tagEl) return;
      if (r.tagAt == null || now - r.tagAt >= TAG_MIN_MS) {
        r.tagAt = now;
        mpPerf.tagUpdates++;
        var dist = Math.hypot(r.grp.position.x - G.player.pos.x, r.grp.position.z - G.player.pos.z);
        var enemy = r.team !== myTeam;
        if (enemy && now - r.losT > 260) {
          r.losT = now;
          try {
            var origin = G.camera.position;
            var dx = r.grp.position.x - origin.x;
            var dy2 = r.grp.position.y + 1.5 - origin.y;
            var dz = r.grp.position.z - origin.z;
            var len = Math.hypot(dx, dy2, dz) || 1;
            rayDir.x = dx / len; rayDir.y = dy2 / len; rayDir.z = dz / len;
            var hit = G.physics.raycast(origin, rayDir, Math.max(1, len - 0.5));
            r.los = !hit || hit.dist == null || hit.dist >= len - 0.6;
          } catch (e) { r.los = true; }
        }
        var wp = tmpV3.set(r.grp.position.x, r.grp.position.y + 2.3, r.grp.position.z).project(G.camera);
        var visible = !r.dead && wp.z > -1 && wp.z < 1 && dist < (enemy ? 40 : 60) && (!enemy || r.los);
        var tag = r.tagEl;
        if (!visible) {
          if (r.tagVis !== false) { r.tagVis = false; tag.style.display = "none"; mpPerf.tagWrites++; }
        } else {
          var tx = Math.round((wp.x * 0.5 + 0.5) * innerWidth);
          var ty = Math.round((-wp.y * 0.5 + 0.5) * innerHeight);
          if (r.tagVis !== true) { r.tagVis = true; tag.style.display = "block"; mpPerf.tagWrites++; }
          if (tx !== r.tagX || ty !== r.tagY) {
            r.tagX = tx; r.tagY = ty;
            tag.style.transform = "translate3d(" + tx + "px," + ty + "px,0) translate(-50%,-100%)";
            mpPerf.tagWrites++;
          }
        }
      } else {
        mpPerf.tagSkips++;
      }
    }

    function updateRemotes(dt) {
      _upNow = nowMs();
      _upFrameMs = 1000 / Math.max(1, tickRate);
      _upDt = dt;
      remotes.forEach(updateRemoteEach);
    }

    /* ------------------------------------------------------------ 本地输入 / 射击 */
    function buttonsFor(p) {
      var B = (window.SALT_NET && SALT_NET.BTN) || { FIRE: 1, ADS: 2, JUMP: 4, SPRINT: 8, CROUCH: 16, RELOAD: 32 };
      var b = 0;
      var inp = G.input || {};
      if (inp.fire) b |= B.FIRE;
      if (inp.ads) b |= B.ADS;
      if (inp.down && inp.down("jump")) b |= B.JUMP;
      if (p.sprinting) b |= B.SPRINT;
      if (p.crouching) b |= B.CROUCH;
      if (G.weapon && G.weapon.state === "reloading") b |= B.RELOAD;
      return b;
    }

    function flushPendingPos() {
      if (!pending.length) return;
      var last = pending[pending.length - 1];
      last.pos = { x: G.player.pos.x, y: G.player.pos.y, z: G.player.pos.z };
      last.vel = { x: G.player.vel.x, y: G.player.vel.y, z: G.player.vel.z };
    }

    function makeCommand() {
      var p = G.player;
      var mv = G.input.move || { x: 0, y: 0 };
      return {
        seq: ++seq,
        tick: ++inputTick,
        mx: clamp(num(mv.x, 0), -1, 1),
        my: clamp(num(mv.y, 0), -1, 1),
        yaw: num(p.yaw, 0),
        pitch: clamp(num(p.pitch, 0), -1.55, 1.55),
        buttons: buttonsFor(p),
        slot: G.weapon && G.weapon.activeIndex != null ? G.weapon.activeIndex | 0 : 0
      };
    }

    function sendCmd(cmd) {
      if (!cmd || typeof cmd !== "object") return false;
      if (cmd.t) return send(cmd);
      var c = {
        seq: cmd.seq != null ? cmd.seq : ++seq,
        tick: cmd.tick != null ? cmd.tick : ++inputTick,
        mx: clamp(num(cmd.mx, 0), -1, 1),
        my: clamp(num(cmd.my, 0), -1, 1),
        yaw: num(cmd.yaw, G.player ? G.player.yaw : 0),
        pitch: clamp(num(cmd.pitch, G.player ? G.player.pitch : 0), -1.55, 1.55),
        buttons: num(cmd.buttons, 0) | 0,
        slot: num(cmd.slot, 0) | 0
      };
      return wireCmd(c);
    }

    function wireCmd(c) {
      if (!ws || ws.readyState !== 1 || !selfId) return false;
      try {
        if (net.bin && window.SALT_NET && SALT_NET.encodeInput) {
          ws.send(SALT_NET.encodeInput(c));
          net.commandsSent++;
          return true;
        }
        var B = (window.SALT_NET && SALT_NET.BTN) || { FIRE: 1, ADS: 2, JUMP: 4, SPRINT: 8, CROUCH: 16, RELOAD: 32 };
        ws.send(JSON.stringify({
          t: "input", seq: c.seq, tick: c.tick, buttons: c.buttons,
          mx: c.mx, my: c.my, move: { x: c.mx, y: c.my },
          yaw: c.yaw, pitch: c.pitch, slot: c.slot,
          jump: !!(c.buttons & B.JUMP), sprint: !!(c.buttons & B.SPRINT), crouch: !!(c.buttons & B.CROUCH),
          reload: !!(c.buttons & B.RELOAD)
        }));
        net.commandsSent++;
        return true;
      } catch (e) { return false; }
    }

    function sendInput() {
      if (!ws || ws.readyState !== 1 || !selfId || !G.player) return;
      if (pending.length >= MAX_PENDING_SEND) { net.cmdBackoff++; return; }
      flushPendingPos();
      var c = makeCommand();
      pending.push({ seq: c.seq, tick: c.tick, cmd: c, pos: { x: G.player.pos.x, y: G.player.pos.y, z: G.player.pos.z }, vel: { x: G.player.vel.x, y: G.player.vel.y, z: G.player.vel.z }, at: nowMs() });
      while (pending.length > 120) pending.shift();
      wireCmd(c);
    }

    function send(obj) {
      if (!ws || ws.readyState !== 1) return false;
      try { ws.send(JSON.stringify(obj)); return true; } catch (e) { return false; }
    }

    function sendPing() {
      if (!ws || ws.readyState !== 1) return;
      try { ws.send(JSON.stringify({ t: "ping", ts: nowMs(), wall: Date.now(), n: rx.pong + 1 })); } catch (e) {}
      lastPing = nowMs();
    }

    function fireHandlerFn(ev) {
      if (!active || mpDead || !ev || !ev.dir) return;
      var d = vecFrom(ev.dir);
      if (!d) return;
      var L = Math.hypot(d.x, d.y, d.z);
      if (L < 0.5) return;
      d = { x: d.x / L, y: d.y / L, z: d.z / L };
      var w = G.weapon || {};
      var shot = {
        seq: ++shotSeq,
        wpn: ev.weapon || w.id || "pac9",
        slot: w.activeIndex | 0,
        ads: num(ev.ads, w.ads || 0),
        ammoBefore: (w.ammo == null ? 0 : w.ammo) + 1,
        reserveBefore: w.reserve == null ? 0 : w.reserve,
        at: nowMs()
      };
      pendingShots.push(shot);
      while (pendingShots.length > 24) pendingShots.shift();
      net.localShots++;
      send({
        t: "fire", dir: { x: d.x, y: d.y, z: d.z },
        wpn: shot.wpn, slot: shot.slot, ads: +shot.ads.toFixed(3),
        ammo: w.ammo == null ? 0 : w.ammo, reserve: w.reserve == null ? 0 : w.reserve,
        tick: estimatedServerTick(), cmdTick: inputTick, viewTick: viewTick(),
        serverTime: estimatedServerTime(), shotSeq: shot.seq
      });
    }

    function reloadHandlerFn(ev) {
      if (!active || !ev) return;
      var w = G.weapon || {};
      send({ t: "reload", phase: ev.phase || "start", wpn: w.id || "pac9", slot: w.activeIndex | 0, ammo: w.ammo | 0, reserve: w.reserve | 0, empty: !!ev.empty });
    }
    function switchHandlerFn() {
      if (!active || suppressWeaponNet) return;
      var w = G.weapon || {};
      send({ t: "switch", wpn: w.id || "pac9", slot: w.activeIndex | 0 });
    }

    /* ------------------------------------------------------------ 伤害 / 死亡 */
    function die(killer) {
      if (mpDead) return;
      mpDead = true;
      deadUi.classList.add("on");
      respawnAt = nowMs() + 3000;
      var killerName = killer ? sanitizeName(killer) : "";
      setText(deadSub(), killerName
        ? mpT("ui2.mp.death.killedBy", { killer: killerName }, "被 {killer} 击倒 · 3 秒后重生")
        : mpT("ui2.mp.death.respawn", null, "3 秒后重生"));
      try { G.player.health = 0; G.player.alive = false; } catch (e) {}
      try { G.input.setGameplay(false); G.input.exitLock(); } catch (e) {}
      resetPrediction();
    }

    function revive(m) {
      mpDead = false;
      deadUi.classList.remove("on");
      try {
        if (m.x != null) G.player.pos.set(num(m.x, 0), num(m.y, 0), num(m.z, 0));
        G.player.vel.set(0, 0, 0);
        if (m.yaw != null) G.player.yaw = m.yaw;
        G.player.health = m.hp != null ? m.hp : 100;
        G.player.armor = m.armor != null ? m.armor : 50;
        G.player.alive = true;
        G.input.setGameplay(true);
        G.input.requestLock();
      } catch (e) {}
      // 重生若带 slot/wpn/mag/reserve，写回武器与 HUD（无字段则保持旧行为）
      if (m.slot != null || m.wpn != null || m.mag != null || m.reserve != null) applyWeaponState(m);
      resetPrediction();
      justRespawn = true;
      showBanner(mpT("ui2.mp.respawned", null, "已重生"), 1.6);
    }

    /* ------------------------------------------------------------ 地图 */
    function mapSpec() {
      try {
        var d = window.__SX_MAPS_DATA;
        if (d && d.maps && d.maps[mapId]) return d.maps[mapId];
      } catch (e) {}
      return null;
    }

    function ensurePredWorld(force) {
      if (!window.SALT_SIM) return;
      if (predWorld && !force) return;
      var boxes = [];
      try {
        var pb = (G.physics && G.physics.boxes) || [];
        for (var i = 0; i < pb.length; i++) {
          var b = pb[i];
          if (!b || !b.min || !b.max) continue;
          boxes.push({
            min: { x: b.min.x, y: b.min.y, z: b.min.z },
            max: { x: b.max.x, y: b.max.y, z: b.max.z },
            flags: b.bulletOnly ? 1 : (b.playerOnly ? 2 : 0),
            surface: b.surface || "concrete"
          });
        }
      } catch (e) {}
      var spec = mapSpec() || {};
      var ground = spec.ground || {};
      try {
        predWorld = window.SALT_SIM.createWorld({
          boxes: boxes, bounds: spec.bounds,
          groundY: ground.y, seaY: ground.seaY, quayX: ground.quayX
        });
        predTuning = (G.player && G.player.tuning) || undefined;
      } catch (e) { predWorld = null; }
    }

    function mapSpawnYaw() {
      var spec = mapSpec();
      try {
        if (spec && spec.spawns && spec.spawns.team) {
          for (var i = 0; i < spec.spawns.team.length; i++) {
            if ((spec.spawns.team[i].team | 0) === myTeam) return spec.spawns.team[i].yaw;
          }
        }
      } catch (e) {}
      return null;
    }

    function applyMap(id) {
      if (id !== "depot" && id !== "ship" && id !== "core") id = "harbor";
      if (mapId === id) return false;
      mapId = id;
      showLoading(mapTitle(mapId));
      try { MapKit.load(mapId); } catch (e) {}
      try {
        G.enemies.clear();
        G.hud.setMarkers([]);
        var yaw = mapSpawnYaw();
        if (yaw != null) G.player.yaw = yaw;
      } catch (e) {}
      clearRemotes();
      baseline.clear();
      net.lastSnapAt = 0;
      ensurePredWorld(true);
      resetPrediction();
      match.caps = {};
      match.capsList = [];
      ensureCaps();
      refreshObjective();
      refreshMapHud();
      readyMap();
      return true;
    }

    function refreshObjective() {
      try {
        if (modeId === "domination") {
          ensureCaps();
          G.hud.setObjective(mpT("ui2.mp.domGoal", null, "据点争夺 · 控制 A / B / C"));
          var markers = ["A", "B", "C"].map(function (id) {
            var c = match.caps[id];
            return { kind: "relay", short: id, pos: c && c.pos ? c.pos : { x: 0, y: 0, z: 0 } };
          });
          G.hud.setMarkers(markers);
        } else {
          G.hud.setObjective(mpT("ui2.mp.objective.mode", { mode: modeText() + " · " + mapName(mapId) }, "多人 · {mode}"));
          G.hud.setMarkers([]);
        }
      } catch (e) {}
    }

    function mapLabel() { return mapName(mapId) + " · " + modeText(); }

    function refreshMapHud() {
      setText(hudRef("room"), (room || "room") + " · " + mapLabel());
    }

    function mapTitleFor(id) { return mapTitle(id); }
    function showLoading(title) {
      var lu = scoreUi && scoreUi._load;
      if (!lu) return;
      var t = lu.querySelector("[data-mp-load-t]");
      if (t) t.textContent = title || mapTitle(mapId);
      lu.classList.add("on");
      clearTimeout(showLoading._t);
      showLoading._t = setTimeout(function () { lu.classList.remove("on"); }, 2600);
    }
    function readyMap() {
      var lu = scoreUi && scoreUi._load;
      if (!lu) return;
      var hide = function () { setTimeout(function () { lu.classList.remove("on"); }, 260); };
      try {
        var p = G.render && G.render.renderer && G.render.renderer.compileAsync
          ? G.render.renderer.compileAsync(G.scene, G.camera) : null;
        if (p && p.then) p.then(hide).catch(hide); else hide();
      } catch (e) { hide(); }
    }

    function showRound(title, sub, secs) {
      var ru = scoreUi && scoreUi._round;
      if (!ru) return;
      var t = ru.querySelector("[data-mp-round-t]");
      if (t) t.textContent = title || "";
      var s = ru.querySelector("[data-mp-round-s]");
      if (s) s.textContent = sub || "";
      ru.classList.add("on");
      clearTimeout(roundTimer);
      if (secs) roundTimer = setTimeout(function () { ru.classList.remove("on"); }, secs * 1000);
    }
    function hideRound() { var ru = scoreUi && scoreUi._round; if (ru) ru.classList.remove("on"); }

    /* ------------------------------------------------------------ 进入 / 退出 */
    function hookGame() {
      if (prevUpdate && G.game.update !== prevUpdate) {
        // 已挂过，先恢复再重新挂，避免叠加
        G.game.update = prevUpdate;
      }
      prevUpdate = G.game.update;
      G.game.update = function (dt) {
        if (!active) return prevUpdate.call(G.game, dt);
        frame(dt);
        return true;
      };
      if (G.player && G.player.update && !origPlayerUpdate) {
        origPlayerUpdate = G.player.update;
        G.player.update = function (dt) {
          var r = origPlayerUpdate.call(this, dt);
          try {
            if (active && (viewOffset.x || viewOffset.y || viewOffset.z)) {
              G.camera.position.x += viewOffset.x;
              G.camera.position.y += viewOffset.y;
              G.camera.position.z += viewOffset.z;
              if (G.viewCamera && G.viewCamera !== G.camera) {
                G.viewCamera.position.x += viewOffset.x;
                G.viewCamera.position.y += viewOffset.y;
                G.viewCamera.position.z += viewOffset.z;
              }
            }
          } catch (e) {}
          return r;
        };
      }
    }
    function unhookGame() {
      if (prevUpdate && G.game) G.game.update = prevUpdate;
      prevUpdate = null;
      if (origPlayerUpdate && G.player) G.player.update = origPlayerUpdate;
      origPlayerUpdate = null;
    }

    function enter(welcome) {
      if (welcome.mapId) mapId = (welcome.mapId === "depot" || welcome.mapId === "ship" || welcome.mapId === "core") ? welcome.mapId : "harbor";
      if (welcome.mode) modeId = modeKey(welcome.mode);
      match.mode = modeId;
      if (MapKit.current() !== mapId) { showLoading(mapTitle(mapId)); MapKit.load(mapId); }
      G.game.menus.show("none");
      G.game.start({ skipIntro: true });
      var gen = session;
      setTimeout(function () {
        if (gen !== session || !conn) return;
        G.enemies.clear();
        G.game.flow.waves = [];
        G.game.flow.patrol = {};
        G.hud.setMarkers([]);
        G.hud.setRelays(0, 0);
        G.hud.setObjective(mpT("ui2.mp.objective.mode", { mode: modeLabel() }, "多人 · {mode}"));
        var hk = document.querySelector(".h-k"); if (hk) hk.textContent = mpT("ui2.mp.hud.kicker", null, "联机对战");
        var rel = document.querySelector(".h-relays");
        if (rel) rel.style.setProperty("display", "none", "important");
        if (G.hud.setPrompt) G.hud.setPrompt(null);
        G.hud.show(true);
        if (G.input.setGameplay) G.input.setGameplay(true);
        try {
          var spawn = welcome.map && welcome.map.spawn;
          var sy = spawn && (typeof spawn.yaw === "number" ? spawn.yaw : (spawn.pos && spawn.pos.yaw));
          if (typeof sy === "number") G.player.yaw = sy;
          else { var my = mapSpawnYaw(); if (my != null) G.player.yaw = my; }
          if (spawn && spawn.pos && Array.isArray(spawn.pos)) G.player.pos.set(spawn.pos[0], spawn.pos[1], spawn.pos[2]);
          else if (spawn && typeof spawn.x === "number") G.player.pos.set(spawn.x, spawn.y, spawn.z);
        } catch (e) {}
        try { G.input.requestLock(); } catch (e) {}
        active = true; joined = true; net.joinedAt = nowMs();
        try {
          var gd = document.querySelector(".x-guide"); if (gd) gd.classList.remove("on");
          var trs = document.querySelector(".x-train-step"); if (trs) trs.classList.remove("on");
        } catch (e) {}
        try { if (typeof AudioExt !== "undefined") AudioExt.setMode("mp"); } catch (e) {}
        hookGame();
        if (G.player) {
          mpDead = false;
          try { G.player.alive = true; } catch (e) {}
        }
        myKills = 0; myDeaths = 0;
        deadUi.classList.remove("on");
        scoreUi.classList.remove("on");
        scoreVisible = false;
        hud.classList.add("on");
        matchEl.classList.add("on");
        room = welcome.room || room;
        updateTeamHud();
        refreshMapHud();
        match.caps = {};
        match.capsList = [];
        ensureCaps();
        refreshObjective();
        renderCaps();
        setMatchState(match.state || "live");
        if (welcome.players) {
          setText(hudRef("count"), mpT("ui2.mp.online", { n: welcome.players.length }, "{n} 在线"));
        }
        var sh = scoreRefs ? scoreRefs.h3 : scoreUi.querySelector("h3");
        setText(sh, mpT("ui2.mp.score.title", { mode: modeText() }, "计分板 · {mode}"));
        ensurePredWorld(true);
        resetPrediction();
        try { readyMap(); } catch (e) {}
        window.__MPSNAP = [];
      }, 60);
    }

    function showRemotes() { return Array.from(remotes.keys()); }

    function leave(silent) {
      manualClose = true;
      session++;
      clearReconnect();
      active = false; joined = false; joining = false;
      net.lost = false;
      if (typeof AudioExt !== "undefined") { try { AudioExt.setMode("ambient"); } catch (e) {} }
      unhookGame();
      clearRemotes();
      clearTagPool();
      clearTimeout(hitUi.timer);
      hitUi.timer = 0;
      for (var hk in hudPending) delete hudPending[hk];
      roster.clear();
      baseline.clear();
      pending.length = 0;
      pendingShots.length = 0;
      serverSelf = null;
      selfId = null;
      resetIdMap();
      conn = null;
      if (ws) { try { ws.close(); } catch (e) {} ws = null; }
      hud.classList.remove("on");
      matchEl.classList.remove("on");
      capsEl.classList.remove("on");
      pause.classList.remove("on");
      deadUi.classList.remove("on");
      scoreUi.classList.remove("on");
      hideRound();
      hideBanner();
      mpDead = false;
      scoreVisible = false;
      try { G.player.health = 100; G.player.armor = 50; G.input.setGameplay(false); } catch (e) {}
      ui.classList.remove("on");
      try { G.input.exitLock(); } catch (e) {}
      try { G.hud.show(false); } catch (e) {}
      try { if (MapKit && MapKit.current() !== "harbor") MapKit.load("harbor"); } catch (e) {}
      try { G.game.state = "title"; G.game.menus.show("title"); } catch (e) {}
      try { G.player.enabled = false; } catch (e) {}
      try {
        var rel2 = document.querySelector(".h-relays"); if (rel2) rel2.style.display = "";
        var hk2 = document.querySelector(".h-k"); if (hk2) hk2.textContent = mpT("ui2.hud.objective", null, "任务目标");
      } catch (e) {}
      if (!silent) showStatus("");
    }

    /* ------------------------------------------------------------ 帧更新 */
    function frame(dt) {
      try { if (typeof AudioExt !== "undefined") AudioExt.update(dt); } catch (e) {}
      if (!active) return;
      sendAcc += Math.min(dt, 0.05);
      var guard = 0;
      var sendStep = 1 / Math.max(1, cmdRate);   // cmdRate = tickRate（服务端 60Hz）
      while (sendAcc >= sendStep && guard++ < 2) { sendAcc -= sendStep; sendInput(); }
      if (nowMs() - lastPing > 2000) { lastPing = nowMs(); sendPing(); }
      var decay = Math.exp(-dt / 0.11);
      viewOffset.x *= decay; viewOffset.y *= decay; viewOffset.z *= decay;
      if (Math.abs(viewOffset.x) + Math.abs(viewOffset.y) + Math.abs(viewOffset.z) < 0.001) viewOffset.x = viewOffset.y = viewOffset.z = 0;
      updateRemotes(dt);
      updatePerfHud();
      if (match.state === "live" && match.timeLeft != null && displayTimeLeft() <= 0) {
        // 服务器会发 roundEnd；先显示等待结算
        setMatchState("roundEnd");
      }
      if (mpDead && respawnAt) {
        var left = Math.max(0, Math.ceil((respawnAt - nowMs()) / 1000));
        setText(deadSub(), left > 0
          ? mpT("ui2.mp.death.countdown", { n: left }, "{n} 秒后重生")
          : mpT("ui2.mp.death.soon", null, "即将重生"));
      }
    }

    var _lastPingShown = -1, _lastTimeShown;
    /** 每帧 HUD：time 走值门控，ping 与 score/count 共用 100ms 节流。 */
    function updatePerfHud() {
      var tl = displayTimeLeft();
      var tlSec = tl == null ? null : Math.ceil(Math.max(0, tl));
      if (tlSec !== _lastTimeShown) {
        _lastTimeShown = tlSec;
        setText(hudRef("time"), formatTime(tl));
      }
      var pm = pingMs == null ? null : Math.round(pingMs);
      if (pm !== _lastPingShown) {
        _lastPingShown = pm;
        queueHudValue("ping", (pm == null ? "--" : pm) + " ms");
      }
      flushHudText();
    }

    /* ------------------------------------------------------------ 初始化 */
    /** 旧版 API：window.__SX_NET.modes —— 与 modeText 同一套词典 */
    function modesMap() {
      return {
        tdm: mpT("ui2.mp.modeName.tdm", null, "团队死斗"),
        chaos: mpT("ui2.mp.modeName.chaos", null, "大乱战"),
        domination: mpT("ui2.mp.modeName.domination", null, "据点争夺"),
        bomb: mpT("ui2.mp.modeName.bomb", null, "爆破"),
        coop: mpT("ui2.mp.modeName.coop", null, "潮汐防线")
      };
    }
    function installPublicNet() {
      try {
        if (!window.SX_NET2) {
          window.SX_NET2 = {
            VERSION: 2,
            install: function () { return !!window.__SX_NET; },
            sanitizeName: sanitizeName,
            escapeText: esc,
            friendlyError: friendly,
            validateUrl: checkUrl,
            modeKey: modeKey,
            modeName: modeText,
            addLobbyMode: function () { return true; }
          };
        }
        window.__SX_NET = {
          version: 2,
          get interpMs() { return interpMs; },
          get interpTicks() { return INTERP_TICKS; },
          perf: function () { return perfStats(); },
          state: function () { return netState(); },
          sendCmd: function (c) { return sendCmd(c); },
          pending: function () { return API.net2.pending(); },
          reconcileStats: function () { return API.net2.reconcileStats(); },
          rtt: function () { return pingMs; },
          protocol: API.net2.protocol,
          caps: ["bin"],
          escape: esc,
          sanitizeName: sanitizeName,
          validateUrl: checkUrl,
          errorText: friendly,
          modes: modesMap(),
          ready: true
        };
      } catch (e) {}
    }
    function init(g, kit) {
      G = g; T = g.THREE; MapKit = kit;
      tmpV = new T.Vector3(); tmpV2 = new T.Vector3(); tmpV3 = new T.Vector3();
      tmpDir = new T.Vector3();
      recomputeInterp();
      buildUI();
      addTitleEntry();
      if (G.events) {
        fireHandler = fireHandlerFn;
        reloadHandler = reloadHandlerFn;
        switchHandler = switchHandlerFn;
        G.events.on("weapon:fire", fireHandler);
        G.events.on("weapon:reload", reloadHandler);
        G.events.on("weapon:switch", switchHandler);
      }
      addEventListener("resize", function () {});
      var n = net2();
      if (n && n.addLobbyMode) { try { n.addLobbyMode(); } catch (e) {} }
      installPublicNet();
      // V39：语言切换 -> 重绘大厅 / 计分板 / 据点 / 状态条；i18n_extra 晚到也要再刷一次
      try { G.events.on("sx:lang", function () { applyLang(); }); } catch (e) {}
      try { addEventListener("sx:i18n-extra", function () { applyLang(); }); } catch (e) {}
      try { setTimeout(function () { applyLang(); }, 0); } catch (e) {}
      // V37：删除启动期 Vector3 错误吞并（ext_visual 已在引擎就绪后 boot），
      // 错误一律照常上报到 pageerror / window.__errors。
    }

    function netState() {
      return {
        active: active, joining: joining, joined: joined, selfId: selfId, selfNid: selfNid,
        room: room, map: mapId, mode: modeId, modeName: modeText(), url: url,
        team: myTeam, players: remotes.size + (selfId != null ? 1 : 0),
        kills: myKills, deaths: myDeaths, dead: mpDead,
        protocol: net.protocol, bin: net.bin, caps: net.caps.slice(),
        tickRate: tickRate, cmdRate: cmdRate, interpMs: interpMs, interpTicks: INTERP_TICKS,
        serverTick: estimatedServerTick(), serverTime: estimatedServerTime(),
        rtt: pingMs, pending: pending.length, acked: lastAcked, ackedTotal: ackedTotal, cmdBackoff: net.cmdBackoff,
        snapStats: { binary: net.snapBinary, json: net.snapJson, decodeErrors: net.decodeErrors, lastBinaryAt: net.lastBinaryAt, lastSnapAt: net.lastSnapAt, lastTick: net.lastTick },
        netStats: { commands: net.commandsSent, acks: net.ackFrames, ackFrameDropped: net.ackFrameDropped, ackDropped: net.ackDropped, localShots: net.localShots, remoteShots: net.remoteShots, hitEvents: net.hitEvents, killEvents: net.killEvents, rejectedShots: net.rejectedShots },
        match: { state: match.state, mode: match.mode, overtime: match.overtime, timeLeft: displayTimeLeft(), teams: match.teams.slice() },
        caps: { A: match.caps.A, B: match.caps.B, C: match.caps.C },
        reconnect: { attempt: reconnectAttempts, max: 3, pending: !!reconnectTimer },
        lost: net.lost, ws: ws ? ws.readyState : -1
      };
    }

    var API = {
      init: init,
      open: openLobby,
      join: function (u, n, r, m, md) { openLobby(); return join(u, n || "猫", r || "harbor-1", m, md); },
      leave: leave,
      state: function () { return netState(); },
      remotes: showRemotes,
      testFire: function (dir) {
        if (!active || !dir) return false;
        var d = vecFrom(dir);
        if (!d) return false;
        fireHandlerFn({ dir: d, weapon: G.weapon && G.weapon.id, ads: G.weapon && G.weapon.ads });
        return true;
      },
      testTeleport: function (x, z) { return send({ t: "dev", cmd: "tp", x: x, z: z, token: window.__MP_DEV_TOKEN || "" }); },
      testRound: function () { return send({ t: "dev", cmd: "round", token: window.__MP_DEV_TOKEN || "" }); },
      vote: function (m) { return send({ t: "vote", map: m }); },
      score: function () { return scoreData; },
      net2: {
        state: netState,
        sendCmd: sendCmd,
        pending: function () { return pending.map(function (p) { return { seq: p.seq, tick: p.tick, pos: p.pos }; }); },
        reconcileStats: function () {
          return {
            count: reconcile.count, hard: reconcile.hard, smooth: reconcile.smooth,
            lastError: reconcile.lastError, maxError: reconcile.maxError, p95: p95(reconcileErrs),
            errors: reconcileErrs.slice(-32), pending: pending.length, acked: lastAcked, ackedTotal: ackedTotal
          };
        },
        rtt: function () { return pingMs; },
        // 测试钩子（与 __MP.testFire/testTeleport 同类）：注入消息 / 二进制帧、
        // 读取 id 映射结果，供 tools/test_v36_net.mjs 校验 P0/P1 修复。
        testJsonOnly: function (v) { forceJson = !!v; if (forceJson) { net.bin = false; net.caps = []; } return forceJson; },
        testMsg: function (m) { if (m && typeof m === "object") onMsg(m); return true; },
        testBinary: function (buf) { onBinary(buf, session); return true; },
        testSnapshot: function (players, full) { return mergeSnapshotFrame(players, !!full); },
        // V38 性能测试钩子（非协议）：帧推进 / 远端注入与清理 / 缓存开关 / 复用对象与计数器
        testFrame: function (dt) { updateRemotes(dt || 1 / 60); updatePerfHud(); flushHudText(); return true; },
        testUpsert: function (list) {
          (list || []).forEach(function (p) { if (p && p.id != null) upsertRemote(normalizePlayer(p, false)); });
          return remotes.size;
        },
        testRemove: function (id) { return removeRemote(id); },
        testClear: function () { clearRemotes(); return remotes.size; },
        testTickRate: function (v) { tickRate = Math.max(1, num(v, 30)); cmdRate = tickRate; return recomputeInterp(); },
        testHudCache: function (on) { hudCacheOff = !on; if (!hudCacheOff) primeHudRefs(); return !hudCacheOff; },
        testHit: function (kind) { queueHitmarker(kind); return mpPerf.hitWrites; },
        testTags: function () { var out = []; remotes.forEach(function (r) { out.push(r.tagEl); }); return out; },
        // V39 本地化回归钩子：计分板显隐 / 强制重绘 / 阵亡与重生（无服务器也能看播报文案）
        testScoreboard: function (on) {
          scoreVisible = !!on;
          if (scoreUi) scoreUi.classList.toggle("on", scoreVisible);
          if (scoreVisible) renderScore();
          return scoreVisible;
        },
        testLang: function () { applyLang(); return i18nApi() ? "ok" : "no-i18n"; },
        testDie: function (killer) { die(killer == null ? "" : String(killer)); return true; },
        testRevive: function () { try { revive({}); } catch (e) {} return !mpDead; },
        perf: function () { return perfStats(); },
        resolveId: function (id) { return resolveId(id); },
        registerIds: function (list) { (list || []).forEach(function (p) { if (p && p.id != null) registerId(p.id, p.nid); }); return true; },
        ids: function () { return { selfId: selfId, selfNid: selfNid }; },
        protocol: {
          version: 2, caps: ["bin"],
          encodeInput: function (c) { return window.SALT_NET && SALT_NET.encodeInput ? SALT_NET.encodeInput(c) : null; },
          decodeSnapshot: function (b) { return window.SALT_NET && SALT_NET.decodeSnapshot ? SALT_NET.decodeSnapshot(b) : null; },
          encodeSnapshot: function (t, b, p, prev) { return window.SALT_NET && SALT_NET.encodeSnapshot ? SALT_NET.encodeSnapshot(t, b, p, prev) : null; }
        }
      },
      debug: function () {
        return {
          active: active, selfId: selfId, selfNid: selfNid, serverSelf: serverSelf,
          parts: Array.from(remotes.values()).map(function (r) {
            return {
              id: r.id, kids: r.grp.children.length, leg: +r.legL.rotation.x.toFixed(2),
              shield: !!r.shield.visible, tag: !!r.tagEl, dead: !!r.dead,
              reloadT: r.reloadT, lastWpn: r.lastWpn || null,
              // V39：换弹动作可观测（枪口俯仰 / 弹匣高度 / 左手关节）
              riflePitch: r.rifle ? +r.rifle.rotation.x.toFixed(3) : 0,
              magY: r.mag ? +r.mag.position.y.toFixed(3) : 0,
              armL: r.armL ? +r.armL.rotation.x.toFixed(3) : 0
            };
          }),
          hist: Array.from(remotes.entries()).map(function (e) {
            return { id: e[0], pos: e[1].grp.position.toArray().map(function (v) { return +v.toFixed(2); }), h: e[1].samples.slice(-3) };
          }),
          snap: window.__MPSNAP || null,
          net: netState()
        };
      }
    };
    return API;
  })();
