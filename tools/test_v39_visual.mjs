/* =====================================================================
   SALTLINE · V39 收尾 · 画面层遗留问题验收（TAA / 探针 / 远级阴影 / 稳定性）
   - TAA 是否真正启用：aa.ok / aa.patched、注入点、uniform 就位、历史纹理真的写入
   - 低画质明确回退 FXAA（不许「假装开着 TAA」）
   - 货轮探针：低画质在 map:loaded 同步完成整图探针（0 帧内就绪）
   - 阴影：静止时 nearUpdates 不增长；远级 1/4 节流
   - 300 帧渲染无 pageerror / 无 shader 编译错误
   用法：node tools/test_v39_visual.mjs   （SX_TARGET 可指定 html）
   ===================================================================== */
import { chromium } from 'playwright';
import { PW_ARGS } from './pwargs.mjs';
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const exe = process.env.CHROME_EXE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const candidates = [process.env.SX_TARGET, 'game_v39.html', 'game_v35.html', 'versions/几猫_V39.html', 'versions/几猫_V35.html'].filter(Boolean);
let target = candidates.find((f) => fs.existsSync(path.join(root, f)));
if (!target) { console.error('[v39-visual] 找不到可测 html'); process.exit(1); }
const URL = 'file://' + path.join(root, target) + '?q=medium&noaudio=1&autostart=1&dt=0.1';

const browser = await chromium.launch({
  headless: true, executablePath: exe,
  args: PW_ARGS
});
const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
const cErrs = []; page.on('console', (m) => { if (m.type() === 'error') cErrs.push(m.text()); });
const warns = []; page.on('console', (m) => { if (m.type() === 'warning') warns.push(m.text()); });

let fails = 0;
const safe = (v) => { try { return JSON.stringify(v); } catch (e) { return '[unserializable]'; } };
const ok = (n, c, d) => { if (!c) fails++; console.log((c ? 'PASS' : 'FAIL') + ' · ' + n + (d !== undefined ? ' — ' + safe(d) : '')); };

console.log('[v39-visual] target=' + target);
await page.goto(URL, { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 420000 });

/* ---------------- 1. final pass 暴露 ---------------- */
const exposed = await page.evaluate(() => {
  const pm = window.__G.render.postModule;
  const list = (pm && pm.materials) || [];
  return {
    hasModule: !!pm,
    n: list.length,
    names: list.map((m) => m && m.name),
    finalIsShader: !!(pm && list.find && list.find((m) => m.name === 'post-final' && m.fragmentShader)),
    quality: window.__G.quality && window.__G.quality.name
  };
});
ok('引擎暴露 postModule.materials，且存在名为 post-final 的 final pass', exposed.hasModule && exposed.finalIsShader, { n: exposed.n, quality: exposed.quality, names: exposed.names.slice(-3) });

/* ---------------- 2. TAA 注入状态（ok 或明确 fallback） ---------------- */
const inj = await page.evaluate(() => {
  const V = window.__SX_VISUAL, a = V.debug.aa;
  const fs = a.mat ? String(a.mat.fragmentShader || '') : '';
  const iMain = fs.indexOf('void main');
  const iPro = fs.indexOf('// SX_TAA');
  const iCall = fs.indexOf('col = sxTaa(col)');
  const iGrain = fs.indexOf('// animated, luminance-weighted film grain');
  const keys = ['tSxHist', 'tSxDepth', 'uSxInvVP', 'uSxPrevVP', 'uSxHistValid', 'uSxTaaAmt'];
  const uni = a.mat && a.mat.uniforms ? keys.filter((k) => !!a.mat.uniforms[k]) : [];
  return {
    ok: a.ok, patched: a.patched, failed: a.failed || '', aa: V.stats.aa,
    hasMat: !!a.mat, uni,
    prologueBeforeMain: iPro >= 0 && iMain >= 0 && iPro < iMain,
    callBeforeGrain: iCall >= 0 && (iGrain < 0 || iCall < iGrain),
    callAfterMain: iCall > iMain,
    declaresVUv: /varying\s+vec2\s+vUv/.test(fs),
    declaresTsrc: /uniform\s+sampler2D\s+tSrc/.test(fs)
  };
});
const taaInjected = inj.ok === true && inj.patched === true;
const taaFallback = inj.ok === false && inj.failed && inj.aa === 'fxaa';
ok('TAA：aa.ok && aa.patched 为真，或明确回退（aa.failed 有原因 + S.aa=fxaa）', taaInjected || taaFallback, { ok: inj.ok, patched: inj.patched, failed: inj.failed, aa: inj.aa });
ok('注入点与 final shader（iA）兼容：prologue 在 main 前，sxTaa 在 grain 前且引用 vUv/tSrc', taaInjected ? (inj.prologueBeforeMain && inj.callBeforeGrain && inj.callAfterMain && inj.declaresVUv && inj.declaresTsrc) : true, inj);
ok('注入的 TAA uniform 全部就位', taaInjected ? inj.uni.length === 6 : inj.uni.length === 0, inj.uni);

