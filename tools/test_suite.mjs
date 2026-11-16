
import { chromium } from 'playwright';
import { PW_ARGS } from './pwargs.mjs';

// 默认静态服务器由 tools/serve.mjs 提供（npm run serve:test）；
// 也可用 BASE_URL=file:///绝对路径/fps 指向本地目录。
const BASE = process.env.BASE_URL || 'http://127.0.0.1:3311';
const EXE = process.env.CHROME_EXE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
let failures = 0;
const results = [];

function ok(name, cond, detail) {
  results.push({ name, pass: !!cond, detail });
  if (!cond) failures++;
  console.log((cond ? 'PASS' : 'FAIL') + ' · ' + name + (detail ? ' — ' + detail : ''));
}

const browser = await chromium.launch({
  headless: true,
  executablePath: EXE,
  args: PW_ARGS
});

async function openPage(url) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 560 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => window.__ready === true || window.__fatal, null, { timeout: 180000 });
  await page.waitForTimeout(800);
  const state = await page.evaluate(() => ({ ready: window.__ready, fatal: window.__fatal, errors: (window.__errors || []).slice(0, 5) }));
  const click = async (sel) => {
    const loc = page.locator(sel).first();
    try { await loc.scrollIntoViewIfNeeded(); } catch (e) {}
    const b = await loc.boundingBox();
    if (!b) return false;
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    return true;
  };
  return { page, errors, state, click };
}

/* ---------- 1. 各版本启动 ---------- */
const versions = [
  ['V2', 'v2', 2], ['V3', 'v3', 2], ['V4', 'v4', 2], ['V5', 'v5', 3], ['V6', 'v6', 3], ['V7', 'v7', 3], ['V8', 'v8', 3], ['V9', 'v9', 3]
];
for (const [name, prof, weapons] of versions) {
  const file = 'versions/' + encodeURIComponent('几猫_' + name) + '.html';
  const { page, state, errors } = await openPage(BASE + '/' + file + '?q=low&noaudio=1&autostart=1&dt=0.1');
  const info = await page.evaluate(() => ({
    state: window.__G && window.__G.game.state,
    weapons: window.__G && window.__G.weapon && window.__G.weapon.list ? window.__G.weapon.list.length : 0
  }));
  ok(name + ' 启动', state.ready && !state.fatal && state.errors.length === 0 && errors.length === 0, JSON.stringify(state.errors.slice(0, 2)));
  ok(name + ' 武器数量', info.weapons === weapons, 'got ' + info.weapons + ' want ' + weapons);
  await page.close();
}

/* ---------- 2. V6 战术扫描 / 手雷弹道 ---------- */
{
  const { page } = await openPage(BASE + '/versions/' + encodeURIComponent('几猫_V6') + '.html?q=low&noaudio=1&autostart=1&dt=0.1');
  const spawn = await page.evaluate(() => {
    const G = window.__G, T = G.THREE, S = window.__SX;
    S.god();
    G.player.pos.set(-19, 0, 9); G.player.yaw = 0;
    G.enemies.clear();
    [['hound', -19, 0, 4], ['hound', -16, 0, 5], ['gull', -19, 6, 3]].forEach(([t, x, y, z]) =>
      G.enemies.spawn(t, new T.Vector3(x, y, z), { state: 'alert', passive: true }));
    return G.enemies.aliveCount();
  });
  ok('V6 敌人生成', spawn === 3, 'alive=' + spawn);
  const scan = await page.evaluate(() => { const S = window.__SX; S.scan(); return { marks: S.marks(), cd: S.scanCd() }; });
  ok('V6 战术扫描标记', scan.marks === 3, 'marks=' + scan.marks);
  ok('V6 扫描冷却', scan.cd > 13, 'cd=' + scan.cd);
  ok('V6 扫描 HUD', (await page.locator('.x-sm').count()) === 3);
  const aim = await page.evaluate(() => { const S = window.__SX; const ok = S.aim(); return { ok, arc: S.arc(), g: S.S.grenades }; });
  ok('V6 手雷弹道预览', aim.ok && aim.arc, JSON.stringify(aim));
  const rel = await page.evaluate(() => { const S = window.__SX; S.release(); return { arc: S.arc(), g: S.S.grenades, live: S.S.grenadeList.length }; });
  ok('V6 手雷投出', !rel.arc && rel.g === aim.g - 1 && rel.live >= 1, JSON.stringify(rel));
  await page.close();
}

