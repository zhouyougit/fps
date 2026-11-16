
import io
p='tools/test_v13.mjs'
s=io.open(p,encoding='utf-8').read()
s=s.replace("await page.waitForTimeout(3000);\nconst done = await page.evaluate(()=>({","await page.waitForTimeout(3000);\nawait page.evaluate(()=>window.__SX.openMissions());\nawait page.waitForTimeout(400);\nconst done = await page.evaluate(()=>({",1)
s=s.replace("card:document.querySelector('.x-mcard[data-idx=\"1\"] .x-mchal')","card:(document.querySelector('.x-mcard[data-idx=\"1\"] .x-mchal')||{}).textContent",1)
s=s.replace("ok('V13 行动卡挑战进度', !!done.card && done.card.textContent==='挑战 3/3', done.card&&done.card.textContent);","ok('V13 行动卡挑战进度', done.card==='挑战 3/3', done.card);",1)
io.open(p,'w',encoding='utf-8').write(s)
print('patched card')
