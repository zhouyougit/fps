
import io
p='src/campaign.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

# single selection + go label
rep('''      html += '<button class="x-mcard' + (i === camp.current ? " sel" : "") + (locked ? " locked" : "") + '" data-idx="' + i + '">' +''','''      html += '<button class="x-mcard' + (i === camp.current && !camp.trainSel ? " sel" : "") + (locked ? " locked" : "") + '" data-idx="' + i + '">' +''')
rep('''    html += '<button class="x-mcard x-train-card' + (camp.trainSel ? " sel" : "") + '" data-train="1">' +''','''    html += '<button class="x-mcard x-train-card' + (camp.trainSel ? " sel" : "") + '" data-train="1">' +''')
rep('''    list.innerHTML = html;
  }''','''    list.innerHTML = html;
    var go = CAMP && CAMP.querySelector('.x-camp-actions [data-x="go"]');
    if (go) go.textContent = camp.trainSel ? "出动 · 训练场" : "出动 · " + MISSIONS[camp.current].name;
  }''')

# title progress in applyMission
rep('''    var premise = document.querySelector(".m-title .m-premise");''','''    var dim = document.querySelector(".m-title .m-eyebrow .m-dim");
    if (dim) dim.textContent = "几猫港区 · 已解锁 " + camp.unlocked + "/" + MISSIONS.length;
    var premise = document.querySelector(".m-title .m-premise");''')

# restore relays + slots on mission launch
rep('''    clearCampaignComplete();
    applyMission(idx);''','''    clearCampaignComplete();
    var rel = document.querySelector(".h-relays");
    if (rel) rel.style.display = "";
    applyMission(idx);''')

# next mission button: demote redeploy
rep('''    var b = el("button", "btn primary x-next", "下一行动 · " + MISSIONS[next].name);''','''    var redeploy = actions.querySelector('[data-act="redeploy"]');
    if (redeploy) { redeploy.classList.remove("primary"); }
    var b = el("button", "btn primary x-next", "下一行动 · " + MISSIONS[next].name);''')

# campaign complete: demote redeploy, back as primary? keep back secondary
rep('''    var note = document.createElement("p");
    note.className = "x-final";''','''    var redeploy2 = actions.querySelector('[data-act="redeploy"]');
    if (redeploy2) { redeploy2.classList.remove("primary"); }
    var note = document.createElement("p");
    note.className = "x-final";''')
io.open(p,'w',encoding='utf-8').write(s)
print('campaign polish patched')

p2='src/ext.js'
s2=io.open(p2,encoding='utf-8').read()
def rep2(old,new):
    global s2
    assert s2.count(old)==1, (s2.count(old), old[:80])
    s2=s2.replace(old,new,1)

# showDeadCheckpointButton demote retry
rep2('''    var acts = scr.querySelector(".m-actions");
    if (acts && !cpBtn.parentNode) acts.insertBefore(cpBtn, acts.firstChild);''','''    var acts = scr.querySelector(".m-actions");
    var retry = scr.querySelector('[data-act="retry"]');
    if (retry) retry.classList.remove("primary");
    if (acts && !cpBtn.parentNode) acts.insertBefore(cpBtn, acts.firstChild);''')

# slots fallback
rep2('''    var slots = [{ short: "九式", ammo: w && w.ammo }];
    if (w && w.slots) slots = w.slots;''','''    var slots = [{ short: "九式", ammo: w && w.ammo }];
    if (w && w.slots && w.slots.length) slots = w.slots;
    else if (w && w.list) slots = w.list.map(function (x) { return { short: x.short, ammo: x.ammo }; });''')

# CSS polish
rep2('''      ".x-final-back{margin-top:10px;}",''','''      ".x-final-back{margin-top:10px;}",
      "/* ---- V10 UX polish ---- */",
      ".m-debrief .m-h{white-space:normal;font-size:clamp(24px,5.4vw,34px);line-height:1.08;overflow-wrap:anywhere;}",
      ".m-debrief{max-width:min(520px,92vw);}",
      ".hud .h-health{opacity:.55;transition:opacity .3s;}",
      ".hud .h-health.on{opacity:1;}",
      ".hud.scoped .h-obj,.hud.scoped .comms,.hud.scoped .h-feed,.hud.scoped .h-msg,.hud.scoped .h-marks{opacity:0;}",
      "@media(min-width:1180px){.m-only-narrow{display:none;}}",
      "@media(max-width:420px){.m-actions .btn{flex:1 1 45%;min-width:88px;}}",
      ".x-camp-veil{background:rgba(6,8,10,.96);}",''')
io.open(p2,'w',encoding='utf-8').write(s2)
print('ext polish patched')

p3='src/armory.js'
s3=io.open(p3,encoding='utf-8').read()
s3=s3.replace('<h2>军械库</h2>','<h2>武器改装</h2>',1)
s3=s3.replace('"<button class=\\"btn primary\\" data-x=\\"close\\">完成</button>"','"<button class=\\"btn primary\\" data-x=\\"close\\">返回</button>"') if False else s3
s3=s3.replace('<button class="btn primary" data-x="close">完成</button>','<button class="btn primary" data-x="close">返回</button>',1)
old='''    overlay.querySelector('[data-x="reset"]').addEventListener("click", function (e) {'''
new='''    addEventListener("keydown", function (e) {
      if (e.code === "Escape" && armoryUI && armoryUI.el.classList.contains("on")) {
        e.preventDefault();
        e.stopPropagation();
        closeArmory();
      }
    }, true);
    overlay.querySelector('[data-x="reset"]').addEventListener("click", function (e) {'''
assert s3.count(old)==1
s3=s3.replace(old,new,1)
io.open(p3,'w',encoding='utf-8').write(s3)
print('armory polish patched')

p4='src/boss.js'
s4=io.open(p4,encoding='utf-8').read()
s4=s4.replace('''    if (bossBar) { bossBar.el.classList.add("on"); bossBar.lastPct = -1; }''','''    if (bossBar) { bossBar.el.classList.add("on"); bossBar.lastPct = -1; }
    var rel = document.querySelector(".h-relays");
    if (rel) rel.style.display = "none";''',1)
s4=s4.replace('''    if (bossBar) bossBar.el.classList.remove("on");''','''    if (bossBar) bossBar.el.classList.remove("on");
    var rel = document.querySelector(".h-relays");
    if (rel) rel.style.display = "";''',1)
io.open(p4,'w',encoding='utf-8').write(s4)
print('boss relays patched')