/* ---------- 3. V6 行动档案真实点击 ---------- */
{
  const { page, click } = await openPage(BASE + '/versions/' + encodeURIComponent('几猫_V6') + '.html?q=low&noaudio=1');
  await page.evaluate(() => window.__SX.unlockAll());
  await click('[data-x="campaign"]');
  await page.waitForTimeout(300);
  ok('V6 行动档案可打开（真实点击）', await page.evaluate(() => document.querySelector('.x-camp').classList.contains('on')));
  await click('.x-mcard[data-idx="1"]');
  await page.waitForTimeout(200);
  const sel = await page.evaluate(() => ({ cur: window.__SX.campaign().current, sel: document.querySelector('.x-mcard.sel') && document.querySelector('.x-mcard.sel').dataset.idx }));
  ok('V6 行动卡片可选择', sel.cur === 1 && sel.sel === '1', JSON.stringify(sel));
  await click('.x-camp-actions [data-x="go"]');
  await page.waitForTimeout(2500);
  const launched = await page.evaluate(() => ({ state: window.__G.game.state, mission: window.__G.game.currentMission.id, overlay: document.querySelector('.x-camp').classList.contains('on') }));
  ok('V6 出动可进入任务', !launched.overlay && launched.state !== 'title' && launched.mission === 'm2', JSON.stringify(launched));
  await page.close();
}

/* ---------- 4. V7 训练场 ---------- */
{
  const { page, click } = await openPage(BASE + '/versions/' + encodeURIComponent('几猫_V7') + '.html?q=low&noaudio=1');
  await page.evaluate(() => window.__SX.unlockAll());
  await click('[data-x="campaign"]');
  await page.waitForTimeout(300);
  ok('V7 行动档案含训练卡', (await page.locator('.x-mcard').count()) === 4);
  await click('.x-train-card');
  await page.waitForTimeout(200);
  await click('.x-camp-actions [data-x="go"]');
  await page.waitForTimeout(2000);
  const launched = await page.evaluate(() => ({
    state: window.__G.game.state,
    active: !!(window.__SX.S.training && window.__SX.S.training.active),
    targets: window.__G.enemies.list.filter(e => e.alive && e.trainTarget).length,
    inv: window.__G.player.invulnerable,
    relays: window.__G.level.objectives.length,
    hud: document.querySelector('.x-train-hud').classList.contains('on')
  }));
  ok('V7 训练场启动', launched.state === 'playing' && launched.active && launched.targets >= 5 && launched.inv && launched.relays === 0 && launched.hud, JSON.stringify(launched));
  await page.evaluate(() => { window.__G.weapon.list.forEach(w => { w.reserve = 0; }); });
  await page.waitForTimeout(1200);
  const reserves = await page.evaluate(() => window.__G.weapon.list.map(w => w.reserve));
  ok('V7 训练场无限弹药', reserves.every(r => r >= 200), JSON.stringify(reserves));
  await page.evaluate(() => { window.__SX.S.training.t = 0.01; });
  await page.waitForTimeout(1500);
  const ended = await page.evaluate(() => ({
    state: window.__G.game.state,
    result: document.querySelector('.x-train-result').classList.contains('on')
  }));
  ok('V7 训练结算面板', ended.state === 'paused' && ended.result, JSON.stringify(ended));
  await click('.x-tr-actions [data-x="again"]');
  await page.waitForTimeout(2000);
  const retried = await page.evaluate(() => ({
    state: window.__G.game.state,
    active: !!(window.__SX.S.training && window.__SX.S.training.active),
    t: window.__SX.S.training && window.__SX.S.training.t,
    result: document.querySelector('.x-train-result').classList.contains('on')
  }));
  ok('V7 训练场重开', retried.state === 'playing' && retried.active && retried.t > 80 && !retried.result, JSON.stringify(retried));
  await page.evaluate(() => { window.__SX.S.training.t = 0.01; });
  await page.waitForTimeout(1500);
  await click('.x-tr-actions [data-x="back"]');
  await page.waitForTimeout(1200);
  const backed = await page.evaluate(() => ({ state: window.__G.game.state, screen: window.__G.game.menus.screen }));
  ok('V7 训练结束返回标题', backed.state === 'title' && backed.screen === 'title', JSON.stringify(backed));
  await click('.m-title [data-act="deploy"]');
  await page.waitForTimeout(2500);
  const deploy = await page.evaluate(() => ({
    state: window.__G.game.state,
    mission: window.__G.game.currentMission && window.__G.game.currentMission.id,
    relays: window.__G.level.objectives.length,
    training: !!window.__SX.S.training
  }));
  ok('V7 训练后标题可正常开战役', deploy.mission === 'm1' && deploy.relays >= 3 && !deploy.training && deploy.state !== 'title', JSON.stringify(deploy));
  await page.close();
}

