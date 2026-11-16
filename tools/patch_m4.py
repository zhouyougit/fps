
import io
p='src/campaign.js'
s=io.open(p,encoding='utf-8').read()
old='''      done: "码头封锁已解除"
    }
  ];'''
new='''      done: "码头封锁已解除"
    },
    {
      id: "m4", code: "04", name: "冷链仓库", sub: "05:12 · 拂晓 · 室内近战",
      desc: "信号钻进 B4-0271 冷链仓库。切断三处冷却中继，在装卸口撤离——看看低温里冻着什么。",
      locTitle: "几猫港区 · 冷链仓库", locSub: "B4-0271 · 低温货物区",
      goal: "切断冷库内三处冷却中继", extractText: "前往装卸口",
      map: "depot",
      relays: [
        { id: "depot_r1", label: "西侧冷却中继", zone: "depot" },
        { id: "depot_r2", label: "中央控制中继", zone: "depot" },
        { id: "depot_r3", label: "东侧货舱中继", zone: "depot" }
      ],
      extraction: { x: 0, z: -15.4, radius: 2.6 },
      start: { x: 0, z: 13.6, yaw: 0 },
      waves: [{ hound: 2 }, { hound: 2, marksman: 1 }, { hound: 2, heavy: 1, marksman: 1 }],
      patrol: { hound: 1 }, maxAlive: 6, damageScale: 1.05, hpScale: 1.02,
      rain: 0, exposure: 0.92, saturation: 0.9, evac: 45, boss: false,
      env: { sun: [0.35, 0.8, 0.5], zen: [0.02, 0.025, 0.03], hor: [0.05, 0.055, 0.06], away: [0.02, 0.025, 0.03], col: [0.22, 0.2, 0.18], light: 0x9fb4c8, intensity: 0.6, exposure: 0.92, envIntensity: 0.7, rain: 0, saturation: 0.9 },
      challenges: { time: 300, head: 8 },
      speaker: "小队频道",
      threats: "机械猎犬 · 狙击猎犬 · 重装盾卫",
      recommend: "破门锤 / 突击步枪",
      brief: ["切断冷链仓库三处冷却中继", "在装卸口坚守 45 秒", "从装卸口撤离"],
      intro: "信号钻进了冷库。三个冷却中继维持着 B4-0271 的低温——切断它们，看看里面到底冻着什么。",
      all: "冷库中继全部离线！装卸口正在封门，坚守 45 秒！",
      done: "冷链仓库已恢复控制"
    }
  ];'''
assert s.count(old)==1
s=s.replace(old,new,1)

# applyMission map branch + start guard
old2='''    camp.current = idx;
    setRelays(m.relays.map(function (r) { return r.id; }));
    G.level.objectives = m.relays.map(function (r) {
      var p = relayPool[r.id];
      return { id: "relay_" + r.id, label: r.label, zone: r.zone || "yard", pos: p.pos, object: p.object };
    });'''
new2='''    camp.current = idx;
    if (m.map && typeof MapKit !== "undefined" && MapKit.current() !== m.map) {
      MapKit.load(m.map);
    }
    if (m.map === "depot") {
      var dr = MapKit.relays("depot") || {};
      Object.keys(dr).forEach(function (id) { dr[id].object.visible = false; });
      G.level.objectives = m.relays.map(function (r) {
        var d = dr[r.id];
        if (!d) return null;
        d.object.visible = true;
        return { id: "relay_" + r.id, label: r.label || d.label, zone: "depot", pos: d.pos, object: d.object };
      }).filter(Boolean);
    } else {
      setRelays(m.relays.map(function (r) { return r.id; }));
      G.level.objectives = m.relays.map(function (r) {
        var p = relayPool[r.id];
        return { id: "relay_" + r.id, label: r.label, zone: r.zone || "yard", pos: p.pos, object: p.object };
      });
    }'''
assert s.count(old2)==1
s=s.replace(old2,new2,1)

# extraction ground height 2.5
s=s.replace("var ey = G.physics.groundHeight(m.extraction.x, m.extraction.z, 10);","var ey = G.physics.groundHeight(m.extraction.x, m.extraction.z, 2.5);",1)

# start guard for depot
old3='''    try {
      if (!G.level.__origStart) G.level.__origStart = { pos: G.level.playerStart.pos.clone(), yaw: G.level.playerStart.yaw };
      var st = m.start || G.level.__origStart;'''
new3='''    try {
      if (!m.map || m.map === "harbor") {
      if (!G.level.__origStart) G.level.__origStart = { pos: G.level.playerStart.pos.clone(), yaw: G.level.playerStart.yaw };
      var st = m.start || G.level.__origStart;'''
assert s.count(old3)==1
s=s.replace(old3,new3,1)
old4='''      G.level.playerStart = { pos: new G.THREE.Vector3(sx, sy, sz), yaw: syaw };
    } catch (e) {}'''
new4='''      G.level.playerStart = { pos: new G.THREE.Vector3(sx, sy, sz), yaw: syaw };
      }
    } catch (e) {}'''
assert s.count(old4)==1
s=s.replace(old4,new4,1)

# training ensures harbor
p2='src/training.js'
s2=io.open(p2,encoding='utf-8').read()
old5='''  function launchTraining() {'''
new5='''  function launchTraining() {
    try { if (typeof MapKit !== "undefined" && MapKit.current() !== "harbor") MapKit.load("harbor"); } catch (e) {}'''
assert s2.count(old5)==1
s2=s2.replace(old5,new5,1)
io.open(p2,'w',encoding='utf-8').write(s2)

# MapKit: no probe / debug no onLevelReady
p3='src/mapkit.js'
s3=io.open(p3,encoding='utf-8').read()
s3=s3.replace('''      if (!depotProbeDone) {
        depotProbeDone = true;
        try { G.render.captureInteriorProbe(); } catch (e) {}
      }
''','')
io.open(p3,'w',encoding='utf-8').write(s3)
p4='src/ext.js'
s4=io.open(p4,encoding='utf-8').read()
s4=s4.replace("switchMap: function (id) { var r = MapKit.load(id); if (r) { try { G.render.onLevelReady(); } catch (e) {} } return r; },","switchMap: function (id) { return MapKit.load(id); },",1)
io.open(p4,'w',encoding='utf-8').write(s4)
print('m4 + map integration patched')
