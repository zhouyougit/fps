
import io
p='src/game.js'
s=io.open(p,encoding='utf-8').read()
if '/*__WEAPON_EXT__*/' not in s:
    anchor='  async function PC(i) {'
    assert s.count(anchor)==1
    s=s.replace(anchor,'  /*__WEAPON_EXT__*/\n\n'+anchor,1)
old='br(Xv, { create: () => dm, showcase: () => PC });'
new='br(Xv, { create: () => dm, showcase: () => PC, inventory: () => inventory });'
assert s.count(old)==1
s=s.replace(old,new,1)
old2='        await r("weapon", "weapon", () => dm(t)),'
new2='''        await r("weapon", "weapon", () =>
          inventory(t, [
            { cfg: { ...mi, id: "pac9", short: "九式" }, build: w_ },
            { cfg: SHOTGUN, build: w2, short: "破门锤" },
          ]),
        ),'''
assert s.count(old2)==1, s.count(old2)
s=s.replace(old2,new2,1)
io.open(p,'w',encoding='utf-8').write(s)
print('inserted weapon ext markers and boot')
