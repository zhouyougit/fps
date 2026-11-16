#!/usr/bin/env node
/* =====================================================================
   SALTLINE · tools/test_v38_mp_perf.mjs — V38 联机客户端性能回归
   直接加载 src/mp.js（vm + DOM/THREE 桩），验证：
   1) hudRefs 缓存后每帧 querySelector 归零，值不变不写 textContent；
      score/ping/count 100ms 节流（A/B 用 testHudCache 对比旧路径）。
   2) updateRemotes 每帧 0 分配：模块级 scratch 引用跨帧不变、无 stime
      闭包 / samples.indexOf / 每帧位置对象；堆增量 + 30k 帧。
   3) 插值窗口 2 tick = 67ms（60–120 clamp），并实测成像延迟低于旧 100ms。
   4) removeRemote 后场景对象减少、几何/材质各 dispose 一次（去重/非共享）。
   5) 姓名板 transform + 30Hz + 变化门控；姓名板 DOM 池化；命中 UI 合并。
   6) 无未捕获异常 / pageerror 等价物。
   运行：node tools/test_v38_mp_perf.mjs（自动以 --expose-gc 复跑堆测试）
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

/* 堆分配测试需要 gc；自动带 --expose-gc 复跑一次 */
if (typeof global.gc !== 'function' && !process.env.SX_V38_GC_REEXEC) {
  const r = spawnSync(process.execPath, ['--expose-gc', __filename, ...process.argv.slice(2)], {
    stdio: 'inherit', env: Object.assign({}, process.env, { SX_V38_GC_REEXEC: '1' })
  });
  process.exit(r.status == null ? 1 : r.status);
}

let pass = 0, fail = 0, skipped = 0;
function ok(name, cond, detail) {
  if (cond) {
    pass++;
    console.log('PASS · ' + name + (detail !== undefined ? ' — ' + JSON.stringify(detail) : ''));
  } else {
    fail++;
    console.log('FAIL · ' + name + (detail !== undefined ? ' — ' + JSON.stringify(detail) : ''));
  }
}
function skip(name, detail) { skipped++; console.log('SKIP · ' + name + (detail !== undefined ? ' — ' + JSON.stringify(detail) : '')); }
function section(n) { console.log('\n=== ' + n + ' ==='); }

/* ---------------------------- DOM 桩 ---------------------------- */
const domStats = { queries: 0, hudQueries: 0, nodes: 0 };
function makeStyle() {
  const s = {};
  Object.defineProperty(s, 'setProperty', { value: (k, v) => { s[k] = v; }, enumerable: false });
  Object.defineProperty(s, 'removeProperty', { value: (k) => { delete s[k]; }, enumerable: false });
  Object.defineProperty(s, 'getPropertyValue', { value: (k) => s[k] || '', enumerable: false });
  return s;
}
class ClassList {
  constructor(el) { this.el = el; }
  list() { return String(this.el.className || '').split(/\s+/).filter(Boolean); }
  contains(c) { return this.list().indexOf(c) >= 0; }
  add(...cs) { const l = this.list(); for (const c of cs) if (l.indexOf(c) < 0) l.push(c); this.el.className = l.join(' '); }
  remove(...cs) { this.el.className = this.list().filter((c) => cs.indexOf(c) < 0).join(' '); }
  toggle(c, force) {
    const on = force === undefined ? !this.contains(c) : !!force;
    if (on) this.add(c); else this.remove(c);
    return on;
  }
}
class FakeEl {
  constructor(tag, cls, text) {
    this.tagName = String(tag || 'div').toUpperCase();
    this.className = cls || '';
    this.children = [];
    this.parentNode = null;
    this.style = makeStyle();
    this._q = new Map();
    this._attrs = Object.create(null);
    this._text = '';
    this._writes = 0;
    this.classList = new ClassList(this);
    this.value = '';
    this.onclick = null;
    this._mpText = undefined;
    domStats.nodes++;
    if (text != null) this.textContent = text;
  }
  get firstChild() { return this.children[0] || null; }
  set textContent(v) { this._text = v == null ? '' : String(v); this._writes++; }
  get textContent() { return this._text; }
  set innerHTML(v) { this._html = v == null ? '' : String(v); }
  get innerHTML() { return this._html || ''; }
  appendChild(c) {
    if (!c) return c;
    if (c.parentNode) c.parentNode.removeChild(c);
    c.parentNode = this;
    this.children.push(c);
    return c;
  }
  insertBefore(c, ref) {
    if (!c) return c;
    if (c.parentNode) c.parentNode.removeChild(c);
    const i = ref ? this.children.indexOf(ref) : -1;
    if (i < 0) this.children.push(c); else this.children.splice(i, 0, c);
    c.parentNode = this;
    return c;
  }
  removeChild(c) {
    const i = this.children.indexOf(c);
    if (i >= 0) this.children.splice(i, 1);
    if (c) c.parentNode = null;
    return c;
  }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  setAttribute(k, v) { this._attrs[k] = String(v); }
  getAttribute(k) { return this._attrs[k] == null ? null : this._attrs[k]; }
  addEventListener() {}
  querySelector(sel) {
    domStats.queries++;
    if (String(this.className || '').split(' ')[0] === 'x-mp-hud') domStats.hudQueries++;
    let c = this._q.get(sel);
    if (!c) { c = new FakeEl('div'); c._sel = sel; this._q.set(sel, c); }
    return c;
  }
  querySelectorAll() { return []; }
  animate() { return { onfinish: null, cancel() {} }; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 120, height: 24 }; }
}

