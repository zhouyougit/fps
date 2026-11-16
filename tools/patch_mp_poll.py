
import io
p='tools/test_mp.mjs'
s=io.open(p,encoding='utf-8').read()
old='''const seen = await pages[1].evaluate(() => {
  const d = window.__MP.debug();
  const h = d.hist[0] && d.hist[0].h[d.hist[0].h.length - 1];
  return { hist: h, remotes: window.__MP.remotes(), avatarKids: (() => { const g = window.__G.scene.children.find(o => o.type === 'Group' && o.children.length >= 8); return g ? g.children.length : 0; })() };
});'''
new='''let seen = null;
for (let i = 0; i < 16; i++) {
  seen = await pages[1].evaluate(() => {
    const d = window.__MP.debug();
    const h = d.hist[0] && d.hist[0].h[d.hist[0].h.length - 1];
    return { hist: h, remotes: window.__MP.remotes(), avatarKids: (() => { const g = window.__G.scene.children.find(o => o.type === 'Group' && o.children.length >= 8); return g ? g.children.length : 0; })() };
  });
  if (seen.hist && Math.hypot(seen.hist.x - p0[0], seen.hist.z - p0[2]) > 1.0) break;
  await new Promise(r => setTimeout(r, 700));
}'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('mp test polls remote')
