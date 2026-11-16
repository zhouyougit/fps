
import io
p='src/mp.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

# CSS loading
rep('''        ".x-mp-vote button.sel{border-color:var(--signal);color:var(--signal);}" +
      var s = document.createElement("style");''','''        ".x-mp-vote button.sel{border-color:var(--signal);color:var(--signal);}" +
        ".x-mp-loading{position:absolute;inset:0;z-index:85;display:none;align-items:center;justify-content:center;flex-direction:column;gap:10px;background:rgba(5,7,9,.86);pointer-events:none;}" +
        ".x-mp-loading.on{display:flex;}" +
        ".x-mp-loading b{font:900 30px/1.1 var(--f-display);letter-spacing:.16em;color:var(--signal);}" +
        ".x-mp-loading span{font:500 11px/1.4 var(--f-mono);letter-spacing:.14em;color:var(--steel);}"
      var s = document.createElement("style");''')

# build loading UI
rep('''      var voteUi = el("div", "x-mp-vote", '<div class="t">下一张地图</div><div class="opts"><button class="btn" data-vote="harbor">港区</button><button class="btn" data-vote="depot">冷库</button><button class="btn" data-vote="ship">货轮</button></div>');''','''      var loadUi = el("div", "x-mp-loading", '<b data-mp-load-t></b><span>正在准备地图 · 编译着色器</span>');
      document.getElementById("ui").appendChild(loadUi);
      scoreUi._load = loadUi;
      var voteUi = el("div", "x-mp-vote", '<div class="t">下一张地图</div><div class="opts"><button class="btn" data-vote="harbor">港区</button><button class="btn" data-vote="depot">冷库</button><button class="btn" data-vote="ship">货轮</button></div>');''')

# loading helpers in applyMap
rep('''    function applyMap(id) {
      if (id !== "depot" && id !== "ship") id = "harbor";
      if (mapId === id) return;
      mapId = id;
      try { MapKit.load(mapId); } catch (e) {}
      try { G.enemies.clear(); G.hud.setMarkers([]); } catch (e) {}
      refreshMapHud();
    }''','''    function mapTitle(id) {
      return id === "depot" ? "冷链仓库" : id === "ship" ? "外锚地" : "四号泊位";
    }
    function showLoading(title) {
      var lu = scoreUi && scoreUi._load;
      if (!lu) return;
      lu.querySelector("[data-mp-load-t]").textContent = title;
      lu.classList.add("on");
      clearTimeout(applyMap._t);
      applyMap._t = setTimeout(function () { lu.classList.remove("on"); }, 2600);
    }
    function readyMap() {
      var lu = scoreUi && scoreUi._load;
      if (!lu) return;
      var hide = function () { setTimeout(function () { lu.classList.remove("on"); }, 260); };
      try {
        var p = G.render && G.render.renderer && G.render.renderer.compileAsync
          ? G.render.renderer.compileAsync(G.scene, G.camera) : null;
        if (p && p.then) p.then(hide).catch(hide); else hide();
      } catch (e) { hide(); }
    }
    function applyMap(id) {
      if (id !== "depot" && id !== "ship") id = "harbor";
      if (mapId === id) return;
      mapId = id;
      showLoading(mapTitle(mapId));
      try { MapKit.load(mapId); } catch (e) {}
      try { G.enemies.clear(); G.hud.setMarkers([]); } catch (e) {}
      refreshMapHud();
      readyMap();
    }''')

# enter show loading before load
rep('''      mapId = welcome.mapId === "depot" || welcome.mapId === "ship" ? welcome.mapId : "harbor";
      if (MapKit.current() !== mapId) MapKit.load(mapId);
      G.game.menus.show("none");''','''      mapId = welcome.mapId === "depot" || welcome.mapId === "ship" ? welcome.mapId : "harbor";
      if (MapKit.current() !== mapId) { showLoading(mapTitle(mapId)); MapKit.load(mapId); }
      G.game.menus.show("none");''')
# hide loading after enter setup
rep('''        hud.classList.add("on");
        hud.querySelector("[data-mp-room]")''','''        hud.classList.add("on");
        try { readyMap(); } catch (e) {}
        hud.querySelector("[data-mp-room]")''') if False else None
# actual enter HUD line is refreshMapHud; add readyMap after
rep('''        room = welcome.room || room;
        refreshMapHud();''','''        room = welcome.room || room;
        refreshMapHud();
        try { readyMap(); } catch (e) {}''')
io.open(p,'w',encoding='utf-8').write(s)
print('mp loading overlay patched')
