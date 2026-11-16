
import io
p='src/mp.js'
s=io.open(p,encoding='utf-8').read()
old='''<span data-mp-count>0 在线</span><span class="kd" data-mp-kd>0K / 0D</span><span data-mp-ping>-- ms</span>'''
new='''<span data-mp-count>0 在线</span><span class="kd" data-mp-kd>0K / 0D</span><span data-mp-time>5:00</span><span data-mp-ping>-- ms</span>'''
assert s.count(old)==1
s=s.replace(old,new,1)
old2='''        var kd = hud.querySelector("[data-mp-kd]");
        if (kd) kd.textContent = myKills + "K / " + myDeaths + "D";'''
new2='''        var kd = hud.querySelector("[data-mp-kd]");
        if (kd) kd.textContent = myKills + "K / " + myDeaths + "D";
        var tm = hud.querySelector("[data-mp-time]");
        if (tm && typeof m.timeLeft === "number") tm.textContent = Math.floor(m.timeLeft / 60) + ":" + String(m.timeLeft % 60).padStart(2, "0");'''
assert s.count(old2)==1
s=s.replace(old2,new2,1)
io.open(p,'w',encoding='utf-8').write(s)
print('mp timer patched')
