
import io
p='src/campaign.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

# --- mission data: M1 evac + briefing ---
rep('''      rain: 0.6, exposure: 1, saturation: 1,
      intro: "几猫队员，这里是行动指挥。按顺序切断三处中继，撤离艇在南端舷梯等你。",
      all: "三处中继全部断开！撤离艇已靠泊，快撤！",
      done: "四号泊位已解除封锁"''','''      rain: 0.6, exposure: 1, saturation: 1, evac: 45,
      speaker: "指挥中心",
      threats: "机械飞鸥 · 机械猎犬 · 固定炮台",
      recommend: "精确射手 / 突击步枪",
      brief: ["切断堆场、仓库、码头的三处中继", "在撤离点坚守 45 秒，等待接驳", "登船撤离"],
      intro: "几猫队员，这里是行动指挥。按顺序切断三处中继；接驳需要 45 秒，务必守住撤离点。",
      all: "三处中继全部断开！接驳艇正在靠泊，坚守 45 秒！",
      done: "四号泊位已解除封锁"''')

# --- M2 ---
rep('''      rain: 1, exposure: 0.92, saturation: 0.86,
      intro: "指挥部通报：暴雨封港，仓库内有三个上行中继。猎犬已经进场，注意近距离交火。",
      all: "仓库中继全部离线！东门集结点已标定，动作快！",
      done: "仓库区已恢复控制"''','''      rain: 1, exposure: 0.92, saturation: 0.86, evac: 45,
      speaker: "小队频道",
      threats: "机械猎犬 · 自爆无人机 · 狙击猎犬 · 重装盾卫",
      recommend: "霰弹枪 / 突击步枪",
      brief: ["切断仓库内三处中继", "在东门集结点坚守 45 秒", "从集结点撤离"],
      intro: "指挥部通报：暴雨封港，仓库内有三个上行中继。猎犬已经进场；接驳需要 45 秒。",
      all: "仓库中继全部离线！东门集结点被封锁，坚守 45 秒！",
      done: "仓库区已恢复控制"''')

# --- M3 ---
rep('''      rain: 0.35, exposure: 1.08, saturation: 1.04, evac: 0, boss: true,
      intro: "最后一班接驳即将到港。切断四处中继——注意，港区主控还在码头上。",
      all: "四处中继全部断开！港区主控已启动，摧毁它的核心！",
      done: "码头封锁已解除"''','''      rain: 0.35, exposure: 1.08, saturation: 1.04, evac: 0, boss: true,
      speaker: "指挥中心",
      threats: "全兵种 · 港区主控",
      recommend: "精确射手 + 破门锤",
      brief: ["切断码头四处中继", "摧毁港区主控核心", "在登船窗口内撤离"],
      intro: "最后一班接驳即将到港。切断四处中继——注意，港区主控还在码头上。",
      all: "四处中继全部断开！港区主控已启动，摧毁它的核心！",
      done: "码头封锁已解除"''')

# --- briefing state & UI ---
rep('''  var trainUI = null;''','''  var trainUI = null;''') if False else None
rep('''  function buildCampaignUI() {''','''  var BRIEF = null;

  function closeBriefing() {
    if (BRIEF) BRIEF.classList.remove("on");
  }

  function openBriefing(idx) {
    var m = MISSIONS[idx];
    if (!m || !BRIEF) { launchMission(idx); return; }
    camp.briefIdx = idx;
    var q = function (s) { return BRIEF.querySelector(s); };
    q(".x-br-k").textContent = "行动 " + m.code + " · " + m.name + " · 行动简报";
    q(".x-br-h").textContent = m.name;
    q(".x-br-sub").textContent = m.sub;
    q(".x-br-threats").textContent = m.threats || "未知";
    q(".x-br-rec").textContent = m.recommend || "自由配装";
    q(".x-br-diff").textContent = "难度 · " + ((DIFFICULTY[access.difficulty] || DIFFICULTY.normal).label);
    var best = camp.best && camp.best[m.id];
    q(".x-br-best").textContent = best
      ? "最佳 " + Math.floor(best.time / 60) + ":" + String(Math.floor(best.time % 60)).padStart(2, "0") + " · " + (best.rating || "")
      : "尚未完成";
    var ul = q(".x-br-list");
    ul.innerHTML = (m.brief || []).map(function (x) { return "<li>" + x + "</li>"; }).join("");
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
          '<div><span>威胁</span><b class="x-br-threats"></b></div>' +
          '<div><span>建议装备</span><b class="x-br-rec"></b></div>' +
          '<div><span>难度</span><b class="x-br-diff"></b></div>' +
          '<div><span>记录</span><b class="x-br-best"></b></div>' +
        '</div>' +
        '<ul class="x-br-list"></ul>' +
        '<div class="x-br-actions">' +
          '<button class="btn primary" data-x="brief-go">出击</button>' +
          '<button class="btn" data-x="brief-arm">武器改装</button>' +
          '<button class="btn" data-x="brief-back">返回</button>' +
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

  function buildCampaignUI() {''')

# go button opens briefing
rep('''    overlay.querySelector('[data-x="go"]').addEventListener("click", function () {
      camp.trainSel ? launchTraining() : launchMission(camp.current);
    });''','''    overlay.querySelector('[data-x="go"]').addEventListener("click", function () {
      if (camp.trainSel) launchTraining();
      else openBriefing(camp.current);
    });''')

# close briefing with mission screen close
rep('''  function closeMissionScreen() { if (CAMP) CAMP.classList.remove("on"); }''','''  function closeMissionScreen() {
    if (CAMP) CAMP.classList.remove("on");
    if (typeof closeBriefing === "function") closeBriefing();
  }''')

# init briefing + speaker
rep('''    buildCampaignUI();
    addMenuEntry();''','''    buildCampaignUI();
    buildBriefingUI();
    addMenuEntry();''')
rep('''    var lc = document.querySelector(".loc-card b");''','''    var spk = document.querySelector(".comms-who");
    if (spk) spk.textContent = m.speaker || "指挥中心";
    var lc = document.querySelector(".loc-card b");''')
io.open(p,'w',encoding='utf-8').write(s)
print('V11 briefing + evac data patched')
