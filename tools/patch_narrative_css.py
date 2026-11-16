
import io
p='src/ext.js'
s=io.open(p,encoding='utf-8').read()
old='''      ".x-end-choice{display:flex;gap:10px;margin:14px 0 4px;}",'''
new='''      ".x-end-choice{display:flex;gap:10px;margin:14px 0 4px;}",
      ".x-interlude{position:absolute;inset:0;z-index:77;display:none;pointer-events:auto;color:var(--bone);}",
      ".x-interlude.on{display:block;}",
      ".x-int-veil{position:absolute;inset:0;background:rgba(4,6,8,.94);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);}",
      ".x-int-card{position:relative;max-width:640px;margin:0 auto;top:50%;transform:translateY(-50%);padding:34px 38px;border-left:2px solid var(--signal);background:rgba(8,10,12,.9);}",
      ".x-int-card h2{font:900 40px/1.05 var(--f-display);letter-spacing:.14em;margin:6px 0 4px;}",
      ".x-int-card .sub{font:500 11px/1.5 var(--f-mono);letter-spacing:.12em;color:var(--steel);margin-bottom:20px;}",
      ".x-int-lines p{font:500 14px/1.9 var(--f-label);color:var(--bone-dim);margin:0 0 10px;max-width:52ch;}",
      ".x-int-card .btn{margin-top:18px;}",
      ".x-archive{position:absolute;inset:0;z-index:77;display:none;pointer-events:auto;color:var(--bone);}",
      ".x-archive.on{display:block;}",
      ".x-ar-veil{position:absolute;inset:0;background:rgba(4,6,8,.94);}",
      ".x-ar-panel{position:relative;max-width:680px;margin:0 auto;top:50%;transform:translateY(-50%);padding:28px 32px;border:1px solid rgba(232,228,218,.18);background:rgba(10,12,14,.92);}",
      ".x-ar-panel h2{font:900 34px/1.05 var(--f-display);letter-spacing:.16em;margin:4px 0;}",
      ".x-ar-sub{font:500 11px/1.5 var(--f-mono);letter-spacing:.12em;color:var(--steel);margin-bottom:14px;}",
      ".x-ar-row{display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:12px;align-items:center;padding:9px 0;border-top:1px solid rgba(232,228,218,.09);font:500 12px/1.4 var(--f-label);}",
      ".x-ar-row b{color:var(--bone);font-weight:600;}",
      ".x-ar-row span{font:500 10px/1.4 var(--f-mono);color:var(--steel);letter-spacing:.08em;}",
      ".x-ar-row em{font-style:normal;color:var(--signal);text-align:right;font-size:11px;}",
      ".x-ar-row.lock{opacity:.45;}",
      ".x-ar-final{margin-top:14px;padding:10px 12px;border-left:2px solid var(--signal);background:rgba(255,179,71,.06);font:500 11px/1.8 var(--f-label);color:var(--bone-dim);}",
      ".x-ar-actions{margin-top:18px;display:flex;justify-content:flex-end;}",'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('narrative css added')

p2='src/ext.js'
s2=io.open(p2,encoding='utf-8').read()
old2='''      validateObjectives: function () { return validateObjectives(); },'''
new2='''      validateObjectives: function () { return validateObjectives(); },
      interlude: function (a, b) { openInterlude(a, b); },
      archive: function () { openArchive(); },'''
assert s2.count(old2)==1
s2=s2.replace(old2,new2,1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('narrative debug added')
