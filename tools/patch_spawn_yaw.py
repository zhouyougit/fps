
import io
p='server/export_maps.mjs'
s=io.open(p,encoding='utf-8').read()
s=s.replace("{id:'harbor', idx:0, bases:[{x:-32,z:6},{x:29,z:20}]}","{id:'harbor', idx:0, bases:[{x:-32,z:6,yaw:-1.57},{x:29,z:20,yaw:1.57}]}")
s=s.replace("{id:'depot', idx:3, bases:[{x:0,z:13.6},{x:0,z:-14.2}]}","{id:'depot', idx:3, bases:[{x:0,z:13.6,yaw:0},{x:0,z:-14.2,yaw:Math.PI}]}")
s=s.replace("{id:'ship', idx:4, bases:[{x:0,z:5.2},{x:0,z:-8.4}]}","{id:'ship', idx:4, bases:[{x:0,z:5.2,yaw:0},{x:0,z:-8.4,yaw:Math.PI}]}")
io.open(p,'w',encoding='utf-8').write(s)
print('export bases yaw patched')

p2='server/server.cjs'
s2=io.open(p2,encoding='utf-8').read()
old="""  if (!best) {
    const gy = room.world.groundHeight(fallback.x, fallback.z, 3);
    return { x: fallback.x, y: gy + 0.02, z: fallback.z, yaw: Math.random() * Math.PI * 2 };
  }
  return { x: best.x + (Math.random() - 0.5) * 0.3, y: best.y + 0.02, z: best.z + (Math.random() - 0.5) * 0.3, yaw: Math.random() * Math.PI * 2 };"""
new="""  const yaw = fallback && typeof fallback.yaw === 'number' ? fallback.yaw : 0;
  if (!best) {
    const gy = room.world.groundHeight(fallback.x, fallback.z, 3);
    return { x: fallback.x, y: gy + 0.02, z: fallback.z, yaw };
  }
  return { x: best.x + (Math.random() - 0.5) * 0.3, y: best.y + 0.02, z: best.z + (Math.random() - 0.5) * 0.3, yaw };"""
assert s2.count(old)==1
s2=s2.replace(old,new,1)
# reset broadcasts respawn
old2="""  for (const p of room.players.values()) {
    p.kills = 0;
    p.deaths = 0;
    respawn(p);
  }
  room.broadcast({ t: 'roundStart', teams: [0, 0], mapId: room.mapId });"""
new2="""  for (const p of room.players.values()) {
    p.kills = 0;
    p.deaths = 0;
    respawn(p);
    room.broadcast({ t: 'respawn', id: p.id, x: round3(p.pos.x), y: round3(p.pos.y), z: round3(p.pos.z), yaw: round3(p.yaw), hp: 100, armor: 50 });
  }
  room.broadcast({ t: 'roundStart', teams: [0, 0], mapId: room.mapId });"""
assert s2.count(old2)==1
s2=s2.replace(old2,new2,1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('server spawn yaw/reset patched')