/* ---------- 5. V8 军械库 ---------- */
{
  const { page, click } = await openPage(BASE + '/versions/' + encodeURIComponent('几猫_V8') + '.html?q=low&noaudio=1');
  await click('.m-title [data-x="armory"]');
  await page.waitForTimeout(300);
  ok('V8 军械库可打开（真实点击）', await page.evaluate(() => document.querySelector('.x-armory').classList.contains('on')));
  await click('.x-ar-tab[data-wid="breaker12"]');
  await page.waitForTimeout(200);
  await click('.x-ar-opt[data-slot="mag"][data-opt="ext"]');
  await page.waitForTimeout(300);
  const mag = await page.evaluate(() => {
    const w = window.__G.weapon.list.find(x => x.id === 'breaker12');
    return { magSize: w.magSize, saved: JSON.parse(localStorage.getItem('saltline.armory.v1') || '{}').breaker12 };
  });
  ok('V8 扩容弹匣生效并保存', mag.magSize === 10 && mag.saved && mag.saved.mag === 'ext', JSON.stringify(mag));
  await click('.x-ar-actions [data-x="close"]');
  await page.waitForTimeout(200);
  const supp = await page.evaluate(() => {
    const S = window.__SX;
    S.armorySet('pac9', 'muzzle', 'supp');
    const w = window.__G.weapon.list.find(x => x.id === 'pac9');
    return { damage: w.mods.damage, alert: w.mods.alert, visible: !!(w.__sxMuzzle && w.__sxMuzzle.visible), stat: S.armoryStats('pac9') };
  });
  ok('V8 消音器属性', Math.abs(supp.damage - 0.92) < 0.001 && supp.alert === 14 && supp.visible, JSON.stringify(supp));
  await page.reload({ waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  await page.waitForTimeout(1000);
  const persist = await page.evaluate(() => {
    const w = window.__G.weapon.list.find(x => x.id === 'pac9');
    return { muzzle: window.__SX.armory().pac9.muzzle, damage: w.mods.damage };
  });
  ok('V8 改装持久化', persist.muzzle === 'supp' && Math.abs(persist.damage - 0.92) < 0.001, JSON.stringify(persist));
  await page.close();
}

/* ---------- 6. V8 消音器实战：枪声半径与伤害 ---------- */
{
  const { page } = await openPage(BASE + '/game.html?q=low&noaudio=1&autostart=1&dt=0.1');
  const setup = await page.evaluate(() => {
    const S = window.__SX, G = window.__G, T = G.THREE;
    S.god();
    S.armorySet('pac9', 'muzzle', 'supp');
    G.player.pos.set(-19, 0, 9); G.player.yaw = 0; G.player.pitch = 0;
    G.enemies.clear();
    const e = G.enemies.spawn('hound', new T.Vector3(-19, 0, 4), { state: 'alert', passive: true });
    window.__FIRED = [];
    G.events.on('weapon:fire', ev => window.__FIRED.push(ev.radius));
    return { hp: e.hp };
  });
  await page.waitForFunction(() => window.__G.game.state === 'playing', null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(400);
  await page.keyboard.down('Enter');
  await page.waitForTimeout(1600);
  await page.keyboard.up('Enter');
  await page.waitForTimeout(1000);
  const fire = await page.evaluate(() => ({
    radii: window.__FIRED.slice(0, 4),
    hp: window.__G.enemies.list.filter(e => e.alive).map(e => e.hp),
    shots: window.__G.combat.stats.shots,
    mods: window.__G.weapon.list[0] && window.__G.weapon.list[0].mods ? window.__G.weapon.list[0].mods.damage : 1
  }));
  ok('V8 消音器降低枪声半径', fire.radii.length > 0 && fire.radii.every(r => r === 14), JSON.stringify(fire.radii));
  ok('V8 伤害修正生效', fire.shots > 0 && fire.mods > 0.9 && fire.mods < 0.95, 'mods.damage=' + fire.mods + ' shots=' + fire.shots);
  await page.evaluate(() => { const S = window.__SX; S.armorySet('pac9', 'muzzle', 'std'); S.armorySet('pac9', 'mag', 'std'); S.armorySet('breaker12', 'mag', 'std'); });
  await page.close();
}

/* ---------- 6.5 V9 难度 / 准星 / 晃动 / 性能面板 ---------- */
{
  const { page } = await openPage(BASE + '/game.html?q=low&noaudio=1&autostart=1&dt=0.1');
  const hasRows = await page.evaluate(() => document.querySelectorAll('[data-x-seg]').length);
  ok('V9 设置项扩展', hasRows >= 5, 'segs=' + hasRows);
  const changed = await page.evaluate(() => {
    const S = window.__SX, G = S.G;
    document.querySelector('[data-x-seg="difficulty"] button[data-v="nightmare"]').click();
    document.querySelector('[data-x-seg="cross"] button[data-v="cyan"]').click();
    document.querySelector('[data-x-seg="shake"] button[data-v="high"]').click();
    G.player.armor = 0; G.player.health = 100;
    G.player.damage(10, null);
    return {
      diff: S.S.diffDamage, dmgScale: S.S.damageScale, shake: S.S.shakeScale,
      hp: G.player.health, cross: getComputedStyle(document.documentElement).getPropertyValue('--cross-col').trim(),
      saved: JSON.parse(localStorage.getItem('saltline.access.v1') || '{}')
    };
  });
  ok('V9 难度影响受伤', changed.diff === 1.6 && changed.hp === 84, JSON.stringify(changed));
  ok('V9 准星颜色', changed.cross.toLowerCase() === '#8fd8ff', changed.cross);
  ok('V9 镜头晃动', changed.shake === 1.6, String(changed.shake));
  ok('V9 设置持久化写入', changed.saved && changed.saved.difficulty === 'nightmare', JSON.stringify(changed.saved));
  await page.keyboard.press('F3');
  await page.waitForTimeout(1200);
  const perf = await page.evaluate(() => ({
    on: document.querySelector('.x-perf').classList.contains('on'),
    text: document.querySelector('.x-perf pre').textContent
  }));
  ok('V9 性能面板 F3', perf.on && /FPS/.test(perf.text) && /calls/.test(perf.text), perf.text.replace(/\n/g, ' | '));
  await page.reload({ waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  await page.waitForTimeout(900);
  const persisted = await page.evaluate(() => ({
    diff: window.__SX.S.diffDamage, shake: window.__SX.S.shakeScale,
    cross: getComputedStyle(document.documentElement).getPropertyValue('--cross-col').trim()
  }));
  ok('V9 设置刷新后保留', persisted.diff === 1.6 && persisted.shake === 1.6 && persisted.cross.toLowerCase() === '#8fd8ff', JSON.stringify(persisted));
  await page.evaluate(() => {
    document.querySelector('[data-x-seg="difficulty"] button[data-v="normal"]').click();
    document.querySelector('[data-x-seg="cross"] button[data-v="bone"]').click();
    document.querySelector('[data-x-seg="shake"] button[data-v="std"]').click();
  });
  await page.close();
}

/* ---------- 6.8 V10 新敌人 ---------- */
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

/* ---------- 6.9 V11 行动简报与节拍 ---------- */
{
  const { page, click } = await openPage(BASE + '/game.html?q=low&noaudio=1');
  await page.evaluate(() => window.__SX.unlockAll());
  await click('[data-x="campaign"]');
  await page.waitForTimeout(300);
  await click('.x-mcard[data-idx="1"]');
  await page.waitForTimeout(200);
  await click('.x-camp-actions [data-x="go"]');
  await page.waitForTimeout(400);
  const brief = await page.evaluate(() => ({
    on: document.querySelector('.x-brief').classList.contains('on'),
    title: document.querySelector('.x-br-h').textContent,
    list: document.querySelectorAll('.x-br-list li').length,
    threats: document.querySelector('.x-br-threats').textContent
  }));
  ok('V11 行动简报显示', brief.on && brief.title === '仓库区' && brief.list === 3 && brief.threats.length > 0, JSON.stringify(brief));
  await click('.x-br-actions [data-x="brief-back"]');
  await page.waitForTimeout(300);
  const closed = await page.evaluate(() => ({ brief: document.querySelector('.x-brief').classList.contains('on'), camp: document.querySelector('.x-camp').classList.contains('on') }));
  ok('V11 简报返回', !closed.brief && closed.camp, JSON.stringify(closed));
  await click('.x-camp-actions [data-x="go"]');
  await page.waitForTimeout(300);
  await click('.x-br-actions [data-x="brief-go"]');
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__G.game.start({ skipIntro: true }));
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__SX.god(); window.__SX.cutAll(); });
  await page.waitForTimeout(2500);
  const hold = await page.evaluate(() => ({
    state: window.__G.game.state, evac: window.__G.game.run.evacT,
    all: window.__G.game.run.allCut, obj: document.querySelector('.h-obj-t').textContent
  }));
  ok('V11 撤离坚守节拍', hold.state === 'playing' && hold.all && hold.evac > 40 && hold.obj.indexOf('坚守') >= 0, JSON.stringify(hold));
  await page.evaluate(() => { window.__G.game.run.evacT = 0.01; });
  await page.waitForTimeout(2000);
  const opened = await page.evaluate(() => ({
    evac: window.__G.game.run.evacT,
    obj: document.querySelector('.h-obj-t').textContent,
    markers: document.querySelectorAll('.h-wm').length
  }));
  ok('V11 撤离窗口开启', opened.evac === 0 && opened.markers >= 1, JSON.stringify(opened));
  await page.evaluate(() => { const G = window.__G, e = G.level.extraction.pos; G.player.pos.set(e.x, e.y, e.z); });
  await page.waitForTimeout(4000);
  const done = await page.evaluate(() => window.__G.game.state);
  ok('V11 坚守后撤离完成', done === 'complete', done);
  await page.close();
}

/* ---------- 6.95 V11 BOSS 后登船窗口 ---------- */
{
  const { page } = await openPage(BASE + '/game.html?q=low&noaudio=1&autostart=1&dt=0.1');
  await page.evaluate(() => window.__SX.launchFast(2));
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__SX.god(); window.__SX.cutAll(); });
  await page.waitForTimeout(4000);
  await page.evaluate(() => {
    const G = window.__G, b = G.enemies.list.find(e => e.boss);
    if (b) b.damage(99999, b.pos, new G.THREE.Vector3(0, 0, 1), 'weak');
  });
  await page.waitForFunction(() => window.__G.game.run.bossAlive === false, null, { timeout: 15000 }).catch(() => {});
  const esc = await page.evaluate(() => ({
    state: window.__G.game.state,
    bossAlive: window.__G.game.run.bossAlive,
    evac: window.__G.game.run.evacT,
    obj: document.querySelector('.h-obj-t').textContent
  }));
  // 高帧率下固定步会更快消耗撤离窗口：只要求窗口存在且未打完
  ok('V11 BOSS 后登船窗口', esc.bossAlive === false && esc.evac >= 0 && esc.evac <= 30 && esc.state === 'playing', JSON.stringify(esc));
  await page.close();
}

