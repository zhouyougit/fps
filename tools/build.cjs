#!/usr/bin/env node
/* =====================================================================
   SALTLINE · build.cjs — 单文件构建（V32–V42）
   - 拼接 head + engine + shared sim + core + ext + feature modules
   - 所有替换使用函数形式，避免 $& 序列被解释（旧构建隐患 E2）
   - 必须显式传入 target/profile；缺文件/缺标记/未知 profile 直接报错
   - 输出体积明细，预算 3.5MB
   ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));

const PROFILES = ['v32', 'v33', 'v34', 'v35', 'v36', 'v37', 'v38', 'v39', 'v40', 'v41', 'v42', 'v43', 'v44', 'v45', 'v46', 'v47', 'v48', 'v49', 'v50', 'v51', 'v52', 'v53', 'v54', 'v55', 'dev'];
const LABELS = {
  v32: 'V32 · 地基',
  v33: 'V33 · 手感',
  v34: 'V34 · 对手',
  v35: 'V35 · 世界',
  v36: 'V36 · 联机',
  v37: 'V37 · 质量',
  v38: 'V38 · 性能',
  v39: 'V39 · 收尾',
  v40: 'V40 · 地图深化',
  v41: 'V41 · 性能',
  v42: 'V42 · 架构',
  v43: 'V43 · 角色',
  v44: 'V44 · 平衡',
  v45: 'V45 · 精简',
  v46: 'V46 · 内存',
  v47: 'V47 · 打磨',
  v48: 'V48 · 稳定',
  v49: 'V49 · 视距',
  v50: 'V50 · 设置',
  v51: 'V51 · 可读',
  v52: 'V52 · 收口',
  v53: 'V53 · 改进',
  v54: 'V54 · 收敛',
  v55: 'V55 · 平衡'
};
// V40 地图深化：用户明确允许放宽单文件体积，先完成地图细节，后续再统一优化。
// 当前约 3.54MB；预算临时放宽到 6MB，仅作为失控保护，不是质量目标。
const BUDGET = 6 * 1024 * 1024;

function usage(msg) {
  if (msg) console.error('[build] ' + msg);
  console.error('用法: node tools/build.cjs <target.html> <profile>');
  console.error('  target  : 输出文件（相对仓库根目录或绝对路径），例：versions/几猫_V32.html');
  console.error('  profile : ' + PROFILES.join(' | '));
  console.error('  示例    : node tools/build.cjs "versions/几猫_V53.html" v53');
  console.error('  示例    : node tools/build.cjs game.html v53');
  console.error('  --force : 允许覆盖 versions/ 下已存在的快照（默认拒绝）');
  console.error('  不再提供默认 target/profile（旧默认会把 game.html 覆盖成 v32）。');
  process.exit(1);
}

if (process.argv.length < 4) usage('必须显式指定 target 与 profile');
const targetArg = process.argv[2];
const profile = process.argv[3];
if (!targetArg || !profile) usage('必须显式指定 target 与 profile');
if (PROFILES.indexOf(profile) < 0) usage('未知 profile: ' + profile);
const force = process.argv.indexOf('--force') >= 0;
const MINIFY = process.argv.indexOf('--minify') >= 0;
const target = path.isAbsolute(targetArg) ? targetArg : path.resolve(root, targetArg);
const version = process.env.SX_VERSION || pkg.version || '0.38.0';
// ENG-2：历史快照只读。versions/ 下已存在的产物默认拒绝覆盖，必须显式 --force。
const versionsDir = path.join(root, 'versions') + path.sep;
if (!force && target.indexOf(versionsDir) === 0 && fs.existsSync(target)) {
  console.error('[build] 拒绝覆盖历史快照：' + path.relative(root, target));
  console.error('[build] 如确需重建，请显式追加 --force。');
  process.exit(1);
}

function readIf(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; }
}
function must(rel, label) {
  const v = readIf(path.join(root, rel));
  if (v == null) throw new Error('[build] 缺少文件 ' + rel + (label ? ' (' + label + ')' : ''));
  return v;
}
function replaceMarker(src, marker, label, body) {
  if (src.indexOf(marker) < 0) throw new Error('[build] 标记缺失 ' + marker + ' (' + label + ')');
  return src.replace(marker, () => body);
}

/* ---- 基础壳与引擎 ---- */
let head = must('src/template.head.html');
// V42：配置层先于引擎/玩法执行（window.SX_QUALITY_PRESETS / SX_BALANCE）
const gameConfig = must('src/config/quality.js') + '\n' + must('src/config/balance.js') + '\n' + must('src/config/avatar.js');
// V42：game.js 已按 manifest 拆成 src/game/*.js；拼接顺序是契约的一部分。
const gameManifest = JSON.parse(must('src/game/manifest.json', 'game manifest'));
let gameBundle = '';
for (const part of gameManifest.parts) {
  gameBundle += must(part.file, 'game part') + '\n';
}
let js = gameConfig + '\n' + gameBundle;
let ext = must('src/ext.js');

