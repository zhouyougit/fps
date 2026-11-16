
import io
p='src/ext.js'
s=io.open(p,encoding='utf-8').read()
old='".x-camp-panel{position:relative;max-width:1080px;margin:0 auto;padding:7vh 5vw 6vh;max-height:100%;overflow:auto;}",'
new='".x-camp-panel{position:relative;max-width:1080px;margin:0 auto;padding:5vh 4vw 4vh;height:100%;display:flex;flex-direction:column;overflow:hidden;}",'
assert s.count(old)==1
s=s.replace(old,new,1)
old2='".x-camp-list{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;}",'
new2='".x-camp-list{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;flex:1 1 auto;min-height:0;overflow-y:auto;align-content:start;}",'
assert s.count(old2)==1
s=s.replace(old2,new2,1)
old3='".x-camp-actions{display:flex;gap:10px;margin-top:26px;}",'
new3='".x-camp-actions{display:flex;gap:10px;margin-top:18px;flex:0 0 auto;}",'
assert s.count(old3)==1
s=s.replace(old3,new3,1)
old4='      "@media(max-width:1180px){.x-camp-list{grid-template-columns:repeat(2,1fr);}}",'
new4='''      "@media(max-width:1180px){.x-camp-list{grid-template-columns:repeat(2,1fr);}}",
      "@media(max-height:760px){.x-camp-panel{padding:3vh 4vw 3vh;}.x-camp-h{font-size:30px;margin:4px 0 4px;}.x-camp-sub{margin-bottom:14px;}.x-mcard{min-height:0;padding:14px 16px;}.x-mcard h3{font-size:20px;margin:6px 0 2px;}.x-mcard p{display:none;}.x-camp-actions{margin-top:12px;}}",'''
assert s.count(old4)==1
s=s.replace(old4,new4,1)
io.open(p,'w',encoding='utf-8').write(s)
print('camp layout responsive fixed')

p2='tools/test_suite.mjs'
s2=io.open(p2,encoding='utf-8').read()
old5='''  const click = async (sel) => {
    const b = await page.locator(sel).first().boundingBox();
    if (!b) return false;
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    return true;
  };'''
new5='''  const click = async (sel) => {
    const loc = page.locator(sel).first();
    try { await loc.scrollIntoViewIfNeeded(); } catch (e) {}
    const b = await loc.boundingBox();
    if (!b) return false;
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    return true;
  };'''
n=s2.count(old5)
print('click helpers found', n)
s2=s2.replace(old5,new5)
io.open(p2,'w',encoding='utf-8').write(s2)
