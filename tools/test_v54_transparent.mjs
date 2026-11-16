#!/usr/bin/env node
/* =====================================================================
   SALTLINE · tools/test_v54_transparent.mjs — V54 · PERF-3 透明网格/label 基线
   ---------------------------------------------------------------------
   做什么：
     1. medium 画质依次切四图（harbor/depot/ship/core），每图渲染几帧
        让可见性稳定；
     2. 遍历当前地图自身根节点（harbor 用 G.level.root，其余用
        MapKit.def(id).merged），统计：
          - mesh 总数 / 可见 mesh 数 / 三角形数
          - transparent=true 的 mesh 数与可见数
          - alphaTest>0、depthWrite=false 的 mesh 数（单独列，便于区分）
          - label mesh 数与唯一 label 纹理数（CanvasTexture）
          - 每图 top 材质（按 mesh 数，附透明/opacity/map 类型）
          - 透明材质 top 10
     3. 输出 JSON 报告（默认 bench/v54_transparent.json）。
     本脚本只测量、不设硬失败；阈值由 lead 后续根据基线收紧。

   怎么读：
     - transparentMeshes 是材质 m.transparent===true 的 mesh 数，V53
       基线约 177–396 个；
     - labelTextures 按 CanvasTexture.uuid 去重；label 图集/缓存优化的
       目标是把唯一纹理数降下来（同一文字复用同一 CanvasTexture）；
     - topMaterials 里同一 material.uuid 出现很多 mesh，说明是合批好的
       共享材质；若大量材质只有 1 个 mesh，是合批/图集的候选；
     - transparentTop 只统计透明材质，避免被不透明主体淹没；
     - 数量是“当前激活地图根节点”的口径，不含敌人、FX、第一人称手模
       等跨图常驻对象。

   用法：
     node tools/test_v54_transparent.mjs
     SX_TARGET=versions/几猫_V54.html node tools/test_v54_transparent.mjs
     SX_TRANSPARENT_REPORT=bench/v54_transparent.json node tools/test_v54_transparent.mjs
   注意：脚本只写，不在本机启动；浏览器验收由 lead 统一跑。
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, closeBrowser, waitReady, gameUrl, VIEWPORT } from './testkit.mjs';
import { GPU_MODE } from './pwargs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = process.env.SX_TARGET || 'game.html';
const QUALITY = process.env.SX_QUALITY || 'medium';
const REPORT = path.resolve(ROOT, process.env.SX_TRANSPARENT_REPORT || 'bench/v54_transparent.json');
const MAPS = ['harbor', 'depot', 'ship', 'core'];

const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.setDefaultTimeout(180000);
const errors = [];
page.on('pageerror', (e) => errors.push(String((e && e.message) || e)));

const report = {
  tool: 'test_v54_transparent', version: 'V54', generatedAt: new Date().toISOString(),
  target: TARGET, gpu: GPU_MODE, quality: QUALITY, maps: {}, totals: null, errors: null
};

try {
  await page.goto(gameUrl(TARGET, { q: QUALITY, noaudio: '1', autostart: '1', dynres: '0' }), { waitUntil: 'load', timeout: 240000 });
  await waitReady(page);
  await page.evaluate(() => {
    try { if (window.__G.game.state !== 'playing') window.__G.game.start({ skipIntro: true }); } catch (e) {}
    try { window.__SX.god(true); } catch (e) {}
  });
  report.label = await page.evaluate(() => window.__VERSION_LABEL);
  console.log('[v54-transparent] target=' + TARGET + ' label=' + report.label + ' gpu=' + GPU_MODE + ' quality=' + QUALITY);

  for (const id of MAPS) {
    const data = await page.evaluate(({ id }) => {
      const G = window.__G, R = G.render;
      if (window.__SX.mapId() !== id) window.__SX.switchMap(id);
      try { G.enemies.clear(); } catch (e) {}
      for (let i = 0; i < 10; i++) R.frame(1 / 60);

      const def = window.MapKit ? window.MapKit.def(id) : null;
      const root = id === 'harbor' ? G.level.root : (def && def.merged);
      const out = {
        map: id, current: window.__SX.mapId(), built: !!(def && def.built),
        rootName: root ? (root.name || '(unnamed)') : null,
        meshes: 0, visibleMeshes: 0, tris: 0,
        transparentMeshes: 0, visibleTransparentMeshes: 0,
        alphaMeshes: 0, depthWriteFalseMeshes: 0,
        labelMeshes: 0, labelVisibleMeshes: 0,
        labelTextures: [], labelTextureCount: 0,
        materials: 0, transparentMaterials: 0,
        types: {}, topMaterials: [], transparentTop: [],
        renderer: { programs: G.renderer.info.programs ? G.renderer.info.programs.length : 0, geometries: G.renderer.info.memory.geometries, textures: G.renderer.info.memory.textures }
      };
      if (!root) { out.error = 'map root missing'; return out; }

      const mats = new Map();
      const labels = new Map();
      const addMat = (m, visible, tris) => {
        if (!m) return;
        let e = mats.get(m.uuid);
        if (!e) {
          e = {
            uuid: m.uuid, name: m.name || '', type: m.type || 'Material',
            transparent: m.transparent === true, opacity: m.opacity == null ? 1 : m.opacity,
            alphaTest: m.alphaTest || 0, depthWrite: m.depthWrite !== false,
            side: m.side, vertexColors: !!m.vertexColors,
            mapType: m.map ? (m.map.isCanvasTexture ? 'CanvasTexture' : (m.map.type || 'Texture')) : null,
            color: m.color && m.color.getHexString ? '#' + m.color.getHexString() : null,
            meshes: 0, visibleMeshes: 0, tris: 0
          };
          mats.set(m.uuid, e);
        }
        e.meshes++;
        if (visible) e.visibleMeshes++;
        e.tris += tris;
      };

      const walk = (o, parentVisible) => {
        if (!o) return;
        const visible = parentVisible && o.visible !== false;
        if (o.isMesh) {
          const geo = o.geometry;
          const pos = geo && geo.attributes && geo.attributes.position;
          const tris = geo ? (geo.index ? geo.index.count / 3 : (pos ? pos.count / 3 : 0)) : 0;
          const list = Array.isArray(o.material) ? o.material : [o.material];
          out.meshes++;
          out.tris += tris;
          if (visible) out.visibleMeshes++;
          let isTransparent = false, isAlpha = false, isNoDepth = false, isLabel = false;
          for (const m of list) {
            if (!m) continue;
            addMat(m, visible, tris);
            if (m.transparent === true) isTransparent = true;
            if (m.alphaTest > 0) isAlpha = true;
            if (m.depthWrite === false) isNoDepth = true;
            if (m.map && (m.map.isCanvasTexture || (m.map.image && m.map.image.tagName === 'CANVAS'))) {
              isLabel = true;
              let l = labels.get(m.map.uuid);
              if (!l) {
                l = {
                  uuid: m.map.uuid,
                  width: m.map.image ? m.map.image.width : (m.map.source && m.map.source.data ? m.map.source.data.width : null),
                  height: m.map.image ? m.map.image.height : (m.map.source && m.map.source.data ? m.map.source.data.height : null),
                  meshes: 0
                };
                labels.set(m.map.uuid, l);
              }
              l.meshes++;
            }
          }
          if (isTransparent) { out.transparentMeshes++; if (visible) out.visibleTransparentMeshes++; }
          if (isAlpha) out.alphaMeshes++;
          if (isNoDepth) out.depthWriteFalseMeshes++;
          if (isLabel) { out.labelMeshes++; if (visible) out.labelVisibleMeshes++; }
        }
        const kids = o.children || [];
        for (let i = 0; i < kids.length; i++) walk(kids[i], visible);
      };
      walk(root, true);

      out.materials = mats.size;
      out.labelTextures = [...labels.values()];
      out.labelTextureCount = labels.size;
      const all = [...mats.values()];
      out.transparentMaterials = all.filter((m) => m.transparent).length;
      for (const m of all) out.types[m.type] = (out.types[m.type] || 0) + 1;
      const sortFn = (a, b) => (b.meshes - a.meshes) || (b.tris - a.tris);
      out.topMaterials = all.slice().sort(sortFn).slice(0, 10);
      out.transparentTop = all.filter((m) => m.transparent).sort(sortFn).slice(0, 10);
      return out;
    }, { id });
    report.maps[id] = data;
    console.log('[' + id.padEnd(6) + '] meshes ' + String(data.meshes).padStart(4) +
      ' (vis ' + String(data.visibleMeshes).padStart(4) + ')' +
      '  transparent ' + String(data.transparentMeshes).padStart(3) + ' (vis ' + data.visibleTransparentMeshes + ')' +
      '  labels ' + data.labelMeshes + '/' + data.labelTextureCount +
      '  alpha ' + data.alphaMeshes + '  noDepth ' + data.depthWriteFalseMeshes +
      '  mats ' + data.materials + '/' + data.transparentMaterials);
    if (data.topMaterials && data.topMaterials[0]) {
      const t = data.topMaterials[0];
      console.log('         top: ' + t.type + (t.name ? ' "' + t.name + '"' : '') + ' ×' + t.meshes + (t.transparent ? ' [transparent]' : ''));
    }
  }

  const vals = MAPS.map((id) => report.maps[id]).filter(Boolean);
  report.totals = vals.reduce((a, m) => {
    a.meshes += m.meshes || 0;
    a.visibleMeshes += m.visibleMeshes || 0;
    a.transparentMeshes += m.transparentMeshes || 0;
    a.visibleTransparentMeshes += m.visibleTransparentMeshes || 0;
    a.labelMeshes += m.labelMeshes || 0;
    a.labelTextureCount += m.labelTextureCount || 0;
    a.alphaMeshes += m.alphaMeshes || 0;
    a.depthWriteFalseMeshes += m.depthWriteFalseMeshes || 0;
    return a;
  }, { meshes: 0, visibleMeshes: 0, transparentMeshes: 0, visibleTransparentMeshes: 0, labelMeshes: 0, labelTextureCount: 0, alphaMeshes: 0, depthWriteFalseMeshes: 0 });
  report.errors = errors.slice();
  console.log('\n=== 四图合计 ===');
  console.log('  meshes ' + report.totals.meshes + '  transparent ' + report.totals.transparentMeshes +
    '  visible transparent ' + report.totals.visibleTransparentMeshes +
    '  labels ' + report.totals.labelMeshes + '/' + report.totals.labelTextureCount +
    '  alpha ' + report.totals.alphaMeshes + '  noDepth ' + report.totals.depthWriteFalseMeshes);
  console.log('\n结果：报告已生成（本脚本不设通过/失败）');
} catch (e) {
  report.errors = String((e && e.stack) || e);
  console.log('FAIL · 测量异常 — ' + ((e && e.stack) || e));
  process.exitCode = 1;
} finally {
  try {
    fs.mkdirSync(path.dirname(REPORT), { recursive: true });
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n');
    console.log('[v54-transparent] 报告：' + REPORT);
  } catch (e) { console.log('[v54-transparent] 报告写入失败：' + e); }
  await closeBrowser(browser);
}
process.exit(process.exitCode || 0);