/* ---- engine 内部扩展（必须在武器/战役模块作用域内） ---- */
const weaponExt = must('src/weapon_ext.js');
// V42：武器数值只保留 packages/data/weapons/*.json 一份源，构建时内联。
const WEAPON_IDS = ['pac9', 'breaker12', 'dmr', 'smg', 'lmg', 'sidearm'];
const weaponData = {};
for (const wid of WEAPON_IDS) {
  weaponData[wid] = JSON.parse(must('packages/data/weapons/' + wid + '.json', 'weapon data'));
}
const weaponDataTag = 'window.__SX_WEAPON_DATA_SOURCE = ' + JSON.stringify(weaponData) + ';\n';
let campaign = must('src/campaign.js');
const boss = must('src/boss.js');
const tactics = must('src/tactics.js');
const training = must('src/training.js');
const armory = must('src/armory.js');
const access = must('src/access.js');
const mapkit = must('src/mapkit.js');
const mapDepot = must('src/map_depot.js');
const mapShip = must('src/map_ship.js');
const mapCore = must('src/map_core.js');
const mapHarborExt = must('src/map_harbor_ext.js');
const audioExt = must('src/audio_ext.js');
const onboarding = must('src/onboarding.js');
const mp = must('src/mp.js');

js = replaceMarker(js, '  /*__WEAPON_EXT__*/', 'weapon_ext', weaponDataTag + weaponExt);

