#!/usr/bin/env node
/* Map review screenshot harness.
 * Usage:
 *   node tools/mapwork/shoot.mjs --map ship --out tools/mapwork/shots/ship --views tools/mapwork/views/ship.json
 * Options: --target <html> (default game.html), --quality <low|medium|high> (default medium),
 *          --width 960 --height 540, --tag <suffix>, --keep-ui
 * Views JSON: [{ "name":"deck", "pos":[x,y,z], "look":[x,y,z], "fov":70, "exposure":1.2,
 *                "survey":true, "plan":false, "hideWeapon":true }]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchOptions, GPU_MODE } from '../pwargs.mjs';
import { acquireGPU, releaseGPU } from './gpulock.mjs';

const A = process.argv.slice(2);
function arg(name, def) { const i = A.indexOf('--' + name); return i >= 0 && A[i + 1] ? A[i + 1] : def; }
const ROOT = process.cwd();
const mapId = arg('map', 'harbor');
const outDir = path.resolve(ROOT, arg('out', 'tools/mapwork/shots/' + mapId));
const target = path.resolve(ROOT, arg('target', 'game.html'));
const fast = A.includes('--fast');
const quality = arg('quality', fast ? 'low' : 'medium');
const W = Number(arg('width', fast ? '800' : '960')), H = Number(arg('height', fast ? '450' : '540'));
const namesArg = arg('names', '');
const nameSet = namesArg ? new Set(namesArg.split(',')) : null;
const tag = arg('tag', '');
const keepUI = A.includes('--keep-ui');
const exe = process.env.CHROME_EXE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const DEFAULT_VIEWS = {
  harbor: [
    { name: 'yard', pos: [-30, 6, 24], look: [2, 1, -2] },
    { name: 'quay', pos: [34, 5, 22], look: [8, 1, -6] },
    { name: 'shed', pos: [-8, 2.2, -14], look: [8, 1.2, -24] },
    { name: 'gate', pos: [-34, 2.4, 4], look: [10, 1.6, 12] },
    { name: 'crane', pos: [16, 3, 18], look: [34, 8, -6] },
    { name: 'plan', pos: [0, 52, 0.1], look: [0, 0, 0], fov: 55, plan: true, exposure: 1.5 }
  ],
  depot: [
    { name: 'hall', pos: [0, 2.2, 15], look: [0, 1.4, -12] },
    { name: 'racks', pos: [-22, 2.2, -6], look: [14, 1.6, -6] },
    { name: 'dock', pos: [0, 2.2, -16], look: [0, 1.6, 8] },
    { name: 'mezz', pos: [24, 4.9, 6], look: [8, 1.6, -4] },
    { name: 'cold', pos: [22, 2.2, -16], look: [-6, 1.6, -16] },
    { name: 'plan', pos: [0, 46, 0.1], look: [0, 0, 0], fov: 55, plan: true, exposure: 1.4 }
  ],
  ship: [
    { name: 'bow', pos: [0, 3.0, -7.5], look: [0, 1.2, 8] },
    { name: 'stern', pos: [0, 3.0, 7.6], look: [0, 1.4, -8] },
    { name: 'deck_e', pos: [24, 3.2, 0], look: [-10, 1.2, 0] },
    { name: 'deck_w', pos: [-24, 3.2, 0], look: [10, 1.2, 0] },
    { name: 'bridge', pos: [0, 5.0, 4.2], look: [0, 4.0, 9] },
    { name: 'plan', pos: [0, 42, 0.1], look: [0, 0, 0], fov: 55, plan: true, exposure: 1.6 }
  ],
  core: [
    { name: 'reactor', pos: [0, 2.2, 10.5], look: [0, 3.2, 0] },
    { name: 'west', pos: [-15, 2.2, 8], look: [4, 2.4, -4] },
    { name: 'east', pos: [15, 2.2, -8], look: [-4, 2.4, 4] },
    { name: 'south', pos: [0, 2.2, -11], look: [0, 3.2, 0] },
    { name: 'catwalk', pos: [-8.4, 4.4, 4], look: [6, 3.0, -4] },
    { name: 'plan', pos: [0, 34, 0.1], look: [0, 0, 0], fov: 55, plan: true, exposure: 1.5 }
  ]
};

const viewsFile = arg('views', '');
let views = DEFAULT_VIEWS[mapId] || DEFAULT_VIEWS.harbor;
if (viewsFile && fs.existsSync(path.resolve(ROOT, viewsFile))) {
  views = JSON.parse(fs.readFileSync(path.resolve(ROOT, viewsFile), 'utf8'));
}
if (nameSet) views = views.filter((v) => nameSet.has(v.name));
if (!views.length) { console.error('[shoot] no views selected (names=' + namesArg + ')'); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });

const MISSION = { harbor: 0, depot: 3, ship: 4, core: null };
await acquireGPU();
process.on('exit', releaseGPU);
const browser = await chromium.launch(launchOptions({ headless: true }));
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 300)); });

const url = pathToFileURL(target).href + '?q=' + quality + '&noaudio=1&autostart=1&dt=0.1';
const t0 = Date.now();
await page.goto(url, { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction(() => window.__ready === true || !!window.__fatal, null, { timeout: 300000 });
const fatal = await page.evaluate(() => window.__fatal || null);
if (fatal) { console.error('[shoot] fatal: ' + fatal); process.exit(2); }
await page.waitForTimeout(600);

const setup = await page.evaluate(({ mapId, mission, hideUI }) => {
  const G = window.__G;
  if (mission == null) { window.__SX.switchMap(mapId); G.game.start({ skipIntro: true }); }
  else { window.__SX.applyMission(mission); G.game.start({ skipIntro: true }); }
  if (hideUI) { const ui = document.getElementById('ui'); if (ui) ui.style.display = 'none'; }
  // hide enemies and viewmodel for clean map shots
  try { (G.enemies.list || []).forEach((e) => { const o = e.mesh || e.root || e.object || e.group; if (o) o.visible = false; }); } catch (e) {}
  try {
    const w = G.weapon;
    ['root','group','mesh','view','viewmodel','object'].forEach((k) => { if (w && w[k] && w[k].visible !== undefined) { try { w[k].visible = false; } catch (e) {} } });
  } catch (e) {}
  try { G.game.pause(); } catch (e) {}
  window.__mapWork = { origExposure: G.render.exposure, origFog: G.scene.fog, extraLights: [], weaponHidden: [] };
  return { map: window.__SX.mapId(), state: G.game.state, boxes: G.physics.boxes.length };
}, { mapId, mission: MISSION[mapId] ?? null, hideUI: !keepUI });
console.log('[shoot] gpu=' + GPU_MODE + ' setup ' + JSON.stringify(setup) + ' views=' + views.map((v) => v.name).join(','));

/* Dump live collision data so verify.mjs can reuse it without booting Chrome. */
const livePath = path.resolve(ROOT, 'tools/mapwork/' + mapId + '/live.json');
const live = await page.evaluate(({ mapId }) => {
  const G = window.__G, P = G.physics;
  const relays = [];
  try { const rr = window.__SX.mapRelays(mapId) || {}; for (const k of Object.keys(rr)) relays.push({ id: k, pos: rr[k].pos.toArray() }); } catch (e) {}
  const b = (x) => Math.round(x * 1e4) / 1e4;
  return {
    mapId, builtAt: Date.now(),
    boxes: P.boxes.map((q) => ({ min: [b(q.min.x), b(q.min.y), b(q.min.z)], max: [b(q.max.x), b(q.max.y), b(q.max.z)], surface: q.surface || 'concrete', tag: q.tag || '', opts: { noNav: !!q.noNav, bulletOnly: !!q.bulletOnly, playerOnly: !!q.playerOnly } })),
    bounds: { min: P.bounds.min.toArray(), max: P.bounds.max.toArray() },
    playerStart: G.level.playerStart.pos.toArray(),
    relays,
    mapInfo: window.__SX.mapInfo(),
    pageErrors: (window.__errors || []).slice(0, 8)
  };
}, { mapId });
fs.mkdirSync(path.dirname(livePath), { recursive: true });
fs.writeFileSync(livePath, JSON.stringify(live));
console.log('[shoot] live=' + path.relative(ROOT, livePath) + ' boxes=' + live.boxes.length);

