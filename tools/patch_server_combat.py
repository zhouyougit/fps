
import io
p='server/server.cjs'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

# player fields
rep('''    this.hp = 100;
    this.maxHp = 100;
    this.alive = true;''','''    this.hp = 100;
    this.maxHp = 100;
    this.armor = 50;
    this.alive = true;
    this.respawnAt = 0;
    this.lastFire = 0;
    this.kills = 0;
    this.deaths = 0;''')

# spawn yaw
rep('''    this.spawn = s;
    this.pos = { x: s.x, y: s.y, z: s.z };''','''    this.spawn = s;
    this.yaw = s.yaw || 0;
    this.pos = { x: s.x, y: s.y, z: s.z };''')

# snapshot fields
rep('''      hp: Math.round(this.hp),
      onGround: !!this.onGround,
      seq: this.lastSeq,''','''      hp: Math.round(this.hp),
      armor: Math.round(this.armor),
      alive: !!this.alive,
      kills: this.kills,
      deaths: this.deaths,
      onGround: !!this.onGround,
      seq: this.lastSeq,''')

# room fields
rep('''  constructor(id) {
    this.id = id;
    this.players = new Map();
    this.createdAt = Date.now();
  }''','''  constructor(id) {
    this.id = id;
    this.players = new Map();
    this.createdAt = Date.now();
    this.roundStart = Date.now();
    this.scoreLimit = 30;
    this.roundSeconds = 300;
    this.roundOver = false;
  }''')

# respawn reset armor/alive
rep('''function respawn(p) {
  p.pos.x = p.spawn.x;
  p.pos.y = p.spawn.y;
  p.pos.z = p.spawn.z;
  p.vel.x = p.vel.y = p.vel.z = 0;
  p.hp = p.maxHp;
  p.onGround = true;
}''','''function respawn(p) {
  const s = p.room ? spawnForRoom(p.room) : p.spawn;
  p.spawn = s;
  p.pos.x = s.x;
  p.pos.y = s.y;
  p.pos.z = s.z;
  p.vel.x = p.vel.y = p.vel.z = 0;
  p.yaw = s.yaw || 0;
  p.hp = p.maxHp;
  p.armor = 50;
  p.alive = true;
  p.respawnAt = 0;
  p.onGround = true;
}

function spawnForRoom(room) {
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
}''')

# stepPlayer early return
rep('''function stepPlayer(p, dt) {
  const inp = p.input;''','''function stepPlayer(p, dt) {
  if (!p.alive) return;
  const inp = p.input;''')

# simulate respawn + score
rep('''function simulate(dt) {
  tick++;
  for (const room of rooms.values()) {
    for (const p of room.players.values()) stepPlayer(p, dt);
  }
}''','''function simulate(dt) {
  tick++;
  const now = Date.now();
  for (const room of rooms.values()) {
    for (const p of room.players.values()) {
      if (!p.alive && p.respawnAt && now >= p.respawnAt) {
        respawn(p);
        room.broadcast({ t: 'respawn', id: p.id, x: round3(p.pos.x), y: round3(p.pos.y), z: round3(p.pos.z), yaw: round3(p.yaw), hp: 100, armor: 50 });
      }
      stepPlayer(p, dt);
    }
    if (tick % 30 === 0) {
      room.broadcast({
        t: 'score',
        timeLeft: Math.max(0, room.roundSeconds - Math.floor((now - room.roundStart) / 1000)),
        players: [...room.players.values()].map((q) => ({ id: q.id, name: q.name, kills: q.kills, deaths: q.deaths, ping: q.ping || 0 })),
      });
    }
  }
}''')

