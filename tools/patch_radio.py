
import io
p='src/ext.js'
s=io.open(p,encoding='utf-8').read()
old='''    // 首次进入战斗的操作提示'''
new='''    // 任务专属无线电：覆盖引擎默认的开场/全断文案
    var baseRadio = G.hud.radio;
    G.hud.radio = function (text, secs) {
      var m = G.game.currentMission;
      if (m && typeof text === "string") {
        if (m.intro && text.indexOf("几猫队员，这里是指挥中心") === 0)
          return baseRadio.call(G.hud, m.intro, secs || 4.2);
        if (m.all && text.indexOf("三处中继全部断开") === 0)
          return baseRadio.call(G.hud, m.all, secs || 4.5);
      }
      return baseRadio.call(G.hud, text, secs);
    };

    // 首次进入战斗的操作提示'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('radio override added')
