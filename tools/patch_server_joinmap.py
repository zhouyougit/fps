
import io
p='server/server.cjs'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

rep('''  const roomId = sanitizeRoom(msg.room);
  let room = rooms.get(roomId);
  if (!room) {
    room = new Room(roomId);
    rooms.set(roomId, room);
  }''','''  const roomId = sanitizeRoom(msg.room);
  const mapId = MAPS[msg.map] ? msg.map : 'harbor';
  const roomKey = roomId + '@' + mapId;
  let room = rooms.get(roomKey);
  if (!room) {
    room = new Room(roomKey, mapId);
    rooms.set(roomKey, room);
  }''')
rep('''  const spawn = spawnForRoom(room, team);
  const p = new Player(ws, room, name, spawnCounter++ + room.size, team);
  p.spawn = spawn;
  p.pos.x = spawn.x; p.pos.y = spawn.y; p.pos.z = spawn.z;
  p.yaw = spawn.yaw || 0;''','''  const spawn = spawnForRoom(room, team);
  const p = new Player(ws, room, name, spawnCounter++ + room.size, team, spawn);''')
rep('''    room: room.id,
    tick,
    tickRate: TICK_HZ,
    team,''','''    room: roomId,
    mapId,
    tick,
    tickRate: TICK_HZ,
    team,''')
rep('''    map: {
      boxes: world.boxes.length,
      bounds: world.bounds,
      spawn: p.spawn,
      seaY: world.seaY,
    },''','''    map: {
      boxes: room.world.boxes.length,
      bounds: room.world.bounds,
      spawn: p.spawn,
      seaY: room.world.seaY,
    },''')
rep('''  console.log(
    '[join] ' + p.name + ' ' + p.id + ' room=' + room.id + ' players=' + room.size + ' from ' + ctx.ip
  );''','''  console.log(
    '[join] ' + p.name + ' ' + p.id + ' room=' + room.id + ' map=' + mapId + ' players=' + room.size + ' from ' + ctx.ip
  );''')
io.open(p,'w',encoding='utf-8').write(s)
print('server join map patched')
