
import io
p='src/mp.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

rep('''    var selfId = null, room = "harbor-1", playerName = "", mapId = "harbor";''','''    var selfId = null, room = "harbor-1", playerName = "", mapId = "harbor", modeId = "tdm";''')
# lobby row
rep('''          '<div class="x-mp-row"><label>地图</label><select data-mp-map><option value="harbor">四号泊位 · 港区</option><option value="depot">冷链仓库 · 室内</option><option value="ship">外锚地 · 货轮甲板</option><option value="core">核心舱 · 反应堆</option></select></div>' +''','''          '<div class="x-mp-row"><label>地图</label><select data-mp-map><option value="harbor">四号泊位 · 港区</option><option value="depot">冷链仓库 · 室内</option><option value="ship">外锚地 · 货轮甲板</option><option value="core">核心舱 · 反应堆</option></select></div>' +
          '<div class="x-mp-row"><label>模式</label><select data-mp-mode><option value="tdm">团队死斗 · 4v4</option><option value="chaos">大乱战 · 6v6</option></select></div>' +''')
rep('''      ui.querySelector("[data-mp-map]").value = localStorage.getItem("saltline.mp.map") || "harbor";''','''      ui.querySelector("[data-mp-map]").value = localStorage.getItem("saltline.mp.map") || "harbor";
      ui.querySelector("[data-mp-mode]").value = localStorage.getItem("saltline.mp.mode") || "tdm";''')
rep('''        var mp = ui.querySelector("[data-mp-map]").value || "harbor";
        localStorage.setItem("saltline.mp.name", n);
        localStorage.setItem("saltline.mp.url", u);
        localStorage.setItem("saltline.mp.map", mp);
        join(u, n, r, mp);''','''        var mp = ui.querySelector("[data-mp-map]").value || "harbor";
        var md = ui.querySelector("[data-mp-mode]").value || "tdm";
        localStorage.setItem("saltline.mp.name", n);
        localStorage.setItem("saltline.mp.url", u);
        localStorage.setItem("saltline.mp.map", mp);
        localStorage.setItem("saltline.mp.mode", md);
        join(u, n, r, mp, md);''')
rep('''    function join(u, name, r, map) {
      if (joining) return;
      joining = true; playerName = name; room = r; url = u;
      mapId = (map === "depot" || map === "ship" || map === "core") ? map : "harbor";''','''    function join(u, name, r, map, mode) {
      if (joining) return;
      joining = true; playerName = name; room = r; url = u;
      mapId = (map === "depot" || map === "ship" || map === "core") ? map : "harbor";
      modeId = mode === "chaos" ? "chaos" : "tdm";''')
rep('''        ws.send(JSON.stringify({ t: "join", name: name, room: r, map: mapId }));''','''        ws.send(JSON.stringify({ t: "join", name: name, room: r, map: mapId, mode: modeId }));''')
# enter mode
rep('''      mapId = welcome.mapId === "depot" || welcome.mapId === "ship" || welcome.mapId === "core" ? welcome.mapId : "harbor";''','''      mapId = welcome.mapId === "depot" || welcome.mapId === "ship" || welcome.mapId === "core" ? welcome.mapId : "harbor";
      modeId = welcome.mode === "chaos" ? "chaos" : "tdm";''')
# map hud mode
rep('''      return mapId === "depot" ? "冷库" : mapId === "ship" ? "货轮" : mapId === "core" ? "核心" : "港区";''','''      return (mapId === "depot" ? "冷库" : mapId === "ship" ? "货轮" : mapId === "core" ? "核心" : "港区") + " · " + (modeId === "chaos" ? "大乱战" : "团队死斗");''')
# scoreboard title
rep('''        room = welcome.room || room;
        refreshMapHud();''','''        room = welcome.room || room;
        if (scoreUi) { var sh = scoreUi.querySelector("h3"); if (sh) sh.textContent = "计分板 · " + (modeId === "chaos" ? "大乱战 6v6" : "团队死斗 4v4"); }
        refreshMapHud();''')
# state mode
rep('''        return { active: active, selfId: selfId, room: room, map: mapId, url: url, team: myTeam, players: remotes.size + (selfId ? 1 : 0), ping: pingMs, rx: rx };''','''        return { active: active, selfId: selfId, room: room, map: mapId, mode: modeId, url: url, team: myTeam, players: remotes.size + (selfId ? 1 : 0), ping: pingMs, rx: rx };''')
# public join signature
rep('''      join: function (u, n, r, m) { openLobby(); join(u, n || "猫", r || "harbor-1", m); },''','''      join: function (u, n, r, m, md) { openLobby(); join(u, n || "猫", r || "harbor-1", m, md); },''')
io.open(p,'w',encoding='utf-8').write(s)
print('client modes patched')
