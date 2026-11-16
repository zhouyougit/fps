
import io
p='server/server.cjs'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

rep('''const MAX_PLAYERS = Math.max(2, Math.min(8, envNum('MAX_PLAYERS', 8)));''','''const MAX_PLAYERS = Math.max(2, Math.min(12, envNum('MAX_PLAYERS', 12)));''')
rep('''    this.spawn = s;''','''    this.spawn = s;
    this.spawnProtectUntil = Date.now() + 2000;''')
rep('''      onGround: !!this.onGround,
      seq: this.lastSeq,''','''      onGround: !!this.onGround,
      crouch: !!(this.input && this.input.crouch),
      sprinting: !!(this.input && this.input.sprint),
      spawnProtect: this.spawnProtectUntil > Date.now(),
      seq: this.lastSeq,''')
rep('''  p.alive = true;
  p.hp = 100;
  p.armor = 50;''','''  p.alive = true;
  p.hp = 100;
  p.armor = 50;
  p.spawnProtectUntil = Date.now() + 2000;''')
# friendly fire block add spawn protect
rep('''    if (q.id === p.id || !q.alive || q.team === p.team) continue;''','''    if (q.id === p.id || !q.alive || q.team === p.team || q.spawnProtectUntil > Date.now()) continue;''')
# hit message from
rep('''      t: 'hit', by: p.id, victim: hit.q.id, dmg: dmg, hs: hs, hp: hit.q.hp, armor: hit.q.armor,''','''      t: 'hit', by: p.id, victim: hit.q.id, dmg: dmg, hs: hs, hp: hit.q.hp, armor: hit.q.armor,
      from: [round3(p.pos.x), round3(p.pos.y), round3(p.pos.z)],''')
# room defaults large
rep('''    this.scoreLimit = 50;
    this.roundSeconds = 300;''','''    this.scoreLimit = 75;
    this.roundSeconds = 360;''')
io.open(p,'w',encoding='utf-8').write(s)
print('server v30 patched')

p2='server/fps-mp.service'
s2=io.open(p2,encoding='utf-8').read()
s2=s2.replace('Environment=MAX_PLAYERS=8','Environment=MAX_PLAYERS=12',1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('unit max12')
