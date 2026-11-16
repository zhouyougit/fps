
import io
p='src/training.js'
s=io.open(p,encoding='utf-8').read()
old='''    S.training = {
      active: true, t: TRAINING.duration, score: 0, kills: 0, head: 0,
      spawnT: 0, refillT: 0, startShots: (G.combat && G.combat.stats.shots) || 0
    };'''
new='''    S.training = {
      active: true, t: TRAINING.duration, score: 0, kills: 0, head: 0,
      spawnT: 0, refillT: 0, startShots: (G.combat && G.combat.stats.shots) || 0
    };
    try { G.events.emit("sx:training-start", {}); } catch (e) {}'''
assert s.count(old)==1
s=s.replace(old,new,1)
# finish
old2='''  function finishTraining() {'''
new2='''  function finishTraining() {
    try { G.events.emit("sx:training-end", {}); } catch (e) {}'''
assert s.count(old2)==1
s=s.replace(old2,new2,1)
io.open(p,'w',encoding='utf-8').write(s)
print('training events added')

p2='src/onboarding.js'
s2=io.open(p2,encoding='utf-8').read()
old3='''      G.events.on("game:state", function (e) {'''
new3='''      G.events.on("sx:training-start", function () {
        trainingOn = true;
        guide.classList.remove("on");
        tracker.classList.add("on");
        resetTraining();
      });
      G.events.on("sx:training-end", function () {
        trainingOn = false;
        tracker.classList.remove("on");
      });
      G.events.on("game:state", function (e) {'''
assert s2.count(old3)==1
s2=s2.replace(old3,new3,1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('onboarding training events wired')