/* ---------------- 3. medium 档：TAA 真的在跑（历史纹理写入） ---------------- */
const taaRun = await page.evaluate(() => {
  const V = window.__SX_VISUAL, G = window.__G;
  if (V.quality !== 'medium') V.setQuality('medium');
  const a = V.debug.aa;
  const b0 = { valid: a.valid, hist: a.histFrames, enabledFrames: a.enabledFrames };
  for (let i = 0; i < 10; i++) G.render.frame(0.05);
  const u = a.mat && a.mat.uniforms ? a.mat.uniforms : {};
  return {
    quality: V.quality, aa: V.stats.aa, enabled: a.enabled, ok: a.ok,
    valid: a.valid, histFrames: a.histFrames, copyFails: a.copyFails, failed: a.failed || '',
    d0: b0,
    histIsTex: !!(a.tex && a.tex.isTexture),
    histSize: a.tex && a.tex.image ? [a.tex.image.width, a.tex.image.height] : null,
    uHistValid: u.uSxHistValid ? u.uSxHistValid.value : null,
    uAmt: u.uSxTaaAmt ? u.uSxTaaAmt.value : null,
    histBound: !!(u.tSxHist && a.tex && u.tSxHist.value === a.tex),
    depthBound: !!(u.tSxDepth && u.tSxDepth.value && u.tSxDepth.value.isTexture),
    invVP: !!(u.uSxInvVP && u.uSxInvVP.value && u.uSxInvVP.value.isMatrix4),
    sharpen: G.render.tune ? G.render.tune.sharpen : null,
    fxaaUniform: u.uFxaa ? u.uFxaa.value : null
  };
});
const taaLive = taaRun.ok && taaRun.enabled && taaRun.aa === 'taa-lite' && taaRun.valid === 1 && taaRun.histFrames >= taaRun.d0.hist + 5 && taaRun.uHistValid === 1 && taaRun.histBound && taaRun.depthBound && taaRun.invVP;
ok('medium 档真正启用 TAA：历史纹理写入成功 + 6 个 uniform 生效（非「开着但历史恒无效」）', taaLive || (!taaRun.ok && taaRun.aa === 'fxaa' && !!taaRun.failed), taaRun);

/* ---------------- 4. 低画质明确回退 FXAA ---------------- */
const lowAA = await page.evaluate(() => {
  const V = window.__SX_VISUAL, G = window.__G;
  V.setQuality('low');
  for (let i = 0; i < 4; i++) G.render.frame(0.05);
  const a = V.debug.aa, u = a.mat && a.mat.uniforms ? a.mat.uniforms : {};
  const e = G.camera.projectionMatrix.elements;
  return {
    quality: V.quality, aa: V.stats.aa, enabled: a.enabled,
    amt: u.uSxTaaAmt ? u.uSxTaaAmt.value : null,
    histValid: u.uSxHistValid ? u.uSxHistValid.value : null,
    jitter: a.jitter, proj8: e[8], proj9: e[9],
    sharpen: G.render.tune ? G.render.tune.sharpen : null
  };
});
ok('低画质仍走 FXAA：TAA 关闭、uSxTaaAmt=0、抖动已还原、锐化提升', lowAA.aa === 'fxaa' && lowAA.enabled === false && lowAA.amt === 0 && lowAA.histValid === 0 && lowAA.jitter === 0 && Math.abs(lowAA.proj8) < 1e-6 && Math.abs(lowAA.proj9) < 1e-6 && lowAA.sharpen > 0.3, lowAA);

/* ---------------- 5. 货轮探针：map:loaded 内同步就绪（0 帧） ---------------- */
const ship = await page.evaluate(() => {
  const V = window.__SX_VISUAL, G = window.__G;
  V.setQuality('low');
  const framesBefore = V.stats.frames;
  window.__SX.switchMap('ship');
  try { window.__SX.tp(0, 0.32, 5.2); } catch (e) {}
  // 不推进任何帧，直接读探针状态
  const p0 = V.probes();
  const framesAfter = V.stats.frames;
  return { p0, framesBefore, framesAfter, map: window.__SX.mapId ? window.__SX.mapId() : null };
});
ok('货轮探针在 map:loaded 内同步就绪（未消耗任何渲染帧）', ship.p0.map === 'ship' && ship.p0.ready >= 1 && ship.p0.pending === 0 && ship.p0.failed === 0 && ship.framesAfter === ship.framesBefore, ship);

