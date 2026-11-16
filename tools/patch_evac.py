
import io
p='src/game.js'
s=io.open(p,encoding='utf-8').read()

def rep(old,new,count=1):
    global s
    assert s.count(old)==count, (s.count(old), old[:80])
    s=s.replace(old,new,count)

rep('        extractHint: 0,\n        intensity: 0.15,','        extractHint: 0,\n        evacT: 0,\n        intensity: 0.15,')
rep('        (c.extractHint = 0),\n        c.used.clear(),','        (c.extractHint = 0),\n        (c.evacT = 0),\n        c.used.clear(),')

rep('    function D() {\n      if (c.allCut) return "前往撤离艇";',
'''    function D() {
      let mission = _.currentMission || {};
      if (c.allCut)
        return c.evacT > 0
          ? "坚守撤离窗口 · " + Math.ceil(c.evacT) + " 秒"
          : mission.extractText || "前往撤离艇";''')
rep('        ? "切断三处上行中继"','        ? mission.goal || "切断三处上行中继"')

rep('''          ? ((c.allCut = !0),
            (c.pursuitLeft = Yi.pursuitExtra),
            (c.pursuitT = 12),
            i.events.emit("objective:all", {}),
            o.radio && o.radio(_l.all, 4.5))''','''          ? ((c.allCut = !0),
            (c.evacT = (_.currentMission && +_.currentMission.evac) || 0),
            (c.pursuitLeft = Yi.pursuitExtra),
            (c.pursuitT = 12),
            i.events.emit("objective:all", {}),
            o.radio &&
              o.radio((_.currentMission && _.currentMission.all) || _l.all, 4.5))''')

rep('''        Z && c.allCut && n.alive
          ? ee()
          : Z &&
            !c.allCut &&
            c.extractHint <= 0 &&
            ((c.extractHint = 8),
            o.message("中继尚未断开，撤离艇无法在火力下接应", 3.5)),''','''        Z && c.allCut && n.alive && c.evacT <= 0
          ? ee()
          : Z &&
            c.allCut &&
            c.evacT > 0 &&
            c.extractHint <= 0
            ? ((c.extractHint = 5),
              o.message("撤离窗口尚未打开，坚守阵地", 3))
            : Z &&
              !c.allCut &&
              c.extractHint <= 0 &&
              ((c.extractHint = 8),
              o.message("中继尚未断开，撤离艇无法在火力下接应", 3.5)),''')

rep('''      c.allCut &&
        s.extraction &&
        P.push({''','''      c.allCut &&
        c.evacT <= 0 &&
        s.extraction &&
        P.push({''')

rep('''          if ((ue(P), _.state !== "playing")) return !0;
          X(P),''','''          if ((ue(P), _.state !== "playing")) return !0;
          if (c.evacT > 0) {
            let prevSec = Math.ceil(c.evacT);
            c.evacT = Math.max(0, c.evacT - P);
            if (Math.ceil(c.evacT) !== prevSec || c.evacT <= 0) {
              if (c.evacT <= 0) {
                q();
                o.radio && o.radio("撤离窗口已打开！登船撤离！", 4);
                o.warn && o.warn("撤离窗口已打开", 3);
              }
              o.setObjective && o.setObjective(D());
            }
          }
          X(P),''')

io.open(p,'w',encoding='utf-8').write(s)
print('patched evac + mission objective text')
