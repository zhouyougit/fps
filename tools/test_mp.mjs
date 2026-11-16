
import { chromium } from 'playwright';
const URL = process.env.MP_URL || 'ws://172.16.17.189:9100';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const room = 'mptest-' + Date.now().toString(36);
let fails = 0;
const ok = (n, c, d) => { if (!c) fails++; console.log((c ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + JSON.stringify(d) : '')); };
const pages = [];
for (let i = 0; i < 2; i++) {
  const p = await browser.newPage({ viewport: { width: 1000, height: 560 } });
  await p.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1', { waitUntil: 'load', timeout: 180000 });
  await p.waitForFunction(() => window.__ready === true, null, { timeout: 240000 });
  await p.waitForTimeout(700);
  await p.evaluate(([u, r, n]) => window.__MP.join(u, n, r), [URL, room, i === 0 ? 'A' : 'B']);
  pages.push(p);
}
let state = null;
for (let i = 0; i < 20; i++) {
  await new Promise(r => setTimeout(r, 1000));
  const a = await pages[0].evaluate(() => window.__MP.state());
  const b = await pages[1].evaluate(() => window.__MP.state());
  if (a.active && b.active && a.players >= 2 && b.players >= 2) { state = { a, b }; break; }
}
ok('双人加入同一房间', !!state, state);
await new Promise(r => setTimeout(r, 2600));
const p0 = await pages[0].evaluate(() => window.__G.player.pos.toArray());
await pages[0].keyboard.down('w');
await new Promise(r => setTimeout(r, 2500));
await pages[0].keyboard.up('w');
await new Promise(r => setTimeout(r, 1200));
const moved = await pages[0].evaluate(() => ({
  server: window.__MP.debug().serverSelf,
  player: window.__G.player.pos.toArray().map(v => +v.toFixed(2))
}));
let seen = null;
for (let i = 0; i < 16; i++) {
  seen = await pages[1].evaluate(() => {
    const d = window.__MP.debug();
    const h = d.hist[0] && d.hist[0].h[d.hist[0].h.length - 1];
    return { hist: h, remotes: window.__MP.remotes(), avatarKids: (() => { const g = window.__G.scene.children.find(o => o.type === 'Group' && o.children.length >= 8); return g ? g.children.length : 0; })() };
  });
  if (seen.hist && Math.hypot(seen.hist.x - p0[0], seen.hist.z - p0[2]) > 1.0) break;
  await new Promise(r => setTimeout(r, 700));
}
const dist = moved.server ? Math.hypot(moved.server.x - p0[0], moved.server.z - p0[2]) : 0;
ok('服务器权威移动', dist > 1.0, { from: p0, server: moved.server, dist: +dist.toFixed(2) });
ok('对端看到移动', !!seen.hist && Math.hypot(seen.hist.x - p0[0], seen.hist.z - p0[2]) > 1.0, seen);
ok('远端角色模型', seen.avatarKids >= 8 && seen.remotes.length === 1, { kids: seen.avatarKids, remotes: seen.remotes });
await pages[1].screenshot({ path: 'tools/v16_mp_final.png', timeout: 120000 });
await pages[0].evaluate(() => window.__MP.leave());
await new Promise(r => setTimeout(r, 800));
const left = await pages[0].evaluate(() => ({ state: window.__G.game.state, mp: window.__MP.state() }));
ok('退出联机回到标题', left.state === 'title' && left.mp.active === false && left.mp.selfId === null, left);
await browser.close();
console.log(fails ? fails + ' 项失败' : '全部通过');
process.exit(fails ? 1 : 0);
