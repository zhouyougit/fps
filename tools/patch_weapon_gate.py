
import io
p='src/game.js'
s=io.open(p,encoding='utf-8').read()
old='''        await r("weapon", "weapon", () =>
          inventory(t, [
            { cfg: { ...mi, id: "pac9", short: "九式" }, build: w_ },
            { cfg: SHOTGUN, build: buildShotgun, short: "破门锤" },
            { cfg: DMR, build: buildDMR, short: "长眼" },
          ]),
        ),'''
new='''        await r("weapon", "weapon", () => {
          let defs = [
            { cfg: { ...mi, id: "pac9", short: "九式" }, build: w_ },
            { cfg: SHOTGUN, build: buildShotgun, short: "破门锤" },
          ];
          !window.__SX_PROFILE || window.__SX_PROFILE === "v5"
            ? defs.push({ cfg: DMR, build: buildDMR, short: "长眼" })
            : 0;
          return inventory(t, defs);
        }),'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('weapon gating patched')
