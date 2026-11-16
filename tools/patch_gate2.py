
import io
p='src/game.js'
s=io.open(p,encoding='utf-8').read()
old='''          !window.__SX_PROFILE || window.__SX_PROFILE === "v5"
            ? defs.push({ cfg: DMR, build: buildDMR, short: "长眼" })
            : 0;'''
new='''          let prof = window.__SX_PROFILE || "v5";
          prof !== "v2" && prof !== "v3" && prof !== "v4"
            ? defs.push({ cfg: DMR, build: buildDMR, short: "长眼" })
            : 0;'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('dmr gating fixed for v6+')