# combat functions before messages
rep('''// ---------------------------------------------------------------------------
// 消息处理
// ---------------------------------------------------------------------------''','''// ---------------------------------------------------------------------------
// 射击 / 命中
// ---------------------------------------------------------------------------
const RIFLE = { damage: 26, rpm: 720, headMult: 2.2, range: 220, armorAbsorb: 0.65 };

function raySphere(origin, dir, cx, cy, cz, radius) {
  const ox = origin.x - cx, oy = origin.y - cy, oz = origin.z - cz;
  const b = ox * dir.x + oy * dir.y + oz * dir.z;
  const c = ox * ox + oy * oy + oz * oz - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  let t = -b - sq;
  if (t < 0) t = -b + sq;
  if (t < 0) return null;
  return { t, x: origin.x + dir.x * t, y: origin.y + dir.y * t, z: origin.z + dir.z * t };
}

function rayPlayer(origin, dir, q) {
  let best = null;
  const head = raySphere(origin, dir, q.pos.x, q.pos.y + 1.68, q.pos.z, 0.21);
  if (head) best = { t: head.t, part: 'head', x: head.x, y: head.y, z: head.z };
  const pts = [0.45, 0.85, 1.25];
  for (const hy of pts) {
    const h = raySphere(origin, dir, q.pos.x, q.pos.y + hy, q.pos.z, 0.34);
    if (h && (!best || h.t < best.t)) best = { t: h.t, part: 'body', x: h.x, y: h.y, z: h.z };
  }
  return best;
}

function handleFire(p, msg) {
  if (!p.alive || !p.room) return;
  const now = Date.now();
  if (now - p.lastFire < 60000 / RIFLE.rpm - 8) return;
  p.lastFire = now;
  const d = msg.dir;
  if (!d || typeof d !== 'object') return;
  let dx = numOr(d.x, numOr(Array.isArray(d) ? d[0] : NaN, 0));
  let dy = numOr(d.y, numOr(Array.isArray(d) ? d[1] : NaN, 0));
  let dz = numOr(d.z, numOr(Array.isArray(d) ? d[2] : NaN, 0));
  const len = Math.hypot(dx, dy, dz);
  if (len < 0.5) return;
  dx /= len; dy /= len; dz /= len;
  const eye = { x: p.pos.x, y: p.pos.y + (p.input.crouch ? 1.05 : 1.68), z: p.pos.z };
  const dir = { x: dx, y: dy, z: dz };
  const wall = world.raycast(eye, dir, RIFLE.range);
  let maxT = wall ? wall.dist : RIFLE.range;
  let hit = null;
  for (const q of p.room.players.values()) {
    if (q.id === p.id || !q.alive) continue;
    const r = rayPlayer(eye, dir, q);
    if (r && r.t < maxT) { maxT = r.t; hit = { q, r }; }
  }
  if (!hit) return;
  const hs = hit.r.part === 'head';
  let dmg = RIFLE.damage * (hs ? RIFLE.headMult : 1);
  const absorbed = Math.min(hit.q.armor, dmg * RIFLE.armorAbsorb);
  hit.q.armor -= absorbed;
  dmg -= absorbed;
  hit.q.hp -= dmg;
  p.room.broadcast({
    t: 'hit', by: p.id, victim: hit.q.id, dmg: Math.round(dmg), part: hit.r.part,
    hs, point: [round3(hit.r.x), round3(hit.r.y), round3(hit.r.z)]
  });
  if (hit.q.hp <= 0) {
    hit.q.hp = 0;
    hit.q.alive = false;
    hit.q.deaths++;
    hit.q.respawnAt = now + 3000;
    p.kills++;
    p.room.broadcast({ t: 'kill', by: p.id, victim: hit.q.id, hs, wpn: 'rifle', byName: p.name, victimName: hit.q.name });
    if (p.kills >= p.room.scoreLimit && !p.room.roundOver) {
      p.room.roundOver = true;
      p.room.broadcast({ t: 'roundEnd', winner: { id: p.id, name: p.name, kills: p.kills } });
    }
  }
}

// ---------------------------------------------------------------------------
// 消息处理
// ---------------------------------------------------------------------------''')

# message case fire
rep('''    case 'ping':
      p.send({ t: 'pong', ts: msg.ts, serverTime: Date.now(), tick });
      break;''','''    case 'ping':
      p.send({ t: 'pong', ts: msg.ts, serverTime: Date.now(), tick });
      break;
    case 'fire':
      handleFire(p, msg);
      break;''')

# join spawn uses room
rep('''  const p = new Player(ws, room, name, spawnCounter++ + room.size);''','''  const spawn = spawnForRoom(room);
  const p = new Player(ws, room, name, spawnCounter++ + room.size);
  p.spawn = spawn;
  p.pos.x = spawn.x; p.pos.y = spawn.y; p.pos.z = spawn.z;
  p.yaw = spawn.yaw || 0;''')
io.open(p,'w',encoding='utf-8').write(s)
print('server combat patched')
