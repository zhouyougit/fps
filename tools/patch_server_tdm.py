
import io
p='server/server.cjs'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

# global team spawn arrays
rep('''let world;
let spawnPoints = [];''','''let world;
let spawnPoints = [];
let spawnPointsA = [];
let spawnPointsB = [];
const TEAM_BASES = [{ x: -32, z: 6 }, { x: 29, z: 20 }];''')

# buildSpawnPoints param
rep('''function buildSpawnPoints() {
  const points = [];
  const base = DEFAULT_SPAWN;''','''function buildSpawnPoints(baseIn) {
  const points = [];
  const base = baseIn || DEFAULT_SPAWN;''')
rep('''  spawnPoints = buildSpawnPoints();''','''  spawnPoints = buildSpawnPoints(DEFAULT_SPAWN);
  spawnPointsA = buildSpawnPoints(TEAM_BASES[0]);
  spawnPointsB = buildSpawnPoints(TEAM_BASES[1]);''')

# player team
rep('''  constructor(ws, room, name, index) {
    this.id = makeId();''','''  constructor(ws, room, name, index, team) {
    this.id = makeId();
    this.team = team == null ? 0 : team;''')
rep('''      alive: !!this.alive,
      kills: this.kills,''','''      alive: !!this.alive,
      team: this.team,
      kills: this.kills,''')

# room teams
rep('''    this.roundStart = Date.now();
    this.scoreLimit = 30;
    this.roundSeconds = 300;
    this.roundOver = false;''','''    this.roundStart = Date.now();
    this.scoreLimit = 50;
    this.roundSeconds = 300;
    this.roundOver = false;
    this.roundOverAt = 0;
    this.teamKills = [0, 0];
    this.resetT = 0;''')

# team helpers before spawnForRoom
rep('''function spawnForRoom(room) {
  const others = [...room.players.values()].filter((q) => q.alive);
  let best = null;
  let bestD = -1;
  for (const p of spawnPoints) {
    let d = Infinity;
    for (const q of others) d = Math.min(d, Math.hypot(p.x - q.pos.x, p.z - q.pos.z));
    if (d > bestD) { bestD = d; best = p; }
  }
  const base = best || spawnPoints[0] || { x: DEFAULT_SPAWN.x, y: 0, z: DEFAULT_SPAWN.z };
  return { x: base.x + (Math.random() - 0.5) * 0.6, y: base.y + 0.02, z: base.z + (Math.random() - 0.5) * 0.6, yaw: Math.random() * Math.PI * 2 };
}''','''function spawnForRoom(room, team) {
  const others = [...room.players.values()].filter((q) => q.alive && q.team !== team);
  const list = (team === 1 ? spawnPointsB : spawnPointsA);
  const fallback = team === 1 ? TEAM_BASES[1] : TEAM_BASES[0];
  let best = null;
  let bestD = -1;
  for (const p of (list.length ? list : spawnPoints)) {
    let d = Infinity;
    for (const q of others) d = Math.min(d, Math.hypot(p.x - q.pos.x, p.z - q.pos.z));
    if (d > bestD) { bestD = d; best = p; }
  }
  const base = best || { x: fallback.x, y: 0, z: fallback.z };
  return { x: base.x + (Math.random() - 0.5) * 0.6, y: base.y + 0.02, z: base.z + (Math.random() - 0.5) * 0.6, yaw: Math.random() * Math.PI * 2 };
}

function assignTeam(room, requested) {
  const counts = [0, 0];
  for (const p of room.players.values()) counts[p.team]++;
  if (requested === 0 || requested === 1) return requested;
  return counts[0] <= counts[1] ? 0 : 1;
}

function resetRoom(room) {
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
}''')

# respawn uses team
rep('''  const s = p.room ? spawnForRoom(p.room) : p.spawn;''','''  const s = p.room ? spawnForRoom(p.room, p.team) : p.spawn;''')

# simulate reset
rep('''    if (tick % 30 === 0) {
      room.broadcast({
        t: 'score',
        timeLeft: Math.max(0, room.roundSeconds - Math.floor((now - room.roundStart) / 1000)),
        players: [...room.players.values()].map((q) => ({ id: q.id, name: q.name, kills: q.kills, deaths: q.deaths, ping: q.ping || 0 })),
      });
    }''','''    if (room.roundOver && room.roundOverAt && now >= room.roundOverAt) resetRoom(room);
    if (tick % 30 === 0) {
      room.broadcast({
        t: 'score',
        timeLeft: Math.max(0, room.roundSeconds - Math.floor((now - room.roundStart) / 1000)),
        teams: room.teamKills.slice(),
        players: [...room.players.values()].map((q) => ({ id: q.id, name: q.name, team: q.team, kills: q.kills, deaths: q.deaths, ping: q.ping || 0 })),
      });
    }''')

# fire friendly fire/team score
rep('''    if (q.id === p.id || !q.alive) continue;''','''    if (q.id === p.id || !q.alive || q.team === p.team) continue;''')
rep('''    p.kills++;
    p.room.broadcast({ t: 'kill', by: p.id, victim: hit.q.id, hs, wpn: 'rifle', byName: p.name, victimName: hit.q.name });
    if (p.kills >= p.room.scoreLimit && !p.room.roundOver) {
      p.room.roundOver = true;
      p.room.broadcast({ t: 'roundEnd', winner: { id: p.id, name: p.name, kills: p.kills } });
    }''','''    p.kills++;
    p.room.teamKills[p.team] = (p.room.teamKills[p.team] || 0) + 1;
    p.room.broadcast({ t: 'kill', by: p.id, victim: hit.q.id, hs, wpn: 'rifle', byName: p.name, victimName: hit.q.name, team: p.team });
    if (p.room.teamKills[p.team] >= p.room.scoreLimit && !p.room.roundOver) {
      p.room.roundOver = true;
      p.room.roundOverAt = now + 8000;
      p.room.broadcast({ t: 'roundEnd', winnerTeam: p.team, teams: p.room.teamKills.slice(), winner: { id: p.id, name: p.name, kills: p.kills } });
    }''')

# join team + spawn
rep('''  const spawn = spawnForRoom(room);
  const p = new Player(ws, room, name, spawnCounter++ + room.size);''','''  const team = assignTeam(room, msg.team);
  const spawn = spawnForRoom(room, team);
  const p = new Player(ws, room, name, spawnCounter++ + room.size, team);''')
rep('''    tickRate: TICK_HZ,
    serverTime: Date.now(),''','''    tickRate: TICK_HZ,
    team,
    serverTime: Date.now(),''')
io.open(p,'w',encoding='utf-8').write(s)
print('server TDM patched')
