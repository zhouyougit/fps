
import io
p='src/ext.js'
s=io.open(p,encoding='utf-8').read()
old='      "@media(max-width:820px){.x-camp-list{grid-template-columns:1fr;}.x-mcard{min-height:0;}}"'
new='''      "@media(max-width:1180px){.x-camp-list{grid-template-columns:repeat(2,1fr);}}",
      "@media(max-width:760px){.x-camp-list{grid-template-columns:1fr;}.x-mcard{min-height:0;}}",
      "/* ---- v7 training ---- */",
      ".x-train-card{border-style:dashed;}",
      ".x-train-card .code{color:#8fd8ff;}",
      ".x-train-hud{position:absolute;left:50%;top:calc(78px + var(--sat));transform:translate(-50%,-8px);text-align:center;opacity:0;transition:opacity .3s,transform .3s;pointer-events:none;}",
      ".x-train-hud.on{opacity:1;transform:translate(-50%,0);}",
      ".x-train-hud .k{font:600 10px/1 var(--f-label);letter-spacing:.34em;margin-right:-.34em;color:var(--signal);text-transform:uppercase;margin-bottom:7px;text-shadow:var(--shadow);}",
      ".x-train-hud .row{display:flex;align-items:baseline;justify-content:center;gap:8px;}",
      ".x-train-hud .t{font:700 30px/.9 var(--f-display);color:var(--bone);min-width:2.4em;text-align:right;font-variant-numeric:tabular-nums;text-shadow:var(--shadow);}",
      ".x-train-hud .s{font:700 30px/.9 var(--f-display);color:var(--signal);min-width:2em;text-align:left;font-variant-numeric:tabular-nums;text-shadow:var(--shadow);}",
      ".x-train-hud span{font:500 10px/1 var(--f-mono);color:var(--bone-dim);letter-spacing:.1em;}",
      ".x-train-result{position:absolute;inset:0;z-index:75;display:none;color:var(--bone);}",
      ".x-train-result.on{display:block;}",
      ".x-tr-veil{position:absolute;inset:0;background:rgba(5,7,9,.9);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px);}",
      ".x-tr-panel{position:relative;max-width:560px;margin:0 auto;top:50%;transform:translateY(-50%);padding:34px 38px 30px;border:1px solid rgba(232,228,218,.18);background:rgba(11,13,15,.75);text-align:left;}",
      ".x-tr-panel h2{font:900 40px/1.05 var(--f-display);letter-spacing:.12em;margin:8px 0 18px;}",
      ".x-tr-score{display:flex;align-items:baseline;gap:10px;margin-bottom:16px;}",
      ".x-tr-score b{font:700 64px/.85 var(--f-display);color:var(--signal);}",
      ".x-tr-score span{font:600 10px/1 var(--f-mono);letter-spacing:.24em;color:var(--bone-dim);}",
      ".x-tr-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px 20px;margin:0 0 22px;}",
      ".x-tr-stats div{display:flex;justify-content:space-between;border-bottom:1px solid rgba(232,228,218,.12);padding-bottom:6px;}",
      ".x-tr-stats dt{font:500 11px/1 var(--f-mono);letter-spacing:.1em;color:var(--steel);}",
      ".x-tr-stats dd{font:700 15px/1 var(--f-display);margin:0;}",
      ".x-tr-actions{display:flex;gap:10px;}",
      "@media(max-width:620px){.x-tr-panel{padding:24px;}.x-tr-panel h2{font-size:30px;}}"'''
assert s.count(old)==1
s=s.replace(old,new,1)
# grid 3 -> 4
oldg='".x-camp-list{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}"'
if s.count(oldg)==1:
    s=s.replace(oldg,'".x-camp-list{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;}"',1)
io.open(p,'w',encoding='utf-8').write(s)
print('css patched')
