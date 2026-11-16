
import io
p='src/mp.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

rep('''        if (m.victim === selfId) {
          var fp = m.point ? { x: m.point[0], y: m.point[1], z: m.point[2] } : null;
          try { G.events.emit("player:hit", { amount: m.dmg, fromPos: fp }); } catch (e) {}
        }''','''        if (m.victim === selfId) {
          var fp = m.point ? { x: m.point[0], y: m.point[1], z: m.point[2] } : null;
          try { G.events.emit("player:hit", { amount: m.dmg, fromPos: fp }); } catch (e) {}
          if (hitDirEl && m.from) {
            var dx = m.from[0] - G.player.pos.x, dz = m.from[2] - G.player.pos.z;
            var ang = Math.atan2(dx, -dz) - G.player.yaw;
            hitDirEl.style.transform = "rotate(" + ang.toFixed(3) + "rad)";
            hitDirEl.classList.add("on");
            clearTimeout(hitDirEl._t);
            hitDirEl._t = setTimeout(function () { hitDirEl.classList.remove("on"); }, 850);
          }
        }''')
rep('''        if (m.by === selfId) { myKills++; try { G.audio.play("objective_done", { gain: 0.4, pitch: 1.25 }); } catch (e) {} }
        if (m.victim === selfId) { myDeaths++; try { G.audio.play("death", { gain: 0.6 }); } catch (e) {} die(m.byName || "对手"); }''','''        if (m.by === selfId) {
          myKills++; streak++;
          try { G.audio.play("objective_done", { gain: 0.4, pitch: 1.25 }); } catch (e) {}
          var names = { 2: "双杀", 3: "三杀", 4: "四杀", 5: "五杀" };
          if (names[streak]) try { G.hud.warn(names[streak] + " · 连杀 " + streak, 2.2); } catch (e) {}
        }
        if (m.victim === selfId) { myDeaths++; streak = 0; protectShown = false; try { G.audio.play("death", { gain: 0.6 }); } catch (e) {} die(m.byName || "对手"); }''')
rep('''      deadUi.querySelector(".s").textContent = (killer ? "被 " + killer + " 击倒 · " : "") + "3 秒后重生";''','''      respawnAt = performance.now() + 3000;
      deadUi.querySelector(".s").textContent = (killer ? "被 " + killer + " 击倒 · " : "") + "3 秒后重生";''')
rep('''      hud.querySelector("[data-mp-ping]").textContent = (pingMs ? pingMs : "--") + " ms";''','''      hud.querySelector("[data-mp-ping]").textContent = (pingMs ? pingMs : "--") + " ms";
      if (mpDead && respawnAt) {
        var left = Math.max(0, Math.ceil((respawnAt - performance.now()) / 1000));
        var ds = deadUi.querySelector(".s");
        if (ds) ds.textContent = left > 0 ? left + " 秒后重生" : "即将重生";
      }''')
io.open(p,'w',encoding='utf-8').write(s)
print('part2 patched')
