
import io
p='tools/test_v12.mjs'
s=io.open(p,encoding='utf-8').read()
old='''  await page.waitForTimeout(3200);
  await page.evaluate(()=>{ const G=window.__G; G.player.pos.set(10,0,22); G.player.yaw=0; G.player.pitch=0.05; });'''
new='''  await page.waitForTimeout(1200);
  const sp = await page.evaluate(()=>({pos:window.__G.player.pos.toArray().map(v=>+v.toFixed(2)), yaw:+window.__G.player.yaw.toFixed(2)}));
  console.log('spawn', i, JSON.stringify(sp));
  await page.waitForTimeout(2000);
  await page.evaluate(()=>{ const G=window.__G; G.player.pos.set(10,0,22); G.player.yaw=0; G.player.pitch=0.05; });'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('test updated')
