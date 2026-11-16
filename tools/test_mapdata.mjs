#!/usr/bin/env node
/**
 * tools/test_mapdata.mjs — 地图数据管线测试（WP32-6）
 *
 * 1) 结构：四张 packages/data/maps/<id>.map.json 字段齐全、计数正确、
 *    bounds/ground 不再沿用港区、boxes 与 server/maps.json 一致；
 *    src/data_maps.js 可解析且不含碰撞盒。
 * 2) 运行时：Playwright 打开构建后的 game.html（?q=low&noaudio=1&autostart=1&dt=0.1），
 *    逐图通过 window.__SX.switchMap(id) 切图，用 G.physics.groundHeight / raycast /
 *    nav.isWalkable / nav.findPath 校验 player/enemy/air/team/boss/pickup/relay；
 *    并断言每张图的中继与 MapKit/关卡一致、无运行时错误。
 *
 * 用法：node tools/test_mapdata.mjs
 * 退出码：0 全通过，1 有失败。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { PW_ARGS } from './pwargs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAP_IDS = ['harbor', 'depot', 'ship', 'core'];
const DATA_DIR = path.join(ROOT, 'packages', 'data', 'maps');
const CLIENT_FILE = path.join(ROOT, 'src', 'data_maps.js');
const GAME = path.join(ROOT, 'game.html');
const CHROME_EXE = process.env.CHROME_EXE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const KINDS = new Set(['medkit', 'armor', 'ammo', 'grenade']);
const COVER_KEYS = ['bounds', 'ground', 'spawns', 'cover', 'pickups', 'relays', 'zones', 'nav'];

let failures = 0;
let passes = 0;

function check(name, cond, detail) {
  if (cond) {
    passes++;
    console.log('PASS · ' + name + (detail !== undefined ? ' — ' + JSON.stringify(detail) : ''));
  } else {
    failures++;
    console.log('FAIL · ' + name + (detail !== undefined ? ' — ' + JSON.stringify(detail) : ''));
  }
}

function isNum(n) {
  return typeof n === 'number' && Number.isFinite(n);
}
function isPos(p) {
  return Array.isArray(p) && p.length === 3 && p.every(isNum);
}
function isStr(s) {
  return typeof s === 'string' && s.length > 0;
}

/* ------------------------------------------------------------ 1. 文件结构 */