/* --------------------------- THREE 桩 --------------------------- */
const threeStats = { geoms: 0, mats: 0, geomDisposed: 0, matDisposed: 0 };
class V3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  clone() { return new V3(this.x, this.y, this.z); }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  project() {
    // 把世界 x 映射到 NDC，便于姓名板位移测试；z 始终在近远裁剪面之间
    this.x = 0.1 + Math.max(-1, Math.min(1, this.x / 50)) * 0.45;
    this.y = 0.1;
    this.z = 0.5;
    return this;
  }
  toArray() { return [this.x, this.y, this.z]; }
}
class Color {
  constructor(v) { this.value = v == null ? 0xffffff : v; }
  copy(c) { this.value = c.value; return this; }
}
class Geometry {
  constructor(kind) { this.kind = kind || 'geo'; this.__id = ++threeStats.geoms; }
  dispose() { threeStats.geomDisposed++; this.disposed = true; }
}
class Material {
  constructor(opts) {
    opts = opts || {};
    this.color = new Color(opts.color);
    this.emissive = new Color(opts.emissive);
    this.opacity = opts.opacity;
    this.transparent = opts.transparent;
    this.__id = ++threeStats.mats;
  }
  dispose() { threeStats.matDisposed++; this.disposed = true; }
}
class Obj3D {
  constructor() {
    this.children = [];
    this.parent = null;
    this.position = new V3();
    this.rotation = { x: 0, y: 0, z: 0 };
    this.scale = new V3(1, 1, 1);
    this.visible = true;
    this.name = '';
  }
  add(...os) { for (const o of os) { if (o.parent) o.parent.remove(o); o.parent = this; this.children.push(o); } return this; }
  remove(o) { const i = this.children.indexOf(o); if (i >= 0) this.children.splice(i, 1); if (o) o.parent = null; return this; }
  traverse(fn) { fn(this); for (const c of this.children) c.traverse(fn); }
}
class Mesh extends Obj3D {
  constructor(geo, mat) { super(); this.geometry = geo; this.material = mat; this.castShadow = false; }
}
class Group extends Obj3D {}
const T = {
  Vector3: V3, Color, Group, Mesh,
  BoxGeometry: class extends Geometry { constructor(...a) { super('box'); this.args = a; } },
  CylinderGeometry: class extends Geometry { constructor(...a) { super('cyl'); this.args = a; } },
  SphereGeometry: class extends Geometry { constructor(...a) { super('sphere'); this.args = a; } },
  CapsuleGeometry: class extends Geometry { constructor(...a) { super('capsule'); this.args = a; } },
  TorusGeometry: class extends Geometry { constructor(...a) { super('torus'); this.args = a; } },
  MeshStandardMaterial: class extends Material {},
  MeshBasicMaterial: class extends Material {},
  DoubleSide: 2
};

