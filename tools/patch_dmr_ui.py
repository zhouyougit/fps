
import io
p='src/game.js'
s=io.open(p,encoding='utf-8').read()
old='''            { cfg: SHOTGUN, build: buildShotgun, short: "破门锤" },
          ]),'''
new='''            { cfg: SHOTGUN, build: buildShotgun, short: "破门锤" },
            { cfg: DMR, build: buildDMR, short: "长眼" },
          ]),'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)

p2='src/ext.js'
s2=io.open(p2,encoding='utf-8').read()
old2='''    var toast = el("div", "x-toast");
    root.appendChild(armor);'''
new2='''    var toast = el("div", "x-toast");
    var scope = el("div", "x-scope", '<i class="x-scope-dot"></i><b class="x-scope-h"></b><b class="x-scope-v"></b>');
    root.appendChild(armor);'''
assert s2.count(old2)==1
s2=s2.replace(old2,new2,1)
old3='''    root.appendChild(toast);
    HUD = {'''
new3='''    root.appendChild(toast);
    root.appendChild(scope);
    HUD = {
      scopeEl: scope,
      scopeOn: false,'''
assert s2.count(old3)==1
s2=s2.replace(old3,new3,1)
old4='''      setSlots: function (list, active, grenades) {'''
new4='''      setScope: function (on) {
        if (on === this.scopeOn) return;
        this.scopeOn = on;
        this.scopeEl.classList.toggle("on", on);
        G.hud.root.classList.toggle("scoped", on);
      },
      setSlots: function (list, active, grenades) {'''
assert s2.count(old4)==1
s2=s2.replace(old4,new4,1)
old5='''    HUD.setSlots(slots, w && w.activeIndex || 0, S.grenades);'''
new5='''    HUD.setSlots(slots, w && w.activeIndex || 0, S.grenades);
    var act = w && w.list && w.list[w.activeIndex];
    HUD.setScope(!!(act && act.scope && act.ads > 0.82));'''
assert s2.count(old5)==1
s2=s2.replace(old5,new5,1)
# scope CSS
oldcss='''      ".x-boss-pips em.on{background:var(--alarm);box-shadow:0 0 6px rgba(255,90,64,.5);}",'''
newcss='''      ".x-boss-pips em.on{background:var(--alarm);box-shadow:0 0 6px rgba(255,90,64,.5);}",
      "/* ---- v5 scope ---- */",
      ".x-scope{position:absolute;inset:0;opacity:0;transition:opacity .1s;pointer-events:none;}",
      ".x-scope.on{opacity:1;}",
      ".x-scope::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 0 25.5vmin, rgba(3,5,7,.72) 26vmin, #04060a 33vmin);}",
      ".x-scope::after{content:'';position:absolute;left:50%;top:50%;width:52vmin;height:52vmin;transform:translate(-50%,-50%);border-radius:50%;box-shadow:inset 0 0 0 1.5px rgba(0,0,0,.85), inset 0 0 70px rgba(0,0,0,.75);}",
      ".x-scope-dot{position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px;background:#ff5a40;border-radius:50%;box-shadow:0 0 6px rgba(255,90,64,.9);}",
      ".x-scope-h,.x-scope-v{position:absolute;left:50%;top:50%;background:rgba(10,12,14,.55);}",
      ".x-scope-h{width:36vmin;height:1px;transform:translate(-50%,-0.5px);}",
      ".x-scope-v{width:1px;height:30vmin;transform:translate(-0.5px,-50%);}",
      ".hud.scoped .h-cross{opacity:0 !important;}",'''
assert s2.count(oldcss)==1
s2=s2.replace(oldcss,newcss,1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('dmr wired + scope hud')