function checkStructure() {
  console.log('\n== 结构检查 ==');
  const server = JSON.parse(fs.readFileSync(path.join(ROOT, 'server', 'maps.json'), 'utf8'));
  const serverMaps = server.maps || server;
  const maps = {};

  for (const id of MAP_IDS) {
    const file = path.join(DATA_DIR, id + '.map.json');
    check(id + ' .map.json 存在', fs.existsSync(file));
    if (!fs.existsSync(file)) continue;
    const m = JSON.parse(fs.readFileSync(file, 'utf8'));
    maps[id] = m;

    check(id + ' id/version', m.id === id && isNum(m.version), { id: m.id, version: m.version });
    check(id + ' 顶层字段齐全',
      ['id', 'version', 'bounds', 'ground', 'boxes', 'spawns', 'cover', 'pickups', 'relays', 'zones', 'triggers', 'probes', 'nav', 'validated']
        .every((k) => Object.prototype.hasOwnProperty.call(m, k)),
      Object.keys(m));

    const b = m.bounds;
    check(id + ' bounds 合法',
      b && isPos(b.min) && isPos(b.max) && b.min[0] < b.max[0] && b.min[1] < b.max[1] && b.min[2] < b.max[2],
      b);
    check(id + ' bounds 不是港区默认值',
      id === 'harbor' || !(b.min[0] === -40 && b.min[2] === -30 && b.max[0] === 40 && b.max[2] === 30),
      b);
    check(id + ' ground 三键', m.ground && isNum(m.ground.y) &&
      Object.prototype.hasOwnProperty.call(m.ground, 'seaY') &&
      Object.prototype.hasOwnProperty.call(m.ground, 'quayX'), m.ground);
    check(id + ' ground 室内无海',
      id === 'harbor' || id === 'ship' ? true : m.ground.seaY === null && m.ground.quayX === null,
      m.ground);

    check(id + ' boxes 与 server/maps.json 一致',
      Array.isArray(m.boxes) && serverMaps[id] && m.boxes.length === (serverMaps[id].boxes || []).length,
      { data: m.boxes.length, server: (serverMaps[id] || {}).boxes ? serverMaps[id].boxes.length : null });
    check(id + ' boxes 字段格式',
      m.boxes.every((x) => isPos(x.min) && isPos(x.max) && isStr(x.surf) && (!x.flags || Array.isArray(x.flags))));

    const s = m.spawns;
    check(id + ' spawns 子字段齐全',
      s && s.player && isPos(s.player.pos) && isNum(s.player.yaw) &&
      Array.isArray(s.enemy) && Array.isArray(s.air) && Array.isArray(s.team) && Array.isArray(s.boss));
    check(id + ' 敌人出生点 12..20',
      s.enemy.length + s.air.length >= 12 && s.enemy.length + s.air.length <= 20,
      { enemy: s.enemy.length, air: s.air.length });
    check(id + ' 队伍基地恰好 2 个',
      s.team.length === 2 && s.team[0].team === 0 && s.team[1].team === 1 &&
      s.team.every((t) => isPos(t.pos) && isNum(t.yaw) && isNum(t.radius)), s.team.length);
    check(id + ' BOSS 出生点 >=1', s.boss.length >= 1 && s.boss.every((x) => isPos(x.pos) && isNum(x.yaw)), s.boss.length);
    check(id + ' 地面敌人字段',
      s.enemy.every((x) => isPos(x.pos) && x.type === 'ground' && isStr(x.zone)));
    check(id + ' 空中敌人字段', s.air.every((x) => isPos(x.pos) && isStr(x.zone)));

    check(id + ' pickups >= 8 且格式正确',
      m.pickups.length >= 8 && m.pickups.every((p) => KINDS.has(p.kind) && isPos(p.pos) && isNum(p.respawn)),
      { count: m.pickups.length, kinds: [...new Set(m.pickups.map((p) => p.kind))] });
    check(id + ' relays 格式正确 / id 唯一',
      m.relays.every((r) => isStr(r.id) && isPos(r.pos) && isStr(r.labelKey)) &&
      new Set(m.relays.map((r) => r.id)).size === m.relays.length,
      m.relays.map((r) => r.id));
    check(id + ' zones 格式正确',
      m.zones.length > 0 && m.zones.every((z) => isStr(z.id) && isPos(z.min) && isPos(z.max) &&
        typeof z.interior === 'boolean' && isStr(z.reverb)),
      m.zones.map((z) => z.id));
    check(id + ' cover 格式正确',
      m.cover.length >= 6 && m.cover.every((c) => isPos(c.pos) && isPos(c.normal) &&
        (c.height === 'low' || c.height === 'high') && isStr(c.zone)),
      m.cover.length);
    check(id + ' triggers/probes 为空数组',
      Array.isArray(m.triggers) && m.triggers.length === 0 &&
      Array.isArray(m.probes) && m.probes.length === 0);
    check(id + ' nav 参数', m.nav && isNum(m.nav.cell) && m.nav.cell > 0 && isNum(m.nav.agentRadius) && m.nav.agentRadius > 0, m.nav);
    check(id + ' validated.ok', m.validated && m.validated.ok === true && m.validated.errors === 0, m.validated);
  }

  // G10：拾取物与 BOSS 点位必须逐图不同，不能是港区坐标的复制。
  const sig = (id) => JSON.stringify(maps[id] ? {
    pickups: (maps[id].pickups || []).map((p) => p.pos),
    boss: (maps[id].spawns || {}).boss
  } : null);
  check('G10 四图 pickups/boss 不共用港区数据',
    MAP_IDS.every((id) => maps[id]) && new Set(MAP_IDS.map(sig)).size === MAP_IDS.length);

  const indexFile = path.join(DATA_DIR, 'index.json');
  check('index.json 存在且四图齐全', fs.existsSync(indexFile) && (() => {
    const idx = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
    return MAP_IDS.every((id) => idx.maps && idx.maps[id] && idx.maps[id].file === id + '.map.json');
  })());

  check('src/data_maps.js 存在', fs.existsSync(CLIENT_FILE));
  const js = fs.existsSync(CLIENT_FILE) ? fs.readFileSync(CLIENT_FILE, 'utf8') : '';
  check('src/data_maps.js 体积紧凑（<64KB）', js.length > 0 && js.length < 65536, { bytes: js.length });
  let client = null;
  try {
    const body = js.slice(js.indexOf('{'), js.lastIndexOf('}') + 1);
    client = JSON.parse(body);
  } catch (e) {
    check('src/data_maps.js JSON 可解析', false, String(e.message));
  }
  check('window.__SX_MAPS_DATA 结构', !!client && client.version === 1 && client.maps &&
    MAP_IDS.every((id) => client.maps[id]), client && Object.keys(client.maps || {}));
  if (client && client.maps) {
    for (const id of MAP_IDS) {
      const cm = client.maps[id];
      check(id + ' 客户端字段只含玩法数据',
        cm && Object.keys(cm).sort().join(',') === COVER_KEYS.slice().sort().join(',') &&
        !Object.prototype.hasOwnProperty.call(cm, 'boxes'),
        cm && Object.keys(cm));
      check(id + ' 客户端 pickups/relays 与 map.json 一致',
        maps[id] && JSON.stringify(cm.pickups) === JSON.stringify(maps[id].pickups) &&
        JSON.stringify(cm.relays) === JSON.stringify(maps[id].relays));
    }
  }

  return maps;
}