/* ---------------------------- 计时器 ---------------------------- */
const clock = { t: 1000 };
const timers = new Map();
let timerSeq = 1;
function fakeSetTimeout(fn, ms) { const id = ++timerSeq; timers.set(id, { fn, at: clock.t + (ms || 0) }); return id; }
function fakeClearTimeout(id) { timers.delete(id); }
const uncaught = [];
function pumpTimers() {
  let again = true;
  while (again) {
    again = false;
    const due = [];
    for (const [id, t] of timers) if (t.at <= clock.t) due.push([id, t]);
    for (const [id, t] of due) {
      timers.delete(id);
      try { t.fn(); } catch (e) { uncaught.push(e); }
      again = true;
    }
  }
}
function resetClock(ms) { clock.t = ms; timers.clear(); }

/* ----------------------------- G 桩 ----------------------------- */
const uiRoot = new FakeEl('div', 'ui');
uiRoot.id = 'ui';
const hits = [];
const G = {
  THREE: T,
  scene: new Obj3D(),
  camera: { position: new V3(), updateMatrixWorld() {} },
  player: { pos: new V3(), vel: new V3(), yaw: 0, pitch: 0, health: 100, armor: 50, alive: true, update() { return true; } },
  physics: { raycast() { return null; }, boxes: [] },
  input: { move: { x: 0, y: 0 }, fire: false, ads: false, down() { return false; }, setGameplay() {}, requestLock() {}, exitLock() {} },
  hud: {
    warn() {}, message() {}, feed(t) { return { el: new FakeEl('div', 'h-fl', t) }; },
    hitmarker(k) { hits.push(k); }, setSlots() {}, setObjective() {}, setMarkers() {},
    setRelays() {}, show() {}, setPrompt() {}
  },
  events: { on() {}, emit() {} },
  audio: { play() {} },
  fx: { tracer() {}, muzzleFlash() {} },
  weapon: { id: 'pac9', activeIndex: 0, list: [], slots: [], magSize: 30, ammo: 30, reserve: 90, state: 'idle' },
  enemies: { clear() {} },
  game: { update() {}, start() {}, menus: { show() {} }, flow: {}, state: 'title' },
  render: { renderer: {} }
};