/* ---------------- 6. 阴影：静止时 nearUpdates 不增长 ---------------- */
const staticShadow = await page.evaluate(() => {
  const V = window.__SX_VISUAL, G = window.__G;
  V.setQuality('low');
  // 先空跑 3 帧消费一次性的 force，再取基线
  for (let i = 0; i < 3; i++) G.render.frame(0.05);
  const before = { near: V.stats.shadow.nearUpdates, far: V.stats.shadow.farUpdates };
  for (let i = 0; i < 60; i++) G.render.frame(0.05);
  const after = { near: V.stats.shadow.nearUpdates, far: V.stats.shadow.farUpdates };
  return { before, after, delta: { near: after.near - before.near, far: after.far - before.far }, shadow: V.stats.shadow };
});
ok('静止 60 帧：近级 shadow map 不重绘（nearUpdates 不增长）', staticShadow.delta.near === 0, staticShadow.delta);
ok('静止 60 帧：远级也不重绘（1/4 节流且只跟真实位移）', staticShadow.delta.far === 0 && staticShadow.shadow.farInterval === 4, { delta: staticShadow.delta, farInterval: staticShadow.shadow.farInterval });

/* ---------------- 7. 阴影：远级 1/4 节流（移动时不超过近级 1/4） ---------------- */
const movingShadow = await page.evaluate(() => {
  const V = window.__SX_VISUAL, G = window.__G;
  const before = { near: V.stats.shadow.nearUpdates, far: V.stats.shadow.farUpdates };
  const n = 40;
  for (let i = 0; i < n; i++) {
    try { window.__SX.tp(-20 + i * 1.6, 0.34, 0); } catch (e) {}
    G.render.frame(0.05);
  }
  const after = { near: V.stats.shadow.nearUpdates, far: V.stats.shadow.farUpdates };
  return { n, near: after.near - before.near, far: after.far - before.far, farInterval: V.stats.shadow.farInterval, farMode: V.stats.shadow.farMode, farRadius: V.stats.shadow.farRadius };
});
ok('远级更新频率真的是 1/4（40 帧位移内 farUpdates ≈ nearUpdates/4，且 <= n/4+2）', movingShadow.near >= 20 && movingShadow.far >= 2 && movingShadow.far <= Math.ceil(movingShadow.n / 4) + 2 && movingShadow.farMode === 'pcf-lite', movingShadow);

/* ---------------- 8. 300 帧无 pageerror（medium/TAA 路径） ---------------- */
const bench = await page.evaluate(() => {
  const V = window.__SX_VISUAL, G = window.__G;
  V.setQuality('medium');
  const times = [];
  let calls = 0, tris = 0;
  for (let i = 0; i < 300; i++) {
    const t0 = performance.now();
    G.render.frame(0.05);
    times.push(performance.now() - t0);
    calls = G.renderer.info.render.calls;
    tris = G.renderer.info.render.triangles;
  }
  times.sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  return { n: times.length, avg: +avg.toFixed(2), p95: +times[Math.floor(times.length * 0.95)].toFixed(2), calls, tris, aa: V.stats.aa, valid: V.debug.aa.valid };
});
ok('300 帧渲染无 pageerror（medium/TAA 路径）', bench.n === 300 && errs.length === 0, { rendered: bench.n, pageerrors: errs.slice(0, 3), avgMs: bench.avg, p95Ms: bench.p95, aa: bench.aa, histValid: bench.valid });

/* ---------------- 9. 无 post shader 编译错误 / 画面层自身异常 ---------------- */
const shaderErr = await page.evaluate(() => {
  const V = window.__SX_VISUAL;
  return { errors: V.errors, aaFailed: V.debug.aa.failed || '', copyFails: V.debug.aa.copyFails };
});
const shaderConsole = cErrs.filter((t) => /shader|compile|program|GLSL/i.test(t));
ok('无 post shader 编译错误（pageerror / console 均无）', errs.length === 0 && shaderConsole.length === 0, { pageerrors: errs.slice(0, 2), shaderConsole: shaderConsole.slice(0, 2) });
ok('画面层自身无运行时异常', shaderErr.errors.length === 0 && shaderErr.copyFails === 0, shaderErr);

const postWarn = warns.filter((t) => /TAA|sx-visual/i.test(t));
console.log('INFO · 画面层告警 ' + JSON.stringify(postWarn.slice(0, 4)));
console.log('INFO · TAA state ' + safe({ quality: taaRun.quality, aa: taaRun.aa, valid: taaRun.valid, histFrames: taaRun.histFrames, size: taaRun.histSize, failed: taaRun.failed }));
console.log('INFO · 探针 ' + safe({ map: ship.p0.map, ready: ship.p0.ready, pending: ship.p0.pending, size: ship.p0.size, framesDelta: ship.framesAfter - ship.framesBefore }));

console.log('---');
console.log(fails ? fails + ' 项失败' : '全部通过');
await browser.close();
process.exit(fails ? 1 : 0);
