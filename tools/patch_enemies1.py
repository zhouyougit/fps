
import io
p='src/game.js'
s=io.open(p,encoding='utf-8').read()

def rep(old,new,count=1):
    global s
    assert s.count(old)==count, (s.count(old), old[:70])
    s=s.replace(old,new,count)

# 1) spawn dispatch + variant setup
rep('''        spawn(T, D, C = {}) {
          let G = T === "gull" ? d : T === "hound" ? v : null;
          if (!G) return null;
          let j = null;
          for (let N of G)
            if (!N.active) {
              j = N;
              break;
            }
          if (!j && T === "hound" && n.length) {
            let N = n[0];
            h.retire(N), (j = N);
          }
          return j
            ? ((j.id = O++),
              t.push(j),
              j._activate(D, C),
              i.events.emit("enemy:spawn", { enemy: j }),
              j)
            : null;
        },''','''        spawn(T, D, C = {}) {
          let G = T === "gull" || T === "drone" ? d : T === "hound" || T === "elite" || T === "boss" ? v : null;
          if (!G) return null;
          let j = null;
          for (let N of G)
            if (!N.active) {
              j = N;
              break;
            }
          if (!j && (T === "hound" || T === "elite" || T === "boss") && n.length) {
            let N = n[0];
            h.retire(N), (j = N);
          }
          if (!j) return null;
          (j.id = O++), t.push(j), j._activate(D, C);
          // 变体标记（type 保持不变，避免音频/统计分支失配）
          (j.variant = T === "gull" || T === "hound" ? "" : T),
            (j.elite = T === "elite" || T === "boss"),
            (j.boss = T === "boss"),
            (j.hitScale = T === "boss" ? 1.8 : T === "elite" ? 1.15 : 1),
            (j.hitRadiusSq = T === "boss" ? 5.2 : T === "elite" ? 2.2 : 1.7);
          if (j.rig && j.rig.group) j.rig.group.scale.setScalar(T === "boss" ? 1.8 : T === "elite" ? 1.15 : 1);
          if (T === "drone") {
            j.hp = 26; j.maxHp = 26;
            if (j.lens && j.lens.color) j.lens.color.setRGB(7, 0.45, 0.18);
          } else if (T === "elite") {
            j.hp = 230; j.maxHp = 230;
            if (j.lens && j.lens.color) j.lens.color.setRGB(6.5, 0.35, 0.2);
          } else if (T === "boss") {
            j.hp = 1600; j.maxHp = 1600;
            j.bossPhase = 0; j.bossT = 0; j.volleyCd = 6; j.stompCd = 4;
            if (j.lens && j.lens.color) j.lens.color.setRGB(8, 0.3, 0.12);
          }
          i.events.emit("enemy:spawn", { enemy: j });
          return j;
        },''')

# 2) broadphase radius + center
rep('''              K = N.pos.y + (N.type === "hound" ? 0.6 : 0) - T.y,
              ie = N.pos.z - T.z,
              F = Q * D.x + K * D.y + ie * D.z;
            F < -1.5 ||
              F > C + 1.5 ||
              Q * Q + K * K + ie * ie - F * F > 1.7 ||''','''              K = N.pos.y + (N.type === "hound" ? 0.6 * (N.hitScale || 1) : 0) - T.y,
              ie = N.pos.z - T.z,
              F = Q * D.x + K * D.y + ie * D.z;
            F < -1.5 ||
              F > C + 1.5 ||
              Q * Q + K * K + ie * ie - F * F > (N.hitRadiusSq || 1.7) ||''')