/* --------------------------- 沙箱加载 --------------------------- */
const errors = [];
const sandbox = {
  console: { log() {}, warn() {}, error(...a) { errors.push(a.map(String).join(' ')); } },
  performance: { now: () => clock.t },
  document: {
    createElement: (t) => new FakeEl(t),
    createTextNode: (t) => ({ nodeType: 3, textContent: String(t), parentNode: null }),
    getElementById: (id) => (id === 'ui' ? uiRoot : null),
    head: new FakeEl('head'),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {}
  },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  location: { search: '', protocol: 'file:', hostname: '' },
  URLSearchParams,
  WebSocket: class {},
  addEventListener() {},
  setTimeout: fakeSetTimeout,
  clearTimeout: fakeClearTimeout,
  innerWidth: 1280,
  innerHeight: 720,
  requestAnimationFrame: (fn) => fakeSetTimeout(fn, 16),
  // 模拟 ext_net2 在浏览器里提供的 SX_NET2（UMD 先于 MP 消息到达）
  SX_NET2: {
    VERSION: 2,
    sanitizeName: (n) => String(n == null ? '' : n).replace(/[\u0000-\u001f\u007f<>"'&\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16) || '猫',
    validateUrl: (u) => ({ ok: /^wss?:\/\//i.test(String(u || '').trim()), url: String(u || '').trim() }),
    friendlyError: (code, msg) => msg || code || 'error',
    modeKey: (m) => String(m || '').toLowerCase(),
    addLobbyMode: () => true
  }
};
sandbox.window = sandbox;

let MP = null;
try {
  const ctx = vm.createContext(sandbox);
  // V43：先加载高细节士兵模型模块（mp.js 在运行时调用 window.SX_MP_AVATAR）
  const avatarSrc = fs.readFileSync(path.join(ROOT, 'src/mp_avatar.js'), 'utf8');
  vm.runInContext(avatarSrc, ctx, { filename: 'src/mp_avatar.js' });
  const src = fs.readFileSync(path.join(ROOT, 'src/mp.js'), 'utf8');
  vm.runInContext(src, ctx, { filename: 'src/mp.js' });
  MP = vm.runInContext('MP', ctx);
  MP.init(G, {});
  sandbox.MP = MP;
} catch (e) {
  console.error('FATAL · mp.js 加载失败 —', e && e.stack || e);
  process.exit(1);
}

/* ---------------------------- 工具 ---------------------------- */
function hudEl() { return uiRoot.children.find((c) => String(c.className || '').split(' ')[0] === 'x-mp-hud'); }
function hudNode(sel) { return hudEl().querySelector(sel); }
function snap(tick, players) { return { t: 'snap', tick, players }; }
function P(id, x, team = 1, hp = 100) {
  return { id, name: '猫-' + id, x, y: 0, z: 0, yaw: 0, pitch: 0, hp, armor: 50, alive: true, team, crouch: false };
}
function players(prefix, n, x0 = -14) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(P(prefix + i, x0 + i * 4, i % 2));
  return out;
}
function tagNodes() { return uiRoot.children.filter((c) => String(c.className || '').indexOf('x-mp-tag') === 0); }
function walk(obj, fn) { if (!obj) return; fn(obj); for (const c of obj.children || []) walk(c, fn); }
function seqFrames(n, dtMs, fn) { for (let i = 0; i < n; i++) { clock.t += dtMs; if (fn) fn(i); MP.net2.testFrame(1 / 60); } }
function perf() { return MP.net2.perf(); }
function delta(a, b, k) { return (b[k] | 0) - (a[k] | 0); }

console.log('SALTLINE V38 · mp perf regression');
console.log('build: node ' + process.version + (global.gc ? ' · --expose-gc' : ''));

const srcText = fs.readFileSync(path.join(ROOT, 'src/mp.js'), 'utf8');

/* ===================================================================== */
section('0 · 模块与读数');
ok('mp.js 加载 + 测试钩子 + __SX_NET', !!MP && typeof MP.net2.testFrame === 'function' && !!sandbox.__SX_NET,
  { hooks: ['testFrame', 'testUpsert', 'testRemove', 'testHudCache', 'perf'].filter((k) => typeof MP.net2[k] === 'function') });
console.log('interpMs =', sandbox.__SX_NET.interpMs, '· tickRate =', MP.state().tickRate);

/* ===================================================================== */
section('1 · 插值窗口');
{
  const base = sandbox.__SX_NET.interpMs;
  const r60 = MP.net2.testTickRate(60);
  const r15 = MP.net2.testTickRate(15);
  const back = MP.net2.testTickRate(30);
  ok('插值窗口 = 2 tick ≈ 67ms（clamp 60–120）',
    base === 67 && r60 === 60 && r15 === 120 && back === 67,
    { default: base, at60Hz: r60, at15Hz: r15, backTo30: back, ticks: sandbox.__SX_NET.interpTicks });
}

/* ===================================================================== */
section('2 · hudRefs DOM 缓存 A/B');
{
  const pls = players('q', 4);
  let tick = 1;
  // 旧路径：关闭缓存，每次读取都会 querySelector
  MP.net2.testHudCache(false);
  resetClock(1000);
  domStats.hudQueries = 0;
  seqFrames(300, 16, () => { tick++; MP.net2.testMsg(snap(tick, pls)); });
  const legacy = domStats.hudQueries;
  // 新路径：缓存命中
  MP.net2.testHudCache(true);
  domStats.hudQueries = 0;
  seqFrames(300, 16, () => { tick++; MP.net2.testMsg(snap(tick, pls)); });
  const cached = domStats.hudQueries;
  // 旧实现每帧固定 ping/time 两次查询 = 600 次/300 帧；这里关闭缓存后因值门控已降到少量
  ok('hudRefs 缓存后 hud.querySelector 调用下降', legacy >= 30 && cached === 0,
    { legacyQueries300帧: legacy, cachedQueries300帧: cached, oldImplPerFrame: 2, oldImplQueries300帧: 600, dropPct: legacy ? '100%' : 'n/a' });
}

/* ===================================================================== */
section('3 · 值不变不写 + 100ms 节流');
{
  const tNode = hudNode('[data-mp-time]');
  const pNode = hudNode('[data-mp-ping]');
  const sNode = hudNode('[data-mp-score]');
  const cNode = hudNode('[data-mp-count]');
  seqFrames(2, 16);   // 预热：消化上一节遗留的 pending
  clock.t += 1000;
  MP.net2.testFrame(1 / 60);
  [tNode, pNode, sNode, cNode].forEach((n) => { n._writes = 0; });
  const p0 = perf();
  seqFrames(60, 16);
  const p1 = perf();
  const stable = { timeWrites: tNode._writes, pingWrites: pNode._writes, textWritesDelta: delta(p0, p1, 'textWrites') };

  const pls8 = players('q', 8);
  clock.t += 110;   // 让第一次 flush 立即发生，之后 20 次更新落入同一 100ms 窗口
  [tNode, pNode, sNode, cNode].forEach((n) => { n._writes = 0; });
  for (let i = 0; i < 20; i++) {
    clock.t += 5;
    MP.net2.testMsg({ t: 'score', teams: [i, 0], players: [] });
    MP.net2.testMsg(snap(1000 + i, pls8));
    MP.net2.testMsg({ t: 'pong', ts: clock.t - (20 + i) });
    MP.net2.testFrame(1 / 60);
  }
  clock.t += 20;
  MP.net2.testFrame(1 / 60);
  ok('值不变时 textContent 0 写入', stable.timeWrites === 0 && stable.pingWrites === 0 && stable.textWritesDelta === 0, stable);
  ok('score/ping/count 0.1s 节流且落最后值',
    sNode._writes === 2 && pNode._writes <= 2 && cNode._writes === 1 && sNode.textContent === '19 : 0' && pNode.textContent === '39 ms' && cNode.textContent === '8 在线',
    { scoreWrites: sNode._writes, pingWrites: pNode._writes, countWrites: cNode._writes, score: sNode.textContent, ping: pNode.textContent, count: cNode.textContent, rtt: MP.net2.rtt() });
}

/* ===================================================================== */
section('4 · 插值延迟实测（67ms vs 旧 100ms）');
{
  MP.net2.testClear();
  resetClock(8000);
  MP.net2.testMsg(snap(100, [P('lat1', 0)]));
  clock.t = 8033; MP.net2.testMsg(snap(101, [P('lat1', 10)]));
  clock.t = 8066; MP.net2.testMsg(snap(102, [P('lat1', 20)]));
  clock.t = 8133; MP.net2.testFrame(1 / 60);
  const h = MP.debug().hist.find((x) => x.id === 'lat1');
  const x = h ? h.pos[0] : null;
  // 旧 100ms 窗口在同帧会取到 tick 101 附近（≈10.1），新 67ms 直接到最新 tick 102
  const oldTarget = 8133 - 100;
  const s1t = 8066 + (101 - 102) * (1000 / 30);
  const oldX = 10 + (20 - 10) * Math.max(0, Math.min(1, (oldTarget - s1t) / (1000 / 30)));
  ok('插值成像提前到 2 tick（67ms）', x != null && Math.abs(x - 20) < 0.01 && oldX < 12,
    { now: 8133, target: 8066, newX: x, oldWindow100msX: +oldX.toFixed(2), savedMs: 33 });
}

/* ===================================================================== */
section('5 · 复用对象 / 0 分配');
{
  const p0 = perf();
  const remotes = p0.remotes;
  seqFrames(200, 8);
  const p1 = perf();
  const uses = delta(p0, p1, 'interpUses');
  ok('模块级 scratch 引用跨帧不变', p1.interpScratch === p0.interpScratch && p1.muzzleScratch === p0.muzzleScratch,
    { sameInterpScratch: true, sameMuzzleScratch: true, remotes });
  ok('每帧使用计数 = 远端数 × 帧数', uses === remotes * 200, { uses, expected: remotes * 200 });

  const noClosure = !/var\s+stime\s*=\s*function/.test(srcText);
  const noIndexOf = !/samples\.indexOf\s*\(/.test(srcText);
  const noPosObj = !/pos\s*=\s*\{\s*x:\s*a\.x/.test(srcText);
  ok('源级：无 stime 闭包 / samples.indexOf / 每帧 pos 对象',
    noClosure && noIndexOf && noPosObj && /function sampleTime\(/.test(srcText),
    { noClosure, noIndexOf, noPosObj });

  if (typeof global.gc === 'function') {
    MP.net2.testClear();
    resetClock(20000);
    MP.net2.testUpsert(players('h', 8));
    seqFrames(3000, 16);
    global.gc(); global.gc();
    const h0 = process.memoryUsage().heapUsed;
    seqFrames(30000, 16);
    global.gc(); global.gc();
    const h1 = process.memoryUsage().heapUsed;
    const kb = (h1 - h0) / 1024;
    ok('updateRemotes 30k 帧堆增量 < 2MB（8 远端）', kb < 2048,
      { frames: 30000, remotes: 8, heapDeltaKB: +kb.toFixed(1), oldEquivAllocs: 30000 * 8 * 2 });
  } else {
    skip('updateRemotes 堆增量', '无 --expose-gc');
  }
}

/* ===================================================================== */
section('6 · 姓名板 transform + 变化门控');
{
  MP.net2.testClear();
  resetClock(30000);
  const pls = players('t', 8);
  MP.net2.testUpsert(pls);
  MP.net2.testFrame(1 / 60);
  const tags = MP.net2.testTags();
  const p0 = perf();
  seqFrames(60, 16);
  const p1 = perf();
  ok('静态 60 帧姓名板 0 次 style 写入', p1.tagWrites === p0.tagWrites && p1.tagUpdates > p0.tagUpdates,
    { extraWrites: delta(p0, p1, 'tagWrites'), tagUpdates: delta(p0, p1, 'tagUpdates'), remoteFrames: 60 * 8 });
  ok('定位使用 transform（不再是 left/top）', tags.length === 8 && tags.every((t) => /^translate3d\(/.test(t.style.transform) || t.style.display === 'none'),
    { sample: tags[0] && tags[0].style.transform, usesLeft: tags.some((t) => t.style.left != null && t.style.left !== '') });

  let moved = 0;
  const p2 = perf();
  for (let i = 0; i < 100; i++) {
    clock.t += 16;
    const list = [];
    for (let j = 0; j < 8; j++) list.push(P('t' + j, -14 + j * 4 + i * 0.9, j % 2));
    MP.net2.testUpsert(list);
    MP.net2.testFrame(1 / 60);
    moved++;
  }
  const p3 = perf();
  const writes = delta(p2, p3, 'tagWrites');
  const legacyWrites = moved * 8 * 2; // 旧实现每帧 left+top 各一次
  ok('8 人房姓名板写入 < 旧路径 50%（30Hz 节流）', writes > 0 && writes < legacyWrites * 0.5,
    { frames: moved, remotes: 8, tagWrites: writes, tagUpdates: delta(p2, p3, 'tagUpdates'), legacyPerFrameWrites: legacyWrites });
}

/* ===================================================================== */
section('7 · 姓名板 DOM 池化');
{
  const first = MP.net2.testTags();
  MP.net2.testClear();
  const baseTags = tagNodes().length;
  let maxTags = baseTags;
  let recreated = false;
  for (let c = 0; c < 5; c++) {
    MP.net2.testUpsert(players('p' + c, 8));
    const nowTags = tagNodes().length;
    if (nowTags > maxTags) maxTags = nowTags;
    if (c === 0) {
      const prev = new Set(first);
      const second = MP.net2.testTags();
      recreated = second.some((x) => prev.has(x));
    }
    MP.net2.testClear();
  }
  const pool = perf().tagPool;
  ok('换房 5 轮姓名板节点不增长（池化复用）', maxTags <= 8 && recreated && pool <= 16,
    { maxTagNodes: maxTags, reused: recreated, pool, cycles: 5 });
}

/* ===================================================================== */
section('8 · removeRemote dispose');
{
  MP.net2.testClear();
  resetClock(40000);
  const g0 = threeStats.geomDisposed, m0 = threeStats.matDisposed, d0 = perf().disposed;
  const list = players('d', 4);
  MP.net2.testUpsert(list);
  const sceneBefore = G.scene.children.length;
  const geos = new Set(), mats = new Set();
  for (const grp of G.scene.children) {
    walk(grp, (o) => {
      if (o.geometry) geos.add(o.geometry);
      if (Array.isArray(o.material)) o.material.forEach((m) => mats.add(m));
      else if (o.material) mats.add(o.material);
    });
  }
  const removed = MP.net2.testRemove('d1');
  const sceneAfter = G.scene.children.length;
  ok('removeRemote 后场景对象减少', removed === true && sceneBefore === 4 && sceneAfter === 3,
    { sceneBefore, sceneAfter, remotesLeft: MP.state().players });
  MP.net2.testClear();
  const dg = threeStats.geomDisposed - g0, dm = threeStats.matDisposed - m0;
  const disposed = perf().disposed - d0;
  ok('几何/材质逐个 dispose（去重、非共享）', dg === geos.size && dm === mats.size && disposed === geos.size + mats.size,
    { geometries: geos.size, materials: mats.size, disposedGeoms: dg, disposedMats: dm, disposedTotal: disposed });
  ok('清空远端后场景回到 0（换房不泄漏）', G.scene.children.length === 0 && MP.state().players === 0,
    { sceneChildren: G.scene.children.length, remotes: MP.state().players });
}

/* ===================================================================== */
section('9 · 命中 UI 合并');
{
  resetClock(50000);
  hits.length = 0;
  const p0 = perf();
  MP.net2.testHit('hit');
  for (let i = 0; i < 9; i++) { clock.t += 5; MP.net2.testHit('hit'); }
  clock.t += 70; pumpTimers();
  clock.t += 1; MP.net2.testHit('kill');
  clock.t += 70; pumpTimers();
  const p1 = perf();
  ok('11 次命中在 60ms 内合并为 3 次 UI（kill 收尾）', delta(p0, p1, 'hitQueued') === 11 && delta(p0, p1, 'hitWrites') === 3 && hits[hits.length - 1] === 'kill',
    { queued: delta(p0, p1, 'hitQueued'), writes: delta(p0, p1, 'hitWrites'), kinds: hits });
}

/* ===================================================================== */
section('10 · 无 pageerror / 未捕获异常');
{
  ok('Node 沙箱无 pageerror 等价物（未捕获异常）', uncaught.length === 0,
    { uncaught: uncaught.slice(0, 3).map((e) => String(e && e.message || e)) });
  ok('模块内 console.error 为 0', errors.length === 0, { errors: errors.slice(0, 3) });
}

/* ===================================================================== */
console.log('\n----------------------------------------');
console.log('PASS ' + pass + ' · FAIL ' + fail + ' · SKIP ' + skipped);
if (fail) {
  console.log('结果：失败');
  process.exit(1);
}
console.log('结果：全部通过（' + pass + ' 项 PASS）');
process.exit(0);