/* ------------------------------------------------------------ 2. 运行时 */

async function checkRuntime(maps) {
  console.log('\n== 运行时检查（Playwright） ==');
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME_EXE,
    args: PW_ARGS
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 500 } });
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });

  const url = pathToFileURL(GAME).href + '?q=low&noaudio=1&autostart=1&dt=0.1';
  await page.goto(url, { waitUntil: 'load', timeout: 240000 });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 420000 });

  // 构建内联检查：game.html 里必须有 window.__SX_MAPS_DATA，且与 src/data_maps.js 同源。
  const runtimeData = await page.evaluate((ids) => {
    const d = window.__SX_MAPS_DATA;
    if (!d || !d.maps) return { ok: false };
    const out = { ok: true, version: d.version, maps: {} };
    for (const id of ids) {
      const m = d.maps[id];
      out.maps[id] = m
        ? {
            keys: Object.keys(m),
            pickups: m.pickups ? m.pickups.length : -1,
            relays: m.relays ? m.relays.length : -1,
            hasBoxes: Object.prototype.hasOwnProperty.call(m, 'boxes')
          }
        : null;
    }
    return out;
  }, MAP_IDS);
  check('game.html 内联 window.__SX_MAPS_DATA', !!runtimeData.ok && runtimeData.version === 1,
    { version: runtimeData.version, maps: Object.keys(runtimeData.maps || {}) });
  if (runtimeData.ok) {
    for (const id of MAP_IDS) {
      const rm = runtimeData.maps[id];
      check(id + ' 内联数据与文件一致',
        rm && maps[id] && rm.pickups === maps[id].pickups.length &&
        rm.relays === maps[id].relays.length && rm.hasBoxes === false &&
        rm.keys.sort().join(',') === COVER_KEYS.slice().sort().join(','),
        rm);
    }
  }

  for (const id of MAP_IDS) {
    const map = maps[id];
    const current = await page.evaluate(() => window.__SX.mapId());
    if (current !== 'harbor') {
      await page.evaluate(() => window.__SX.switchMap('harbor'));
    }
    if (id !== 'harbor') {
      await page.evaluate((mapId) => window.__SX.switchMap(mapId), id);
    }
    await page.waitForTimeout(150);

    const r = await page.evaluate((data) => {
      const G = window.__G;
      const P = G.physics;
      const start = G.level.playerStart.pos;
      const startXZ = { x: start.x, y: 0, z: start.z };

      function boxHit(x, z, y, radius, height, tol) {
        for (const b of P.boxes) {
          if (b.bulletOnly) continue;
          if (b.max.y <= y + (tol || 0.06) || b.min.y >= y + height) continue;
          const cx = Math.max(b.min.x, Math.min(b.max.x, x));
          const cz = Math.max(b.min.z, Math.min(b.max.z, z));
          const dx = x - cx;
          const dz = z - cz;
          if (dx * dx + dz * dz < radius * radius) {
            return [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z];
          }
        }
        return null;
      }
      function airHit(x, y, z) {
        for (const b of P.boxes) {
          if (b.bulletOnly) continue;
          if (b.max.y <= y - 0.45 || b.min.y >= y + 0.45) continue;
          const cx = Math.max(b.min.x, Math.min(b.max.x, x));
          const cz = Math.max(b.min.z, Math.min(b.max.z, z));
          const dx = x - cx;
          const dz = z - cz;
          if (dx * dx + dz * dz < 0.4 * 0.4) return [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z];
        }
        return null;
      }
      function reach(p) {
        return !!P.nav.findPath(startXZ, { x: p[0], y: 0, z: p[2] });
      }
      function inBounds(p) {
        const b = data.bounds;
        return p[0] >= b.min[0] && p[0] <= b.max[0] &&
          p[1] >= b.min[1] && p[1] <= b.max[1] &&
          p[2] >= b.min[2] && p[2] <= b.max[2];
      }
      function groundDiff(p, maxYOffset) {
        const gy = P.groundHeight(p[0], p[2], p[1] + (maxYOffset == null ? 2.5 : maxYOffset));
        return { gy: +gy.toFixed(3), diff: +Math.abs(gy - p[1]).toFixed(3) };
      }
      // 向下 raycast：确认点位下方确实是实体地面（对应 WP32-6 校验里的 raycast）。
      function groundRay(p) {
        const hit = P.raycast({ x: p[0], y: p[1] + 1, z: p[2] }, { x: 0, y: -1, z: 0 }, 3);
        if (!hit || !hit.point) return null;
        return {
          y: +hit.point.y.toFixed(3),
          diff: +Math.abs(hit.point.y - p[1]).toFixed(3),
          normalUp: +hit.normal.y.toFixed(2),
          surface: hit.surface
        };
      }

      const out = {
        mapId: window.__SX.mapId(),
        boxes: P.boxes.length,
        start: [start.x, start.y, start.z],
        player: data.spawns.player.pos,
        relays: {},
        pickups: [],
        enemy: [],
        air: [],
        team: [],
        boss: []
      };

      // 玩家出生点：位置与 MapKit 一致 + 地面正确（碰撞由引擎在出生帧处理）
      out.playerMatch = Math.abs(start.x - out.player[0]) < 1e-3 &&
        Math.abs(start.y - out.player[1]) < 1e-3 && Math.abs(start.z - out.player[2]) < 1e-3;
      out.playerGround = groundDiff(out.player);

      for (const p of data.pickups) {
        const g = groundDiff(p.pos);
        out.pickups.push({ pos: p.pos, kind: p.kind, gh: g.gy, diff: g.diff, ray: groundRay(p.pos), hit: boxHit(p.pos[0], p.pos[2], p.pos[1], 0.32, 1.8, 0.06), reach: reach(p.pos), inBounds: inBounds(p.pos) });
      }
      for (const p of data.spawns.enemy) {
        const g = groundDiff(p.pos);
        out.enemy.push({ pos: p.pos, gh: g.gy, diff: g.diff, ray: groundRay(p.pos), hit: boxHit(p.pos[0], p.pos[2], p.pos[1], 0.32, 1.8, 0.06), reach: reach(p.pos), inBounds: inBounds(p.pos) });
      }
      for (const p of data.spawns.air) {
        out.air.push({ pos: p.pos, hit: airHit(p.pos[0], p.pos[1], p.pos[2]), inBounds: inBounds(p.pos) });
      }
      for (const p of data.spawns.team) {
        const g = groundDiff(p.pos);
        out.team.push({ team: p.team, pos: p.pos, gh: g.gy, diff: g.diff, ray: groundRay(p.pos), hit: boxHit(p.pos[0], p.pos[2], p.pos[1], 0.32, 1.8, 0.06), reach: reach(p.pos), inBounds: inBounds(p.pos) });
      }
      for (const p of data.spawns.boss) {
        const g = groundDiff(p.pos);
        out.boss.push({ pos: p.pos, gh: g.gy, diff: g.diff, ray: groundRay(p.pos), hit: boxHit(p.pos[0], p.pos[2], p.pos[1], 0.32, 1.8, 0.06), reach: reach(p.pos), inBounds: inBounds(p.pos) });
      }
      for (const r of data.relays) {
        const g = groundDiff(r.pos, 0.45);
        out.relays[r.id] = { pos: r.pos, gh: g.gy, diff: g.diff, reach: reach(r.pos), inBounds: inBounds(r.pos) };
      }

      // 当前地图中继（港区在 G.level.objectives，其余在 MapKit.relays）
      if (data.id === 'harbor') {
        out.liveRelays = (G.level.objectives || []).map((o) => String(o.id).replace(/^relay_/, ''));
      } else {
        out.liveRelays = Object.keys(window.__SX.mapRelays(data.id) || {});
      }
      out.mapInfo = window.__SX.mapInfo(data.id);
      return out;
    }, Object.assign({}, map));

    check(id + ' 切图成功', r.mapId === id && r.mapInfo && r.mapInfo.built === true, { mapId: r.mapId, mapInfo: r.mapInfo });
    check(id + ' 碰撞盒数量与数据一致', r.boxes === map.boxes.length, { runtime: r.boxes, data: map.boxes.length });

    check(id + ' player 与 MapKit 一致且落地', r.playerMatch && r.playerGround.diff < 0.5,
      { match: r.playerMatch, ground: r.playerGround });

    const grounded = (p) => p.diff < 0.5 && p.ray && p.ray.diff < 0.5 && p.ray.normalUp > 0.5;
    const pickupsOk = r.pickups.length >= 8 && r.pickups.every((p) =>
      grounded(p) && !p.hit && p.reach && p.inBounds);
    check(id + ' pickups 数量/落地/不卡碰撞/可达', pickupsOk, {
      count: r.pickups.length,
      bad: r.pickups.filter((p) => !(grounded(p) && !p.hit && p.reach && p.inBounds))
    });

    const enemyTotal = r.enemy.length + r.air.length;
    const enemyOk = enemyTotal >= 12 && enemyTotal <= 20 &&
      r.enemy.every((p) => grounded(p) && !p.hit && p.reach && p.inBounds) &&
      r.air.every((p) => !p.hit && p.inBounds);
    check(id + ' enemy/air 12..20 且有效', enemyOk, {
      enemy: r.enemy.length,
      air: r.air.length,
      badEnemy: r.enemy.filter((p) => !(grounded(p) && !p.hit && p.reach && p.inBounds)),
      badAir: r.air.filter((p) => p.hit || !p.inBounds)
    });

    check(id + ' team 两个基地有效',
      r.team.length === 2 && r.team.every((p) => grounded(p) && !p.hit && p.reach && p.inBounds),
      r.team.map((p) => ({ team: p.team, pos: p.pos, diff: p.diff, ray: p.ray, hit: p.hit, reach: p.reach, inBounds: p.inBounds })));

    check(id + ' boss 点位有效',
      r.boss.length >= 1 && r.boss.every((p) => grounded(p) && !p.hit && p.reach && p.inBounds),
      r.boss.map((p) => ({ pos: p.pos, diff: p.diff, ray: p.ray, hit: p.hit, reach: p.reach, inBounds: p.inBounds })));

    const relayOk = Object.keys(r.relays).length === map.relays.length &&
      Object.values(r.relays).every((p) => p.diff < 0.5 && p.reach && p.inBounds);
    check(id + ' relays 落地/可达', relayOk, Object.values(r.relays));

    const dataRelays = map.relays.map((x) => x.id).sort();
    const liveRelays = r.liveRelays.slice().sort();
    check(id + ' relays 与当前地图一致',
      JSON.stringify(dataRelays) === JSON.stringify(liveRelays), { data: dataRelays, live: liveRelays });
  }

  check('无 pageerror', pageErrors.length === 0, pageErrors.slice(0, 3));
  check('无 console.error', consoleErrors.length === 0, consoleErrors.slice(0, 3));

  await browser.close();
}

/* ------------------------------------------------------------ main */

const maps = checkStructure();
await checkRuntime(maps);

console.log('\n== 汇总 ==');
console.log('通过 ' + passes + ' 项，失败 ' + failures + ' 项');
if (failures) {
  console.error('地图数据测试失败');
  process.exit(1);
}
console.log('地图数据测试全部通过');
