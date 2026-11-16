#!/usr/bin/env node
/* V39 联机 e2e：两个独立浏览器进程（避免第二标签页 SwiftShader 卡死） */
import { chromium } from 'playwright';
import { PW_ARGS, findChrome } from './pwargs.mjs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = findChrome();
const PORT = 9300 + Math.floor(Math.random() * 300);
const TOKEN = 'v39-e2e-token';
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('PASS · ' + n + (d !== undefined ? ' — ' + JSON.stringify(d) : '')); } else { fail++; console.log('FAIL · ' + n + (d !== undefined ? ' — ' + JSON.stringify(d) : '')); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const server = spawn(process.execPath, [path.join(ROOT, 'server/server.cjs')], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), STATIC_DIR: ROOT, BOTS: '0', MP_DEV_TOKEN: TOKEN, PROFILES_FILE: path.join(ROOT, 'tools', 'e2e-profiles.json') },
  stdio: ['ignore', 'pipe', 'pipe']
});
let serverLog = '';
server.stdout.on('data', d => { serverLog += d.toString(); });
server.stderr.on('data', d => { serverLog += d.toString(); });

async function waitHealth(timeout = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { const r = await fetch('http://127.0.0.1:' + PORT + '/healthz'); if (r.ok) return true; } catch (e) {}
    await sleep(250);
  }
  return false;
}

async function openPlayer(name) {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME, args: PW_ARGS });
  const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript((t) => { window.__MP_DEV_TOKEN = t; }, TOKEN);
  await page.goto('http://127.0.0.1:' + PORT + '/game.html?q=low&noaudio=1&autostart=1&dt=0.1', { waitUntil: 'load', timeout: 240000 });
  await page.waitForFunction(() => window.__ready === true && window.__SX && window.__MP, null, { timeout: 420000 });
  await page.evaluate((args) => { window.__MP.join('ws://127.0.0.1:' + args.port, args.name, 'v39-e2e', 'harbor', 'tdm'); }, { port: PORT, name });
  const joined = await page.waitForFunction(() => { const s = window.__MP.state(); return s.active && s.joined && s.selfId; }, null, { timeout: 30000 }).then(() => true).catch(() => false);
  return { browser, page, errs, joined };
}

let A = null, B = null;
try {
  ok('服务器启动 / healthz', await waitHealth(), { port: PORT });
  A = await openPlayer('Alice');
  ok('客户端 A 加入房间', A.joined, await A.page.evaluate(() => window.__MP.state()).catch(() => null));
  B = await openPlayer('Bob');
  ok('客户端 B 加入房间', B.joined, await B.page.evaluate(() => window.__MP.state()).catch(() => null));
  await sleep(1500);
  const a = await A.page.evaluate(() => ({ st: window.__MP.state(), remotes: window.__MP.remotes().length, snap: window.__MP.debug ? window.__MP.debug() : null, net: window.__SX_NET ? window.__SX_NET.state() : null }));
  const b = await B.page.evaluate(() => ({ st: window.__MP.state(), remotes: window.__MP.remotes().length }));
  ok('A 看到 B 的远端模型', a.remotes >= 1, { a: a.remotes, b: b.remotes });
  ok('B 看到 A 的远端模型', b.remotes >= 1, b);
  ok('自己不被渲染成远端', a.remotes === 1 && b.remotes === 1, { a: a.remotes, b: b.remotes });
  const net = await A.page.evaluate(() => ({ bin: window.__SX_NET && window.__SX_NET.state ? window.__SX_NET.state() : null, mp: window.__MP.state() }));
  ok('二进制协议生效', net.mp && net.mp.active, { active: net.mp && net.mp.active, bin: net.bin && net.bin.bin });
  const before = await B.page.evaluate(() => window.__G.player.pos.toArray());
  await A.page.evaluate(() => window.__MP.testTeleport && window.__MP.testTeleport(10, 10));
  await sleep(1200);
  const moved = await B.page.evaluate(() => window.__MP.debug ? window.__MP.debug() : null).catch(() => null);
  const pos = await A.page.evaluate(() => window.__G.player.pos.toArray().map(v => +v.toFixed(2)));
  ok('dev 传送在 A 生效', Math.abs(pos[0] - 10) < 3 && Math.abs(pos[2] - 10) < 3, { pos, before });
  ok('无 pageerror', A.errs.length === 0 && B.errs.length === 0, { a: A.errs.slice(0, 2), b: B.errs.slice(0, 2) });
} catch (e) {
  fail++;
  console.log('FAIL · e2e 异常 — ' + (e && e.message));
  try { if (A) console.log('A state', await A.page.evaluate(() => ({ ready: window.__ready, fatal: window.__fatal, mp: window.__MP && window.__MP.state(), err: (window.__errors || []).slice(0, 3) }))); } catch (_) {}
  try { if (B) console.log('B state', await B.page.evaluate(() => ({ ready: window.__ready, fatal: window.__fatal, mp: window.__MP && window.__MP.state(), err: (window.__errors || []).slice(0, 3) }))); } catch (_) {}
  console.log('server log tail:', serverLog.slice(-800));
} finally {
  try { if (A) await A.browser.close(); } catch (e) {}
  try { if (B) await B.browser.close(); } catch (e) {}
  try { server.kill('SIGTERM'); } catch (e) {}
  await sleep(300);
}
console.log(pass + ' PASS / ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
