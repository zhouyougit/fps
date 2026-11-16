
import io
p='server/server.cjs'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

rep('''  if (!out.length) return buildSpawnPoints(w, base);''','''  if (!out.length) return [];''')

rep('''    const bases = spec.teamBases || TEAM_BASES;
    this.spawnsA = pickSpawns(this.world, spec.spawns, bases[0]);
    this.spawnsB = pickSpawns(this.world, spec.spawns, bases[1]);''','''    const bases = spec.teamBases || TEAM_BASES;
    this.bases = bases;
    this.spawnsA = pickSpawns(this.world, spec.spawns, bases[0]);
    this.spawnsB = pickSpawns(this.world, spec.spawns, bases[1]);''')

rep('''  const others = [...room.players.values()].filter((q) => q.alive && q.team !== team);
  const list = (team === 1 ? room.spawnsB : room.spawnsA);
  const fallback = team === 1 ? TEAM_BASES[1] : TEAM_BASES[0];
  let best = null;
  let bestD = -1;
  for (const p of (list.length ? list : spawnPoints)) {
    let d = Infinity;
    for (const q of others) d = Math.min(d, Math.hypot(p.x - q.pos.x, p.z - q.pos.z));
    if (d > bestD) { bestD = d; best = p; }
  }
  const base = best || { x: fallback.x, y: 0, z: fallback.z };
  return { x: base.x + (Math.random() - 0.5) * 0.6, y: base.y + 0.02, z: base.z + (Math.random() - 0.5) * 0.6, yaw: Math.random() * Math.PI * 2 };''','''  const others = [...room.players.values()].filter((q) => q.alive && q.team !== team);
  const list = (team === 1 ? room.spawnsB : room.spawnsA);
  const bases = room.bases || TEAM_BASES;
  const fallback = bases[team === 1 ? 1 : 0] || bases[0];
  let best = null;
  let bestD = -1;
  for (const p of (list || [])) {
    let d = Infinity;
    for (const q of others) d = Math.min(d, Math.hypot(p.x - q.pos.x, p.z - q.pos.z));
    if (d > bestD) { bestD = d; best = p; }
  }
  if (!best) {
    const gy = room.world.groundHeight(fallback.x, fallback.z, 50);
    return { x: fallback.x, y: gy + 0.02, z: fallback.z, yaw: Math.random() * Math.PI * 2 };
  }
  return { x: best.x + (Math.random() - 0.5) * 0.3, y: best.y + 0.02, z: best.z + (Math.random() - 0.5) * 0.3, yaw: Math.random() * Math.PI * 2 };''')
io.open(p,'w',encoding='utf-8').write(s)
print('spawn fallback patched')
