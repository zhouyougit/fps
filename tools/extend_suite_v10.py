
import io
p='tools/test_suite.mjs'
s=io.open(p,encoding='utf-8').read()
marker='/* ---------- 7. BOSS 流程 ---------- */'
assert s.count(marker)==1
section='''/* ---------- 6.8 V10 新敌人 ---------- */
{
  const { page } = await openPage(BASE + '/game.html?q=low&noaudio=1&autostart=1&dt=0.1');
  const reg = await page.evaluate(() => {
    const G = window.__G, T = G.THREE;
    G.enemies.clear();
    const m = G.enemies.spawn('marksman', new T.Vector3(-19, 0, -16), { yaw: 0, passive: true });
    const h = G.enemies.spawn('heavy', new T.Vector3(-19, 0, 4), { yaw: 0 });
    const t = G.enemies.spawn('turret', new T.Vector3(-16, 0, 4), { yaw: 0 });
    return {
      pool: G.enemies.TUNE.poolHounds,
      m: m && { hp: m.hp, rMin: m.rangeMin, rMax: m.rangeMax, laser: m.laser, burst: m.burstCount },
      h: h && { hp: h.hp, shield: h.shieldHp, max: h.maxShield, mesh: !!(h.shieldMesh && h.shieldMesh.visible) },
      t: t && { hp: t.hp, fixed: t.fixed, leg: t.rig.bones.abdFL.scale.x }
    };
  });
  ok('V10 变体可生成', reg.m && reg.m.hp === 95 && reg.m.rMax <= 45 && reg.m.laser && reg.h && reg.h.shield === 240 && reg.t && reg.t.fixed, JSON.stringify(reg));
  ok('V10 地面池容量', reg.pool >= 12, 'pool=' + reg.pool);
  ok('V10 炮台隐藏腿部', reg.t && reg.t.leg < 0.05, 'leg=' + (reg.t && reg.t.leg));

  const shield = await page.evaluate(() => {
    const G = window.__G, T = G.THREE;
    G.enemies.clear();
    const h = G.enemies.spawn('heavy', new T.Vector3(-2, 0, 12), { yaw: 0 });
    const front = new T.Vector3(-2, 1.6, 18), dirF = new T.Vector3(0, -1.1, -6).normalize();
    const hp0 = h.hp;
    G.combat.playerShot(front, dirF, { damage: 20, range: 50 });
    const frontLoss = hp0 - h.hp, shield1 = h.shieldHp;
    for (let i = 0; i < 20; i++) G.combat.playerShot(front, dirF, { damage: 20, range: 50 });
    return { frontLoss, shield1, shieldNow: h.shieldHp, mesh: h.shieldMesh && h.shieldMesh.visible };
  });
  ok('V10 护盾正面减伤', shield.frontLoss > 0 && shield.frontLoss <= 6 && shield.shield1 < 240, JSON.stringify(shield));
  ok('V10 护盾可击破', shield.shieldNow === 0 && shield.mesh === false, JSON.stringify(shield));

  const queue = await page.evaluate(() => {
    const G = window.__G;
    G.game.flow.waves = [{ gull: 0, hound: 0, marksman: 2, heavy: 1, turret: 1 }];
    G.game.debugCut();
    return G.game.run.queue.map(q => q.type);
  });
  ok('V10 波次支持新单位', queue.includes('marksman') && queue.includes('heavy') && queue.includes('turret'), JSON.stringify(queue));

  const names = await page.evaluate(() => {
    const G = window.__G, T = G.THREE;
    G.enemies.clear();
    const a = G.enemies.spawn('marksman', new T.Vector3(-2, 0, 12), { yaw: 0 });
    const b = G.enemies.spawn('heavy', new T.Vector3(-2, 0, 14), { yaw: 0 });
    const c = G.enemies.spawn('turret', new T.Vector3(-4, 0, 14), { yaw: 0 });
    a.damage(9999, a.pos, new T.Vector3(0, 0, 1), 'body');
    b.damage(9999, b.pos, new T.Vector3(0, 0, 1), 'body');
    c.damage(9999, c.pos, new T.Vector3(0, 0, 1), 'body');
    return [...document.querySelectorAll('.h-fl')].map(x => x.textContent).join(' | ');
  });
  ok('V10 击杀播报名称', names.includes('狙击猎犬') && names.includes('重装盾卫') && names.includes('固定炮台'), names);

  const turret = await page.evaluate(async () => {
    const G = window.__G, T = G.THREE;
    G.enemies.clear();
    G.player.pos.set(10, 0, 20); G.player.yaw = 0; G.player.health = 100;
    const t = G.enemies.spawn('turret', new T.Vector3(10, 0, 14), { yaw: 0, state: 'alert' });
    window.__TT = t;
    return true;
  });
  await page.waitForTimeout(4000);
  const turretState = await page.evaluate(() => {
    const t = window.__TT;
    return { fixed: t.fixed, moved: +t.pos.distanceTo(new window.__G.THREE.Vector3(10, 0, 14)).toFixed(2), mode: t.mode, es: t.es };
  });
  ok('V10 炮台固定并进入交战', turretState.fixed && turretState.moved < 0.1 && (turretState.mode === 'engage' || turretState.es === 'aim' || turretState.es === 'tele'), JSON.stringify(turretState));
  await page.close();
}

'''
s=s.replace(marker, section+marker,1)
io.open(p,'w',encoding='utf-8').write(s)
print('suite extended with V10')
