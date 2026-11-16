
import io
p='src/mp.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

# state vars
rep('''    var mpDead = false, scoreData = null, scoreVisible = false, myKills = 0, myDeaths = 0, myTeam = 0;''','''    var mpDead = false, scoreData = null, scoreVisible = false, myKills = 0, myDeaths = 0, myTeam = 0;
    var respawnAt = 0, streak = 0, protectShown = false, hitDirEl = null;''')

# CSS
rep('''        ".x-mp-loading span{font:500 11px/1.4 var(--f-mono);letter-spacing:.14em;color:var(--steel);}"''','''        ".x-mp-loading span{font:500 11px/1.4 var(--f-mono);letter-spacing:.14em;color:var(--steel);}" +
        ".x-hit-dir{position:absolute;left:50%;top:50%;width:150px;height:150px;margin:-75px 0 0 -75px;pointer-events:none;opacity:0;z-index:60;}" +
        ".x-hit-dir.on{opacity:1;}" +
        ".x-hit-dir i{position:absolute;left:50%;top:2px;width:3px;height:22px;margin-left:-1px;background:linear-gradient(#ff5a5a,rgba(255,90,90,0));box-shadow:0 0 12px rgba(255,90,90,.8);}" +
        ".x-hit-dir::after{content:'';position:absolute;left:50%;top:0;width:0;height:0;margin-left:-7px;border-left:7px solid transparent;border-right:7px solid transparent;border-top:10px solid #ff5a5a;}"''')

# build hit dir after HUD creation in buildUI? use init after hud built
rep('''      var roundUi = el("div", "x-mp-round",''','''      hitDirEl = el("div", "x-hit-dir", "<i></i>");
      document.getElementById("ui").appendChild(hitDirEl);
      var roundUi = el("div", "x-mp-round",''')

# lobby subtitle
rep('''<p class="x-mp-sub">2–8 人 · 30Hz 权威服务器 · NUC 中转</p>''','''<p class="x-mp-sub">2–12 人 · 30Hz 权威服务器 · NUC 中转 · 大乱战 6v6</p>''')

# shield in model
rep('''      var tag = makeTagV2(p.name || "几猫", p.team);
      tag.sprite.position.y = 1.92; grp.add(tag.sprite);''','''      var tag = makeTagV2(p.name || "几猫", p.team);
      tag.sprite.position.y = 1.92; grp.add(tag.sprite);
      var shield = new T.Mesh(new T.SphereGeometry(1.08, 16, 10), new T.MeshBasicMaterial({ color: teamCol, transparent: true, opacity: 0.13, side: T.DoubleSide, depthWrite: false }));
      shield.position.y = 1.02; shield.visible = false; grp.add(shield);''')
rep('''      var tag = makeTagV2(p.name || "几猫", p.team);
      tag.sprite.position.y = 1.92; grp.add(tag.sprite);
      var shield''','''      var tag = makeTagV2(p.name || "几猫", p.team);
      tag.sprite.position.y = 1.92; grp.add(tag.sprite);
      var shield''') if False else None
rep('''      return { grp: grp, hips: hips, torso: torso, head: head, legL: legs[0], legR: legs[1], armL: arms[0], armR: arms[1], tag: tag.sprite, tagDraw: tag.draw, lastHp: -1 };''','''      return { grp: grp, hips: hips, torso: torso, head: head, legL: legs[0], legR: legs[1], armL: arms[0], armR: arms[1], tag: tag.sprite, tagDraw: tag.draw, shield: shield, lastHp: -1 };''')
rep('''      r.grp.visible = true;
      if (r.lastHp !== p.hp || r.dead !== (p.alive === false)) {''','''      r.grp.visible = true;
      r.shield.visible = !!p.spawnProtect && p.alive !== false;
      if (r.lastHp !== p.hp || r.dead !== (p.alive === false)) {''')

# self spawn protection message
rep('''          if (typeof p.armor === "number") G.player.armor = p.armor;
            }''','''          if (typeof p.armor === "number") G.player.armor = p.armor;
              if (p.spawnProtect && !protectShown) { protectShown = true; try { G.hud.warn("出生保护 · 2 秒", 2); } catch (e) {} }
              if (!p.spawnProtect) protectShown = false;
            }''')

# hit direction on victim
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

# killstreak
rep('''        if (m.by === selfId) { myKills++; try { G.audio.play("objective_done", { gain: 0.4, pitch: 1.25 }); } catch (e) {} }
        if (m.victim === selfId) { myDeaths++; try { G.audio.play("death", { gain: 0.6 }); } catch (e) {} die(m.byName || "对手"); }''','''        if (m.by === selfId) {
          myKills++; streak++;
          try { G.audio.play("objective_done", { gain: 0.4, pitch: 1.25 }); } catch (e) {}
          var names = { 2: "双杀", 3: "三杀", 4: "四杀", 5: "五杀" };
          if (names[streak]) try { G.hud.warn(names[streak] + " · 连杀 " + streak, 2.2); } catch (e) {}
        }
        if (m.victim === selfId) { myDeaths++; streak = 0; protectShown = false; try { G.audio.play("death", { gain: 0.6 }); } catch (e) {} die(m.byName || "对手"); }''')

# die respawn
rep('''      deadUi.querySelector(".s").textContent = (killer ? "被 " + killer + " 击倒 · " : "") + "3 秒后重生";''','''      respawnAt = performance.now() + 3000;
      deadUi.querySelector(".s").textContent = (killer ? "被 " + killer + " 击倒 · " : "") + "3 秒后重生";''')

# frame countdown
rep('''      hud.querySelector("[data-mp-ping]").textContent = (pingMs ? pingMs : "--") + " ms";''','''      hud.querySelector("[data-mp-ping]").textContent = (pingMs ? pingMs : "--") + " ms";
      if (mpDead && respawnAt) {
        var left = Math.max(0, Math.ceil((respawnAt - performance.now()) / 1000));
        var ds = deadUi.querySelector(".s");
        if (ds) ds.textContent = left > 0 ? left + " 秒后重生" : "即将重生";
      }''')
io.open(p,'w',encoding='utf-8').write(s)
print('client v30 feedback patched')
