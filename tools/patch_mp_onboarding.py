
import io
p='src/onboarding.js'
s=io.open(p,encoding='utf-8').read()
old='''            setTimeout(function () {
              if (G.game.state === "playing" && !seen) guide.classList.add("on");
            }, 1400);'''
new='''            setTimeout(function () {
              var mpNow = false;
              try { mpNow = !!(window.__MP && window.__MP.state().active); } catch (err) {}
              if (G.game.state === "playing" && !seen && !mpNow) guide.classList.add("on");
            }, 1400);'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('onboarding mp guard')

p2='src/mp.js'
s2=io.open(p2,encoding='utf-8').read()
old2='''        active = true;
        try { if (typeof AudioExt !== "undefined") AudioExt.setMode("mp"); } catch (e) {}'''
new2='''        active = true;
        try { var gd = document.querySelector(".x-guide"); if (gd) gd.classList.remove("on"); var trs = document.querySelector(".x-train-step"); if (trs) trs.classList.remove("on"); } catch (e) {}
        try { if (typeof AudioExt !== "undefined") AudioExt.setMode("mp"); } catch (e) {}'''
assert s2.count(old2)==1
s2=s2.replace(old2,new2,1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('mp hides onboarding')
