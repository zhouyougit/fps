
import io
p='src/campaign.js'
s=io.open(p,encoding='utf-8').read()
old='''      done: "冷链仓库已恢复控制"
    }
  ];'''
new='''      done: "冷链仓库已恢复控制"
    },
    {
      id: "m5", code: "05", name: "外锚地", sub: "暴雨夜 · 货轮甲板",
      desc: "货单上的“活体”在几猫远洋上。登上外锚地的货轮甲板，切断三处船上中继，打开 7 号货舱。",
      locTitle: "几猫远洋 · 外锚地", locSub: "B4-0271 · 7 号货舱",
      goal: "切断货轮三处中继", extractText: "前往船首撤离",
      map: "ship",
      relays: [
        { id: "ship_r1", label: "系泊绞车中继", zone: "ship" },
        { id: "ship_r2", label: "货舱门中继", zone: "ship" },
        { id: "ship_r3", label: "驾驶台中继", zone: "ship" }
      ],
      extraction: { x: 0, z: -8.4, radius: 2.4 },
      start: { x: 0, z: 5.2, yaw: 0 },
      waves: [{ hound: 2, marksman: 1 }, { hound: 2, heavy: 1, marksman: 1 }, { hound: 3, heavy: 2, marksman: 2 }],
      patrol: { hound: 1 }, maxAlive: 7, damageScale: 1.1, hpScale: 1.08,
      rain: 1, exposure: 0.84, saturation: 0.86, evac: 45, boss: false,
      env: { sun: [0.2, 0.16, 0.9], zen: [0.018, 0.025, 0.04], hor: [0.12, 0.16, 0.22], away: [0.05, 0.07, 0.1], col: [0.35, 0.4, 0.55], light: 0x9fb4c8, intensity: 2.6, exposure: 0.84, envIntensity: 1.3, rain: 1, saturation: 0.86 },
      challenges: { time: 420, head: 9 },
      speaker: "舵手",
      threats: "机械猎犬 · 狙击猎犬 · 重装盾卫",
      recommend: "精确射手 / 破门锤",
      brief: ["登上几猫远洋甲板", "切断三处船上中继", "在船首撤离"],
      intro: "舵手把船停在探照灯照不到的地方。货单上的“活体”在七号货舱里——切断三处船上中继，别让这艘船离港。",
      all: "三处船上中继全部断开！船首撤离点正在暴露，坚守 45 秒！",
      done: "外锚地已控制"
    }
  ];'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('mission 5 added')
