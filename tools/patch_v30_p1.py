
import io
p='src/mp.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

rep('''    var mpDead = false, scoreData = null, scoreVisible = false, myKills = 0, myDeaths = 0, myTeam = 0;''','''    var mpDead = false, scoreData = null, scoreVisible = false, myKills = 0, myDeaths = 0, myTeam = 0;
    var respawnAt = 0, streak = 0, protectShown = false, hitDirEl = null;''')
rep('''        ".x-mp-loading span{font:500 11px/1.4 var(--f-mono);letter-spacing:.14em;color:var(--steel);}"''','''        ".x-mp-loading span{font:500 11px/1.4 var(--f-mono);letter-spacing:.14em;color:var(--steel);}" +
        ".x-hit-dir{position:absolute;left:50%;top:50%;width:150px;height:150px;margin:-75px 0 0 -75px;pointer-events:none;opacity:0;z-index:60;}" +
        ".x-hit-dir.on{opacity:1;}" +
        ".x-hit-dir i{position:absolute;left:50%;top:2px;width:3px;height:22px;margin-left:-1px;background:linear-gradient(#ff5a5a,rgba(255,90,90,0));box-shadow:0 0 12px rgba(255,90,90,.8);}" +
        ".x-hit-dir::after{content:'';position:absolute;left:50%;top:0;width:0;height:0;margin-left:-7px;border-left:7px solid transparent;border-right:7px solid transparent;border-top:10px solid #ff5a5a;}"''')
rep('''      var roundUi = el("div", "x-mp-round",''','''      hitDirEl = el("div", "x-hit-dir", "<i></i>");
      document.getElementById("ui").appendChild(hitDirEl);
      var roundUi = el("div", "x-mp-round",''')
rep('''          '<div class="x-mp-sub">2–8 人 · 30Hz 权威服务器 · NUC 中转</div>' +''','''          '<div class="x-mp-sub">2–12 人 · 30Hz 权威服务器 · NUC 中转 · 大乱战 6v6</div>' +''')
rep('''      var tag = makeTagV2(p.name || "几猫", p.team);
      tag.sprite.position.y = 1.92; grp.add(tag.sprite);''','''      var tag = makeTagV2(p.name || "几猫", p.team);
      tag.sprite.position.y = 1.92; grp.add(tag.sprite);
      var shield = new T.Mesh(new T.SphereGeometry(1.08, 16, 10), new T.MeshBasicMaterial({ color: teamCol, transparent: true, opacity: 0.13, side: T.DoubleSide, depthWrite: false }));
      shield.position.y = 1.02; shield.visible = false; grp.add(shield);''')
rep('''      return { grp: grp, hips: hips, torso: torso, head: head, legL: legs[0], legR: legs[1], armL: arms[0], armR: arms[1], tag: tag.sprite, tagDraw: tag.draw, lastHp: -1 };''','''      return { grp: grp, hips: hips, torso: torso, head: head, legL: legs[0], legR: legs[1], armL: arms[0], armR: arms[1], tag: tag.sprite, tagDraw: tag.draw, shield: shield, lastHp: -1 };''')
rep('''      r.grp.visible = true;
      if (r.lastHp !== p.hp || r.dead !== (p.alive === false)) {''','''      r.grp.visible = true;
      r.shield.visible = !!p.spawnProtect && p.alive !== false;
      if (r.lastHp !== p.hp || r.dead !== (p.alive === false)) {''')
rep('''          if (typeof p.armor === "number") G.player.armor = p.armor;
            }''','''          if (typeof p.armor === "number") G.player.armor = p.armor;
              if (p.spawnProtect && !protectShown) { protectShown = true; try { G.hud.warn("出生保护 · 2 秒", 2); } catch (e) {} }
              if (!p.spawnProtect) protectShown = false;
            }''')
io.open(p,'w',encoding='utf-8').write(s)
print('part1 patched')