/* ---------- 6.97 V12 时段与天气 ---------- */
{
  const { page } = await openPage(BASE + '/game.html?q=low&noaudio=1&autostart=1&dt=0.1');
  const read = async (idx) => await page.evaluate((i) => {
    const G = window.__G;
    window.__SX.applyMission(i);
    G.game.start({ skipIntro: true });
    return {
      env: window.__SX.environment(),
      pos: G.player.pos.toArray().map(v => +v.toFixed(2)),
      yaw: +G.player.yaw.toFixed(2)
    };
  }, idx);
  const m0 = await read(0);
  const m1 = await read(1);
  const m2 = await read(2);
  ok('V12 三关时段环境不同',
    m1.env.sun[2] > 0.5 && m1.env.intensity < 4 && m1.env.exposure < 0.9 &&
    m2.env.sun[2] < 0 && m2.env.intensity > 6 && m0.env.intensity > 8,
    JSON.stringify({ m0: m0.env, m1: m1.env, m2: m2.env }));
  ok('V12 行动 2 从仓库内部出生',
    Math.abs(m1.pos[0] + 10) < 1 && Math.abs(m1.pos[2] + 20) < 1 && m1.pos[1] < 1,
    JSON.stringify(m1.pos));
  ok('V12 行动 1/3 从大门出生',
    Math.abs(m0.pos[0] + 32) < 1 && Math.abs(m2.pos[0] + 32) < 1,
    JSON.stringify([m0.pos, m2.pos]));
  await page.evaluate(() => { window.__SX.applyMission(0); window.__G.game.start({ skipIntro: true }); });
  await page.close();
}

