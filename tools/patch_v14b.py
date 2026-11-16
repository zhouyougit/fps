
import io
p='src/campaign.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

# title premise
rep('''    if (premise) premise.textContent = "港区防御系统失控。三个行动阶段，逐步切断封锁并撤离。";''','''    if (premise) premise.textContent = "当前行动 " + m.code + " · " + m.name + " · 已解锁 " + camp.unlocked + "/" + MISSIONS.length;''')

# return to title helper before addMenuEntry
rep('''  function addMenuEntry() {''','''  function returnToTitle() {
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

  function addMenuEntry() {''')

# pause return button
rep('''      p.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); openMissionScreen(); });
      pacts.insertBefore(p, pacts.lastElementChild);''','''      p.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); openMissionScreen(); });
      pacts.insertBefore(p, pacts.lastElementChild);
    }
    if (pacts && !pacts.querySelector('[data-x="to-title"]')) {
      var back = el("button", "btn", "返回标题");
      back.setAttribute("data-x", "to-title");
      back.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); returnToTitle(); });
      pacts.appendChild(back);''')

# retry confirm listener in initCampaign (after build UI)
rep('''    buildCampaignUI();
    buildBriefingUI();''','''    buildCampaignUI();
    buildBriefingUI();
    document.addEventListener("click", function (e) {
      var b = e.target.closest('.m-screen[data-s="dead"] [data-act="retry"]');
      if (!b || b.dataset.confirm === "1") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      b.dataset.confirm = "1";
      b.dataset.label = b.textContent;
      b.textContent = "确认重试？";
      setTimeout(function () {
        if (b.isConnected) {
          b.dataset.confirm = "";
          b.textContent = b.dataset.label || "重新开始行动";
        }
      }, 2600);
    }, true);''')
io.open(p,'w',encoding='utf-8').write(s)
print('campaign v14 patched')