// BOSS 注入：旧 campaign.js 没有显式标记，走 CAMP_KEY 前置回退；有标记时优先用标记。
if (campaign.indexOf('  /*__BOSS__*/') >= 0) campaign = campaign.replace('  /*__BOSS__*/', () => boss);
if (campaign.indexOf('function initBoss') < 0) {
  if (campaign.indexOf('  var CAMP_KEY') < 0) throw new Error('[build] campaign 缺少 BOSS 注入点');
  campaign = campaign.replace('  var CAMP_KEY', () => boss + '\n  var CAMP_KEY');
}
if (campaign.indexOf('function initBoss') < 0) throw new Error('[build] BOSS 注入失败');
campaign = replaceMarker(campaign, '/*__TRAINING__*/', 'training', training);
if (!/var MISSIONS\s*=\s*\[/.test(campaign)) throw new Error('[build] campaign 缺少 MISSIONS');

ext = replaceMarker(ext, '/*__MAPKIT__*/', 'mapkit', mapkit + '\n' + mapDepot + '\n' + mapShip + '\n' + mapCore + '\n' + mapHarborExt);
if (ext.indexOf('var MapKit') < 0) throw new Error('[build] mapkit 注入失败');
ext = replaceMarker(ext, '/*__CAMPAIGN__*/', 'campaign', campaign);
if (!/var MISSIONS\s*=\s*\[/.test(ext)) throw new Error('[build] campaign 标记替换后 MISSIONS 缺失');
ext = replaceMarker(ext, '/*__ONBOARD__*/', 'onboarding', onboarding);
if (ext.indexOf('V28 · 首次出击') < 0) throw new Error('[build] onboarding 注入失败');
ext = replaceMarker(ext, '/*__AUDIO__*/', 'audio_ext', audioExt);
if (ext.indexOf('V26 · 动态音乐') < 0) throw new Error('[build] audio 注入失败');
ext = replaceMarker(ext, '/*__MP__*/', 'mp', mp);
if (ext.indexOf('联机对战客户端') < 0) throw new Error('[build] mp 注入失败');
ext = replaceMarker(ext, '/*__ACCESS__*/', 'access', access);
ext = replaceMarker(ext, '/*__ARMORY__*/', 'armory', armory);
ext = replaceMarker(ext, '/*__TACTICS__*/', 'tactics', tactics);

/* ---- 共享模拟层（纯逻辑，UMD） ---- */
const SIM_ORDER = ['math.js', 'rng.js', 'world.js', 'movement.js', 'weapons.js', 'damage.js', 'command.js', 'index.js'];
let sim = '';
for (const f of SIM_ORDER) {
  sim += '\n/* packages/sim/' + f + ' */\n' + must('packages/sim/' + f, 'SIM_ORDER');
}

/* ---- 核心底座（在 ext 之前加载） ---- */
const CORE_ORDER = ['core_errors.js', 'core_save.js', 'core_clock.js', 'core_i18n.js', 'core_systems.js', 'core_bridge.js', 'data_maps.js', 'core_loop.js'];
let core = '';
for (const f of CORE_ORDER) {
  core += '\n/* src/' + f + ' */\n' + must('src/' + f, 'CORE_ORDER');
}
const netProtocol = must('packages/net/protocol.js', 'net protocol');

/* ---- 功能模块（在 ext 之后加载） ---- */
// V36 起的完整功能集；V37（质量）/ V38（性能）只修 bug 与性能，模块集合不变。
const V36_FEATURES = ['ext_weapons2.js', 'ext_movement.js', 'ext_feedback.js', 'ext_audio2.js', 'ext_input.js',
  'ext_ai.js', 'ext_enemies2.js', 'ext_boss2.js', 'ext_missions2.js', 'ext_progress.js',
  'ext_visual.js', 'ext_ui2.js', 'ext_music2.js', 'ext_net2.js'];
const V39_FEATURES = V36_FEATURES.concat(['ext_lod.js']);
// V41：固定点光源预算；v40 之后源码统一走新渲染路径，历史 V40 产物保持快照。
const V41_FEATURES = V39_FEATURES.concat(['ext_lights.js', 'mp_avatar.js']);
const FEATURE_SETS = {
  v32: [],
  v33: ['ext_weapons2.js', 'ext_movement.js', 'ext_feedback.js', 'ext_audio2.js', 'ext_input.js'],
  v34: ['ext_weapons2.js', 'ext_movement.js', 'ext_feedback.js', 'ext_audio2.js', 'ext_input.js',
        'ext_ai.js', 'ext_enemies2.js', 'ext_boss2.js', 'ext_missions2.js', 'ext_progress.js'],
  v35: ['ext_weapons2.js', 'ext_movement.js', 'ext_feedback.js', 'ext_audio2.js', 'ext_input.js',
        'ext_ai.js', 'ext_enemies2.js', 'ext_boss2.js', 'ext_missions2.js', 'ext_progress.js',
        'ext_visual.js', 'ext_ui2.js', 'ext_music2.js'],
  v36: V36_FEATURES,
  v37: V36_FEATURES,
  v38: V36_FEATURES,
  v39: V39_FEATURES,
  v40: V41_FEATURES,
  v41: V41_FEATURES,
  v42: V41_FEATURES,
  v43: V41_FEATURES,
  v44: V41_FEATURES,
  v45: V41_FEATURES,
  v46: V41_FEATURES,
  v47: V41_FEATURES,
  v48: V41_FEATURES,
  v49: V41_FEATURES,
  v50: V41_FEATURES,
  v51: V41_FEATURES,
  v52: V41_FEATURES,
  v53: V41_FEATURES,
  v54: V41_FEATURES,
  v55: V41_FEATURES,
};
let features = '';
if (profile === 'dev') {
  // dev：包含所有 ext_*.js
  const files = fs.readdirSync(path.join(root, 'src')).sort().filter(function (f) {
    return f.indexOf('ext_') === 0 && /\.js$/.test(f);
  });
  if (!files.length) throw new Error('[build] dev profile 未找到任何 ext_*.js');
  for (const f of files) features += '\n/* src/' + f + ' */\n' + must('src/' + f, 'dev feature');
} else {
  if (!Object.prototype.hasOwnProperty.call(FEATURE_SETS, profile)) throw new Error('[build] FEATURE_SETS 缺少 profile: ' + profile);
  for (const f of FEATURE_SETS[profile]) {
    features += '\n/* src/' + f + ' */\n' + must('src/' + f, 'FEATURE_SETS.' + profile);
  }
  // v35+ 额外加载本地化补充包（必须存在，不能静默跳过）
  if (FEATURE_SETS[profile].indexOf('ext_ui2.js') >= 0) {
    features = '\n/* src/i18n_extra.js */\n' + must('src/i18n_extra.js', 'i18n_extra') + features;
  }
}

const buildInfo = {
  version: version,
  profile: profile,
  target: path.basename(target),
  // ENG-7：引擎是无上游源码的 vendor 片段；至少把 three.js 版本写进产物。
  three: 'r180',
  minified: MINIFY,
  commit: (function () {
    try {
      return execSync('git rev-parse --short HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch (e) { return 'local'; }
  })()
};
const buildTag = 'window.__BUILD__ = ' + JSON.stringify(buildInfo) + ';\n' +
  'window.__SX_PROFILE = ' + JSON.stringify(profile) + ';\n' +
  'window.__VERSION_LABEL = ' + JSON.stringify(LABELS[profile] || ('V' + profile.replace(/^v/, ''))) + ';\n';

head = head.replace(/<script>\s*$/, () => '<script>\n' + buildTag);
if (head.indexOf('window.__BUILD__') < 0) throw new Error('[build] buildTag 注入失败（template.head.html 缺少 <script> 结尾）');

// ENG-6：可选压缩构建。每个内联 script 单独 minify，保留全局名（toplevel=false），
// 避免跨 <script> 的 window.*/SALT_* 约定被破坏。terser 只在 --minify 时加载。
function minifyCode(code, label) {
  if (!MINIFY || !code) return code;
  let out;
  try {
    const terser = require('terser');
    out = terser.minify_sync(code, {
      compress: { passes: 2, drop_debugger: false },
      mangle: true,
      format: { comments: false, ascii_only: false },
      sourceMap: false,
    });
  } catch (e) {
    throw new Error('[build] minify 失败 ' + label + ': ' + e.message);
  }
  if (!out || typeof out.code !== 'string') throw new Error('[build] minify 输出为空: ' + label);
  return out.code;
}

const jsOut = minifyCode(js, 'game+cfg');
const simOut = minifyCode(sim, 'sim');
const netOut = minifyCode(netProtocol, 'net');
const coreOut = minifyCode(core, 'core');
const extOut = minifyCode(ext, 'ext');
const featuresOut = minifyCode(features, 'features');

const html =
  head + jsOut + '\n</script>\n' +
  (simOut ? '<script id="salttime-sim">\n' + simOut + '\n</script>\n' : '') +
  (netOut ? '<script id="salttime-net">\n' + netOut + '\n</script>\n' : '') +
  (coreOut ? '<script id="salttime-core">\n' + buildTag + '\n' + coreOut + '\n</script>\n' : '') +
  '<script id="salttime-ext">\n' + extOut + '\n</script>\n' +
  (featuresOut ? '<script id="salttime-features">\n' + featuresOut + '\n</script>\n' : '') +
  '\n</body>\n</html>\n';

fs.writeFileSync(target, html);
const size = fs.statSync(target).size;
const shownTarget = path.relative(root, target) || target;
console.log('built ' + shownTarget + '  profile ' + profile + '  version ' + version + '  minify=' + (MINIFY ? 'on' : 'off') + '  ' + (size / 1048576).toFixed(2) + ' MB');

/* ---- 体积明细 ---- */
function kb(s) { return (Buffer.byteLength(s, 'utf8') / 1024).toFixed(1); }
const parts = [
  ['head', head],
  ['game+cfg', jsOut],
  ['sim', simOut],
  ['net', netOut],
  ['core', coreOut],
  ['ext', extOut],
  ['features', featuresOut]
];
for (const p of parts) console.log('  ' + p[0].padEnd(10) + kb(p[1]).padStart(9) + ' KB');
const pct = (size / BUDGET * 100).toFixed(1);
console.log('  ' + 'total'.padEnd(10) + (size / 1024).toFixed(1).padStart(9) + ' KB / 预算 ' + (BUDGET / 1024 / 1024).toFixed(1) + ' MB（' + pct + '%）');
if (size > BUDGET) {
  console.error('[build] 体积超预算: ' + (size / 1048576).toFixed(2) + 'MB > ' + (BUDGET / 1048576).toFixed(1) + 'MB');
  process.exit(1);
}