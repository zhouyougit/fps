
import io
p='src/ext.js'
s=io.open(p,encoding='utf-8').read()
old='''      ".x-ar-actions{margin-top:18px;display:flex;justify-content:flex-end;}",'''
new='''      ".x-ar-actions{margin-top:18px;display:flex;justify-content:flex-end;}",
      "/* ---- V27 accessibility ---- */",
      ".hud{transform:scale(var(--hud-scale,1));transform-origin:50% 50%;}",
      ".comms-t{font-size:calc(15px * var(--sub-scale,1)) !important;line-height:1.5 !important;}",
      ".comms-who{font-size:calc(9px * var(--sub-scale,1)) !important;}",
      "body.hc .hud{text-shadow:0 2px 8px #000,0 0 2px #000;}",
      "body.hc .comms{background:rgba(0,0,0,.62);}",
      "body.hc .h-obj-t,body.hc .h-k,body.hc .h-health,body.hc .x-scan{color:#fff;}",'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('a11y css added')

p2='tools/test_suite.mjs'
s2=io.open(p2,encoding='utf-8').read()
s2=s2.replace("ok('V9 设置项扩展', hasRows === 3, 'segs=' + hasRows);","ok('V9 设置项扩展', hasRows >= 6, 'segs=' + hasRows);")
io.open(p2,'w',encoding='utf-8').write(s2)
print('suite segs updated')
