
import io
p='src/ext.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

# grenade event
rep('''    S.grenades--;
    S.throwCd = 0.55;''','''    S.grenades--;
    S.throwCd = 0.55;
    try { G.events.emit("sx:grenade", {}); } catch (e) {}''')

# css
rep('''      "body.hc .h-obj-t,body.hc .h-k,body.hc .h-health,body.hc .x-scan{color:#fff;}",''','''      "body.hc .h-obj-t,body.hc .h-k,body.hc .h-health,body.hc .x-scan{color:#fff;}",
      "/* ---- V28 onboarding ---- */",
      ".x-guide{position:absolute;right:calc(var(--gr) + 6px);top:38%;z-index:64;display:none;pointer-events:auto;max-width:300px;padding:14px 16px;background:rgba(6,8,10,.82);border-left:2px solid var(--signal);font:500 11px/1.7 var(--f-label);color:var(--bone-dim);}",
      ".x-guide.on{display:block;}",
      ".x-guide>b{display:block;font:600 10px/1.4 var(--f-mono);letter-spacing:.14em;color:var(--signal);margin-bottom:8px;}",
      ".x-guide-row{margin:4px 0;}",
      ".x-guide kbd{display:inline-block;min-width:20px;padding:1px 4px;margin:0 2px;border:1px solid rgba(232,228,218,.3);font:600 9px/1.3 var(--f-mono);color:var(--bone);text-align:center;}",
      ".x-guide-actions{display:flex;gap:8px;margin-top:10px;}",
      ".x-train-step{position:absolute;right:calc(var(--gr) + 6px);top:32%;z-index:64;display:none;pointer-events:none;padding:12px 14px;background:rgba(6,8,10,.72);border-left:2px solid var(--signal);font:500 11px/1.8 var(--f-label);color:var(--steel);}",
      ".x-train-step.on{display:block;}",
      ".x-train-step b{display:block;font:600 10px/1.4 var(--f-mono);letter-spacing:.14em;color:var(--signal);margin-bottom:6px;}",
      ".x-train-step i{display:block;font-style:normal;}",
      ".x-train-step i em{font-style:normal;color:var(--bone-dim);}",
      ".x-train-step i.done{color:#9cff6a;}",
      ".x-train-step.done b{color:#9cff6a;}",''')

# marker and boot/update
rep('''  /*__AUDIO__*/''','''  /*__ONBOARD__*/

  /*__AUDIO__*/''')
rep('''    try { AudioExt.init(G); } catch (e) { console.error("[ext] audio ext init", e); }''','''    try { AudioExt.init(G); } catch (e) { console.error("[ext] audio ext init", e); }
    try { Onboarding.init(G); } catch (e) { console.error("[ext] onboarding init", e); }''')
io.open(p,'w',encoding='utf-8').write(s)
print('ext onboarding wired')

p2='tools/build.cjs'
s2=io.open(p2,encoding='utf-8').read()
s2=s2.replace("const audioExt = fs.readFileSync(path.join(root,'src','audio_ext.js'),'utf8');","const audioExt = fs.readFileSync(path.join(root,'src','audio_ext.js'),'utf8');\nconst onboarding = fs.readFileSync(path.join(root,'src','onboarding.js'),'utf8');",1)
s2=s2.replace("ext = ext.replace('/*__AUDIO__*/', audioExt);","ext = ext.replace('/*__ONBOARD__*/', onboarding);\n  if (!ext.includes('V28 · 首次出击')) throw new Error('onboarding marker missing');\n  ext = ext.replace('/*__AUDIO__*/', audioExt);",1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('build onboarding wired')
