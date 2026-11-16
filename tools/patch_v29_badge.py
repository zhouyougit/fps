
import io
p='src/campaign.js'
s=io.open(p,encoding='utf-8').read()
old='''    var campActs = CAMP && CAMP.querySelector(".x-camp-actions");'''
new='''    var titleEl = document.querySelector(".m-title");
    if (titleEl && !titleEl.querySelector(".m-ver")) {
      var ver = document.createElement("div");
      ver.className = "m-ver";
      ver.textContent = "V29 · 发布版";
      titleEl.appendChild(ver);
    }
    var campActs = CAMP && CAMP.querySelector(".x-camp-actions");'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('version badge added')

p2='src/ext.js'
s2=io.open(p2,encoding='utf-8').read()
old2='''      "body.hc .h-obj-t,body.hc .h-k,body.hc .h-health,body.hc .x-scan{color:#fff;}",'''
new2='''      "body.hc .h-obj-t,body.hc .h-k,body.hc .h-health,body.hc .x-scan{color:#fff;}",
      ".m-ver{position:absolute;right:calc(var(--gr) + 8px);bottom:calc(var(--gr) + 6px);font:500 9px/1.4 var(--f-mono);letter-spacing:.18em;color:var(--steel);opacity:.8;}",'''
assert s2.count(old2)==1
s2=s2.replace(old2,new2,1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('version css added')
