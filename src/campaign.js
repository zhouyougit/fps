
  /* =====================================================================
     战役 · 行动档案（v3）
     3 个行动：同一张港区地图的三种时段/目标编成；独立进度存档。
     ===================================================================== */
  var MISSIONS = [
    {
      id: "m1", code: "01", name: "四号泊位", chapter: "第一幕 · 断电", sub: "黄昏 · 港区外围",
      desc: "切断堆场、仓库、码头的三处上行中继，从南端舷梯登船撤离。",
      locTitle: "几猫港区 · 四号泊位 · 05:42", locSub: "几猫突击小队 · 单兵行动，无人支援",
      goal: "切断三处上行中继", extractText: "前往撤离艇",
      relays: [{ id: "a", label: "甲号中继 · 堆场" }, { id: "b", label: "乙号中继 · 仓库" }, { id: "c", label: "丙号中继 · 码头" }],
      extraction: { x: 29, z: 20 },
      waves: [{ gull: 3, hound: 1 }, { gull: 3, hound: 2 }, { gull: 4, hound: 3, marksman: 1 }],
      patrol: { gull: 2, hound: 1 }, maxAlive: 9, damageScale: 1, hpScale: 1,
      rain: 0.6, exposure: 1, saturation: 1, evac: 45,
      env: { sun: [0.92, 0.23, 0.33], zen: [0.055, 0.085, 0.13], hor: [0.95, 0.55, 0.28], away: [0.16, 0.22, 0.3], col: [1, 0.72, 0.42], light: 0xffddad, intensity: 9, exposure: 1, envIntensity: 2, rain: 0.6 },
      challenges: { time: 300, head: 6 },
      speaker: "指挥中心",
      threats: "机械飞鸥 · 机械猎犬 · 固定炮台",
      recommend: "精确射手 / 突击步枪",
      brief: ["切断堆场、仓库、码头的三处中继", "在撤离点坚守 45 秒，等待接驳", "登船撤离"],
      intro: "几猫队员，这里是行动指挥。按顺序切断三处中继；接驳需要 45 秒，务必守住撤离点。",
      all: "三处中继全部断开！接驳艇正在靠泊，坚守 45 秒！",
      done: "四号泊位已解除封锁",
      interlude: ["接驳艇提前三分钟靠泊。舵手说，雷达上多了一艘船。", "蜃第一次切进频道：第 3 次。你们每次都从堆场开始。"]
    },
    {
      id: "m2", code: "02", name: "仓库区", chapter: "第一幕 · 断电", sub: "暴雨 · 室内近战",
      desc: "暴雨封港。潜入仓库切断三处内部中继，再从东门集结点撤出。",
      locTitle: "几猫港区 · 二号仓库 · 暴雨", locSub: "几猫突击小队 · 近距离作战 · 能见度低",
      goal: "切断仓库内三处中继", extractText: "前往东门集结点",
      relays: [{ id: "d", label: "西区中继 · 货架" }, { id: "b", label: "主控中继 · 仓库" }, { id: "f", label: "东区中继 · 装卸口" }],
      extraction: { x: 14.5, z: -8.5 },
      waves: [{ gull: 2, hound: 2, drone: 1 }, { gull: 3, hound: 3, drone: 1, marksman: 1 }, { gull: 3, hound: 4, drone: 2, elite: 1, marksman: 1, heavy: 1 }],
      patrol: { gull: 1, hound: 3 }, maxAlive: 8, damageScale: 1.08, hpScale: 1.05,
      rain: 1, exposure: 0.92, saturation: 0.86, evac: 45,
      env: { sun: [0.4, 0.12, 0.9], zen: [0.02, 0.03, 0.045], hor: [0.16, 0.2, 0.26], away: [0.06, 0.075, 0.1], col: [0.35, 0.42, 0.55], light: 0xaab7c9, intensity: 3.2, exposure: 0.82, envIntensity: 1.2, rain: 1, saturation: 0.82 },
      challenges: { time: 360, head: 8 },
      start: { x: -10, z: -20, yaw: -1.57 },
      speaker: "小队频道",
      threats: "机械猎犬 · 自爆无人机 · 狙击猎犬 · 重装盾卫",
      recommend: "霰弹枪 / 突击步枪",
      brief: ["切断仓库内三处中继", "在东门集结点坚守 45 秒", "从集结点撤离"],
      intro: "指挥部通报：暴雨封港，仓库内有三个上行中继。猎犬已经进场；接驳需要 45 秒。",
      all: "仓库中继全部离线！东门集结点被封锁，坚守 45 秒！",
      done: "仓库区已恢复控制",
      interlude: ["货单：B4-0271，收件人四号泊位，1 件（活体）。", "仓库广播里多了一段被删掉的录音。蜃说：谢谢。"]
    },
    {
      id: "m3", code: "03", name: "码头封锁", chapter: "第二幕 · 反扑", sub: "黎明 · 重装抵抗",
      desc: "码头四处中继。全部断电后港区主控启动，摧毁核心，打开撤离窗口。",
      locTitle: "几猫港区 · 北码头 · 黎明", locSub: "几猫突击小队 · 主控核心仍在活动",
      goal: "切断码头四处中继", extractText: "前往撤离艇",
      relays: [{ id: "c", label: "码头中继 · 中" }, { id: "e", label: "码头中继 · 北" }, { id: "a", label: "堆场中继 · 西" }, { id: "f", label: "装卸口中继 · 南" }],
      extraction: { x: 29, z: 20 },
      // V55：第三关 BOSS 战无人机减量（2/2/3 → 1/1/2），配合全局自爆伤害 44→36。
      waves: [{ gull: 3, hound: 2, drone: 1 }, { gull: 4, hound: 3, drone: 1, elite: 1, marksman: 1 }, { gull: 4, hound: 3, drone: 2, elite: 2, marksman: 2, heavy: 2 }],
      patrol: { gull: 3, hound: 2 }, maxAlive: 10, damageScale: 1.16, hpScale: 1.12,
      rain: 0.35, exposure: 1.08, saturation: 1.04, evac: 0, boss: true,
      env: { sun: [0.75, 0.1, -0.65], zen: [0.05, 0.07, 0.15], hor: [1.0, 0.5, 0.36], away: [0.13, 0.15, 0.24], col: [1, 0.55, 0.36], light: 0xffc9a8, intensity: 6.5, exposure: 1.06, envIntensity: 2.1, rain: 0.2 },
      challenges: { time: 480, head: 10 },
      speaker: "指挥中心",
      threats: "全兵种 · 港区主控",
      recommend: "精确射手 + 破门锤",
      brief: ["切断码头四处中继", "摧毁港区主控核心", "在登船窗口内撤离"],
      intro: "最后一班接驳即将到港。切断四处中继——注意，港区主控还在码头上。",
      all: "四处中继全部断开！港区主控已启动，摧毁它的核心！",
      done: "码头封锁已解除",
      interlude: ["港区主控倒下，核心信号却已上传外锚地。", "舵手把船头转向外海：潮水不等人，别回头。"]
    },
    {
      id: "m4", code: "04", name: "冷链仓库", chapter: "第二幕 · 反扑", sub: "05:12 · 拂晓 · 室内近战",
      desc: "信号钻进 B4-0271 冷链仓库。切断三处冷却中继，在装卸口撤离——看看低温里冻着什么。",
      locTitle: "几猫港区 · 冷链仓库", locSub: "B4-0271 · 低温货物区",
      goal: "切断冷库内三处冷却中继", extractText: "前往装卸口",
      map: "depot",
      relays: [
        { id: "depot_r1", label: "西侧冷却中继", zone: "depot" },
        { id: "depot_r2", label: "中央控制中继", zone: "depot" },
        { id: "depot_r3", label: "东侧货舱中继", zone: "depot" }
      ],
      extraction: { x: 0, z: -14.2, radius: 2.6 },
      start: { x: 0, z: 13.6, yaw: 0 },
      waves: [{ hound: 2 }, { hound: 2, marksman: 1 }, { hound: 2, heavy: 1, marksman: 1 }],
      patrol: { hound: 1 }, maxAlive: 6, damageScale: 1.05, hpScale: 1.02,
      rain: 0, exposure: 0.92, saturation: 0.9, evac: 45, boss: false,
      env: { sun: [0.35, 0.8, 0.5], zen: [0.02, 0.025, 0.03], hor: [0.05, 0.055, 0.06], away: [0.02, 0.025, 0.03], col: [0.22, 0.2, 0.18], light: 0x9fb4c8, intensity: 0.6, exposure: 0.92, envIntensity: 0.7, rain: 0, saturation: 0.9 },
      challenges: { time: 300, head: 8 },
      speaker: "小队频道",
      threats: "机械猎犬 · 狙击猎犬 · 重装盾卫",
      recommend: "破门锤 / 突击步枪",
      brief: ["切断冷链仓库三处冷却中继", "在装卸口坚守 45 秒", "从装卸口撤离"],
      intro: "信号钻进了冷库。三个冷却中继维持着 B4-0271 的低温——切断它们，看看里面到底冻着什么。",
      all: "冷库中继全部离线！装卸口正在封门，坚守 45 秒！",
      done: "冷链仓库已恢复控制",
      interlude: ["冷冻舱还在运行，货位写着 B4-0271。", "冷库的低温里，有一件不该存在的东西。"]
    },
    {
      id: "m5", code: "05", name: "外锚地", chapter: "第二幕 · 反扑", sub: "暴雨夜 · 货轮甲板",
      desc: "货单上的“活体”在水滴保险的货轮上。登上外锚地的货轮甲板，切断三处船上中继，打开 7 号货舱。",
      locTitle: "水滴保险 · 外锚地", locSub: "B4-0271 · 7 号货舱",
      goal: "切断货轮三处中继", extractText: "前往船首撤离",
      map: "ship",
      relays: [
        { id: "ship_r1", label: "系泊绞车中继", zone: "ship" },
        { id: "ship_r2", label: "货舱门中继", zone: "ship" },
        { id: "ship_r3", label: "驾驶台中继", zone: "ship" }
      ],
      extraction: { x: 0, z: -8.4, radius: 2.4 },
      start: { x: 0, z: 5.2, yaw: 0 },
      waves: [{ hound: 2, marksman: 1 }, { hound: 2, heavy: 1, marksman: 1 }, { hound: 3, heavy: 2, marksman: 2 }],
      patrol: { hound: 1 }, maxAlive: 7, damageScale: 1.1, hpScale: 1.08,
      rain: 1, exposure: 0.84, saturation: 0.86, evac: 45, boss: false,
      env: { sun: [0.2, 0.16, 0.9], zen: [0.018, 0.025, 0.04], hor: [0.12, 0.16, 0.22], away: [0.05, 0.07, 0.1], col: [0.35, 0.4, 0.55], light: 0x9fb4c8, intensity: 2.6, exposure: 0.84, envIntensity: 1.3, rain: 1, saturation: 0.86 },
      challenges: { time: 420, head: 9 },
      speaker: "舵手",
      threats: "机械猎犬 · 狙击猎犬 · 重装盾卫",
      recommend: "精确射手 / 破门锤",
      brief: ["登上水滴保险的货轮甲板", "切断三处船上中继", "在船首撤离"],
      intro: "舵手把船停在探照灯照不到的地方。货单上的“活体”在七号货舱里——切断三处船上中继，别让这艘船离港。",
      all: "三处船上中继全部断开！船首撤离点正在暴露，坚守 45 秒！",
      done: "外锚地已控制",
      interlude: ["船上没有活人，只有一排等待唤醒的机械体。", "蜃：这不是通信中继。这是我的记忆。"]
    },
    {
      id: "m6", code: "06", name: "归途", chapter: "第三幕 · 溯源", sub: "05:42 · 破晓 · 最终行动",
      desc: "回到四号泊位。接管组已经进场，蜃把整座港区接进了自己身体。两处中继、一个终形，然后做出选择。",
      locTitle: "几猫港区 · 四号泊位 · 破晓", locSub: "几猫突击小队 · 蜃 · 终形",
      goal: "切断最后两处中继", extractText: "前往大门撤离",
      map: "harbor",
      relays: [
        { id: "a", label: "堆场中继 · 西" },
        { id: "c", label: "码头中继 · 中" }
      ],
      extraction: { x: -32, z: 6, radius: 2.6 },
      start: { x: 29, z: 20, yaw: 1.57 },
      waves: [{ gull: 3, hound: 2, drone: 2 }, { gull: 3, hound: 3, drone: 2, marksman: 1 }, { gull: 4, hound: 3, drone: 3, elite: 2, heavy: 1, marksman: 2 }],
      patrol: { gull: 2, hound: 2 }, maxAlive: 10, damageScale: 1.22, hpScale: 1.16,
      rain: 0, exposure: 1.1, saturation: 1.1, evac: 0, boss: true,
      bossHp: 2600, bossName: "蜃 · 终形", bossEvac: 30,
      env: { sun: [0.5, 0.42, 0.76], zen: [0.07, 0.1, 0.18], hor: [1.0, 0.6, 0.42], away: [0.15, 0.17, 0.24], col: [1, 0.72, 0.5], light: 0xffd7b0, intensity: 9.5, exposure: 1.1, envIntensity: 2.1, rain: 0, saturation: 1.1 },
      challenges: { time: 480, head: 12 },
      speaker: "蜃",
      threats: "全兵种 · 蜃 · 终形",
      recommend: "精确射手 / 破门锤",
      brief: ["切断最后两处中继", "摧毁蜃·终形", "在撤离窗口内做出选择"],
      intro: "回到四号泊位。接管组已经进场——蜃把整座港区的防线接进了自己身体。它只想拖住他们，给你时间。",
      all: "最后两处中继断开！蜃·终形展开，摧毁核心！",
      done: "四号泊位 · 归途"
    },
    {
      id: "m7", code: "07", name: "深水区", chapter: "第三幕 · 溯源", sub: "暴雨夜 · 港区反向推进",
      desc: "从码头一路打回西门。切断四处上行中继，清除十八个敌对单位，在暴雨里守住撤离区六十秒。",
      locTitle: "几猫港区 · 四号泊位 · 暴雨夜", locSub: "几猫突击小队 · 反向推进 · 断电区",
      goal: "切断四处上行中继", extractText: "前往西门撤离",
      map: "harbor",
      relays: [
        { id: "f", label: "装卸口中继 · 南" },
        { id: "b", label: "仓库中继 · 乙" },
        { id: "a", label: "堆场中继 · 甲" },
        { id: "e", label: "北侧上行中继 · 戊" }
      ],
      extraction: { x: -32, z: 6, radius: 2.6 },
      start: { x: 29, z: 20, yaw: 1.57 },
      objectivesGraph: [
        { type: "cut", count: 4, text: "切断四处上行中继" },
        { type: "kill", count: 18, text: "清除敌对单位" },
        { type: "hold", seconds: 60, text: "坚守撤离区", at: { x: -32, z: 6, r: 6 } },
        { type: "evac" }
      ],
      waves: [
        { gull: 3, hound: 2, drone: 1, turret: 1, scout: 1, siege: 1 },
        { gull: 4, hound: 3, drone: 2, marksman: 2, elite: 1, warden: 1, emp: 1 },
        { gull: 4, hound: 4, drone: 2, heavy: 2, marksman: 2, turret: 1, siege: 1 },
        { gull: 5, hound: 4, drone: 3, elite: 2, heavy: 2, marksman: 2, scout: 1, emp: 1 }
      ],
      patrol: { gull: 3, hound: 2 }, maxAlive: 11, damageScale: 1.3, hpScale: 1.22,
      rain: 1, exposure: 0.8, saturation: 0.88, evac: 0, boss: false,
      env: { sun: [0.18, 0.22, 0.92], zen: [0.016, 0.02, 0.032], hor: [0.09, 0.12, 0.17], away: [0.04, 0.055, 0.08], col: [0.3, 0.36, 0.52], light: 0x93a6bd, intensity: 2.2, exposure: 0.8, envIntensity: 1.1, rain: 1, saturation: 0.88 },
      challenges: { time: 540, head: 12 },
      speaker: "指挥中心",
      threats: "全兵种混编 · 固定炮台 · 断电区",
      recommend: "突击步枪 / 精确射手",
      brief: ["从码头反向推进，切断四处上行中继", "清除十八个敌对单位", "在撤离区坚守 60 秒，从西门撤离"],
      intro: "泡在水里的港区。四处上行中继还在供电，十八个目标已经把你围在中间——清掉它们，守住西门。",
      all: "四处中继全部断开！敌人正在收拢包围圈，把这片区域清干净，然后守住西门！",
      done: "深水区已清空",
      interlude: ["排水泵停了，港区正在沉进自己挖的坑里。", "蜃在频道里数着：第 3 次。潮水退的时候，你们还是从堆场开始。"]
    },
    {
      id: "m8", code: "08", name: "归零", chapter: "终幕 · 归零", sub: "核心舱 · 单机行动",
      desc: "进入核心舱，切断三处冷却回路上行中继，逼出蜃·残响。三十秒登船窗口，然后做最后的决定。",
      locTitle: "港区主控 · 核心舱 · B4-0271", locSub: "几猫突击小队 · 蜃 · 残响",
      goal: "切断核心舱三处上行中继", extractText: "前往南侧升降口",
      map: "core",
      relays: [
        { id: "core_r1", label: "西侧冷却中继" },
        { id: "core_r2", label: "东侧回响中继" },
        { id: "core_r3", label: "南侧核心中继" }
      ],
      extraction: { x: 0, z: -10.4, radius: 2.6 },
      start: { x: 0, y: 0.42, z: 9.6, yaw: 0 },
      objectivesGraph: [
        { type: "cut", count: 3, text: "切断三处上行中继" },
        { type: "boss", text: "摧毁蜃 · 残响" },
        { type: "evac" }
      ],
      waves: [
        { hound: 2, drone: 1, turret: 1, emp: 1, scout: 1 },
        { hound: 2, heavy: 1, marksman: 1, turret: 1, siege: 1, warden: 1 },
        { hound: 3, heavy: 2, marksman: 2, elite: 1, siege: 1, emp: 1 }
      ],
      patrol: { hound: 2 }, maxAlive: 8, damageScale: 1.32, hpScale: 1.25,
      rain: 0, exposure: 0.9, saturation: 0.95, evac: 0, boss: true,
      bossHp: 2200, bossName: "蜃 · 残响", bossEvac: 30,
      env: { sun: [0.2, 0.9, 0.1], zen: [0.02, 0.01, 0.01], hor: [0.09, 0.03, 0.03], away: [0.02, 0.01, 0.01], col: [0.55, 0.2, 0.12], light: 0xff7a50, intensity: 0.55, exposure: 0.9, envIntensity: 0.85, rain: 0, saturation: 0.95 },
      challenges: { time: 600, head: 15 },
      speaker: "蜃",
      threats: "蜃 · 残响 · 核心护卫 · 固定炮台",
      recommend: "精确射手 / 破门锤",
      brief: ["进入核心舱，切断三处冷却回路上行中继", "摧毁蜃 · 残响", "在 30 秒登船窗口内从南侧升降口撤离"],
      intro: "核心舱。冷却回路还在把它的记忆泵进反应堆——切断三处上行中继，逼它从里面出来。",
      all: "三处冷却中继断开！反应堆过载，蜃·残响正在成形——摧毁它！",
      done: "核心舱 · 归零",
      interlude: ["反应堆的读数停在 B4-0271。", "蜃：第 4 次。这次你打算留下，还是带走我？"]
    }
  ];

  /* =====================================================================
     V54 · 战役本地化
     数据（MISSIONS）保留中文作为 zh 回退；界面与 HUD/引擎读取的字段走 getter，
     EN 从 SXI18n 取词。词典缺键（v32–v34 没有 i18n_extra）时仍返回中文数据。
     ===================================================================== */
  function campI18n() {
    try { return (typeof window !== "undefined" && window.SXI18n) || null; } catch (e) { return null; }
  }
  function campHas(key) {
    var I = campI18n();
    if (!I) return false;
    try {
      if (typeof I.has === "function") return !!I.has(key);
      return !!(I.dict && I.dict["zh-CN"] && I.dict["zh-CN"][key] != null);
    } catch (e) { return false; }
  }
  /** campT(key, 中文兜底, vars) */
  function campT(key, zh, vars) {
    var I = campI18n();
    if (I && typeof I.t === "function" && campHas(key)) {
      try { return I.t(key, vars); } catch (e) { /* 取词失败回退中文 */ }
    }
    var s = zh == null ? key : String(zh);
    if (vars) {
      s = s.replace(/\{(\w+)\}/g, function (_, name) {
        return vars[name] == null ? "" : String(vars[name]);
      });
    }
    return s;
  }
  function missionT(m, field, zh) {
    return campT("mission." + (m && m.id) + "." + field, zh);
  }

  var MISSION_TEXT_FIELDS = ["name", "chapter", "sub", "desc", "goal", "extractText", "locTitle", "locSub", "speaker", "threats", "recommend", "intro", "all", "done", "bossName"];
  var MISSION_ARRAY_FIELDS = ["brief", "interlude"];
  (function localizeMissionData() {
    MISSIONS.forEach(function (m) {
      var raw = { __override: {} };
      MISSION_TEXT_FIELDS.forEach(function (f) {
        if (m[f] == null) return;
        raw[f] = m[f];
        Object.defineProperty(m, f, {
          enumerable: true, configurable: true,
          get: function () {
            if (raw.__override[f]) return raw[f];
            return campT("mission." + m.id + "." + f, raw[f]);
          },
          set: function (v) { raw[f] = v; raw.__override[f] = true; }
        });
      });
      MISSION_ARRAY_FIELDS.forEach(function (f) {
        if (!m[f]) return;
        raw[f] = m[f];
        Object.defineProperty(m, f, {
          enumerable: true, configurable: true,
          get: function () {
            var list = raw[f];
            return list.map(function (v, i) { return campT("mission." + m.id + "." + f + "." + (i + 1), v); });
          },
          set: function (v) { raw[f] = v; }
        });
      });
      if (m.relays) {
        raw.relays = m.relays;
        Object.defineProperty(m, "relays", {
          enumerable: true, configurable: true,
          get: function () {
            return raw.relays.map(function (r, i) {
              var copy = {}, key = "mission." + m.id + ".relayLabels." + (i + 1);
              for (var k in r) if (Object.prototype.hasOwnProperty.call(r, k)) copy[k] = r[k];
              copy.label = campT(key, r.label);
              return copy;
            });
          },
          set: function (v) { raw.relays = v; }
        });
      }
      if (m.objectivesGraph) {
        raw.objectivesGraph = m.objectivesGraph;
        Object.defineProperty(m, "objectivesGraph", {
          enumerable: true, configurable: true,
          get: function () {
            return raw.objectivesGraph.map(function (o, i) {
              var copy = {}, key = "mission." + m.id + ".obj." + (i + 1);
              for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) copy[k] = o[k];
              if (copy.text) copy.text = campT(key, copy.text);
              return copy;
            });
          },
          set: function (v) { raw.objectivesGraph = v; }
        });
      }
    });
  })();

  var CAMP_KEY = "saltline.campaign.v1";
  var camp = { unlocked: 1, best: {}, current: 0, trainSel: false, challenges: {} };
  var missionRadioArmed = null;   // V54：本次行动已发过 sx:mission-radio intro，避免暂停恢复重复触发
  var relayPool = {};
  var CAMP = null;

  function loadCamp() {
    try {
      var raw = JSON.parse(localStorage.getItem(CAMP_KEY) || "null");
      if (raw && typeof raw === "object") {
        camp.unlocked = Math.min(MISSIONS.length, Math.max(1, raw.unlocked | 0));
        camp.best = raw.best && typeof raw.best === "object" ? raw.best : {};
        camp.current = Math.min(MISSIONS.length - 1, Math.max(0, raw.current | 0));
        camp.challenges = raw.challenges && typeof raw.challenges === "object" ? raw.challenges : {};
        camp.ending = raw.ending === "silent" || raw.ending === "open" ? raw.ending : null;
        camp.checkpoint = raw.checkpoint && typeof raw.checkpoint === "object" ? raw.checkpoint : null;
      }
    } catch (e) {}
  }
  function saveCamp() {
    try { localStorage.setItem(CAMP_KEY, JSON.stringify(camp)); } catch (e) {}
    try { if (window.SXBridge) window.SXBridge.campaign(camp); } catch (e) {}
  }
  function reloadCamp() {
    loadCamp();
    return camp;
  }
  /* V53 SAVE-1：导入/重置会把统一档镜像回旧键（含 saltline.campaign.v1）。
     这里同步内存态；否则下一次 saveCamp() 会把导入前的旧进度再推回统一档。 */
  var saveUnsub = null;
  function bindSaveSync() {
    if (saveUnsub) return saveUnsub;
    try {
      if (!window.SXSave || typeof window.SXSave.subscribe !== "function") return null;
      saveUnsub = window.SXSave.subscribe(function (s, info) {
        var reason = info && info.reason;
        if (reason === "import" || reason === "reset") reloadCamp();
      });
    } catch (e) { console.error("[ext] save sync", e); }
    return saveUnsub || null;
  }

  var RELAY_STATIONS = {
    d: { x: -12, z: -24 },
    e: { x: 27, z: -16 },
    f: { x: 9, z: -22 }
  };

  function relayBoxesFor(obj, pos) {
    var cols = (obj && obj.userData && obj.userData.colliders) || [];
    var out = [];
    for (var i = 0; i < cols.length; i++) {
      var c = cols[i];
      var mn = [c.min[0] + pos.x, c.min[1] + pos.y, c.min[2] + pos.z];
      var mx = [c.max[0] + pos.x, c.max[1] + pos.y, c.max[2] + pos.z];
      for (var j = 0; j < G.physics.boxes.length; j++) {
        var b = G.physics.boxes[j];
        if (Math.abs(b.min.x - mn[0]) < 0.02 && Math.abs(b.min.y - mn[1]) < 0.02 &&
            Math.abs(b.min.z - mn[2]) < 0.02 && Math.abs(b.max.x - mx[0]) < 0.02 &&
            Math.abs(b.max.y - mx[1]) < 0.02 && Math.abs(b.max.z - mx[2]) < 0.02) { out.push(b); break; }
      }
    }
    return out;
  }

  function initRelayPool() {
    var T = G.THREE;
    (G.level.objectives || []).forEach(function (o) {
      var key = String(o.id || "").replace("relay_", "");
      relayPool[key] = { object: o.object, pos: o.pos.clone(), boxes: relayBoxesFor(o.object, o.pos) };
    });
    Object.keys(RELAY_STATIONS).forEach(function (key) {
      var def = RELAY_STATIONS[key];
      var px = def.x, pz = def.z;
      try {
        var spot = nearestWalkable(px, pz, 2.2);
        if (spot && spot.d > 0) { px = spot.x; pz = spot.z; }
      } catch (e) {}
      var y = 0.03;
      try { y = G.physics.groundHeight(px, pz, 2.5); } catch (e) { y = 0.03; }
      var g = G.props.build("relay_node");
      g.position.set(px, y, pz);
      G.level.root.add(g);
      g.updateMatrixWorld(true);
      var boxes = [];
      var cols = (g.userData && g.userData.colliders) || [];
      for (var i = 0; i < cols.length; i++) {
        var c = cols[i];
        boxes.push(G.physics.addBox(
          [c.min[0] + px, c.min[1] + y, c.min[2] + pz],
          [c.max[0] + px, c.max[1] + y, c.max[2] + pz],
          { surface: c.surface || "metal", bulletOnly: !!c.bulletOnly }
        ));
      }
      relayPool[key] = { object: g, pos: new T.Vector3(px, y, pz), boxes: boxes };
    });
    G.physics.build();
  }

  function setRelayVisible(key, on) {
    var r = relayPool[key];
    if (!r) return;
    r.object.visible = !!on;
    for (var i = 0; i < r.boxes.length; i++) {
      var b = r.boxes[i];
      if (!b.__sx) b.__sx = { min: b.min.clone(), max: b.max.clone() };
      if (on) { b.min.copy(b.__sx.min); b.max.copy(b.__sx.max); }
      else { b.min.set(0, -120, 0); b.max.set(0, -119.6, 0); }
    }
  }

  function setRelays(active) {
    Object.keys(relayPool).forEach(function (k) { setRelayVisible(k, active.indexOf(k) >= 0); });
    try { G.physics.build(); } catch (e) {}
  }

  function applyEnvironment(env) {
    if (!env || !G || !G.render) return;
    var r = G.render;
    try {
      var u = r.sky && r.sky.material && r.sky.material.uniforms;
      if (u) {
        if (u.uSunDir && env.sun) u.uSunDir.value.set(env.sun[0], env.sun[1], env.sun[2]).normalize();
        if (u.uZen && env.zen) u.uZen.value.set(env.zen[0], env.zen[1], env.zen[2]);
        if (u.uHor && env.hor) u.uHor.value.set(env.hor[0], env.hor[1], env.hor[2]);
        if (u.uHorAway && env.away) u.uHorAway.value.set(env.away[0], env.away[1], env.away[2]);
        if (u.uSunCol && env.col) u.uSunCol.value.set(env.col[0], env.col[1], env.col[2]);
      }
      if (r.sun) {
        if (env.sun) {
          var v = new G.THREE.Vector3(env.sun[0], env.sun[1], env.sun[2]).normalize();
          r.sun.position.copy(v).multiplyScalar(200);
        }
        if (env.light != null) r.sun.color.set(env.light);
        if (env.intensity != null) r.sun.intensity = env.intensity;
      }
      if (env.exposure != null) r.exposure = env.exposure;
      if (env.envIntensity != null && G.scene) G.scene.environmentIntensity = env.envIntensity;
      if (env.rain != null && G.ground) G.ground.setRain(env.rain);
      if (env.saturation != null && r.post) r.post.saturation = env.saturation;
      else if (r.post) r.post.saturation = 1;
    } catch (e) { console.error("[ext] environment", e); }
  }

  function nearestWalkable(x, z, maxR) {
    var nav = G.physics && G.physics.nav;
    if (!nav) return null;
    if (nav.isWalkable(x, z)) return { x: x, z: z, d: 0 };
    for (var r = 0.5; r <= maxR; r += 0.5) {
      for (var a = 0; a < 16; a++) {
        var th = (a / 16) * Math.PI * 2;
        var nx = x + Math.cos(th) * r, nz = z + Math.sin(th) * r;
        if (nav.isWalkable(nx, nz)) return { x: nx, z: nz, d: r };
      }
    }
    return null;
  }

  function validateObjectives() {
    var out = [];
    if (!G || !G.physics || !G.level) return out;
    var start = G.level.playerStart && G.level.playerStart.pos;
    var list = (G.level.objectives || []).slice();
    if (G.level.extraction) list.push({ id: "extract", label: campT("campaign.obj.extract", "撤离点"), pos: G.level.extraction.pos });
    list.forEach(function (o) {
      var near = nearestWalkable(o.pos.x, o.pos.z, 2.2);
      var floor = G.physics.groundHeight(o.pos.x, o.pos.z, 2.5);
      var path = near && start ? G.physics.nav.findPath(start, new G.THREE.Vector3(near.x, floor, near.z)) : null;
      out.push({
        id: o.id,
        label: o.label,
        pos: [o.pos.x, o.pos.y, o.pos.z].map(function (v) { return +v.toFixed(2); }),
        floor: +floor.toFixed(2),
        near: near ? [near.x, near.z].map(function (v) { return +v.toFixed(2); }) : null,
        nearDist: near ? +near.d.toFixed(2) : null,
        path: path ? path.length : 0,
        ok: !!near && !!path && Math.abs(o.pos.y - floor) < 2.2
      });
    });
    return out;
  }

  function applyMission(idx) {
    var m = MISSIONS[idx];
    if (!m) return;
    camp.current = idx;
    missionRadioArmed = null;
    var mapId = m.map || "harbor";
    if (typeof MapKit !== "undefined" && MapKit.current() !== mapId) {
      MapKit.load(mapId);
    }
    if (m.map && m.map !== "harbor") {
      var dr = MapKit.relays(m.map) || {};
      Object.keys(dr).forEach(function (id) { dr[id].object.visible = false; });
      G.level.objectives = m.relays.map(function (r) {
        var d = dr[r.id];
        if (!d) return null;
        d.object.visible = true;
        return { id: "relay_" + r.id, label: r.label || d.label, zone: m.map, pos: d.pos, object: d.object };
      }).filter(Boolean);
    } else {
      setRelays(m.relays.map(function (r) { return r.id; }));
      G.level.objectives = m.relays.map(function (r) {
        var p = relayPool[r.id];
        return { id: "relay_" + r.id, label: r.label, zone: r.zone || "yard", pos: p.pos, object: p.object };
      });
    }
    try {
      var ey = G.physics.groundHeight(m.extraction.x, m.extraction.z, 2.5);
      G.level.extraction.pos.set(m.extraction.x, ey, m.extraction.z);
      G.level.extraction.radius = m.extraction.radius || 2.6;
    } catch (e) {}
    if (G.game && G.game.flow) {
      G.game.flow.waves = m.waves;
      G.game.flow.patrol = m.patrol;
      G.game.flow.maxAlive = m.maxAlive;
    }
    if (G.game) G.game.currentMission = m;
    S.missionDamage = m.damageScale || 1;
    S.missionHp = m.hpScale || 1;
    if (typeof recomputeScales === "function") recomputeScales();
    applyEnvironment(m.env);
    try {
      if (!m.map || m.map === "harbor") {
      if (!G.level.__origStart) G.level.__origStart = { pos: G.level.playerStart.pos.clone(), yaw: G.level.playerStart.yaw };
      var st = m.start || G.level.__origStart;
      var sx = st && st.pos ? st.pos.x : st.x;
      var sz = st && st.pos ? st.pos.z : st.z;
      var syaw = st && st.yaw != null ? st.yaw : 0;
      var sy = G.physics.groundHeight(sx, sz, 3);
      G.level.playerStart = { pos: new G.THREE.Vector3(sx, sy, sz), yaw: syaw };
      }
    } catch (e) {}
    var spk = document.querySelector(".comms-who");
    if (spk) spk.textContent = m.speaker || campT("radio.command", "指挥中心");
    var lc = document.querySelector(".loc-card b");
    if (lc) lc.textContent = m.locTitle;
    var ls = document.querySelector(".loc-card span");
    if (ls) ls.textContent = m.locSub;
    var dim = document.querySelector(".m-title .m-eyebrow .m-dim");
    if (dim) dim.textContent = camp.ending
      ? campT("campaign.sealed", "几猫港区 · 档案 B4-0271 已封存")
      : campT("campaign.unlocked", "几猫港区 · 已解锁 {n}/{total}", { n: camp.unlocked, total: MISSIONS.length });
    var premise = document.querySelector(".m-title .m-premise");
    if (premise) premise.textContent = campT("campaign.now", "当前行动 {code} · {name} · 已解锁 {n}/{total}",
      { code: m.code, name: m.name, n: camp.unlocked, total: MISSIONS.length });
    var dk = document.querySelector(".m-debrief .m-k");
    if (dk) dk.textContent = campT("campaign.debriefTitle", "行动 {code} · {name} · 行动简报", { code: m.code, name: m.name });
    var dh = document.querySelector(".m-debrief .m-h");
    if (dh) dh.textContent = m.done || campT("campaign.doneFallback", "行动完成");
    try {
      var vr = validateObjectives();
      var bad = vr.filter(function (x) { return !x.ok; });
      if (bad.length && window.console && console.warn)
        console.warn("[ext] unreachable objectives", bad);
    } catch (e) {}
  }

  function fmtClock(sec) {
    var m = Math.floor(sec / 60), r = Math.floor(sec % 60);
    return m + ":" + String(r).padStart(2, "0");
  }
  function challengeDefs(m) {
    var c = m.challenges || { time: 999, head: 999 };
    return [
      { key: "time", label: campT("mission." + m.id + ".chal.time", "限时 ≤ {time}", { time: fmtClock(c.time) }) },
      { key: "head", label: campT("mission." + m.id + ".chal.head", "爆头击杀 ≥ {n}", { n: c.head }) },
      { key: "clean", label: campT("mission." + m.id + ".chal.clean", "无死亡通关") }
    ];
  }
  function challengeDone(id) {
    var st = camp.challenges && camp.challenges[id];
    return st ? (st.time ? 1 : 0) + (st.head ? 1 : 0) + (st.clean ? 1 : 0) : 0;
  }
  function challengeCount() {
    var n = 0;
    for (var i = 0; i < MISSIONS.length; i++) n += challengeDone(MISSIONS[i].id);
    return n;
  }
  function challengeCheck(stats) {
    var m = MISSIONS[camp.current], c = m && m.challenges;
    if (!c) return null;
    return {
      time: stats.time <= c.time,
      head: (stats.headshots | 0) >= c.head,
      clean: (stats.retries | 0) === 0
    };
  }

  function renderChallengeNote(newly, done) {
    var panel = document.querySelector(".m-debrief");
    if (!panel) return;
    var old = panel.querySelector(".x-chal");
    if (old) old.remove();
    var defs = challengeDefs(MISSIONS[camp.current]);
    var count = (done.time ? 1 : 0) + (done.head ? 1 : 0) + (done.clean ? 1 : 0);
    var names = {
      time: campT("ui2.chal.name.time", "限时"),
      head: campT("ui2.chal.name.head", "爆头"),
      clean: campT("ui2.chal.name.clean", "无死亡")
    };
    var note = document.createElement("div");
    note.className = "x-chal";
    var unlock = "";
    var total = challengeCount();
    if (total >= 9) unlock = campT("ui2.chal.unlock.gold", "解锁：金色准星");
    else if (total >= 6) unlock = campT("ui2.chal.unlock.red", "解锁：红色准星");
    else if (total >= 3) unlock = campT("ui2.chal.unlock.green", "解锁：绿色准星");
    var newNames = newly.map(function (k) { return names[k]; }).join(" / ");
    note.innerHTML = "<b>" + campT("ui2.camp.challenge", "挑战 {n}/3", { n: count }) + "</b><span>" +
      defs.map(function (d) {
        return '<i class="' + (done[d.key] ? "ok" : "") + '">' + (done[d.key] ? "✓ " : "○ ") + d.label + "</i>";
      }).join("") +
      (newly.length ? "<em>" + campT("ui2.chal.new", "新完成：{names}", { names: newNames }) + "</em>" : "") +
      (unlock ? "<em class='unlock'>" + unlock + "</em>" : "") +
      "</span>";
    var actions = panel.querySelector(".m-actions");
    panel.insertBefore(note, actions || null);
  }

  function buildNarrativeUI() {
    INT = el("div", "x-interlude");
    INT.innerHTML = '<div class="x-int-veil"></div><div class="x-int-card"><div class="m-k" data-int-k></div><h2 data-int-h></h2><div class="sub" data-int-sub></div><div class="x-int-lines" data-int-lines></div><button class="btn primary" data-int-go>' + campT("ui2.int.go", "继续 · 行动简报") + '</button></div>';
    document.getElementById("ui").appendChild(INT);
    INT.querySelector(".x-int-veil").onclick = function () { INT.classList.remove("on"); };
    INT.querySelector("[data-int-go]").onclick = function () {
      var to = parseInt(INT.dataset.to, 10) || 0;
      INT.classList.remove("on");
      camp.current = to;
      camp.trainSel = false;
      saveCamp();
      openBriefing(to);
    };
    ARCH = el("div", "x-archive");
    ARCH.innerHTML = '<div class="x-arc-veil"></div><div class="x-arc-panel"><div class="m-k">' + campT("ui2.arc.kicker", "几猫 · 剧情档案") +
      '</div><h2>B4-0271</h2><div class="x-arc-sub">' + campT("campaign.arcSub", "一夜港区 · 六幕行动") +
      '</div><div class="x-arc-list"></div><div class="x-arc-end"></div><div class="x-arc-actions"><button class="btn" data-ar-back>' +
      campT("ui2.arc.back", "返回") + '</button></div></div>';
    document.getElementById("ui").appendChild(ARCH);
    ARCH.querySelector(".x-arc-veil").onclick = function () { ARCH.classList.remove("on"); };
    ARCH.querySelector("[data-ar-back]").onclick = function () { ARCH.classList.remove("on"); };
  }

  function openInterlude(from, to) {
    var a = MISSIONS[from], b = MISSIONS[to];
    if (!INT || !a || !b) return;
    INT.dataset.to = to;
    INT.querySelector("[data-int-k]").textContent = b.chapter || campT("ui2.int.next", "下一行动");
    INT.querySelector("[data-int-h]").textContent = b.name;
    INT.querySelector("[data-int-sub]").textContent = b.locTitle || b.sub;
    INT.querySelector("[data-int-lines]").innerHTML = (a.interlude || []).map(function (x) { return "<p>" + x + "</p>"; }).join("");
    INT.classList.add("on");
  }

  function openArchive() {
    if (!ARCH) return;
    var rows = MISSIONS.map(function (m, i) {
      var best = camp.best[m.id];
      var ch = challengeDone(m.id);
      var lock = i >= camp.unlocked;
      var st = lock
        ? campT("ui2.arc.locked", "未解锁")
        : best
          ? (best.rating || campT("ui2.arc.done", "已完成")) + " · " + campT("ui2.camp.challenge", "挑战 {n}/3", { n: ch })
          : campT("ui2.arc.unfinished", "尚未完成");
      return '<div class="x-arc-row' + (lock ? " lock" : "") + '"><b>' +
        campT("ui2.arc.row", "行动 {code} · {name}", { code: m.code, name: m.name }) +
        '</b><span>' + (m.chapter || "") + '</span><em>' + st + '</em></div>';
    }).join("");
    ARCH.querySelector(".x-arc-list").innerHTML = rows;
    var end = camp.ending
      ? '<div class="x-arc-final">' +
        campT("ui2.arc.sealed", "档案已封存 · {kind}", { kind: camp.ending === "open" ? campT("ui2.arc.kind.open", "公开") : campT("ui2.arc.kind.silent", "沉默") }) +
        '<br>' + endingText(camp.ending) + '</div>'
      : "";
    ARCH.querySelector(".x-arc-end").innerHTML = end;
    ARCH.classList.add("on");
  }

  function launchMission(idx) {
    if (idx < 0 || idx >= MISSIONS.length || idx >= camp.unlocked) return;
    camp.trainSel = false;
    S.checkpoint = null;
    camp.checkpoint = null;
    if (typeof bossRef !== "undefined") bossRef = null;
    clearCampaignComplete();
    var rel = document.querySelector(".h-relays");
    if (rel) rel.style.display = "";
    applyMission(idx);
    S.runHeadshots = 0;
    saveCamp();
    closeMissionScreen();
    try { G.input.exitLock && G.input.exitLock(); } catch (e) {}
    G.game.start({ skipIntro: false });
    try {
      G.input.requestLock && G.input.requestLock();
    } catch (e) {}
  }

  var BRIEF = null;
  var INT = null;
  var ARCH = null;

  function closeBriefing() {
    if (BRIEF) BRIEF.classList.remove("on");
  }

  function openBriefing(idx) {
    var m = MISSIONS[idx];
    if (!m || !BRIEF) { launchMission(idx); return; }
    camp.briefIdx = idx;
    var q = function (s) { return BRIEF.querySelector(s); };
    q(".x-br-k").textContent = (m.chapter || campT("campaign.op", "行动")) + " · " +
      campT("ui2.brief.opCode", "行动 {code}", { code: m.code }) + " · " + m.name;
    q(".x-br-h").textContent = m.name;
    q(".x-br-sub").textContent = m.sub;
    q(".x-br-threats").textContent = m.threats || campT("campaign.brief.threatsUnknown", "未知");
    q(".x-br-rec").textContent = m.recommend || campT("campaign.brief.recommendFree", "自由配装");
    q(".x-br-diff").textContent = campT("ui2.settings.diff." + access.difficulty,
      (DIFFICULTY[access.difficulty] || DIFFICULTY.normal).label);
    var best = camp.best && camp.best[m.id];
    q(".x-br-best").textContent = best
      ? campT("ui2.camp.best", "最佳 {time} · {rating}", {
        time: Math.floor(best.time / 60) + ":" + String(Math.floor(best.time % 60)).padStart(2, "0"),
        rating: best.rating || ""
      })
      : campT("ui2.camp.unfinished", "尚未完成");
    var ul = q(".x-br-list");
    ul.innerHTML = (m.brief || []).map(function (x) { return "<li>" + x + "</li>"; }).join("");
    var done = camp.challenges[m.id] || {};
    q(".x-br-chal").innerHTML = challengeDefs(m).map(function (c) {
      return '<li class="' + (done[c.key] ? "ok" : "") + '">' + (done[c.key] ? "✓ " : "○ ") + c.label + "</li>";
    }).join("");
    BRIEF.classList.add("on");
  }

  function buildBriefingUI() {
    var overlay = el("div", "x-brief");
    overlay.innerHTML =
      '<div class="x-br-veil"></div>' +
      '<div class="x-br-panel">' +
        '<div class="m-k x-br-k"></div>' +
        '<h2 class="x-br-h"></h2>' +
        '<div class="x-br-sub"></div>' +
        '<div class="x-br-meta">' +
          '<div><span>' + campT("ui2.brief.section.threats", "威胁") + '</span><b class="x-br-threats"></b></div>' +
          '<div><span>' + campT("ui2.brief.section.recommend", "建议装备") + '</span><b class="x-br-rec"></b></div>' +
          '<div><span>' + campT("ui2.brief.section.difficulty", "难度") + '</span><b class="x-br-diff"></b></div>' +
          '<div><span>' + campT("ui2.brief.section.record", "记录") + '</span><b class="x-br-best"></b></div>' +
        '</div>' +
        '<ul class="x-br-list"></ul>' +
        '<div class="x-br-chal-wrap"><b>' + campT("ui2.brief.challenge", "挑战") + '</b><ul class="x-br-chal"></ul></div>' +
        '<div class="x-br-actions">' +
          '<button class="btn primary" data-x="brief-go">' + campT("ui2.brief.go", "出击") + '</button>' +
          '<button class="btn" data-x="brief-arm">' + campT("ui2.brief.armory", "武器改装") + '</button>' +
          '<button class="btn" data-x="brief-back">' + campT("ui2.brief.back", "返回") + '</button>' +
        '</div>' +
      '</div>';
    document.getElementById("ui").appendChild(overlay);
    BRIEF = overlay;
    overlay.querySelector(".x-br-veil").addEventListener("click", closeBriefing);
    overlay.querySelector('[data-x="brief-back"]').addEventListener("click", closeBriefing);
    overlay.querySelector('[data-x="brief-arm"]').addEventListener("click", function () { openArmory(); });
    overlay.querySelector('[data-x="brief-go"]').addEventListener("click", function () {
      var idx = camp.briefIdx;
      closeBriefing();
      closeMissionScreen();
      launchMission(idx);
    });
    addEventListener("keydown", function (e) {
      if (e.code === "Escape" && BRIEF && BRIEF.classList.contains("on")) {
        e.preventDefault();
        e.stopPropagation();
        closeBriefing();
      }
    }, true);
  }

  function buildCampaignUI() {
    var overlay = el("div", "x-camp");
    overlay.innerHTML =
      '<div class="x-camp-veil"></div>' +
      '<div class="x-camp-panel">' +
        '<div class="m-k">' + campT("ui2.camp.kicker", "几猫突击小队 · 行动档案") + '</div>' +
        '<h2 class="x-camp-h">' + campT("ui2.camp.title", "选择行动") + '</h2>' +
        '<div class="x-camp-sub">' + campT("campaign.campSub", "同一港区，三种时段与目标编成。完成行动可解锁下一阶段。") + '</div>' +
        '<div class="x-camp-list"></div>' +
        '<div class="x-camp-actions">' +
          '<button class="btn primary" data-x="go">' + campT("ui2.camp.go", "出动") + '</button>' +
          '<button class="btn" data-x="close">' + campT("ui2.menu.back", "返回") + '</button>' +
          '<button class="btn" data-x="arm">' + campT("ui2.brief.armory", "武器改装") + '</button>' +
        '</div>' +
        '<div class="x-camp-note">' + campT("ui2.camp.note", "进度自动保存 · 评级与用时记录在本地") + '</div>' +
      '</div>';
    document.getElementById("ui").appendChild(overlay);
    CAMP = overlay;
    overlay.querySelector('[data-x="close"]').addEventListener("click", closeMissionScreen);
    overlay.querySelector('[data-x="arm"]').addEventListener("click", function () { openArmory(); });
    overlay.querySelector(".x-camp-veil").addEventListener("click", closeMissionScreen);
    overlay.querySelector('[data-x="go"]').addEventListener("click", function () {
      if (camp.trainSel) launchTraining();
      else openBriefing(camp.current);
    });
    overlay.querySelector(".x-camp-list").addEventListener("click", function (e) {
      var card = e.target.closest(".x-mcard");
      if (!card || card.classList.contains("locked")) return;
      if (card.dataset.train) {
        camp.trainSel = true;
        renderMissionCards();
        return;
      }
      camp.trainSel = false;
      camp.current = parseInt(card.dataset.idx, 10) || 0;
      renderMissionCards();
    });
    document.addEventListener("keydown", function (e) {
      if (CAMP && CAMP.classList.contains("on") && e.code === "Escape") {
        e.preventDefault(); e.stopPropagation(); closeMissionScreen();
      }
    }, true);
  }

  function openMissionScreen() { if (CAMP) { renderMissionCards(); CAMP.classList.add("on"); } }
  function closeMissionScreen() {
    if (CAMP) CAMP.classList.remove("on");
    if (typeof closeBriefing === "function") closeBriefing();
  }

  function ratingOf(id) {
    var b = camp.best[id];
    if (!b) return "";
    var t = "—";
    if (b.time != null) t = Math.floor(b.time / 60) + ":" + String(Math.floor(b.time % 60)).padStart(2, "0");
    return campT("ui2.camp.best", "最佳 {time} · {rating}", { time: t, rating: b.rating || "—" });
  }

  function renderMissionCards() {
    if (!CAMP) return;
    var list = CAMP.querySelector(".x-camp-list");
    var html = "";
    for (var i = 0; i < MISSIONS.length; i++) {
      var m = MISSIONS[i], locked = i >= camp.unlocked;
      html += '<button class="x-mcard' + (i === camp.current && !camp.trainSel ? " sel" : "") + (locked ? " locked" : "") + '" data-idx="' + i + '">' +
        (locked ? '<span class="lock">' + campT("ui2.camp.locked", "未解锁") + '</span>' : "") +
        '<span class="code">' + (m.chapter || campT("campaign.op", "行动")) + ' · ' + m.code + '</span>' +
        '<h3>' + m.name + '</h3><div class="sub">' + m.sub + '</div>' +
        '<p>' + m.desc + '</p>' +
        (locked ? "" : '<div class="x-mchal">' + campT("ui2.camp.challenge", "挑战 {n}/3", { n: challengeDone(m.id) }) + '</div>') +
        '<div class="meta">' + (locked ? campT("ui2.camp.lockHint", "完成上一行动后解锁") : ratingOf(m.id) || campT("ui2.camp.unfinished", "尚未完成")) + '</div></button>';
    }
    html += '<button class="x-mcard x-train-card' + (camp.trainSel ? " sel" : "") + '" data-train="1">' +
      '<span class="code">' + campT("ui2.camp.trainingCard", "训练 {code}", { code: TRAINING.code }) + '</span>' +
      "<h3>" + TRAINING.name + "</h3><div class=\"sub\">" + TRAINING.sub + "</div>" +
      "<p>" + TRAINING.desc + "</p>" +
      '<div class="meta">' + (camp.best && camp.best.train
        ? campT("ui2.camp.trainingBest", "最佳 {score} 分", { score: camp.best.train.score })
        : campT("ui2.camp.trainingMeta", "无限弹药 · 随时进入")) + "</div></button>";
    list.innerHTML = html;
    list.classList.toggle("x-eight", MISSIONS.length >= 8);
    var go = CAMP && CAMP.querySelector('.x-camp-actions [data-x="go"]');
    if (go) go.textContent = campT("ui2.camp.goNamed", "出动 · {name}", {
      name: camp.trainSel ? campT("ui2.camp.training", "训练场") : MISSIONS[camp.current].name
    });
  }

  function returnToTitle() {
    try { G.input.exitLock && G.input.exitLock(); } catch (e) {}
    closeBriefing();
    closeMissionScreen();
    try { if (typeof closeArmory === "function") closeArmory(); } catch (e) {}
    S.checkpoint = null;
    S.runHeadshots = 0;
    try { G.game.menus.show("none"); } catch (e) {}
    G.game.state = "title";
    try { G.game.menus.show("title"); } catch (e) {}
    try { G.hud.show(false); } catch (e) {}
    try { G.input.setGameplay && G.input.setGameplay(false); } catch (e) {}
    G.player.enabled = false;
    try { G.render.post.fade = 1; } catch (e) {}
    try { G.events.emit("game:state", { state: "title", prev: "paused" }); } catch (e) {}
  }

  function addMenuEntry() {
    var acts = document.querySelector(".m-title .m-actions");
    if (acts && !acts.querySelector('[data-x="campaign"]')) {
      var b = el("button", "btn", campT("campaign.brief.title", "行动简报"));
      b.setAttribute("data-x", "campaign");
      b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); openMissionScreen(); });
      acts.insertBefore(b, acts.children[1] || null);
    }
    var pacts = document.querySelector('.m-screen[data-s="paused"] .m-actions');
    if (pacts && !pacts.querySelector('[data-x="campaign"]')) {
      var p = el("button", "btn", campT("campaign.brief.title", "行动简报"));
      p.setAttribute("data-x", "campaign");
      p.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); openMissionScreen(); });
      pacts.insertBefore(p, pacts.lastElementChild);
    }
    if (pacts && !pacts.querySelector('[data-x="to-title"]')) {
      var back = el("button", "btn", campT("ui2.menu.title", "返回标题"));
      back.setAttribute("data-x", "to-title");
      back.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); returnToTitle(); });
      pacts.appendChild(back);
    }
  }

  function addNextMissionButton() {
    var actions = document.querySelector('.m-debrief .m-actions');
    if (!actions) return;
    var old = actions.querySelector(".x-next");
    if (old) old.remove();
    var next = camp.current + 1;
    if (next >= MISSIONS.length || next >= camp.unlocked) return;
    var redeploy = actions.querySelector('[data-act="redeploy"]');
    if (redeploy) { redeploy.classList.remove("primary"); }
    var b = el("button", "btn primary x-next",
      campT("ui2.menu.next", "下一行动 · {name}", { name: MISSIONS[next].name }));
    b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); openInterlude(camp.current, next); });
    actions.insertBefore(b, actions.firstChild);
  }

  function onMissionComplete() {
    var m = MISSIONS[camp.current];
    if (!m) return;
    var ratingEl = document.querySelector('[data-f="rating"]');
    var accEl = document.querySelector('[data-f="acc"]');
    var kills = (G.combat && G.combat.stats && G.combat.stats.kills) || 0;
    var time = (G.game && G.game.run && G.game.run.time) || 0;
    var prev = camp.best[m.id];
    if (!prev || time < prev.time) {
      camp.best[m.id] = { time: time, kills: kills, rating: ratingEl ? ratingEl.textContent : "", acc: accEl ? accEl.textContent : "" };
    }
    if (m.challenges) {
      var res = challengeCheck({ time: time, headshots: S.runHeadshots || 0, retries: (G.game.run && G.game.run.retries) || 0 });
      var prev = camp.challenges[m.id] || {};
      var merged = { time: !!(prev.time || res.time), head: !!(prev.head || res.head), clean: !!(prev.clean || res.clean) };
      var newly = [];
      ["time", "head", "clean"].forEach(function (k) { if (res[k] && !prev[k]) newly.push(k); });
      camp.challenges[m.id] = merged;
      renderChallengeNote(newly, merged);
      if (typeof updateAccessButtons === "function") updateAccessButtons();
    }
    if (camp.unlocked < camp.current + 2) camp.unlocked = Math.min(MISSIONS.length, camp.current + 2);
    saveCamp();
    addNextMissionButton();
    addCampaignComplete();
  }

  function clearCampaignComplete() {
    var note = document.querySelector(".x-final");
    if (note && note.parentNode) note.parentNode.removeChild(note);
    var back = document.querySelector(".x-final-back");
    if (back && back.parentNode) back.parentNode.removeChild(back);
    var ch = document.querySelector(".x-end-choice");
    if (ch && ch.parentNode) ch.parentNode.removeChild(ch);
    var en = document.querySelector(".x-ending");
    if (en && en.parentNode) en.parentNode.removeChild(en);
  }

  function addCampaignComplete() {
    if (camp.current !== MISSIONS.length - 1) return;
    var panel = document.querySelector(".m-debrief");
    var actions = panel && panel.querySelector(".m-actions");
    if (!panel || !actions || panel.querySelector(".x-final")) return;
    var redeploy2 = actions.querySelector('[data-act="redeploy"]');
    if (redeploy2) { redeploy2.classList.remove("primary"); }
    var isFinal = camp.current === MISSIONS.length - 1 || MISSIONS[MISSIONS.length - 1].id === "m6";
    if (isFinal && camp.ending) {
      showEnding(camp.ending, panel, actions, false);
      return;
    }
    var note = document.createElement("p");
    note.className = "x-final";
    note.textContent = isFinal
      ? campT("ui2.final.last", "全部 {n} 个行动完成 · 最后的决定", { n: MISSIONS.length })
      : campT("ui2.final.all", "全部 {n} 个行动完成 · 港区行动结束", { n: MISSIONS.length });
    panel.insertBefore(note, actions);
    if (isFinal) {
      var choice = document.createElement("div");
      choice.className = "x-end-choice";
      choice.innerHTML = '<button class="btn primary" data-end="silent">' + campT("ui2.end.choice.silent", "沉船 · 沉默") +
        '</button><button class="btn" data-end="open">' + campT("ui2.end.choice.open", "带核心回港 · 公开") + '</button>';
      panel.insertBefore(choice, actions);
      choice.querySelector('[data-end="silent"]').onclick = function () { showEnding("silent", panel, actions, true); };
      choice.querySelector('[data-end="open"]').onclick = function () { showEnding("open", panel, actions, true); };
    }
    var back = document.createElement("button");
    back.className = "btn x-final-back";
    back.textContent = campT("ui2.menu.title", "返回标题");
    back.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      G.game.menus.show("none");
      applyMission(0);
      camp.current = 0;
      camp.trainSel = false;
      G.game.state = "title";
      G.game.menus.show("title");
      G.hud.show(false);
      G.input.setGameplay && G.input.setGameplay(false);
      G.player.enabled = false;
      G.render.post.fade = 1;
      G.events.emit("game:state", { state: "title", prev: "complete" });
    });
    actions.appendChild(back);
  }

  function endingText(kind) {
    if (kind === "open") {
      return [
        campT("ui2.end.open.1", "你把核心搬上接驳艇。全港广播被劫持，一个不属于任何人的声音开始念名单。"),
        campT("ui2.end.open.2", "岸台没有回答。她的频道在 05:43 之后一直是空的。"),
        "<b>" + campT("ui2.end.open.3", "蜃：第 4 次。") + "</b>"
      ].join("<br>");
    }
    return [
      campT("ui2.end.silent.1", "接驳艇撤到安全距离。港区主控在日出前下线。"),
      campT("ui2.end.silent.2", "四号泊位在 06:20 恢复作业，调度表上多了三个名字，又很快被划掉。"),
      "<b>" + campT("ui2.end.silent.3", "蜃：第 4 次。") + "</b>"
    ].join("<br>");
  }

  function showEnding(kind, panel, actions, save) {
    camp.ending = kind;
    if (save) saveCamp();
    var choice = panel.querySelector(".x-end-choice");
    if (choice) choice.remove();
    var note = panel.querySelector(".x-final");
    if (!note) {
      note = document.createElement("p");
      note.className = "x-final";
      panel.insertBefore(note, actions);
    }
    note.classList.add("x-ending");
    note.innerHTML = endingText(kind);
    if (!panel.querySelector(".x-final-back")) {
      var back = document.createElement("button");
      back.className = "btn x-final-back";
      back.textContent = campT("ui2.menu.title", "返回标题");
      back.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        G.game.menus.show("none");
        applyMission(0); camp.current = 0; camp.trainSel = false;
        G.game.state = "title"; G.game.menus.show("title");
        G.hud.show(false); G.input.setGameplay && G.input.setGameplay(false);
        G.player.enabled = false; G.render.post.fade = 1;
        G.events.emit("game:state", { state: "title", prev: "complete" });
      });
      actions.appendChild(back);
    }
    var dim = document.querySelector(".m-title .m-eyebrow .m-dim");
    if (dim) dim.textContent = campT("campaign.sealed", "几猫港区 · 档案 B4-0271 已封存");
  }

  /*__TRAINING__*/

  function initCampaign() {
    loadCamp();
    bindSaveSync();
    initRelayPool();
    var profile = (typeof window !== "undefined" && window.__SX_PROFILE) || "v4";
    if (profile === "v3") {
      var m3 = MISSIONS[2];
      m3.boss = false;
      m3.evac = 40;
      m3.waves = m3.waves.map(function (w) { return { gull: w.gull, hound: w.hound }; });
      m3.locSub = campT("campaign.v3.locSub", "几猫突击小队 · 撤离窗口 40 秒");
      m3.all = campT("campaign.v3.all", "四处中继全部断开！撤离窗口开始计时，守住阵地！");
      m3.intro = campT("campaign.v3.intro", "最后一班接驳即将到港。切断四处中继，然后守住撤离点。");
    }
    if (profile === "v2") {
      applyMission(0);
      return;
    }
    buildCampaignUI();
    buildBriefingUI();
    buildNarrativeUI();
    var titleEl = document.querySelector(".m-title");
    if (titleEl && !titleEl.querySelector(".m-ver")) {
      var vEl = document.createElement("div");
      vEl.className = "m-ver";
      vEl.textContent = window.__VERSION_LABEL || "V32 · 地基";
      titleEl.appendChild(vEl);
    }
    var campActs = CAMP && CAMP.querySelector(".x-camp-actions");
    if (campActs && !campActs.querySelector('[data-x="archive"]')) {
      var ab = el("button", "btn", campT("campaign.archive", "剧情档案"));
      ab.setAttribute("data-x", "archive");
      ab.onclick = function (e) { e.preventDefault(); e.stopPropagation(); openArchive(); };
      campActs.insertBefore(ab, campActs.querySelector('[data-x="close"]'));
    }
    try { if (typeof MapKit !== "undefined") MapKit.captureHarbor(); } catch (e) {}
    document.addEventListener("click", function (e) {
      var b = e.target.closest('.m-screen[data-s="dead"] [data-act="retry"]');
      if (!b || b.dataset.confirm === "1") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      b.dataset.confirm = "1";
      b.dataset.label = b.textContent;
      b.textContent = campT("campaign.confirmRetry", "确认重试？");
      (typeof UICLOCK !== "undefined" && UICLOCK ? UICLOCK : { after: function (s, f) { return setTimeout(f, s * 1000); } }).after(2.6, function () {
        if (b.isConnected) {
          b.dataset.confirm = "";
          b.textContent = b.dataset.label || campT("campaign.restart", "重新开始行动");
        }
      });
    }, true);
    addMenuEntry();
    try { initTraining(); } catch (e) { console.error("[ext] training init", e); }
    var start = 0;
    for (var i = 0; i < MISSIONS.length; i++) {
      if (!camp.best[MISSIONS[i].id]) { start = i; break; }
    }
    camp.current = Math.min(start, camp.unlocked - 1);
    applyMission(camp.current);
    try { initBoss(); } catch (e) { console.error("[ext] boss init", e); }
    G.events.on("game:state", function (e) {
      if (!e) return;
      if (e.state === "intro" || e.state === "playing") {
        var m = MISSIONS[camp.current];
        try { G.render.post.saturation = m.saturation; } catch (err) {}
        try { G.render.exposure = m.exposure; } catch (err) {}
      }
      // V53 CLI-2：complete 状态下模拟时钟冻结，结算面板的延迟更新改用 UI 实时钟，
      // 否则 onMissionComplete（最佳成绩/挑战/解锁/存档）永远不会执行。
      if (e.state === "complete") {
        if (typeof UICLOCK !== "undefined" && UICLOCK && typeof UICLOCK.after === "function") {
          UICLOCK.after(0.4, onMissionComplete);
        } else {
          setTimeout(onMissionComplete, 400);
        }
      }
      // V54：任务电台不再靠中文前缀识别。行动开始（每次行动只一次）发稳定事件，
      // ext.js 收到后把下一条引擎开场电台替换成当前任务的 intro（中英都由 getter 取词）。
      if (e.state === "intro") {
        var cm = G.game && G.game.currentMission;
        if (cm && cm.intro && missionRadioArmed !== cm.id) {
          missionRadioArmed = cm.id;
          try { G.events.emit("sx:mission-radio", { kind: "intro", id: cm.id }); } catch (err) { /* 事件失败不影响开局 */ }
        }
      }
    });
  }

  /* =====================================================================
     V34 · WP34-6 / WP34-7 对外接线
     ext_missions2（独立 IIFE，构建后加载）通过该对象读取八关数据、
     启动/恢复行动、读写统一存档里的 campaign.checkpoint。
     不改动上面六关的既有流程。
     ===================================================================== */
  try {
    window.__SX_CAMP = {
      missions: MISSIONS,
      state: function () { return camp; },
      index: function () { return camp.current; },
      save: saveCamp,
      reload: reloadCamp,
      bindSaveSync: bindSaveSync,
      launch: launchMission,
      apply: applyMission,
      challengeTotal: function () { return MISSIONS.length * 3; },
      checkpoint: function () { return camp.checkpoint || null; },
      setCheckpoint: function (cp) { camp.checkpoint = cp || null; saveCamp(); return camp.checkpoint; },
      clearCheckpoint: function () { camp.checkpoint = null; saveCamp(); },
      bossStart: function () { try { startBossEncounter(); } catch (e) {} },
      bossAlive: function () { return !!bossRef; }
    };
  } catch (e) { console.error("[ext] camp api", e); }

  /* =====================================================================
     V37 · 版本复现：按 profile 裁剪行动档案
     v32 / v33 只保留前 6 关，v34+ 保留全部 8 关。
     在 ext 初始化前执行；__SX_CAMP.missions 同步替换，避免 ext_missions2
     在 v33 构建里读到 8 关而渲染出第 7/8 张行动卡。
     ===================================================================== */
  (function sxTrimMissions() {
    var prof = (typeof window !== "undefined" && window.__SX_PROFILE) || "";
    if (prof !== "v32" && prof !== "v33") return;
    if (MISSIONS.length <= 6) return;
    MISSIONS = MISSIONS.slice(0, 6);
    try { if (window.__SX_CAMP) window.__SX_CAMP.missions = MISSIONS; } catch (e) {}
    if (camp.current > MISSIONS.length - 1) camp.current = MISSIONS.length - 1;
    if (camp.unlocked > MISSIONS.length) camp.unlocked = MISSIONS.length;
  })();
