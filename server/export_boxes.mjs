#!/usr/bin/env node
/**
 * export_boxes.mjs — 从 game.html 运行时导出 G.physics.boxes 到 map_boxes.json
 *
 * 用法:
 *   CHROME_EXE=".../Google Chrome for Testing" node server/export_boxes.mjs
 *   node server/export_boxes.mjs --out server/map_boxes.json --game ./game.html
 *
 * 说明:
 *   - 只读 game.html，不会修改客户端。
 *   - 等 window.__ready 后从 window.__G.physics 读取，导出 min/max/surface/tag/opts。
 *   - 同时导出地图元信息（bounds/groundY/seaY/quayX/playerStart），供 server/sim.js 使用。
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const outPath = path.resolve(ROOT, arg('out', 'server/map_boxes.json'));
const gamePath = path.resolve(ROOT, arg('game', 'game.html'));
const exe = process.env.CHROME_EXE || undefined;
const timeout = Number(process.env.EXPORT_TIMEOUT_MS || 240000);

if (!fs.existsSync(gamePath)) {
  console.error('[export] game not found: ' + gamePath);
  process.exit(2);
}

const url = pathToFileURL(gamePath).href + '?q=low&noaudio=1&autostart=1';
console.log('[export] opening ' + url);

const browser = await chromium.launch({
  headless: true,
  executablePath: exe,
  args: [
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
    '--ignore-gpu-blocklist',
    '--allow-file-access-from-files',
  ],
});

let code = 0;
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e && e.message ? e.message : e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(String(m.text()).slice(0, 300));
  });

  await page.goto(url, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => window.__ready === true || !!window.__fatal, null, { timeout });
  const fatal = await page.evaluate(() => window.__fatal || null);
  if (fatal) throw new Error('game boot fatal: ' + fatal);

  const data = await page.evaluate(() => {
    const G = window.__G;
    if (!G || !G.physics || !Array.isArray(G.physics.boxes)) {
      throw new Error('window.__G.physics.boxes unavailable');
    }
    const round = (n) => Math.round(n * 1e4) / 1e4;
    // 碰撞盒坐标保留完整双精度，保证服务端与客户端物理逐位一致。
    const exact = (n) => n;
    const boxes = G.physics.boxes.map((b) => ({
      min: [exact(b.min.x), exact(b.min.y), exact(b.min.z)],
      max: [exact(b.max.x), exact(b.max.y), exact(b.max.z)],
      surface: b.surface || 'concrete',
      tag: b.tag || '',
      opts: {
        noNav: !!b.noNav,
        bulletOnly: !!b.bulletOnly,
        playerOnly: !!b.playerOnly,
      },
    }));
    const bounds = G.physics.bounds;
    const lvl = G.level || {};
    const ps = lvl.playerStart || null;
    return {
      boxes,
      meta: {
        source: 'game.html',
        exportedAt: new Date().toISOString(),
        count: boxes.length,
        bounds: bounds
          ? {
              min: [exact(bounds.min.x), exact(bounds.min.y), exact(bounds.min.z)],
              max: [exact(bounds.max.x), exact(bounds.max.y), exact(bounds.max.z)],
            }
          : null,
        groundY: 0,
        seaY: -1.6,
        quayX: 30,
        playerStart: ps && ps.pos ? { x: round(ps.pos.x), y: round(ps.pos.y), z: round(ps.pos.z), yaw: round(ps.yaw || 0) } : null,
      },
    };
  });

  const surfaces = {};
  const tags = {};
  let flags = 0;
  for (const b of data.boxes) {
    surfaces[b.surface] = (surfaces[b.surface] || 0) + 1;
    if (b.tag) tags[b.tag] = (tags[b.tag] || 0) + 1;
    if (b.opts.noNav || b.opts.bulletOnly || b.opts.playerOnly) flags++;
  }

  const payload = {
    meta: { ...data.meta, surfaces, tags, flagged: flags },
    boxes: data.boxes,
  };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload));

  console.log(
    JSON.stringify(
      {
        ok: true,
        out: outPath,
        bytes: fs.statSync(outPath).size,
        boxes: data.boxes.length,
        bounds: data.meta.bounds,
        playerStart: data.meta.playerStart,
        surfaces,
        tags,
        flagged: flags,
        bootErrors: errors.slice(0, 5),
      },
      null,
      1
    )
  );
  if (data.boxes.length === 0) {
    console.error('[export] warning: 0 boxes exported');
    code = 3;
  }
} catch (e) {
  console.error('[export] failed: ' + (e && e.stack ? e.stack : e));
  code = 1;
} finally {
  await browser.close().catch(() => {});
}
process.exit(code);