/* ---------- 6.98 V13 挑战与解锁 ---------- */
{
  const { page } = await openPage(BASE + '/game.html?q=low&noaudio=1&autostart=1&dt=0.1');
  const init = await page.evaluate(() => ({
    count: window.__SX.challenges().count,
    lime: document.querySelector('[data-x-seg="cross"] button[data-v="lime"]').disabled,
    gold: document.querySelector('[data-x-seg="cross"] button[data-v="gold"]').disabled,
    colors: document.querySelectorAll('[data-x-seg="cross"] button').length
  }));
  ok('V13 挑战初始锁定', init.count === 0 && init.lime && init.gold && init.colors === 6, JSON.stringify(init));
  const grant = await page.evaluate(() => {
    window.__SX.challengeGrant('m1', { time: true, head: true, clean: true });
    return {
      count: window.__SX.challenges().count,
      lime: document.querySelector('[data-x-seg="cross"] button[data-v="lime"]').disabled,
      crimson: document.querySelector('[data-x-seg="cross"] button[data-v="crimson"]').disabled,
      saved: JSON.parse(localStorage.getItem('saltline.campaign.v1') || '{}').challenges
    };
  });
  ok('V13 三挑战解锁绿色准星', grant.count === 3 && grant.lime === false && grant.crimson === true, JSON.stringify(grant));
  ok('V13 挑战进度持久化', !!(grant.saved && grant.saved.m1 && grant.saved.m1.time && grant.saved.m1.head && grant.saved.m1.clean), JSON.stringify(grant.saved));
  await page.close();
}

