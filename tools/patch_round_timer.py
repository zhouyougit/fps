
import io
p='server/server.cjs'
s=io.open(p,encoding='utf-8').read()
old='''  room.players.set(p.id, p);
  ctx.player = p;'''
new='''  room.players.set(p.id, p);
  if (room.size === 1) { room.roundStart = Date.now(); room.roundOver = false; }
  ctx.player = p;'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('server round start patched')

p2='src/mp.js'
s2=io.open(p2,encoding='utf-8').read()
s2=s2.replace('''s2placeholder''','''s2placeholder''') if False else None
s2=s2.replace('''<span data-mp-count>0 在线</span><span class="kd" data-mp-kd>0K / 0D</span><span data-mp-ping>-- ms</span>''','''<span data-mp-count>0 在线</span><span class="kd" data-mp-kd>0K / 0D</span><span data-mp-time>5:00</span><span data-mp-ping>-- ms</span>''',1)
old2='''        var kd = hud.querySelector("[data-mp-kd]");
        if (kd) kd.textContent = myKills + "K / " + myDeaths + "D";'''
new2='''        var kd = hud.querySelector("[data-mp-kd]");
        if (kd) kd.textContent = myKills + "K / " + myDeaths + "D";
        var tm = hud.querySelector("[data-mp-time]");
        if (tm && typeof m.timeLeft === "number") tm.textContent = Math.floor(m.timeLeft / 60) + ":" + String(m.timeLeft % 60).padStart(2, "0");'''
assert s2.count(old2)==1
s2=s2.replace(old2,new2,1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('mp timer patched')
