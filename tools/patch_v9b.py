
import io
p='src/campaign.js'
s=io.open(p,encoding='utf-8').read()
old='''    if (camp.unlocked < camp.current + 2) camp.unlocked = Math.min(MISSIONS.length, camp.current + 2);
    saveCamp();
    addNextMissionButton();
  }'''
new='''    if (camp.unlocked < camp.current + 2) camp.unlocked = Math.min(MISSIONS.length, camp.current + 2);
    saveCamp();
    addNextMissionButton();
    addCampaignComplete();
  }

  function clearCampaignComplete() {
    var note = document.querySelector(".x-final");
    if (note && note.parentNode) note.parentNode.removeChild(note);
    var back = document.querySelector(".x-final-back");
    if (back && back.parentNode) back.parentNode.removeChild(back);
  }

  function addCampaignComplete() {
    if (camp.current !== MISSIONS.length - 1) return;
    var panel = document.querySelector(".m-debrief");
    var actions = panel && panel.querySelector(".m-actions");
    if (!panel || !actions || panel.querySelector(".x-final")) return;
    var note = document.createElement("p");
    note.className = "x-final";
    note.textContent = "三个行动全部完成 · 港区行动结束";
    panel.insertBefore(note, actions);
    var back = document.createElement("button");
    back.className = "btn x-final-back";
    back.textContent = "返回标题";
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
  }'''
assert s.count(old)==1
s=s.replace(old,new,1)
old2='''    S.checkpoint = null;
    if (typeof bossRef !== "undefined") bossRef = null;
    applyMission(idx);'''
new2='''    S.checkpoint = null;
    if (typeof bossRef !== "undefined") bossRef = null;
    clearCampaignComplete();
    applyMission(idx);'''
assert s.count(old2)==1
s=s.replace(old2,new2,1)
io.open(p,'w',encoding='utf-8').write(s)

p2='src/tactics.js'
s2=io.open(p2,encoding='utf-8').read()
old3='''    var now = G.time.t, cam = G.camera, w = innerWidth, h = innerHeight;'''
new3='''    var now = G.time.t, cam = G.camera, w = innerWidth, h = innerHeight;
    if (!S.scanTmp) S.scanTmp = new G.THREE.Vector3();'''
assert s2.count(old3)==1
s2=s2.replace(old3,new3,1)
old4='''      var v = e.pos.clone();
      v.y += (e.type === "hound" ? 1.25 : 0.55);'''
new4='''      var v = S.scanTmp.copy(e.pos);
      v.y += (e.type === "hound" ? 1.25 : 0.55);'''
assert s2.count(old4)==1
s2=s2.replace(old4,new4,1)
io.open(p2,'w',encoding='utf-8').write(s2)

p3='src/ext.js'
s3=io.open(p3,encoding='utf-8').read()
old5='''      ".x-perf pre{margin:0;padding:8px 11px;font:11px/1.55 var(--f-mono);color:#cfe8d0;background:rgba(4,6,8,.74);border-left:2px solid var(--signal);white-space:pre;text-shadow:none;}",'''
new5='''      ".x-perf pre{margin:0;padding:8px 11px;font:11px/1.55 var(--f-mono);color:#cfe8d0;background:rgba(4,6,8,.74);border-left:2px solid var(--signal);white-space:pre;text-shadow:none;}",
      ".x-final{margin:16px 0 0;padding:10px 12px;border-left:2px solid var(--signal);background:rgba(255,179,71,.08);font:600 12px/1.5 var(--f-label);letter-spacing:.12em;color:var(--signal);}",
      ".x-final-back{margin-top:10px;}",'''
assert s3.count(old5)==1
s3=s3.replace(old5,new5,1)
io.open(p3,'w',encoding='utf-8').write(s3)
print('campaign completion + scan opt patched')
