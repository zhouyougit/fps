
import io
p='src/mp.js'
s=io.open(p,encoding='utf-8').read()
s=s.replace('''    var selfId = null, room = "harbor-1", playerName = "", mapId = "harbor";''','''    var selfId = null, room = "harbor-1", playerName = "", mapId = "harbor";
    var rx = { msg: 0, snap: 0, pong: 0 };''',1)
s=s.replace('''    function onMsg(m) {
      if (m.t === "welcome") {''','''    function onMsg(m) {
      rx.msg++;
      if (m.t === "snap") rx.snap++;
      if (m.t === "pong") rx.pong++;
      if (m.t === "welcome") {''',1)
s=s.replace('''        return { active: active, selfId: selfId, room: room, map: mapId, url: url, team: myTeam, players: remotes.size + (selfId ? 1 : 0), ping: pingMs };''','''        return { active: active, selfId: selfId, room: room, map: mapId, url: url, team: myTeam, players: remotes.size + (selfId ? 1 : 0), ping: pingMs, rx: rx };''',1)
io.open(p,'w',encoding='utf-8').write(s)
print('rx counters added')
