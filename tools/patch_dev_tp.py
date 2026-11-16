
import io
p='server/server.cjs'
s=io.open(p,encoding='utf-8').read()
old='''    case 'fire':
      handleFire(p, msg);
      break;'''
new='''    case 'fire':
      handleFire(p, msg);
      break;
    case 'dev':
      if (process.env.MP_DEV === '1') {
        if (msg.cmd === 'tp' && typeof msg.x === 'number' && typeof msg.z === 'number') {
          p.pos.x = clamp(msg.x, world.bounds.min.x + 0.5, world.bounds.max.x - 0.5);
          p.pos.z = clamp(msg.z, world.bounds.min.z + 0.5, world.bounds.max.z - 0.5);
          p.pos.y = world.groundHeight(p.pos.x, p.pos.z, 50) + 0.02;
          p.vel.x = p.vel.y = p.vel.z = 0;
          p.alive = true; p.hp = 100; p.armor = 50;
        }
      }
      break;'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('server dev tp added')

p2='src/mp.js'
s2=io.open(p2,encoding='utf-8').read()
old2='''      testFire: function (dir) { if (active && dir) send({ t: "fire", dir: dir, wpn: "pac9" }); },'''
new2='''      testFire: function (dir) { if (active && dir) send({ t: "fire", dir: dir, wpn: "pac9" }); },
      testTeleport: function (x, z) { if (active) send({ t: "dev", cmd: "tp", x: x, z: z }); },'''
assert s2.count(old2)==1
s2=s2.replace(old2,new2,1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('client dev tp added')

p3='server/fps-mp.service'
s3=io.open(p3,encoding='utf-8').read()
s3=s3.replace('Environment=MAP_FILE=/home/zhouyou/fps-net/map_boxes.json','Environment=MAP_FILE=/home/zhouyou/fps-net/map_boxes.json\nEnvironment=MP_DEV=1',1)
io.open(p3,'w',encoding='utf-8').write(s3)
print('unit dev env added')
