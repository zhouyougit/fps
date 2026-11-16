
import { chromium } from 'playwright';
import { PW_ARGS } from './pwargs.mjs';
const b = await chromium.launch({ headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: PW_ARGS });
const p = await b.newPage({ viewport:{width:1000,height:560} });
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
let fails=0; const ok=(n,c,d)=>{ if(!c)fails++; console.log((c?'PASS':'FAIL')+' · '+n+(d!==undefined?' — '+JSON.stringify(d):'')); };
await p.goto('file:///Users/zhouyou/codex_workspace/fps/versions/几猫_V35.html?q=low&noaudio=1',{waitUntil:'load',timeout:240000});
await p.waitForFunction(()=>window.__ready===true&&window.__SX_LANG,null,{timeout:420000});
await p.waitForTimeout(1000);
const zh=await p.evaluate(()=>({lang:document.documentElement.lang,word:(document.querySelector('.m-word')||{}).textContent,missing:window.__SX_LANG.missing(),n:window.__SX_LANG.state&&window.__SX_LANG.state().keys}));
ok('中文默认 + 词典完整', !!zh.word && (zh.missing||[]).length<5, zh);
const en=await p.evaluate(()=>{ window.__SX_LANG.set('en'); return {lang:document.documentElement.lang,word:(document.querySelector('.m-word')||{}).textContent,stored:localStorage.getItem('saltline.lang')}; });
ok('切英文即时生效并持久化', en.lang==='en' && en.word && en.word!==zh.word && en.stored==='en', en);
const back=await p.evaluate(()=>{ window.__SX_LANG.set('zh-CN'); return {lang:document.documentElement.lang,word:(document.querySelector('.m-word')||{}).textContent}; });
ok('切回中文恢复', back.lang.indexOf('zh')===0 && back.word===zh.word, back);
const cb=await p.evaluate(()=>{
  const api=window.__SX_UI2;
  const has=!!(api && typeof api.setColorblind==='function');
  let err=null;
  if(has){ try{ api.setColorblind('rg'); }catch(e){ err=String((e&&e.message)||e); } }
  return {has,err,after:document.body.className};
});
// 不恒真：setColorblind 未暴露 / 调用抛错 / body 没有 sx-cb-rg / 刷新后丢失，都算 FAIL。
const hasRg=(cls)=>/(^|\s)sx-cb-rg(\s|$)/.test(String(cls||''));
let persisted=null;
if(cb.has && !cb.err){
  await p.reload({waitUntil:'load',timeout:240000});
  await p.waitForFunction(()=>window.__ready===true&&window.__SX_LANG,null,{timeout:420000});
  await p.waitForTimeout(1000);
  persisted=await p.evaluate(()=>({cls:document.body.className,state:window.__SX_UI2&&window.__SX_UI2.state?window.__SX_UI2.state():null}));
}
ok('色盲主题可切换并持久化', cb.has && !cb.err && hasRg(cb.after) && !!persisted && hasRg(persisted.cls), {cb,persisted});
ok('无 pageerror', errs.length===0, errs.slice(0,3));
console.log(fails?fails+' 项失败':'全部通过');
try{ await Promise.race([b.close(),new Promise(r=>setTimeout(r,3000))]); }catch(e){}
process.exit(fails?1:0);
