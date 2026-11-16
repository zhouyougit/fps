
import io
p='server/server.cjs'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

# modes
rep('''const DEFAULT_SPAWN = { x: -32, z: 6 };''','''const DEFAULT_SPAWN = { x: -32, z: 6 };

const MODES = {
  tdm: { id: 'tdm', name: '团队死斗', maxPlayers: 8, scoreLimit: 50, roundSeconds: 300 },
  chaos: { id: 'chaos', name: '大乱战', maxPlayers: 12, scoreLimit: 75, roundSeconds: 360 },
};''')

# room constructor mode
rep('''  constructor(id, mapId) {
    this.id = id;
    this.mapId = mapId || 'harbor';''','''  constructor(id, mapId, modeId) {
    this.id = id;
    this.mapId = mapId || 'harbor';
    this.modeId = MODES[modeId] ? modeId : 'tdm';
    this.mode = MODES[this.modeId];
    this.maxPlayers = this.mode.maxPlayers;''')
rep('''    this.scoreLimit = 75;
    this.roundSeconds = 360;''','''    this.scoreLimit = this.mode.scoreLimit;
    this.roundSeconds = this.mode.roundSeconds;''')
rep('''    this.votes = {};''','''    this.votes = {};
    this.spawnUse = {};''')

# spawn reservation
rep('''  let best = null;
  let bestD = -1;
  for (const p of (list || [])) {
    let d = Infinity;''','''  let best = null;
  let bestD = -1;
  const now = Date.now();
  for (const p of (list || [])) {
    const key = p.x.toFixed(2) + ',' + p.z.toFixed(2);
    if ((room.spawnUse[key] || 0) > now) continue;
    let d = Infinity;''')
rep('''  if (!best) {
    const gy = room.world.groundHeight(fallback.x, fallback.z, 3);''','''  if (best) {
    const k = best.x.toFixed(2) + ',' + best.z.toFixed(2);
    room.spawnUse[k] = now + 1600;
  }
  if (!best) {
    const gy = room.world.groundHeight(fallback.x, fallback.z, 3);''')
# reset clears spawnUse
rep('''  room.teamKills = [0, 0];
  for (const p of room.players.values()) {''','''  room.teamKills = [0, 0];
  room.spawnUse = {};
  for (const p of room.players.values()) {''')

# join mode and room key/cap
rep('''  const roomId = sanitizeRoom(msg.room);
  const mapId = MAPS[msg.map] ? msg.map : 'harbor';
  const roomKey = roomId + '@' + mapId;
  let room = rooms.get(roomKey);
  if (!room) {
    room = new Room(roomKey, mapId);
    rooms.set(roomKey, room);
  }''','''  const roomId = sanitizeRoom(msg.room);
  const mapId = MAPS[msg.map] ? msg.map : 'harbor';
  const modeId = MODES[msg.mode] ? msg.mode : 'tdm';
  const roomKey = roomId + '@' + mapId + '@' + modeId;
  let room = rooms.get(roomKey);
  if (!room) {
    room = new Room(roomKey, mapId, modeId);
    rooms.set(roomKey, room);
  }
  if (room.size >= room.maxPlayers) { sendError(ws, 'room_full', '房间已满'); return; }''')
rep('''    room: roomId,
    mapId,
    tick,''','''    room: roomId,
    mapId,
    mode: room.modeId,
    tick,''')
rep('''        mapId: room.mapId,
        teams: room.teamKills.slice(),''','''        mapId: room.mapId,
        mode: room.modeId,
        teams: room.teamKills.slice(),''')
io.open(p,'w',encoding='utf-8').write(s)
print('server modes/spawns patched')
