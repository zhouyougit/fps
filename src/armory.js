
  /* =====================================================================
     V8 军械库：武器改装与配件
     ===================================================================== */
  var ARMORY_KEY = "saltline.armory.v1";
  var WEAPON_ATTACH = {
    pac9: {
      name: "九式突击步枪", short: "九式",
      slots: [
        { id: "muzzle", name: "枪口", options: [
          { id: "std", name: "标准制退器", desc: "均衡配置", price: 0, mods: {} },
          { id: "comp", name: "战术补偿器", desc: "后坐 -18% · 散布 +5%", price: 120, mods: { recoil: 0.82, spread: 1.05 } },
          { id: "supp", name: "消音器", desc: "伤害 -8% · 枪声隐蔽", price: 260, mods: { damage: 0.92, recoil: 0.95, alert: 14 } }
        ] },
        { id: "mag", name: "弹匣", options: [
          { id: "std", name: "30 发标准", desc: "标准换弹", price: 0, mods: {} },
          { id: "ext", name: "45 发扩容", desc: "换弹 +18%", price: 260, mods: { magAdd: 15, reload: 1.18 } },
          { id: "fast", name: "25 发快拔", desc: "换弹 -25%", price: 120, mods: { magAdd: -5, reload: 0.75 } }
        ] },
        { id: "optic", name: "瞄具", options: [
          { id: "dot", name: "1x 红点", desc: "标准视野", price: 0, mods: { adsFov: 52 } },
          { id: "x2", name: "2x 战术镜", desc: "视野更窄 · 散布 -8%", price: 260, mods: { adsFov: 38, spread: 0.92 } }
        ] }
      ]
    },
    breaker12: {
      name: "破门锤霰弹枪", short: "破门锤",
      slots: [
        { id: "muzzle", name: "枪口", options: [
          { id: "std", name: "标准喉缩", desc: "均衡配置", price: 0, mods: {} },
          { id: "choke", name: "收束器", desc: "散布 -25%", price: 120, mods: { spread: 0.75 } },
          { id: "brake", name: "破门制退器", desc: "后坐 -20% · 散布 +10%", price: 260, mods: { recoil: 0.8, spread: 1.1 } }
        ] },
        { id: "mag", name: "弹仓", options: [
          { id: "std", name: "8 发弹仓", desc: "标准", price: 0, mods: {} },
          { id: "ext", name: "10 发弹仓", desc: "换弹 +20%", price: 260, mods: { magAdd: 2, reload: 1.2 } }
        ] },
        { id: "optic", name: "瞄具", options: [
          { id: "dot", name: "红点", desc: "标准视野", price: 0, mods: { adsFov: 52 } },
          { id: "iron", name: "机械瞄具", desc: "开镜视野更宽", price: 120, mods: { adsFov: 60 } }
        ] }
      ]
    },
    dmr: {
      name: "长眼精确射手步枪", short: "长眼",
      slots: [
        { id: "muzzle", name: "枪口", options: [
          { id: "std", name: "标准制退器", desc: "均衡配置", price: 0, mods: {} },
          { id: "comp", name: "精密制退器", desc: "后坐 -25%", price: 120, mods: { recoil: 0.75 } },
          { id: "supp", name: "消音器", desc: "伤害 -6% · 枪声隐蔽", price: 400, mods: { damage: 0.94, alert: 16 } }
        ] },
        { id: "mag", name: "弹匣", options: [
          { id: "std", name: "10 发弹匣", desc: "标准", price: 0, mods: {} },
          { id: "ext", name: "15 发弹匣", desc: "换弹 +20%", price: 260, mods: { magAdd: 5, reload: 1.2 } }
        ] },
        { id: "optic", name: "瞄具", options: [
          { id: "x3", name: "3x 瞄准镜", desc: "标准倍率", price: 0, mods: { adsFov: 30 } },
          { id: "x45", name: "4.5x 高倍镜", desc: "视野更窄 · 散布 -8%", price: 400, mods: { adsFov: 22, spread: 0.92 } }
        ] }
      ]
    },
    // V38：补齐 smg / lmg / sidearm，槽位与选项 id 与 packages/data/weapons/*.json 同源。
    smg: {
      name: "几猫·短哨 冲锋枪", short: "短哨",
      slots: [
        { id: "muzzle", name: "枪口", options: [
          { id: "std", name: "标准制退器", desc: "均衡配置", price: 0, mods: {} },
          { id: "supp", name: "一体消音器", desc: "伤害 -8% · 枪声隐蔽", price: 400, mods: { damage: 0.92, recoil: 0.95, alert: 12 } }
        ] },
        { id: "mag", name: "弹匣", options: [
          { id: "std", name: "32 发标准", desc: "标准换弹", price: 0, mods: {} },
          { id: "ext", name: "45 发扩容", desc: "换弹 +20%", price: 120, mods: { magAdd: 13, reload: 1.2 } },
          { id: "fast", name: "25 发快拔", desc: "换弹 -28%", price: 260, mods: { magAdd: -7, reload: 0.72 } }
        ] },
        { id: "optic", name: "瞄具", options: [
          { id: "dot", name: "1x 红点", desc: "标准视野", price: 0, mods: { adsFov: 58 } },
          { id: "holo", name: "1.5x 全息", desc: "视野更窄 · 散布 -6%", price: 120, mods: { adsFov: 48, spread: 0.94 } }
        ] }
      ]
    },
    lmg: {
      name: "几猫·重锚 轻机枪", short: "重锚",
      slots: [
        { id: "muzzle", name: "枪口", options: [
          { id: "std", name: "标准制退器", desc: "均衡配置", price: 0, mods: {} },
          { id: "comp", name: "重型补偿器", desc: "后坐 -20% · 散布 +6%", price: 120, mods: { recoil: 0.8, spread: 1.06 } },
          { id: "supp", name: "消音器", desc: "伤害 -6% · 枪声隐蔽", price: 400, mods: { damage: 0.94, recoil: 0.92, alert: 18 } }
        ] },
        { id: "mag", name: "弹箱", options: [
          { id: "std", name: "80 发弹箱", desc: "标准换弹", price: 0, mods: {} },
          { id: "ext", name: "120 发弹箱", desc: "换弹 +25%", price: 260, mods: { magAdd: 40, reload: 1.25 } }
        ] },
        { id: "optic", name: "瞄具", options: [
          { id: "dot", name: "1x 红点", desc: "标准视野", price: 0, mods: { adsFov: 50 } },
          { id: "x2", name: "2x 战术镜", desc: "视野更窄 · 散布 -8%", price: 260, mods: { adsFov: 38, spread: 0.92 } }
        ] }
      ]
    },
    sidearm: {
      name: "几猫·侧牙 手枪", short: "侧牙",
      slots: [
        { id: "muzzle", name: "枪口", options: [
          { id: "std", name: "标准枪口", desc: "均衡配置", price: 0, mods: {} },
          { id: "supp", name: "消音器", desc: "伤害 -10% · 枪声隐蔽", price: 260, mods: { damage: 0.9, recoil: 0.9, alert: 10 } }
        ] },
        { id: "mag", name: "弹匣", options: [
          { id: "std", name: "12 发标准", desc: "标准换弹", price: 0, mods: {} },
          { id: "ext", name: "18 发扩容", desc: "换弹 +15%", price: 120, mods: { magAdd: 6, reload: 1.15 } }
        ] },
        { id: "optic", name: "瞄具", options: [
          { id: "iron", name: "机械瞄具", desc: "标准视野", price: 0, mods: { adsFov: 60 } },
          { id: "dot", name: "1x 红点", desc: "视野更窄 · 散布 -4%", price: 120, mods: { adsFov: 56, spread: 0.96 } }
        ] }
      ]
    }
  };

  /* 配件目录：供成长系统（WP34-8）查询价格 / 解锁状态 */
  var ATTACH_CATALOG = (function () {
    var out = [];
    for (var wid in WEAPON_ATTACH) {
      var slots = WEAPON_ATTACH[wid].slots;
      for (var i = 0; i < slots.length; i++) {
        for (var k = 0; k < slots[i].options.length; k++) {
          var opt = slots[i].options[k];
          out.push({
            id: wid + ":" + slots[i].id + ":" + opt.id,
            wid: wid, slot: slots[i].id, opt: opt.id,
            name: opt.name, price: opt.price | 0
          });
        }
      }
    }
    return out;
  })();
  window.__SX_ARMORY = {
    catalog: ATTACH_CATALOG,
    refresh: function () { try { renderArmory(); } catch (e) {} },
    apply: function () { try { armoryApply(); } catch (e) {} },
    defaults: function () { return armoryDefaults(); }
  };

  var armorySel = null;
  var armoryUI = null;
  var armoryTab = "pac9";

  /* V39：军械库文案统一走 SXI18n（键由 weapon/slot/opt id 生成），
     词典缺键时回退 WEAPON_ATTACH 里的中文原文（旧构建 v32–v34 无 i18n_extra 也不崩）。 */
  function arI18n() {
    try { return (typeof window !== "undefined" && window.SXI18n) || null; } catch (e) { return null; }
  }
  function arHas(key) {
    var I = arI18n();
    if (!I) return false;
    try {
      if (typeof I.has === "function") return !!I.has(key);
      return !!(I.dict && I.dict["zh-CN"] && I.dict["zh-CN"][key] != null);
    } catch (e) { return false; }
  }
  /** arT(key, 中文兜底, vars) */
  function arT(key, zh, vars) {
    var I = arI18n();
    if (I && typeof I.t === "function" && arHas(key)) {
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
  function armoryWeaponI18n(wid) {
    var def = WEAPON_ATTACH[wid] || {};
    return {
      name: arT("ui2.ar.weapon." + wid + ".name", def.name || wid),
      short: arT("ui2.ar.weapon." + wid + ".short", def.short || wid)
    };
  }
  function armorySlotName(wid, slot) {
    return arT("ui2.ar.slot." + wid + "." + slot.id, slot.name);
  }
  function armoryOptName(wid, slot, opt) {
    return arT("ui2.ar.attach." + wid + "." + slot.id + "." + opt.id + ".name", opt.name);
  }
  function armoryOptDesc(wid, slot, opt) {
    return opt.desc ? arT("ui2.ar.attach." + wid + "." + slot.id + "." + opt.id + ".desc", opt.desc) : "";
  }

  function armoryDefaults() {
    var out = {};
    for (var wid in WEAPON_ATTACH) {
      out[wid] = {};
      var slots = WEAPON_ATTACH[wid].slots;
      for (var i = 0; i < slots.length; i++) out[wid][slots[i].id] = slots[i].options[0].id;
    }
    return out;
  }

  function loadArmory() {
    var base = armoryDefaults();
    try {
      var raw = JSON.parse(localStorage.getItem(ARMORY_KEY) || "null");
      if (raw && typeof raw === "object") {
        for (var wid in base) {
          if (!raw[wid]) continue;
          for (var sid in base[wid]) {
            if (typeof raw[wid][sid] !== "string") continue;
            // V37：存档里的配件必须存在于目录，否则回退默认选项
            if (!armoryOptionById(wid, sid, raw[wid][sid])) continue;
            base[wid][sid] = raw[wid][sid];
          }
        }
      }
    } catch (e) {}
    return base;
  }

  function saveArmory() {
    try { localStorage.setItem(ARMORY_KEY, JSON.stringify(armorySel)); } catch (e) {}
    try { if (window.SXBridge) SXBridge.armory(armorySel); } catch (e) {}
  }

  /* ---- WP34-8：配件解锁（价格 / 余额 / 购买） ---- */
  function progressAPI() {
    return window.__SX_PROGRESS || null;
  }
  // V37：价格 / 锁定只在成长系统（ext_progress）存在时启用。
  // V33 构建没有 ext_progress，不能出现“有价格但不可购买”的假锁定。
  function progressEnabled() {
    return !!progressAPI();
  }
  function attachKey(wid, slotId, optId) {
    return wid + ":" + slotId + ":" + optId;
  }
  function armoryOptionById(wid, slotId, optId) {
    var def = WEAPON_ATTACH[wid];
    if (!def) return null;
    for (var i = 0; i < def.slots.length; i++) {
      if (def.slots[i].id !== slotId) continue;
      var opts = def.slots[i].options;
      for (var k = 0; k < opts.length; k++) if (opts[k].id === optId) return opts[k];
    }
    return null;
  }
  function attachOwned(wid, slotId, opt) {
    if (!opt || !(opt.price > 0)) return true;
    var p = progressAPI();
    if (!p || typeof p.isUnlocked !== "function") return true;
    try { return !!p.isUnlocked(attachKey(wid, slotId, opt.id)); } catch (e) { return true; }
  }

  function armoryOption(wid, slotId) {
    var def = WEAPON_ATTACH[wid];
    if (!def) return null;
    var slots = def.slots;
    for (var i = 0; i < slots.length; i++) {
      if (slots[i].id !== slotId) continue;
      var sel = (armorySel && armorySel[wid] && armorySel[wid][slotId]) || slots[i].options[0].id;
      var found = null;
      for (var k = 0; k < slots[i].options.length; k++)
        if (slots[i].options[k].id === sel) { found = slots[i].options[k]; break; }
      if (!found) return slots[i].options[0];
      // V37：价格 > 0 且未解锁的配件不能生效，回退默认选项（0 档）
      if ((found.price | 0) > 0 && !attachOwned(wid, slotId, found)) return slots[i].options[0];
      return found;
    }
    return null;
  }

  function ensureMuzzleMesh(w) {
    if (w.__sxMuzzle) return w.__sxMuzzle;
    var T = G.THREE;
    var geo = new T.CylinderGeometry(0.0225, 0.0225, 0.17, 16, 1, true);
    geo.rotateX(Math.PI / 2);
    var mat = new T.MeshStandardMaterial({ color: 0x14171a, roughness: 0.48, metalness: 0.72 });
    var mesh = new T.Mesh(geo, mat);
    var mu = (w.cfg && w.cfg.muzzle) || [0, 0, -0.5];
    mesh.position.set(mu[0], mu[1], mu[2] - 0.075);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    var ref = w.root.children && w.root.children[0];
    if (ref) mesh.layers.mask = ref.layers.mask;
    w.root.add(mesh);
    w.__sxMuzzle = mesh;
    return mesh;
  }

  function armoryApply() {
    if (!armorySel) armorySel = loadArmory();
    var list = G.weapon && G.weapon.list;
    if (!list) return;
    for (var i = 0; i < list.length; i++) {
      var w = list[i];
      var def = WEAPON_ATTACH[w.id];
      if (!def || !w.mods) continue;
      var m = { damage: 1, reload: 1, spread: 1, recoil: 1, magAdd: 0, alert: 45, adsFov: 0 };
      var muzzleId = "std";
      for (var s = 0; s < def.slots.length; s++) {
        var slot = def.slots[s];
        var opt = armoryOption(w.id, slot.id);
        if (!opt) continue;
        if ((opt.price | 0) > 0 && !attachOwned(w.id, slot.id, opt)) opt = slot.options[0];
        if (slot.id === "muzzle") muzzleId = opt.id;
        var mo = opt.mods || {};
        if (mo.damage != null) m.damage *= mo.damage;
        if (mo.reload != null) m.reload *= mo.reload;
        if (mo.spread != null) m.spread *= mo.spread;
        if (mo.recoil != null) m.recoil *= mo.recoil;
        if (mo.magAdd != null) m.magAdd += mo.magAdd;
        if (mo.alert != null) m.alert = Math.min(m.alert, mo.alert);
        if (mo.adsFov != null) m.adsFov = mo.adsFov;
      }
      w.mods.damage = m.damage;
      w.mods.reload = m.reload;
      w.mods.spread = m.spread;
      w.mods.recoil = m.recoil;
      w.mods.alert = m.alert;
      w.mods.magAdd = m.magAdd;
      w.magSize = (w.baseMag || w.magSize) + m.magAdd;
      if (w.ammo > w.magSize) w.ammo = w.magSize;
      w.adsFov = m.adsFov || w.baseAdsFov || 0;
      var mesh = ensureMuzzleMesh(w);
      mesh.visible = muzzleId === "supp" || muzzleId === "brake" || muzzleId === "comp";
      if (mesh.visible) {
        var big = muzzleId === "supp";
        mesh.scale.set(big ? 1.1 : 0.95, big ? 1.1 : 0.95, big ? 1.25 : 0.55);
      }
    }
  }

  function armoryStat(w) {
    var base = w.cfg || {};
    var mods = w.mods || {};
    return {
      damage: Math.round((base.damage || w.damage || 0) * (mods.damage || 1)),
      rpm: base.rpm || w.rpm || 0,
      mag: w.magSize,
      reload: (w.reloadT || base.reloadT || 0) * (mods.reload || 1),
      recoil: mods.recoil || 1,
      spread: mods.spread || 1,
      fov: w.adsFov || base.adsFov || 52
    };
  }

  function armoryWeapon(id) {
    var list = G.weapon && G.weapon.list;
    if (!list) return null;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function buildArmoryUI() {
    var overlay = el("div", "x-armory");
    overlay.innerHTML =
      '<div class="x-ar-veil"></div>' +
      '<div class="x-ar-panel">' +
        '<div class="m-k">' + arT("ui2.armory.kicker", "几猫兵工厂 · 武器改装") + '</div>' +
        '<h2>' + arT("ui2.armory.title", "武器改装") + '</h2>' +
        '<div class="x-ar-balance">' + arT("ui2.armory.credits", "信用点") + ' <b data-x-balance>0</b></div>' +
        '<div class="x-ar-tabs"></div>' +
        '<div class="x-ar-body">' +
          '<div class="x-ar-slots"></div>' +
          '<aside class="x-ar-stats"></aside>' +
        '</div>' +
        '<div class="x-ar-actions">' +
          '<button class="btn primary" data-x="close">' + arT("ui2.armory.back", "返回") + '</button>' +
          '<button class="btn" data-x="reset">' + arT("ui2.armory.reset", "恢复默认") + '</button>' +
        '</div>' +
      '</div>';
    document.getElementById("ui").appendChild(overlay);
    armoryUI = {
      el: overlay,
      tabs: overlay.querySelector(".x-ar-tabs"),
      slots: overlay.querySelector(".x-ar-slots"),
      stats: overlay.querySelector(".x-ar-stats")
    };
    overlay.querySelector(".x-ar-veil").addEventListener("click", closeArmory);
    overlay.querySelector('[data-x="close"]').addEventListener("click", closeArmory);
    addEventListener("keydown", function (e) {
      if (e.code === "Escape" && armoryUI && armoryUI.el.classList.contains("on")) {
        e.preventDefault();
        e.stopPropagation();
        closeArmory();
      }
    }, true);
    overlay.querySelector('[data-x="reset"]').addEventListener("click", function (e) {
      e.preventDefault();
      armorySel = armoryDefaults();
      saveArmory();
      armoryApply();
      renderArmory();
    });
    armoryUI.tabs.addEventListener("click", function (e) {
      var b = e.target.closest("[data-wid]");
      if (!b) return;
      armoryTab = b.dataset.wid;
      try { G.events.emit("ui:click", {}); } catch (e) {}
      renderArmory();
    });
    armoryUI.slots.addEventListener("click", function (e) {
      var b = e.target.closest("[data-slot]");
      if (!b) return;
      var wid = armoryTab;
      var slotId = b.dataset.slot;
      var optId = b.dataset.opt;
      var opt = armoryOptionById(wid, slotId, optId);
      if (!opt) return;
      if (!attachOwned(wid, slotId, opt)) {
        // WP34-8：未解锁 → 先校验余额，够则扣款解锁，不够则原地拒绝
        var p = progressAPI();
        var res = null;
        try {
          res = p && typeof p.purchase === "function"
            ? p.purchase(attachKey(wid, slotId, optId), opt.price | 0, opt.name)
            : null;
        } catch (err) { res = { ok: false, reason: "error" }; }
        if (!res || !res.ok) {
          var short = res && res.reason === "insufficient";
          try {
            if (p && typeof p.notify === "function") {
              p.notify(short
                ? arT("ui2.armory.insufficient", "信用点不足 · 还差 {n} 点",
                    { n: Math.max(0, (res.price | 0) - (res.credits | 0)) })
                : arT("ui2.armory.lockedToast", "无法解锁该配件"), true);
            }
          } catch (err2) {}
          try { G.events.emit("ui:click", { error: "locked" }); } catch (err3) {}
          renderArmory();
          return;
        }
      }
      armorySel[wid][slotId] = optId;
      saveArmory();
      armoryApply();
      try { G.events.emit("ui:click", {}); } catch (err4) {}
      renderArmory();
    });
  }

  /* 军械库静态骨架（标题 / 信用点 / 按钮 / 统计标签）随语言刷新 */
  function localizeArmoryUI() {
    if (!armoryUI || !armoryUI.el) return;
    var root = armoryUI.el;
    var kicker = root.querySelector(".x-ar-panel .m-k");
    if (kicker) kicker.textContent = arT("ui2.armory.kicker", "几猫兵工厂 · 武器改装");
    var h2 = root.querySelector(".x-ar-panel h2");
    if (h2) h2.textContent = arT("ui2.armory.title", "武器改装");
    var aglow = root.querySelector(".x-ar-balance");
    if (aglow) {
      var balNum = aglow.querySelector("[data-x-balance]");
      var balVal = balNum ? balNum.textContent : "0";
      var label = arT("ui2.armory.credits", "信用点");
      if ((aglow.textContent || "").replace(/\s+/g, "") !== (label + balVal).replace(/\s+/g, "")) {
        aglow.innerHTML = label + ' <b data-x-balance>' + balVal + "</b>";
      }
    }
    var acts = root.querySelectorAll(".x-ar-actions .btn");
    if (acts[0]) acts[0].textContent = arT("ui2.armory.back", "返回");
    if (acts[1]) acts[1].textContent = arT("ui2.armory.reset", "恢复默认");
    var statKeys = ["damage", "rpm", "mag", "reload", "recoil", "spread", "fov"];
    var statZh = { damage: "伤害", rpm: "射速", mag: "弹匣", reload: "换弹", recoil: "后坐", spread: "散布", fov: "开镜 FOV" };
    var spans = root.querySelectorAll(".x-ar-stat span");
    for (var i = 0; i < spans.length && i < statKeys.length; i++) {
      var k = statKeys[i];
      spans[i].textContent = arT("ui2.armory.stat." + k, statZh[k]);
    }
  }

  function renderArmory() {
    if (!armoryUI) return;
    localizeArmoryUI();
    var ids = Object.keys(WEAPON_ATTACH).filter(function (id) {
      return !!armoryWeapon(id);
    });
    if (ids.indexOf(armoryTab) < 0 && ids.length) armoryTab = ids[0];
    var tabsHtml = "";
    for (var i = 0; i < ids.length; i++) {
      var wi = armoryWeaponI18n(ids[i]);
      tabsHtml += '<button class="x-ar-tab' + (ids[i] === armoryTab ? " on" : "") + '" data-wid="' + ids[i] + '"' +
        ' title="' + wi.name + '">' +
        '<b>' + (i + 1) + '</b><span>' + wi.short + '</span></button>';
    }
    armoryUI.tabs.innerHTML = tabsHtml;
    var def2 = WEAPON_ATTACH[armoryTab];
    if (!def2) return;
    var slotsHtml = "";
    for (var s = 0; s < def2.slots.length; s++) {
      var slot = def2.slots[s];
      slotsHtml += '<div class="x-ar-row"><div class="x-ar-row-h"><b>' + armorySlotName(armoryTab, slot) +
        '</b></div><div class="x-ar-opts">';
      for (var k = 0; k < slot.options.length; k++) {
        var opt = slot.options[k];
        var on = (armorySel[armoryTab][slot.id] || slot.options[0].id) === opt.id;
        var price = opt.price | 0;
        var progressOn = progressEnabled();
        var owned = progressOn ? attachOwned(armoryTab, slot.id, opt) : true;
        var locked = progressOn && !owned;
        var optName = armoryOptName(armoryTab, slot, opt);
        var optDesc = armoryOptDesc(armoryTab, slot, opt);
        slotsHtml += '<button class="x-ar-opt' + (on ? " on" : "") + (locked ? " locked" : "") +
          '" data-slot="' + slot.id + '" data-opt="' + opt.id + '"' +
          (locked ? ' title="' + arT("ui2.armory.lockedHint", "未解锁 · {n} 信用点", { n: price }) + '"' : "") + ">" +
          '<b>' + optName + (locked ? ' <i class="x-ar-lock">' + arT("ui2.armory.lock", "锁定") + '</i>' : "") + '</b>' +
          (optDesc ? '<span>' + optDesc + '</span>' : "") +
          (progressOn && price > 0
            ? '<em class="x-ar-price">' + (locked ? arT("ui2.armory.price", "{n} 信用点", { n: price }) : arT("ui2.armory.owned", "已拥有")) + "</em>"
            : "") +
          "</button>";
      }
      slotsHtml += "</div></div>";
    }
    armoryUI.slots.innerHTML = slotsHtml;
    var w = armoryWeapon(armoryTab);
    if (!w) return;
    var balEl = armoryUI.el.querySelector("[data-x-balance]");
    if (balEl) {
      var pApi = progressAPI();
      balEl.textContent = pApi && typeof pApi.credits === "function" ? String(pApi.credits()) : "—";
    }
    var st = armoryStat(w);
    armoryUI.stats.innerHTML =
      '<div class="x-ar-stat"><span>' + arT("ui2.armory.stat.damage", "伤害") + '</span><b>' + st.damage + "</b></div>" +
      '<div class="x-ar-stat"><span>' + arT("ui2.armory.stat.rpm", "射速") + '</span><b>' + st.rpm + " RPM</b></div>" +
      '<div class="x-ar-stat"><span>' + arT("ui2.armory.stat.mag", "弹匣") + '</span><b>' + st.mag + "</b></div>" +
      '<div class="x-ar-stat"><span>' + arT("ui2.armory.stat.reload", "换弹") + '</span><b>' + st.reload.toFixed(2) + "s</b></div>" +
      '<div class="x-ar-stat"><span>' + arT("ui2.armory.stat.recoil", "后坐") + '</span><b>' + Math.round(st.recoil * 100) + "%</b></div>" +
      '<div class="x-ar-stat"><span>' + arT("ui2.armory.stat.spread", "散布") + '</span><b>' + Math.round(st.spread * 100) + "%</b></div>" +
      '<div class="x-ar-stat"><span>' + arT("ui2.armory.stat.fov", "开镜 FOV") + '</span><b>' + Math.round(st.fov) + "°</b></div>";
  }

  function openArmory() {
    if (!armoryUI) return;
    armoryTab = (G.weapon && G.weapon.list && G.weapon.list[0] && G.weapon.list[0].id) || "pac9";
    renderArmory();
    armoryUI.el.classList.add("on");
    try { G.input.exitLock && G.input.exitLock(); } catch (e) {}
  }
  function closeArmory() {
    if (armoryUI) armoryUI.el.classList.remove("on");
  }

  function armoryLabel() { return arT("ui2.menu.armory", "武器改装"); }
  function refreshArmoryButtons() {
    var list = document.querySelectorAll('[data-x="armory"]');
    var label = armoryLabel();
    for (var i = 0; i < list.length; i++) {
      if (list[i].textContent !== label) list[i].textContent = label;
    }
  }

  function addArmoryButton(sel, before) {
    var acts = document.querySelector(sel);
    if (!acts || acts.querySelector('[data-x="armory"]')) return;
    var b = el("button", "btn", armoryLabel());
    b.setAttribute("data-x", "armory");
    b.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      openArmory();
    });
    acts.insertBefore(b, before || null);
  }

  function initArmory() {
    armorySel = loadArmory();
    buildArmoryUI();
    armoryApply();
    // V39：语言切换后重绘骨架 + 当前页签（选项名/描述/价格/统计）
    try {
      if (G.events) G.events.on("sx:lang", function () {
        try { refreshArmoryButtons(); } catch (e) {}
        try { renderArmory(); } catch (e) {}
      });
    } catch (e) {}
    addArmoryButton(".m-title .m-actions", document.querySelector('.m-title [data-act="settings"]'));
    addArmoryButton('.m-screen[data-s="paused"] .m-actions', document.querySelector('.m-screen[data-s="paused"] [data-act="settings"]'));
    G.events.on("game:state", function (e) {
      if (e && (e.state === "playing" || e.state === "intro")) setTimeout(armoryApply, 0);
    });
    G.events.on("weapon:switch", function () { setTimeout(armoryApply, 0); });
  }
