
import io
p='server/server.cjs'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

# config
rep('''const MAP_FILE = path.resolve(__dirname, process.env.MAP_FILE || 'map_boxes.json');''','''const MAP_FILE = path.resolve(__dirname, process.env.MAP_FILE || 'map_boxes.json');
const MAPS_FILE = path.resolve(__dirname, process.env.MAPS_FILE || 'maps.json');''')

# globals
rep('''let world;
let spawnPoints = [];
let spawnPointsA = [];
let spawnPointsB = [];
const TEAM_BASES = [{ x: -32, z: 6 }, { x: 29, z: 20 }];''','''let world;
let spawnPoints = [];
let MAPS = {};
const TEAM_BASES = [{ x: -32, z: 6 }, { x: 29, z: 20 }];''')

# replace loadWorldSafe entirely up to spawnIsFree
old='''function loadWorldSafe() {
  if (fs.existsSync(MAP_FILE)) {
    try {
      world = sim.loadWorld(MAP_FILE);
      console.log('[world] loaded ' + MAP_FILE + ' boxes=' + world.boxes.length);
    } catch (e) {
      console.error('[world] failed to load ' + MAP_FILE + ': ' + e.message + '（使用空地图兜底）');
      world = sim.createWorld([]);
    }
  } else {
    console.error('[world] 未找到 ' + MAP_FILE + '，使用空地图兜底（仅地面/水）。请先运行 server/export_boxes.mjs');
    world = sim.createWorld([]);
  }
  spawnPoints = buildSpawnPoints(DEFAULT_SPAWN);
  spawnPointsA = buildSpawnPoints(TEAM_BASES[0]);
  spawnPointsB = buildSpawnPoints(TEAM_BASES[1]);
  console.log(
    '[spawn] ' + spawnPoints.map((p) => '(' + p.x.toFixed(1) + ',' + p.y.toFixed(1) + ',' + p.z.toFixed(1) + ')').join(' ')
  );
}'''
new='''function makeWorld(spec) {
  return sim.createWorld(spec.boxes || [], {
    bounds: spec.bounds,
    groundY: spec.groundY,
    seaY: spec.seaY,
    quayX: spec.quayX,
  });
}

function loadWorldSafe() {
  MAPS = {};
  if (fs.existsSync(MAPS_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(MAPS_FILE, 'utf8'));
      const list = raw.maps || raw;
      for (const id of Object.keys(list)) {
        const spec = list[id];
        spec.id = id;
        spec.world = makeWorld(spec);
        MAPS[id] = spec;
        console.log('[map] ' + id + ' boxes=' + spec.world.boxes.length);
      }
    } catch (e) {
      console.error('[map] failed to load ' + MAPS_FILE + ': ' + e.message);
    }
  }
  if (!Object.keys(MAPS).length) {
    console.error('[world] maps.json 未找到，回退单图 ' + MAP_FILE);
    let spec = { id: 'harbor', boxes: [], teamBases: TEAM_BASES };
    try { spec = Object.assign(spec, JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'))); } catch (e) {}
    spec.world = makeWorld(spec);
    MAPS.harbor = spec;
  }
  world = MAPS.harbor.world;
  spawnPoints = buildSpawnPoints(world, DEFAULT_SPAWN);
}

function mapIds() { return Object.keys(MAPS); }

function getMap(mapId) {
  return MAPS[mapId] || MAPS.harbor;
}'''
assert s.count(old)==1
s=s.replace(old,new,1)

# spawnIsFree/buildSpawnPoints world
rep('''function spawnIsFree(x, z) {
  const g = world.groundHeight(x, z, 50);''','''function spawnIsFree(w, x, z) {
  const g = w.groundHeight(x, z, 50);''')
rep('''  const r = world.moveCapsule(pos, vel, 1 / TICK_HZ, MOVE.radius, MOVE.standHeight, true);''','''  const r = w.moveCapsule(pos, vel, 1 / TICK_HZ, MOVE.radius, MOVE.standHeight, true);''')
rep('''function buildSpawnPoints(baseIn) {
  const points = [];
  const base = baseIn || DEFAULT_SPAWN;''','''function buildSpawnPoints(w, baseIn) {
  const points = [];
  const base = baseIn || DEFAULT_SPAWN;''')
rep('''    const p = spawnIsFree(base.x + ox, base.z + oz);''','''    const p = spawnIsFree(w, base.x + ox, base.z + oz);''')
rep('''  if (!points.length) {
    const y = world.groundHeight(base.x, base.z, 50);''','''  if (!points.length) {
    const y = w.groundHeight(base.x, base.z, 50);''')

# Room constructor map/world
rep('''  constructor(id) {
    this.id = id;
    this.players = new Map();''','''  constructor(id, mapId) {
    this.id = id;
    this.mapId = mapId || 'harbor';
    const spec = getMap(this.mapId);
    this.world = spec.world;
    const bases = spec.teamBases || TEAM_BASES;
    this.spawnsA = buildSpawnPoints(this.world, bases[0]);
    this.spawnsB = buildSpawnPoints(this.world, bases[1]);
    this.players = new Map();''')

# Player constructor spawnIn
rep('''  constructor(ws, room, name, index, team) {
    this.id = makeId();''','''  constructor(ws, room, name, index, team, spawnIn) {
    this.id = makeId();''')
rep('''    const s = spawnFor(index);
    this.spawn = s;''','''    const s = spawnIn || { x: DEFAULT_SPAWN.x, y: 0, z: DEFAULT_SPAWN.z };
    this.spawn = s;''')

# spawnForRoom uses room spawn lists/world
rep('''  const others = [...room.players.values()].filter((q) => q.alive && q.team !== team);
  const list = (team === 1 ? spawnPointsB : spawnPointsA);''','''  const others = [...room.players.values()].filter((q) => q.alive && q.team !== team);
  const list = (team === 1 ? room.spawnsB : room.spawnsA);''')
rep('''  const base = best || { x: fallback.x, y: 0, z: fallback.z };''','''  const base = best || { x: fallback.x, y: 0, z: fallback.z };''')

# stepPlayer world
rep('''function stepPlayer(p, dt) {
  if (!p.alive) return;''','''function stepPlayer(p, dt) {
  if (!p.alive) return;
  const world = p.room.world;''')

# respawn/ground uses room world via spawnForRoom already
# handleFire world
rep('''  const eye = { x: p.pos.x, y: p.pos.y + (p.input.crouch ? 1.05 : 1.68), z: p.pos.z };
  const dir = { x: dx, y: dy, z: dz };
  const wall = world.raycast(eye, dir, RIFLE.range);''','''  const eye = { x: p.pos.x, y: p.pos.y + (p.input.crouch ? 1.05 : 1.68), z: p.pos.z };
  const dir = { x: dx, y: dy, z: dz };
  const wall = p.room.world.raycast(eye, dir, RIFLE.range);''')

# remove old spawnFor? keep unused harmless
io.open(p,'w',encoding='utf-8').write(s)
print('server per-map core patched')