/* 预热两帧：避免第一个机位拍到开场/标题镜头（depot 反馈的 logo 污染）。 */
await page.evaluate(() => { const G = window.__G; if (G && G.render) { G.render.frame(0.016); G.render.frame(0.016); } });
await page.waitForTimeout(200);

const results = [];
for (const v of views) {
  const stat = await page.evaluate((v) => {
    const G = window.__G, T = window.__G.THREE, W = window.__mapWork;
    // reset temporary state
    W.extraLights.forEach((l) => { if (l.parent) l.parent.remove(l); }); W.extraLights = [];
    G.render.exposure = W.origExposure;
    G.scene.fog = W.origFog;
    if (v.plan) G.scene.fog = null;
    if (v.exposure != null) G.render.exposure = v.exposure;
    if (v.fov && G.camera.fov !== v.fov) { G.camera.fov = v.fov; G.camera.updateProjectionMatrix(); }
    G.camera.position.set(v.pos[0], v.pos[1], v.pos[2]);
    G.camera.lookAt(v.look[0], v.look[1], v.look[2]);
    G.camera.updateMatrixWorld(true);
    if (v.survey) {
      const l = new T.PointLight(0xfff0dd, 260, 40, 2);
      l.position.set(v.pos[0], v.pos[1] + 2, v.pos[2]);
      G.scene.add(l); W.extraLights.push(l);
      // second light nearer the look target to lift mid-ground
      const l2 = new T.PointLight(0xdfe9ff, 180, 34, 2);
      l2.position.set((v.pos[0] + v.look[0]) / 2, v.pos[1] - 0.5, (v.pos[2] + v.look[2]) / 2);
      G.scene.add(l2); W.extraLights.push(l2);
    }
    G.render.frame(0.016);
    G.render.frame(0.016);
    const info = G.render.renderer.info.render;
    G.events.emit('sx:mapwork-shot', { name: v.name });
    return { name: v.name, calls: info.calls, triangles: info.triangles, cam: G.camera.position.toArray() };
  }, v);
  await page.waitForTimeout(180);
  const file = path.join(outDir, (tag ? tag + '_' : '') + v.name + '.png');
  await page.screenshot({ path: file, timeout: 120000 });
  results.push({ ...stat, file });
  console.log('[shoot] ' + v.name + ' calls=' + stat.calls + ' tris=' + stat.triangles + ' -> ' + file);
}
const summary = await page.evaluate(() => {
  const G = window.__G;
  return {
    map: window.__SX.mapId(),
    boxes: G.physics.boxes.length,
    mapInfo: window.__SX.mapInfo(),
    lights: G.scene.children.filter((o) => o.isLight).length,
    errors: (window.__errors || []).slice(0, 8)
  };
});
const out = { map: mapId, target: path.relative(ROOT, target), quality, views: results, summary, pageErrors: errs.slice(0, 10), seconds: Math.round((Date.now() - t0) / 1000) };
fs.writeFileSync(path.join(outDir, 'stats.json'), JSON.stringify(out, null, 1));
console.log('[shoot] done ' + out.seconds + 's ' + JSON.stringify(summary));
if (errs.length) console.log('[shoot] errors: ' + JSON.stringify(errs.slice(0, 5)));
await browser.close();
process.exit(errs.length ? 1 : 0);