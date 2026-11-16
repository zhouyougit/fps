
import io
p='src/game.js'
s=io.open(p,encoding='utf-8').read()
old='''      i.events.on("enemy:killed", (k) => {
        let ce =
          { gull: "机械飞鸥", hound: "机械猎犬" }[
            k && (k.type || (k.enemy && k.enemy.type))
          ] || "机械守卫";
        (fe = I.feed(`<b>${ce</b> 已摧毁`)), (le = i.time.frame);
      }),'''
new='''      i.events.on("enemy:killed", (k) => {
        let nameMap = {
          gull: "机械飞鸥", hound: "机械猎犬",
          drone: "自爆无人机", elite: "精英猎犬", boss: "港区主控",
        };
        let variant = k && k.enemy && k.enemy.variant;
        let ce =
          nameMap[variant] ||
          nameMap[k && (k.type || (k.enemy && k.enemy.type))] ||
          "机械守卫";
        (fe = I.feed(`<b>${ce</b> 已摧毁`)), (le = i.time.frame);
      }),'''
assert s.count(old)==1, s.count(old)
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('hud names patched')
