
import io
p='src/ext.js'
s=io.open(p,encoding='utf-8').read()
old='''      ".x-camp-note{margin-top:16px;font:400 11px/1.6 var(--f-mono);color:var(--bone-faint);letter-spacing:.06em;}",'''
new='''      ".x-camp-note{margin-top:16px;font:400 11px/1.6 var(--f-mono);color:var(--bone-faint);letter-spacing:.06em;}",
      "/* ---- v4 boss ---- */",
      ".x-boss{position:absolute;left:50%;top:calc(88px + var(--sat));transform:translate(-50%,-10px);width:min(560px,72vw);opacity:0;transition:opacity .45s,transform .45s;text-align:center;pointer-events:none;}",
      ".x-boss.on{opacity:1;transform:translate(-50%,0);}",
      ".x-boss-k{font:700 12px/1 var(--f-label);letter-spacing:.34em;margin-right:-.34em;color:var(--signal);text-transform:uppercase;margin-bottom:9px;text-shadow:var(--shadow);}",
      ".x-boss-track{height:6px;background:rgba(232,228,218,.14);border:1px solid rgba(232,228,218,.22);}",
      ".x-boss-track i{display:block;height:100%;width:100%;background:linear-gradient(90deg,var(--rust),var(--signal));transform-origin:left center;transition:transform .1s linear;}",
      ".x-boss-pips{display:flex;gap:6px;justify-content:center;margin-top:7px;}",
      ".x-boss-pips em{width:20px;height:3px;background:rgba(232,228,218,.18);}",
      ".x-boss-pips em.on{background:var(--alarm);box-shadow:0 0 6px rgba(255,90,64,.5);}",'''
assert s.count(old)==1
s=s.replace(old,new,1)

old2='''    // HUD loadout
    var w = G.weapon;'''
new2='''    try { updateBoss(dt); } catch (e) { console.error("[ext] boss update", e); }

    // HUD loadout
    var w = G.weapon;'''
assert s.count(old2)==1
s=s.replace(old2,new2,1)
io.open(p,'w',encoding='utf-8').write(s)
print('boss css + update hooked')
