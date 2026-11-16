
import io
p='src/training.js'
s=io.open(p,encoding='utf-8').read()
old='''  function launchTraining() {
    if (!G || !G.game) return;'''
new='''  function launchTraining() {
    window.__TRAIN_LAUNCH = (window.__TRAIN_LAUNCH || 0) + 1;
    if (!G || !G.game) return;'''
assert s.count(old)==1
s=s.replace(old,new,1)
old2='''    res.querySelector('[data-x="again"]').addEventListener("click", function (e) {
      e.preventDefault();
      hideTrainingResult();
      launchTraining();
    });'''
new2='''    res.querySelector('[data-x="again"]').addEventListener("click", function (e) {
      e.preventDefault();
      window.__TRAIN_AGAIN_CLICK = (window.__TRAIN_AGAIN_CLICK || 0) + 1;
      hideTrainingResult();
      launchTraining();
    });'''
assert s.count(old2)==1
s=s.replace(old2,new2,1)
io.open(p,'w',encoding='utf-8').write(s)
print('training debug counters added')
