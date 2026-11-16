
import io
p='src/onboarding.js'
s=io.open(p,encoding='utf-8').read()
old='''      G.events.on("game:state", function (e) {'''
new='''      setTimeout(function () {
        try {
          if (G.game.state === "playing" && !seen && !(S.training && S.training.active)) guide.classList.add("on");
        } catch (e) {}
      }, 1800);
      G.events.on("game:state", function (e) {'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('onboarding initial check added')