/* ---------- 6.99 V14 可访问性与最终打磨 ---------- */
{
  const { page } = await openPage(BASE + '/game.html?q=low&noaudio=1&autostart=1&dt=0.1');
  const ui = await page.evaluate(() => ({
    heads: [...document.querySelectorAll('.panel-b h3')].map(x => x.textContent),
    reduce: !!document.querySelector('[data-x-reduce]'),
    toTitle: !!document.querySelector('.m-screen[data-s="paused"] [data-x="to-title"]'),
    locPE: (() => { const l = document.querySelector('.loc-card'); return l ? getComputedStyle(l).pointerEvents : null; })(),
    premise: (document.querySelector('.m-title .m-premise') || {}).textContent
  }));
  ok('V14 设置分组与辅助项', ui.heads.includes('画面与音频') && ui.heads.includes('操控') && ui.heads.includes('游戏性') && ui.reduce, JSON.stringify(ui.heads));
  const red = await page.evaluate(() => {
    document.querySelector('[data-x-reduce]').click();
    return { on: document.body.classList.contains('reduce-motion'), shake: window.__SX.S.shakeScale };
  });
  ok('V14 减少动态', red.on && red.shake <= 0.2, JSON.stringify(red));
  ok('V14 装饰层不挡点击', ui.locPE === 'none', ui.locPE);
  ok('V14 暂停返回标题与当前行动', ui.toTitle && (ui.premise || '').includes('当前行动'), JSON.stringify({ toTitle: ui.toTitle, premise: ui.premise }));
  await page.close();
}

/* ---------- 6.995 任务标志物可达性 ---------- */
{
  const { page } = await openPage(BASE + '/game.html?q=low&noaudio=1&autostart=1&dt=0.1');
  const reach = await page.evaluate(() => {
    const G = window.__G, out = [];
    for (let i = 0; i < 8; i++) {
      window.__SX.applyMission(i);
      G.game.start({ skipIntro: true });
      const v = window.__SX.validateObjectives();
      out.push({
        i, ok: v.every(x => x.ok), bad: v.filter(x => !x.ok),
        relays: G.level.objectives.map(o => ({ id: o.id, y: +o.pos.y.toFixed(2) }))
      });
    }
    return out;
  });
  ok('V14 全任务标志物可达', reach.every(x => x.ok), JSON.stringify(reach));
  ok('V14 行动 2 中继不再在屋顶', reach[1].relays.every(r => r.y < 2), JSON.stringify(reach[1].relays));
  await page.close();
}

