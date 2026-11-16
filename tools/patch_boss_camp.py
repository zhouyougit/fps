
import io
p='src/campaign.js'
s=io.open(p,encoding='utf-8').read()
old='''      rain: 0.35, exposure: 1.08, saturation: 1.04, evac: 40,
      intro: "最后一班接驳将在四十秒后关闭。切断四处中继，然后守住撤离点。",
      all: "四处中继全部断开！撤离窗口开始计时，守住阵地！",
      done: "码头封锁已解除"'''
new='''      rain: 0.35, exposure: 1.08, saturation: 1.04, evac: 0, boss: true,
      intro: "最后一班接驳即将到港。切断四处中继——注意，港区主控还在码头上。",
      all: "四处中继全部断开！港区主控已启动，摧毁它的核心！",
      done: "码头封锁已解除"'''
assert s.count(old)==1
s=s.replace(old,new,1)
s=s.replace('''      waves: [{ gull: 2, hound: 2 }, { gull: 3, hound: 3 }, { gull: 3, hound: 4 }],''','''      waves: [{ gull: 2, hound: 2, drone: 1 }, { gull: 3, hound: 3, drone: 1 }, { gull: 3, hound: 4, drone: 2, elite: 1 }],''',1)
s=s.replace('''      waves: [{ gull: 4, hound: 2 }, { gull: 4, hound: 3 }, { gull: 5, hound: 4 }],''','''      waves: [{ gull: 3, hound: 2, drone: 2 }, { gull: 4, hound: 3, drone: 2, elite: 1 }, { gull: 4, hound: 3, drone: 3, elite: 2 }],''',1)
old2='''    G.events.on("game:state", function (e) {'''
new2='''    try { initBoss(); } catch (e) { console.error("[ext] boss init", e); }
    G.events.on("game:state", function (e) {'''
assert s.count(old2)==1
s=s.replace(old2,new2,1)
io.open(p,'w',encoding='utf-8').write(s)
print('campaign boss wiring patched')
