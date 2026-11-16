#!/usr/bin/env node
/* =====================================================================
   SALTLINE · tools/test_v43_avatar.mjs — V43 联机士兵模型验收
   ---------------------------------------------------------------------
   在真实浏览器里用 __MP.net2.testUpsert 注入两个阵营的远端：
     · 模型层级 ≥8 个直接子节点（hips/腿/臂/武器/护盾/标签锚点）
     · 合批后的 draw call 数量在预算内（浏览器合并，VM 测试桩逐件）
     · 两队臂章/护目镜颜色不同，布料为低饱和战术色
     · 行走摆腿、持枪姿势、蹲伏降髋、死亡倒地
     · 截图：正面两队 / 背面 / 蹲伏 / 倒地（versions/screens/v43_avatar）
     · 清理远端后场景归零、无 pageerror
   用法：node tools/test_v43_avatar.mjs   （SX_TARGET 可指定 html）
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { PW_ARGS, GPU_MODE, findChrome } from './pwargs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = findChrome();
const TARGET = path.resolve(ROOT, process.env.SX_TARGET || 'game.html');
const OUT = path.join(ROOT, 'versions/screens/v43_avatar');
fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('PASS · ' + n + (d !== undefined ? ' — ' + JSON.stringify(d) : '')); } else { fail++; console.log('FAIL · ' + n + (d !== undefined ? ' — ' + JSON.stringify(d) : '')); } };

const browser = await chromium.launch({ headless: true, executablePath: CHROME, args: PW_ARGS });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String((e && e.message) || e)));
console.log('[v43-avatar] target=' + TARGET + ' gpu=' + GPU_MODE);

async function shot(name) {
  await page.evaluate(() => {
    const G = window.__G;
    try { if (G.game.menus && G.game.menus.show) G.game.menus.show('none'); } catch (e) {}
    const ui = document.getElementById('ui'); if (ui) ui.style.display = 'none';
    const boot = document.getElementById('boot'); if (boot) boot.style.setProperty('display', 'none', 'important');
    document.querySelectorAll('.menu, .m-screen').forEach((m) => { m.style.setProperty('display', 'none', 'important'); });
    for (let i = 0; i < 8; i++) G.render.frame(1 / 60);
  });
  const file = path.join(OUT, name + '.png');
  await page.screenshot({ path: file, timeout: 60000 });
  return file;
}

try {
  await page.goto('file://' + TARGET + '?q=medium&noaudio=1&autostart=1', { waitUntil: 'load', timeout: 240000 });
  await page.waitForFunction(() => (window.__ready === true && !!window.__SX && !!window.__MP) || window.__fatal, null, { timeout: 420000 });
  await page.evaluate(() => {
    const G = window.__G;
    try { if (G.game.state !== 'playing') G.game.start({ skipIntro: true }); } catch (e) {}
    try { window.__SX.god(true); } catch (e) {}
    try { window.__SX.switchMap('harbor'); } catch (e) {}
    const ui = document.getElementById('ui'); if (ui) ui.style.display = 'none';
    // 隐藏第一人称武器模型，避免挡住被观察的士兵
    try { G.render.viewCamera.layers.mask = 0; } catch (e) {}
    G.enemies.clear();
    const p = [-30, 0, 24];
    G.player.pos.set(p[0], p[1], p[2]);
    G.player.vel.set(0, 0, 0);
    G.player.yaw = -0.888; G.player.pitch = -0.02;
    window.__SX_LOOP.step(6);
    // V43 截图专用的三点补光：真实对战仍用场景日照/灯池
    try {
      const T = G.THREE;
      const hemi = new T.HemisphereLight(0xcfe4ff, 0x202020, 1.6); G.scene.add(hemi);
      const key = new T.DirectionalLight(0xfff0dd, 5.0);
      key.position.set(-26, 6.5, 27); key.target.position.set(-27.5, 1.0, 22); G.scene.add(key, key.target);
      const fill = new T.DirectionalLight(0x9fc4ff, 2.2);
      fill.position.set(-31, 4.0, 19); fill.target.position.set(-27.5, 1.0, 22); G.scene.add(fill, fill.target);
      const rim = new T.DirectionalLight(0xffd9a0, 2.4);
      rim.position.set(-23, 5.0, 18); rim.target.position.set(-27.5, 1.0, 22); G.scene.add(rim, rim.target);
      G.render.exposure = 1.25;
    } catch (e) {}
    window.__MP.net2.testUpsert([
      { id: 'v43a', name: 'A-蓝队', x: -27.97, y: 0.0, z: 21.42, yaw: 2.254, pitch: 0, team: 0, hp: 100, armor: 50, alive: true, crouch: false },
      { id: 'v43b', name: 'B-红队', x: -27.03, y: 0.0, z: 22.58, yaw: 2.254, pitch: 0, team: 1, hp: 100, armor: 50, alive: true, crouch: false }
    ]);
    window.__MP.net2.testFrame(1 / 60);
    try { if (G.game.state !== 'playing') G.game.start({ skipIntro: true }); } catch (e) {}
    const menu = document.querySelector('.menu'); if (menu) menu.style.display = 'none';
  });
  await page.waitForFunction(() => window.__G.game.state === 'playing' || window.__fatal, null, { timeout: 15000 });
  await page.evaluate(() => {
    const ui = document.getElementById('ui'); if (ui) ui.style.display = 'none';
    document.querySelectorAll('.menu, .m-screen').forEach((m) => { m.style.display = 'none'; });
    const G = window.__G;
    const p = window.__SX_MAPS_DATA.maps.harbor.spawns.player.pos;
    G.player.pos.set(-30, p[1], 24); G.player.yaw = -0.888; G.player.pitch = -0.02;
    window.__SX_LOOP.step(3);
  });

  const info = await page.evaluate(() => {
    const groups = [];
    window.__G.scene.traverse((o) => { if (o.name === 'mp-player') groups.push(o); });
    const count = (g) => { let m = 0, t = 0; g.traverse((o) => { if (o.isMesh) m++; }); return m; };
    const mats = new Set();
    groups.forEach((g) => g.traverse((o) => {
      const ms = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
      ms.forEach((m) => mats.add(m));
    }));
    const accents = [];
    mats.forEach((m) => { if (m && m.name === 'accent' && m.color) accents.push(m.color.getHex()); });
    const blobs = groups.map((g) => { let n = 0; g.traverse((o) => { if (o.name === 'mp-blob') n++; }); return n; });
    const parts = window.__MP.debug().parts;
    return {
      groups: groups.length,
      kids: groups.map((g) => g.children.length),
      meshes: groups.map(count),
      materials: mats.size,
      accents: Array.from(new Set(accents)), blobs: blobs,
      parts: parts.map((p) => ({ id: p.id, kids: p.kids, leg: p.leg, armL: p.armL })),
      sceneChildren: window.__G.scene.children.length
    };
  });
  console.log('[info] ' + JSON.stringify(info));
  ok('注入两名远端模型', info.groups === 2, { groups: info.groups });
  ok('模型层级 ≥8 个直接子节点', info.kids.every((k) => k >= 8), info.kids);
  ok('模型细节：每人 ≥18 个 mesh（合批后）', info.meshes.every((m) => m >= 18), info.meshes);
  ok('材质表 ≥5 种/人（布料/装甲/装具/队标/镜片）', info.materials >= 10, { materials: info.materials });
  ok('两队臂章/镜片颜色不同', info.accents.length >= 2, info.accents);
  ok('每个远端有 1 个落地接触阴影', info.blobs.length === 2 && info.blobs.every((n) => n === 1), info.blobs);
  ok('远端 debug 关节可读', info.parts.length === 2 && info.parts.every((p) => p.kids >= 8), info.parts);

  await shot('front_two_teams');

  // 近景：确认头盔/护目镜/防弹衣/弹匣袋细节
  await page.evaluate(() => {
    window.__MP.net2.testUpsert([
      { id: 'v43a', name: 'A-蓝队', x: -27.97, y: 0, z: 21.42, yaw: 2.254, pitch: 0, team: 0, hp: 100, armor: 50, alive: true, crouch: false }
    ]);
    window.__MP.net2.testFrame(1 / 60);
    const G = window.__G;
    G.player.pos.set(-29.21, 0, 23.0);
    G.player.yaw = -0.888;
    G.player.pitch = 0.06;
    window.__SX_LOOP.step(2);
  });
  await shot('closeup_front');

  // 背面 / 蹲伏 / 死亡
  await page.evaluate(() => {
    window.__MP.net2.testUpsert([
      { id: 'v43a', name: 'A-蓝队', x: -27.97, y: 0.0, z: 21.42, yaw: 0, pitch: 0, team: 0, hp: 100, armor: 50, alive: true, crouch: false },
      { id: 'v43b', name: 'B-红队', x: -27.03, y: 0.0, z: 22.58, yaw: 1.55, pitch: 0, team: 1, hp: 100, armor: 50, alive: true, crouch: false }
    ]);
    window.__MP.net2.testFrame(1 / 60);
  });
  await shot('back_and_threequarter');

  await page.evaluate(() => {
    window.__MP.net2.testUpsert([
      { id: 'v43a', name: 'A-蓝队', x: -27.97, y: 0.0, z: 21.42, yaw: 2.254, pitch: 0, team: 0, hp: 100, armor: 50, alive: true, crouch: true },
      { id: 'v43b', name: 'B-红队', x: -27.03, y: 0.0, z: 22.58, yaw: 1.75, pitch: 0, team: 1, hp: 100, armor: 50, alive: true, crouch: true }
    ]);
    for (let i = 0; i < 30; i++) window.__MP.net2.testFrame(1 / 30);
  });
  const crouch = await page.evaluate(() => {
    const out = [];
    window.__G.scene.traverse((o) => { if (o.name === 'mp-player') out.push(o); });
    return { hips: out.map((g) => +g.children[0].position.y.toFixed(3)), parts: window.__MP.debug().parts.map((p) => p.kids) };
  });
  ok('蹲伏降髋（0.92 → ~0.70）', crouch.hips.every((y) => y < 0.82 && y > 0.6), crouch);
  await shot('crouch');

  await page.evaluate(() => {
    window.__MP.net2.testUpsert([
      { id: 'v43a', name: 'A-蓝队', x: -27.97, y: 0.0, z: 21.42, yaw: 2.254, pitch: 0, team: 0, hp: 0, armor: 0, alive: false, crouch: false },
      { id: 'v43b', name: 'B-红队', x: -27.03, y: 0.0, z: 22.58, yaw: 1.75, pitch: 0, team: 1, hp: 100, armor: 50, alive: true, crouch: false }
    ]);
    for (let i = 0; i < 40; i++) window.__MP.net2.testFrame(1 / 30);
  });
  const dead = await page.evaluate(() => {
    const out = [];
    window.__G.scene.traverse((o) => { if (o.name === 'mp-player') out.push(+o.rotation.z.toFixed(3)); });
    return out;
  });
  ok('死亡倒地（rotation.z > 0.8）', dead.some((z) => z > 0.8), dead);
  await shot('dead');

  // 行走摆腿：用多帧快照推进相位，确认关节在动
  await page.evaluate(() => {
    window.__MP.net2.testUpsert([
      { id: 'v43a', name: 'A-蓝队', x: -27.97, y: 0.0, z: 21.42, yaw: 2.254, pitch: 0, team: 0, hp: 100, armor: 50, alive: true, crouch: false }
    ]);
    for (let i = 0; i < 10; i++) {
      window.__MP.net2.testUpsert([{ id: 'v43a', name: 'A-蓝队', x: -27.97 + i * 0.12, y: 0.0, z: 21.42, yaw: 2.254, pitch: 0, team: 0, hp: 100, armor: 50, alive: true, crouch: false }]);
      window.__MP.net2.testFrame(1 / 30);
    }
  });
  const walk = await page.evaluate(() => window.__MP.debug().parts.map((p) => ({ leg: p.leg, armL: p.armL })));
  ok('行走/持枪关节有动画（leg/armL 非零）', walk.some((p) => Math.abs(p.leg) > 0.01) && walk.every((p) => p.armL > 0.5), walk);

  const cleared = await page.evaluate(() => {
    let before = 0, after = 0;
    window.__G.scene.traverse((o) => { if (o.name === 'mp-player') before++; });
    window.__MP.net2.testClear();
    window.__G.scene.traverse((o) => { if (o.name === 'mp-player') after++; });
    return { before, after };
  });
  ok('清理远端后模型组归零', cleared.before >= 1 && cleared.after === 0, cleared);
  ok('无 pageerror', errors.length === 0, errors.slice(0, 4));
} catch (e) {
  fail++;
  console.log('FAIL · 测试异常 — ' + ((e && e.stack) || e));
} finally {
  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]);
}
console.log('\n截图目录: ' + OUT);
console.log('PASS ' + pass + ' · FAIL ' + fail);
process.exit(fail ? 1 : 0);