/* ---------- 6.996 V15 新地图与行动 4 ---------- */
{
  const { page } = await openPage(BASE + '/game.html?q=low&noaudio=1&autostart=1&dt=0.1');
  const map = await page.evaluate(() => {
    const G = window.__G;
    const maps = window.__SX.maps();
    window.__SX.applyMission(3);
    G.game.start({ skipIntro: true });
    const depot = {
      map: window.__SX.mapId(),
      start: G.player.pos.toArray().map(v => +v.toFixed(2)),
      obj: G.level.objectives.length,
      boxes: G.physics.boxes.length,
      valid: window.__SX.validateObjectives().every(x => x.ok),
      extract: G.level.extraction.pos.toArray().map(v => +v.toFixed(2))
    };
    window.__SX.applyMission(0);
    G.game.start({ skipIntro: true });
    const harbor = {
      map: window.__SX.mapId(),
      boxes: G.physics.boxes.length,
      valid: window.__SX.validateObjectives().every(x => x.ok)
    };
    return { maps, depot, harbor };
  });
  ok('V15 地图注册与切换', map.maps.includes('depot') && map.depot.map === 'depot' && map.harbor.map === 'harbor', JSON.stringify(map));
  ok('V15 冷库关可进入且可达', map.depot.obj === 3 && map.depot.valid && Math.abs(map.depot.start[0]) < 1 && Math.abs(map.depot.start[2] - 13.6) < 1, JSON.stringify(map.depot));
  ok('V15 返回港区恢复碰撞', map.harbor.boxes > 500 && map.harbor.valid, JSON.stringify(map.harbor));
  await page.close();
}

/* ---------- 6.997 V18 货轮甲板与行动 5 ---------- */
{
  const { page } = await openPage(BASE + '/game.html?q=low&noaudio=1&autostart=1&dt=0.1');
  const ship = await page.evaluate(() => {
    const G = window.__G;
    const maps = window.__SX.maps();
    window.__SX.applyMission(4);
    G.game.start({ skipIntro: true });
    const apron = G.ground.root.getObjectByName('apron');
    const s = {
      map: window.__SX.mapId(),
      obj: G.level.objectives.length,
      start: G.player.pos.toArray().map(v => +v.toFixed(2)),
      extract: G.level.extraction.pos.toArray().map(v => +v.toFixed(2)),
      boxes: G.physics.boxes.length,
      valid: window.__SX.validateObjectives().every(x => x.ok),
      sea: G.ground.root.getObjectByName('sea').visible,
      apron: apron && apron.visible
    };
    return { maps, s };
  });
  ok('V18 货轮地图注册', ship.maps.includes('ship'), ship.maps);
  ok('V18 行动 5 可进入且可达', ship.s.map === 'ship' && ship.s.obj === 3 && ship.s.valid && Math.abs(ship.s.start[2] - 5.2) < 1, JSON.stringify(ship.s));
  ok('V18 海面/甲板正确', ship.s.sea === true && ship.s.apron === false && ship.s.boxes < 120, JSON.stringify({ sea: ship.s.sea, apron: ship.s.apron, boxes: ship.s.boxes, extract: ship.s.extract }));
  await page.close();
}