# 3) hound hit spheres scale
rep('''        _raycast(T, D, C, G) {
          let j = !1;
          sM(T, D, m.headPos, 0.155, C, G) &&
            ((G.part = "weak"), (G.enemy = m), (j = !0));
          let N = Math.cos(m.yaw),
            Q = Math.sin(m.yaw),
            K = m.pos.y + ni.stand + m.sY.x - m.crouch;
          return (
            ps.set(m.pos.x - Q * 0.45, K + 0.03, m.pos.z - N * 0.45),
            ru.set(m.pos.x + Q * 0.47, K + 0.03, m.pos.z + N * 0.47),
            nM(T, D, ps, ru, 0.27, C, G) &&
              ((G.part = "body"), (G.enemy = m), (j = !0)),
            (ps.y = ru.y = m.pos.y + (K - m.pos.y) * 0.45),
            nM(T, D, ps, ru, 0.25, C, G) &&
              ((G.part = "body"), (G.enemy = m), (j = !0)),
            j
          );
        },''','''        _raycast(T, D, C, G) {
          let j = !1,
            sc = m.hitScale || 1;
          sM(T, D, m.headPos, 0.155 * sc, C, G) &&
            ((G.part = "weak"), (G.enemy = m), (j = !0));
          let N = Math.cos(m.yaw),
            Q = Math.sin(m.yaw),
            K = m.pos.y + ni.stand + m.sY.x - m.crouch;
          return (
            ps.set(m.pos.x - Q * 0.45 * sc, K + 0.03, m.pos.z - N * 0.45 * sc),
            ru.set(m.pos.x + Q * 0.47 * sc, K + 0.03, m.pos.z + N * 0.47 * sc),
            nM(T, D, ps, ru, 0.27 * sc, C, G) &&
              ((G.part = "body"), (G.enemy = m), (j = !0)),
            (ps.y = ru.y = m.pos.y + (K - m.pos.y) * 0.45),
            nM(T, D, ps, ru, 0.25 * sc, C, G) &&
              ((G.part = "body"), (G.enemy = m), (j = !0)),
            j
          );
        },''')

# 4) drone branch in gull update
rep('''    function x(y) {
      let b = s.player,
        m = i.t;
      d.fwd.set(Math.sin(d.yaw), 0, Math.cos(d.yaw)),''','''    function x(y) {
      let b = s.player,
        m = i.t;
      if (d.variant === "drone") {
        if (!d.alive) return;
        if (b && b.alive) {
          let tx = b.eye.x - d.pos.x,
            ty = b.pos.y + 1.05 - d.pos.y,
            tz = b.eye.z - d.pos.z,
            dd = Math.hypot(tx, ty, tz) || 1,
            sp = 10.5;
          (d.vel.x += (tx / dd * sp - d.vel.x) * Math.min(1, y * 2.6)),
            (d.vel.y += (ty / dd * sp - d.vel.y) * Math.min(1, y * 2.6)),
            (d.vel.z += (tz / dd * sp - d.vel.z) * Math.min(1, y * 2.6)),
            d.pos.addScaledVector(d.vel, y),
            (d.yaw = Math.atan2(d.vel.x, d.vel.z)),
            (d.pitch = Math.atan2(d.vel.y, Math.hypot(d.vel.x, d.vel.z)) * 0.45);
          for (let k = 0; k < 4; k++)
            l["rotor" + k].rotation.y += (k % 3 === 0 ? 1 : -1) * 38 * y;
          a.group.rotation.set(d.pitch, d.yaw, d.roll);
          d.strobeT -= y;
          if (d.strobeT <= 0 && l.strobeR) { d.strobeT = 0.12; l.strobeR.scale.setScalar(2.2); }
          if (l.strobeR && l.strobeR.scale.x > 1.2) l.strobeR.scale.multiplyScalar(1 - Math.min(1, y * 8));
          if (dd < 1.9 || d.pos.distanceTo(b.pos) < 1.5) {
            try { s.fx.explosion(d.pos, 1.5); } catch (e) {}
            try { s.combat.explode(d.pos, 4.4, 62, "enemy"); } catch (e) {}
            i.events.emit("enemy:killed", { enemy: d, pos: d.pos, type: "gull" });
            i.retire(d);
          }
        }
        return;
      }
      d.fwd.set(Math.sin(d.yaw), 0, Math.cos(d.yaw)),''')
io.open(p,'w',encoding='utf-8').write(s)
print('patched enemies part 1')
