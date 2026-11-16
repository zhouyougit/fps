
import io
p='src/campaign.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

# camp field + load/save
rep('''  var camp = { unlocked: 1, best: {}, current: 0, trainSel: false };''','''  var camp = { unlocked: 1, best: {}, current: 0, trainSel: false, challenges: {} };''')
rep('''        camp.current = Math.min(MISSIONS.length - 1, Math.max(0, raw.current | 0));''','''        camp.current = Math.min(MISSIONS.length - 1, Math.max(0, raw.current | 0));
        camp.challenges = raw.challenges && typeof raw.challenges === "object" ? raw.challenges : {};''')

# challenge configs
rep('''      env: { sun: [0.92, 0.23, 0.33], zen: [0.055, 0.085, 0.13], hor: [0.95, 0.55, 0.28], away: [0.16, 0.22, 0.3], col: [1, 0.72, 0.42], light: 0xffddad, intensity: 9, exposure: 1, envIntensity: 2, rain: 0.6 },''','''      env: { sun: [0.92, 0.23, 0.33], zen: [0.055, 0.085, 0.13], hor: [0.95, 0.55, 0.28], away: [0.16, 0.22, 0.3], col: [1, 0.72, 0.42], light: 0xffddad, intensity: 9, exposure: 1, envIntensity: 2, rain: 0.6 },
      challenges: { time: 300, head: 6 },''')
rep('''      env: { sun: [0.4, 0.12, 0.9], zen: [0.02, 0.03, 0.045], hor: [0.16, 0.2, 0.26], away: [0.06, 0.075, 0.1], col: [0.35, 0.42, 0.55], light: 0xaab7c9, intensity: 3.2, exposure: 0.82, envIntensity: 1.2, rain: 1, saturation: 0.82 },''','''      env: { sun: [0.4, 0.12, 0.9], zen: [0.02, 0.03, 0.045], hor: [0.16, 0.2, 0.26], away: [0.06, 0.075, 0.1], col: [0.35, 0.42, 0.55], light: 0xaab7c9, intensity: 3.2, exposure: 0.82, envIntensity: 1.2, rain: 1, saturation: 0.82 },
      challenges: { time: 360, head: 8 },''')
rep('''      env: { sun: [0.75, 0.1, -0.65], zen: [0.05, 0.07, 0.15], hor: [1.0, 0.5, 0.36], away: [0.13, 0.15, 0.24], col: [1, 0.55, 0.36], light: 0xffc9a8, intensity: 6.5, exposure: 1.06, envIntensity: 2.1, rain: 0.2 },''','''      env: { sun: [0.75, 0.1, -0.65], zen: [0.05, 0.07, 0.15], hor: [1.0, 0.5, 0.36], away: [0.13, 0.15, 0.24], col: [1, 0.55, 0.36], light: 0xffc9a8, intensity: 6.5, exposure: 1.06, envIntensity: 2.1, rain: 0.2 },
      challenges: { time: 480, head: 10 },''')

# challenge helpers before launchMission
rep('''  function launchMission(idx) {''','''  function fmtClock(sec) {
    var m = Math.floor(sec / 60), r = Math.floor(sec % 60);
    return m + ":" + String(r).padStart(2, "0");
  }
  function challengeDefs(m) {
    var c = m.challenges || { time: 999, head: 999 };
    return [
      { key: "time", label: "限时 ≤ " + fmtClock(c.time) },
      { key: "head", label: "爆头击杀 ≥ " + c.head },
      { key: "clean", label: "无死亡通关" }
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
    var names = { time: "限时", head: "爆头", clean: "无死亡" };
    var note = document.createElement("div");
    note.className = "x-chal";
    var unlock = "";
    var total = challengeCount();
    if (total >= 9) unlock = "解锁：金色准星";
    else if (total >= 6) unlock = "解锁：红色准星";
    else if (total >= 3) unlock = "解锁：绿色准星";
    note.innerHTML = "<b>挑战 " + count + "/3</b><span>" +
      defs.map(function (d) {
        return '<i class="' + (done[d.key] ? "ok" : "") + '">' + (done[d.key] ? "✓ " : "○ ") + d.label + "</i>";
      }).join("") +
      (newly.length ? "<em>新完成：" + newly.map(function (k) { return names[k]; }).join(" / ") + "</em>" : "") +
      (unlock ? "<em class='unlock'>" + unlock + "</em>" : "") +
      "</span>";
    var actions = panel.querySelector(".m-actions");
    panel.insertBefore(note, actions || null);
  }

  function launchMission(idx) {''')

# reset headshots on launch
rep('''    applyMission(idx);
    saveCamp();''','''    applyMission(idx);
    S.runHeadshots = 0;
    saveCamp();''')

# card badge
rep('''        '<p>' + m.desc + '</p>' +
        '<div class="meta">' + (locked ? "完成上一行动后解锁" : ratingOf(m.id) || "尚未完成") + '</div></button>';''','''        '<p>' + m.desc + '</p>' +
        (locked ? "" : '<div class="x-mchal">挑战 ' + challengeDone(m.id) + '/3</div>') +
        '<div class="meta">' + (locked ? "完成上一行动后解锁" : ratingOf(m.id) || "尚未完成") + '</div></button>';''')

# briefing challenge list
rep('''        '<ul class="x-br-list"></ul>' +''','''        '<ul class="x-br-list"></ul>' +
        '<div class="x-br-chal-wrap"><b>挑战</b><ul class="x-br-chal"></ul></div>' +''')
rep('''    var ul = q(".x-br-list");
    ul.innerHTML = (m.brief || []).map(function (x) { return "<li>" + x + "</li>"; }).join("");
    BRIEF.classList.add("on");''','''    var ul = q(".x-br-list");
    ul.innerHTML = (m.brief || []).map(function (x) { return "<li>" + x + "</li>"; }).join("");
    var done = camp.challenges[m.id] || {};
    q(".x-br-chal").innerHTML = challengeDefs(m).map(function (c) {
      return '<li class="' + (done[c.key] ? "ok" : "") + '">' + (done[c.key] ? "✓ " : "○ ") + c.label + "</li>";
    }).join("");
    BRIEF.classList.add("on");''')

# evaluate on complete
rep('''    if (camp.unlocked < camp.current + 2) camp.unlocked = Math.min(MISSIONS.length, camp.current + 2);
    saveCamp();
    addNextMissionButton();
    addCampaignComplete();''','''    if (m.challenges) {
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
    addCampaignComplete();''')
io.open(p,'w',encoding='utf-8').write(s)
print('challenges core patched')
