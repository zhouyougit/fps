
import io
p='src/game.js'
s=io.open(p,encoding='utf-8').read()

old='''        i.events.emit("weapon:fire", {
          origin: Ie,
          dir: ze,
          muzzle: We,
          ads: k.adsE,
        });'''
new='''        i.events.emit("weapon:fire", {
          origin: Ie,
          dir: ze,
          muzzle: We,
          ads: k.adsE,
          weapon: cfg.id || "pac9",
        });'''
assert s.count(old)==1
s=s.replace(old,new,1)

old2='''    ln("weapon:fire", () => {
      (I = (I + 1) & 3), ze("rifle_shot", { variant: I, gain: 1, jitter: 0.012 });'''
new2='''    ln("weapon:fire", (te) => {
      (I = (I + 1) & 3);
      let id = te && te.weapon;
      if (id === "breaker12") {
        ze("rifle_shot", { variant: I, gain: 1.1, jitter: 0.02, pitch: 0.7 });
        ze("explosion", { gain: 0.16, jitter: 0.1, pitch: 2.4, delay: 0.01 });
      } else if (id === "dmr") {
        ze("rifle_shot", { variant: I, gain: 1.05, jitter: 0.01, pitch: 1.08 });
      } else ze("rifle_shot", { variant: I, gain: 1, jitter: 0.012 });'''
assert s.count(old2)==1
s=s.replace(old2,new2,1)
io.open(p,'w',encoding='utf-8').write(s)
print('weapon audio patched')
