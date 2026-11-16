
import io
p='server/server.cjs'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

# room votes
rep('''    this.teamKills = [0, 0];
    this.resetT = 0;''','''    this.teamKills = [0, 0];
    this.resetT = 0;
    this.votes = {};''')

# setRoomMap + resetRoom
rep('''function resetRoom(room) {
  room.roundOver = false;
  room.roundOverAt = 0;
  room.roundStart = Date.now();
  room.teamKills = [0, 0];
  for (const p of room.players.values()) {
    p.kills = 0;
    p.deaths = 0;
    respawn(p);
  }
  room.broadcast({ t: 'roundStart', teams: [0, 0] });
}''','''function setRoomMap(room, mapId) {
  const spec = getMap(mapId);
  room.mapId = spec.id;
  room.world = spec.world;
  const bases = spec.teamBases || TEAM_BASES;
  room.bases = bases;
  room.spawnsA = pickSpawns(room.world, spec.spawns, bases[0]);
  room.spawnsB = pickSpawns(room.world, spec.spawns, bases[1]);
}

function resetRoom(room) {
  const counts = {};
  for (const id of Object.keys(room.votes)) counts[room.votes[id]] = (counts[room.votes[id]] || 0) + 1;
  let nextMap = room.mapId;
  let best = -1;
  for (const id of Object.keys(counts)) if (counts[id] > best) { best = counts[id]; nextMap = id; }
  room.votes = {};
  if (!MAPS[nextMap]) nextMap = room.mapId;
  if (nextMap !== room.mapId) {
    setRoomMap(room, nextMap);
    room.broadcast({ t: 'mapChange', mapId: nextMap });
  }
  room.roundOver = false;
  room.roundOverAt = 0;
  room.roundStart = Date.now();
  room.teamKills = [0, 0];
  for (const p of room.players.values()) {
    p.kills = 0;
    p.deaths = 0;
    respawn(p);
  }
  room.broadcast({ t: 'roundStart', teams: [0, 0], mapId: room.mapId });
}''')

# roundEnd voteStart
rep('''      p.room.broadcast({ t: 'roundEnd', winnerTeam: p.team, teams: p.room.teamKills.slice(), winner: { id: p.id, name: p.name, kills: p.kills } });''','''      p.room.broadcast({ t: 'roundEnd', winnerTeam: p.team, teams: p.room.teamKills.slice(), winner: { id: p.id, name: p.name, kills: p.kills } });
      p.room.broadcast({ t: 'voteStart', maps: mapIds(), current: p.room.mapId, endsIn: 8 });''')

# dev round voteStart
rep('''          p.room.broadcast({ t: 'roundEnd', winnerTeam: 0, teams: p.room.teamKills.slice(), winner: { id: p.id, name: p.name, kills: p.kills } });''','''          p.room.broadcast({ t: 'roundEnd', winnerTeam: 0, teams: p.room.teamKills.slice(), winner: { id: p.id, name: p.name, kills: p.kills } });
          p.room.broadcast({ t: 'voteStart', maps: mapIds(), current: p.room.mapId, endsIn: 8 });''')

# score mapId
rep('''        teams: room.teamKills.slice(),
        players:''','''        mapId: room.mapId,
        teams: room.teamKills.slice(),
        players:''')

# vote case
rep('''    case 'fire':
      handleFire(p, msg);
      break;''','''    case 'fire':
      handleFire(p, msg);
      break;
    case 'vote':
      if (typeof msg.map === 'string' && MAPS[msg.map]) p.room.votes[p.id] = msg.map;
      break;''')
io.open(p,'w',encoding='utf-8').write(s)
print('server map vote patched')
