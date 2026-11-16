
import io
p='tools/test_v11.mjs'
s=io.open(p,encoding='utf-8').read()
old="""console.log('launch', JSON.stringify(await page.evaluate(()=>({state:window.__G.game.state, mission:window.__G.game.currentMission.id, brief:document.querySelector('.x-brief').classList.contains('on'), camp:document.querySelector('.x-camp').classList.contains('on')}))));
// evac hold: cut all"""
new="""console.log('launch', JSON.stringify(await page.evaluate(()=>({state:window.__G.game.state, mission:window.__G.game.currentMission.id, brief:document.querySelector('.x-brief').classList.contains('on'), camp:document.querySelector('.x-camp').classList.contains('on')}))));
await page.evaluate(()=>window.__G.game.start({skipIntro:true}));
await page.waitForTimeout(2000);
console.log('stateAfterSkip', await page.evaluate(()=>window.__G.game.state));
// evac hold: cut all"""
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('inserted skip')
