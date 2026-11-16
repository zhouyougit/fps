
import io
p='src/mp.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

rep('''    var selfId = null, room = "harbor-1", playerName = "";''','''    var selfId = null, room = "harbor-1", playerName = "", mapId = "harbor";''')

rep('''        ".x-mp-row input:focus{border-color:var(--signal);}" +
        ".x-mp-status''','''        ".x-mp-row input:focus{border-color:var(--signal);}" +
        ".x-mp-row select{flex:1;background:rgba(255,255,255,.04);border:1px solid rgba(232,228,218,.18);color:var(--bone);font:500 13px/1.4 var(--f-label);padding:9px 10px;outline:none;}" +
        ".x-mp-status''')

rep('''          '<div class="x-mp-row"><label>房间</label><input data-mp-room maxlength="18" value="harbor-1"></div>' +''','''          '<div class="x-mp-row"><label>房间</label><input data-mp-room maxlength="18" value="harbor-1"></div>' +
          '<div class="x-mp-row"><label>地图</label><select data-mp-map><option value="harbor">四号泊位 · 港区</option><option value="depot">冷链仓库 · 室内</option><option value="ship">外锚地 · 货轮甲板</option></select></div>' +''')

rep('''      ui.querySelector("[data-mp-name]").value = localStorage.getItem("saltline.mp.name") || names[Math.floor(Math.random() * names.length)];
      ui.querySelector("[data-mp-url]").value = defaultUrl();''','''      ui.querySelector("[data-mp-name]").value = localStorage.getItem("saltline.mp.name") || names[Math.floor(Math.random() * names.length)];
      ui.querySelector("[data-mp-url]").value = defaultUrl();
      ui.querySelector("[data-mp-map]").value = localStorage.getItem("saltline.mp.map") || "harbor";''')

rep('''        var u = ui.querySelector("[data-mp-url]").value.trim() || defaultUrl();
        localStorage.setItem("saltline.mp.name", n);
        localStorage.setItem("saltline.mp.url", u);
        join(u, n, r);''','''        var u = ui.querySelector("[data-mp-url]").value.trim() || defaultUrl();
        var mp = ui.querySelector("[data-mp-map]").value || "harbor";
        localStorage.setItem("saltline.mp.name", n);
        localStorage.setItem("saltline.mp.url", u);
        localStorage.setItem("saltline.mp.map", mp);
        join(u, n, r, mp);''')

rep('''    function join(u, name, r) {
      if (joining) return;
      joining = true; playerName = name; room = r; url = u;''','''    function join(u, name, r, map) {
      if (joining) return;
      joining = true; playerName = name; room = r; url = u;
      mapId = (map === "depot" || map === "ship") ? map : "harbor";''')
rep('''        ws.send(JSON.stringify({ t: "join", name: name, room: r }));''','''        ws.send(JSON.stringify({ t: "join", name: name, room: r, map: mapId }));''')

rep('''    function enter(welcome) {
      if (MapKit.current() !== "harbor") MapKit.load("harbor");
      G.game.menus.show("none");
      G.game.start({ skipIntro: true });''','''    function enter(welcome) {
      mapId = welcome.mapId === "depot" || welcome.mapId === "ship" ? welcome.mapId : "harbor";
      if (MapKit.current() !== mapId) MapKit.load(mapId);
      G.game.menus.show("none");
      G.game.start({ skipIntro: true });''')

rep('''        hud.querySelector("[data-mp-room]").textContent = welcome.room || room;''','''        hud.querySelector("[data-mp-room]").textContent = (welcome.room || room) + " · " + (mapId === "depot" ? "冷库" : mapId === "ship" ? "货轮" : "港区");''')

rep('''      try { G.game.state = "title"; G.game.menus.show("title"); } catch (e) {}''','''      try { if (MapKit && MapKit.current() !== "harbor") MapKit.load("harbor"); } catch (e) {}
      try { G.game.state = "title"; G.game.menus.show("title"); } catch (e) {}''')

rep('''        return { active: active, selfId: selfId, room: room, url: url, team: myTeam, players: remotes.size + (selfId ? 1 : 0), ping: pingMs };''','''        return { active: active, selfId: selfId, room: room, map: mapId, url: url, team: myTeam, players: remotes.size + (selfId ? 1 : 0), ping: pingMs };''')

rep('''      join: function (u, n, r) { openLobby(); join(u, n || "猫", r || "harbor-1"); },''','''      join: function (u, n, r, m) { openLobby(); join(u, n || "猫", r || "harbor-1", m); },''')
io.open(p,'w',encoding='utf-8').write(s)
print('client map rotation patched')