/* ---------- 6.998 V19 终章与结局 ---------- */
{
  const { page } = await openPage(BASE + '/game.html?q=low&noaudio=1&autostart=1&dt=0.1');
  const finale = await page.evaluate(async () => {
    const G = window.__G;
    window.__SX.applyMission(5);
    G.game.start({ skipIntro: true });
    const start = {
      map: window.__SX.mapId(),
      start: G.player.pos.toArray().map(v => +v.toFixed(1)),
      obj: G.level.objectives.length,
      extract: G.level.extraction.pos.toArray().map(v => +v.toFixed(1))
    };
    window.__SX.god();
    window.__SX.cutAll();
    await new Promise(r => setTimeout(r, 3200));
    const b = G.enemies.list.find(e => e.boss);
    return {
      start,
      boss: b ? { hp: b.hp, max: b.maxHp, name: b.variant, bar: (document.querySelector('.x-boss-k') || {}).textContent } : null
    };
  });
  ok('V19 归途反向开局', finale.start.map === 'harbor' && finale.start.obj === 2 && Math.abs(finale.start.start[0] - 29) < 2 && Math.abs(finale.start.extract[0] + 32) < 1, JSON.stringify(finale.start));
  ok('V19 蜃·终形', !!finale.boss && finale.boss.hp === 2600 && /终形/.test(finale.boss.name || '') && /终形/.test(finale.boss.bar || ''), JSON.stringify(finale.boss));
  const missionCount = await page.evaluate(() => (window.__SX_CAMP && window.__SX_CAMP.missions ? window.__SX_CAMP.missions.length : 0));
  await page.evaluate(() => window.__SX.openMissions());
  await page.waitForTimeout(300);
  const c2 = await page.evaluate(() => document.querySelectorAll('.x-mcard[data-idx]').length);
  ok('V19 行动档案（按当前关卡数）', missionCount === 8 && c2 === missionCount, { expected: missionCount, after: c2 });
  await page.close();
}

/* ---------- 6.999 V24 叙事包装 ---------- */
{
  const { page, click } = await openPage(BASE + '/game.html?q=low&noaudio=1&autostart=1&dt=0.1');
  await page.evaluate(() => { window.__SX.unlockAll(); window.__SX.openMissions(); });
  await page.waitForTimeout(400);
  const cards = await page.evaluate(() => ({
    chapters: [...document.querySelectorAll('.x-mcard .code')].map(x => x.textContent),
    cards: document.querySelectorAll('.x-mcard[data-idx]').length,
    expected: (window.__SX_CAMP && window.__SX_CAMP.missions ? window.__SX_CAMP.missions.length : 0)
  }));
  ok('V24 章节化行动卡', cards.expected === 8 && cards.cards === cards.expected &&
    cards.chapters.some(x => x.includes('第一幕')) && cards.chapters.some(x => x.includes('第三幕')), cards);
  await click('[data-x="archive"]');
  await page.waitForTimeout(300);
  const arch = await page.evaluate(() => ({ on: document.querySelector('.x-archive').classList.contains('on'), rows: document.querySelectorAll('.x-arc-row').length }));
  ok('V24 剧情档案', arch.on && cards.expected === 8 && arch.rows === cards.expected, JSON.stringify({ expected: cards.expected, ...arch }));
  await page.evaluate(() => { document.querySelector('.x-arc-actions [data-ar-back]').click(); window.__SX.interlude(0, 1); });
  await page.waitForTimeout(300);
  const int = await page.evaluate(() => ({ on: document.querySelector('.x-interlude').classList.contains('on'), title: document.querySelector('[data-int-h]').textContent, lines: document.querySelectorAll('.x-int-lines p').length }));
  ok('V24 关间过场', int.on && int.title === '仓库区' && int.lines === 2, JSON.stringify(int));
  await page.close();
}

/* ---------- 7. BOSS 流程 ---------- */
{
  const { page } = await openPage(BASE + '/game.html?q=low&noaudio=1&autostart=1&dt=0.1');
  await page.evaluate(() => window.__SX.launchFast(2));
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__SX.god(); window.__SX.cutAll(); });
  await page.waitForTimeout(4000);
  const boss = await page.evaluate(() => {
    const G = window.__G, b = G.enemies.list.find(e => e.boss);
    return { exists: !!b, alive: b && b.alive, bossAlive: G.game.run.bossAlive, bar: !!document.querySelector('.x-boss.on') };
  });
  ok('V8 BOSS 生成与血条', boss.exists && boss.alive && boss.bossAlive && boss.bar, JSON.stringify(boss));
  const died = await page.evaluate(async () => {
    const G = window.__G, b = G.enemies.list.find(e => e.boss);
    b.damage(99999, b.pos, new G.THREE.Vector3(0, 0, 1), 'weak');
    await new Promise(r => setTimeout(r, 1500));
    return { bossAlive: G.game.run.bossAlive };
  });
  ok('V8 BOSS 击杀开撤离', died.bossAlive === false, JSON.stringify(died));
  await page.close();
}

await browser.close();
console.log('\n' + (failures ? failures + ' 项失败' : '全部通过') + '（共 ' + results.length + ' 项）');
process.exit(failures ? 1 : 0);
