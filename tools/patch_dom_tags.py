
import io
p='src/mp.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

# remove canvas tag from model
rep('''      var tag = makeTagV2(p.name || "几猫", p.team);
      tag.sprite.position.y = 2.34; grp.add(tag.sprite);
      var shield = new T.Mesh''','''      var shield = new T.Mesh''')
rep('''      return { grp: grp, hips: hips, torso: torso, head: head, legL: legs[0], legR: legs[1], armL: arms[0], armR: arms[1], tag: tag.sprite, tagDraw: tag.draw, shield: shield, lastHp: -1 };''','''      return { grp: grp, hips: hips, torso: torso, head: head, legL: legs[0], legR: legs[1], armL: arms[0], armR: arms[1], shield: shield, lastHp: -1 };''')

# upsert tag DOM
rep('''        r = buildRemoteModel(p);
        r.hist = []; r.name = p.name || "几猫"; r.phase = 0; r.dead = false;
        G.scene.add(r.grp);
        remotes.set(p.id, r);''','''        r = buildRemoteModel(p);
        r.hist = []; r.name = p.name || "几猫"; r.phase = 0; r.dead = false;
        r.tagEl = document.createElement("div");
        r.tagEl.className = "x-mp-tag " + (p.team === 1 ? "team1" : "team0");
        r.tagEl.innerHTML = "<b>" + (p.name || "几猫") + "</b><i><em></em></i>";
        document.getElementById("ui").appendChild(r.tagEl);
        G.scene.add(r.grp);
        remotes.set(p.id, r);''')
rep('''      r.shield.visible = !!p.spawnProtect && p.alive !== false;
      if (r.lastHp !== p.hp || r.dead !== (p.alive === false)) {
        r.lastHp = p.hp;
        r.dead = p.alive === false;
        r.tagDraw(p.hp, p.alive !== false);
        r.tag.visible = p.alive !== false;
      }''','''      r.shield.visible = !!p.spawnProtect && p.alive !== false;
      if (r.lastHp !== p.hp || r.dead !== (p.alive === false)) {
        r.lastHp = p.hp;
        r.dead = p.alive === false;
        var hb = r.tagEl.querySelector("em");
        if (hb) hb.style.transform = "scaleX(" + Math.max(0, Math.min(1, (p.hp || 0) / 100)).toFixed(3) + ")";
        r.tagEl.style.opacity = p.alive === false ? "0" : "1";
      }''')
# remove tag el
rep('''      if (r) { G.scene.remove(r.grp); remotes.delete(id); }''','''      if (r) { G.scene.remove(r.grp); if (r.tagEl) r.tagEl.remove(); remotes.delete(id); }''')
rep('''      remotes.forEach(function (r) { G.scene.remove(r.grp); });''','''      remotes.forEach(function (r) { G.scene.remove(r.grp); if (r.tagEl) r.tagEl.remove(); });''')

# remove dead tag refs in anim
rep('''        if (r.dead) {
          r.grp.rotation.z += (1.38 - r.grp.rotation.z) * Math.min(1, dt * 7);
          r.tag.visible = false;
        } else {''','''        if (r.dead) {
          r.grp.rotation.z += (1.38 - r.grp.rotation.z) * Math.min(1, dt * 7);
        } else {''')

# add projection after animation block, before closing forEach
rep('''          r.grp.rotation.z += (0 - r.grp.rotation.z) * Math.min(1, dt * 10);
        }
      });''','''          r.grp.rotation.z += (0 - r.grp.rotation.z) * Math.min(1, dt * 10);
        }
        if (r.tagEl) {
          var wp = new T.Vector3(r.grp.position.x, r.grp.position.y + 2.3, r.grp.position.z);
          wp.project(G.camera);
          if (r.dead || wp.z > 1 || wp.z < -1) r.tagEl.style.display = "none";
          else {
            r.tagEl.style.display = "block";
            r.tagEl.style.left = ((wp.x * 0.5 + 0.5) * innerWidth) + "px";
            r.tagEl.style.top = ((-wp.y * 0.5 + 0.5) * innerHeight) + "px";
          }
        }
      });''')

# CSS tags
rep('''        ".x-hit-dir::after{content:'';position:absolute;left:50%;top:0;width:0;height:0;margin-left:-7px;border-left:7px solid transparent;border-right:7px solid transparent;border-top:10px solid #ff5a5a;}"''','''        ".x-hit-dir::after{content:'';position:absolute;left:50%;top:0;width:0;height:0;margin-left:-7px;border-left:7px solid transparent;border-right:7px solid transparent;border-top:10px solid #ff5a5a;}" +
        ".x-mp-tag{position:absolute;transform:translate(-50%,-100%);pointer-events:none;z-index:58;font:600 11px/1.3 var(--f-label);color:var(--bone);text-shadow:0 1px 3px #000;white-space:nowrap;}" +
        ".x-mp-tag b{display:block;font-weight:600;letter-spacing:.04em;}" +
        ".x-mp-tag i{display:block;width:64px;height:4px;margin-top:2px;background:rgba(0,0,0,.55);}" +
        ".x-mp-tag i em{display:block;height:100%;transform-origin:left;background:#9cff6a;}" +
        ".x-mp-tag.team1 b{color:#ff8a7a;}" +
        ".x-mp-tag.team0 b{color:#7fc8ff;}"''')
io.open(p,'w',encoding='utf-8').write(s)
print('dom nametags patched')
