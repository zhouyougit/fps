
import io
p='src/campaign.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:60])
    s=s.replace(old,new,1)

# trainSel default
rep('  var camp = { unlocked: 1, best: {}, current: 0 };','  var camp = { unlocked: 1, best: {}, current: 0, trainSel: false };')

# launch campaign resets train selection
rep('''  function launchMission(idx) {
    if (idx < 0 || idx >= MISSIONS.length || idx >= camp.unlocked) return;
    S.checkpoint = null;''','''  function launchMission(idx) {
    if (idx < 0 || idx >= MISSIONS.length || idx >= camp.unlocked) return;
    camp.trainSel = false;
    S.checkpoint = null;''')

# go button
rep('''    overlay.querySelector('[data-x="go"]').addEventListener("click", function () { launchMission(camp.current); });''','''    overlay.querySelector('[data-x="go"]').addEventListener("click", function () {
      camp.trainSel ? launchTraining() : launchMission(camp.current);
    });''')

# card click
rep('''    overlay.querySelector(".x-camp-list").addEventListener("click", function (e) {
      var card = e.target.closest(".x-mcard");
      if (!card || card.classList.contains("locked")) return;
      camp.current = parseInt(card.dataset.idx, 10) || 0;
      renderMissionCards();
    });''','''    overlay.querySelector(".x-camp-list").addEventListener("click", function (e) {
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
    });''')

# render training card
rep('''    list.innerHTML = html;
  }''','''    html += '<button class="x-mcard x-train-card' + (camp.trainSel ? " sel" : "") + '" data-train="1">' +
      '<span class="code">训练 ' + TRAINING.code + '</span>' +
      "<h3>" + TRAINING.name + "</h3><div class=\\"sub\\">" + TRAINING.sub + "</div>" +
      "<p>" + TRAINING.desc + "</p>" +
      '<div class="meta">' + (camp.best && camp.best.train ? "最佳 " + camp.best.train.score + " 分" : "无限弹药 · 随时进入") + "</div></button>";
    list.innerHTML = html;
  }''')

# init training
rep('''    buildCampaignUI();
    addMenuEntry();''','''    buildCampaignUI();
    addMenuEntry();
    try { initTraining(); } catch (e) { console.error("[ext] training init", e); }''')

# training marker
rep('''  function initCampaign() {''','''  /*__TRAINING__*/

  function initCampaign() {''')
io.open(p,'w',encoding='utf-8').write(s)
print('campaign training wiring patched')

p2='src/ext.js'
s2=io.open(p2,encoding='utf-8').read()
old='''    updateScan(dt);
    updateCombatFeedback();'''
new='''    updateScan(dt);
    updateCombatFeedback();
    try { updateTraining(dt); } catch (e) { console.error("[ext] training update", e); }'''
assert s2.count(old)==1
s2=s2.replace(old,new,1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('ext training update hooked')
