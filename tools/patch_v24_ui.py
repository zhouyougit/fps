
import io
p='src/campaign.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

# narrative globals
rep('''  var BRIEF = null;''','''  var BRIEF = null;
  var INT = null;
  var ARCH = null;''')

# build narrative UI before launchMission
rep('''  function launchMission(idx) {''','''  function buildNarrativeUI() {
    INT = el("div", "x-interlude");
    INT.innerHTML = '<div class="x-int-veil"></div><div class="x-int-card"><div class="m-k" data-int-k></div><h2 data-int-h></h2><div class="sub" data-int-sub></div><div class="x-int-lines" data-int-lines></div><button class="btn primary" data-int-go>继续 · 行动简报</button></div>';
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
    ARCH.innerHTML = '<div class="x-ar-veil"></div><div class="x-ar-panel"><div class="m-k">几猫 · 剧情档案</div><h2>B4-0271</h2><div class="x-ar-sub">一夜港区 · 六幕行动</div><div class="x-ar-list"></div><div class="x-ar-end"></div><div class="x-ar-actions"><button class="btn" data-ar-back>返回</button></div></div>';
    document.getElementById("ui").appendChild(ARCH);
    ARCH.querySelector(".x-ar-veil").onclick = function () { ARCH.classList.remove("on"); };
    ARCH.querySelector("[data-ar-back]").onclick = function () { ARCH.classList.remove("on"); };
  }

  function openInterlude(from, to) {
    var a = MISSIONS[from], b = MISSIONS[to];
    if (!INT || !a || !b) return;
    INT.dataset.to = to;
    INT.querySelector("[data-int-k]").textContent = b.chapter || "下一行动";
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
      var st = lock ? "未解锁" : best ? (best.rating || "已完成") + " · 挑战 " + ch + "/3" : "尚未完成";
      return '<div class="x-ar-row' + (lock ? " lock" : "") + '"><b>行动 ' + m.code + ' · ' + m.name + '</b><span>' + (m.chapter || "") + '</span><em>' + st + '</em></div>';
    }).join("");
    ARCH.querySelector(".x-ar-list").innerHTML = rows;
    var end = camp.ending ? '<div class="x-ar-final">档案已封存 · ' + (camp.ending === "open" ? "公开" : "沉默") + '<br>' + endingText(camp.ending) + '</div>' : "";
    ARCH.querySelector(".x-ar-end").innerHTML = end;
    ARCH.classList.add("on");
  }

  function launchMission(idx) {''')

# build narrative UI + archive button in campaign actions
rep('''    buildCampaignUI();
    buildBriefingUI();''','''    buildCampaignUI();
    buildBriefingUI();
    buildNarrativeUI();
    var campActs = CAMP && CAMP.querySelector(".x-camp-actions");
    if (campActs && !campActs.querySelector('[data-x="archive"]')) {
      var ab = el("button", "btn", "剧情档案");
      ab.setAttribute("data-x", "archive");
      ab.onclick = function (e) { e.preventDefault(); e.stopPropagation(); openArchive(); };
      campActs.insertBefore(ab, campActs.querySelector('[data-x="close"]'));
    }''')
io.open(p,'w',encoding='utf-8').write(s)
print('narrative UI patched')
