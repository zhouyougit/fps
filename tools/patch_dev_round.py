
import io
p='server/server.cjs'
s=io.open(p,encoding='utf-8').read()
old='''        if (msg.cmd === 'tp' && typeof msg.x === 'number' && typeof msg.z === 'number') {'''
new='''        if (msg.cmd === 'round') {
          p.room.roundOver = true;
          p.room.roundOverAt = Date.now() + 1500;
          p.room.broadcast({ t: 'roundEnd', winnerTeam: 0, teams: p.room.teamKills.slice(), winner: { id: p.id, name: p.name, kills: p.kills } });
        }
        if (msg.cmd === 'tp' && typeof msg.x === 'number' && typeof msg.z === 'number') {'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('server dev round added')

p2='src/mp.js'
s2=io.open(p2,encoding='utf-8').read()
old2='''      testTeleport: function (x, z) { if (active) send({ t: "dev", cmd: "tp", x: x, z: z }); },'''
new2='''      testTeleport: function (x, z) { if (active) send({ t: "dev", cmd: "tp", x: x, z: z }); },
      testRound: function () { if (active) send({ t: "dev", cmd: "round" }); },'''
assert s2.count(old2)==1
s2=s2.replace(old2,new2,1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('client dev round added')
