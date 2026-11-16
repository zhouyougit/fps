
import io
p='server/server.cjs'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

rep('''function spawnForRoom(room, team) {''','''function pickSpawns(w, list, base) {
  const out = [];
  for (const s of (list || [])) {
    const free = spawnIsFree(w, s.x, s.z);
    if (free) out.push(free);
  }
  if (!out.length) return buildSpawnPoints(w, base);
  out.sort((a, b) => Math.hypot(a.x - base.x, a.z - base.z) - Math.hypot(b.x - base.x, b.z - base.z));
  return out.slice(0, 12);
}

function spawnForRoom(room, team) {''')

rep('''    const bases = spec.teamBases || TEAM_BASES;
    this.spawnsA = buildSpawnPoints(this.world, bases[0]);
    this.spawnsB = buildSpawnPoints(this.world, bases[1]);''','''    const bases = spec.teamBases || TEAM_BASES;
    this.spawnsA = pickSpawns(this.world, spec.spawns, bases[0]);
    this.spawnsB = pickSpawns(this.world, spec.spawns, bases[1]);''')
io.open(p,'w',encoding='utf-8').write(s)
print('server spawn selection patched')
