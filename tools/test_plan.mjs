#!/usr/bin/env node
/* =====================================================================
   SALTLINE · tools/test_plan.mjs — 按变更选择测试层
   ---------------------------------------------------------------------
   分层：
     fast    ~25s   lint + unit + 12 项浏览器冒烟（任何开发改动）
     module  30–150s 单模块/多模块（ui/gameplay/map/net/visual/audio/save/perf）
     server  1–2min  服务器 profiles/round/net2（server/ 变更）
     full    ~19min  85 项 + V55 专项 + 全版本 + e2e + server（发布前）
   用法：
     node tools/test_plan.mjs                 # 看变更 -> 推荐命令
     node tools/test_plan.mjs --json
     node tools/test_plan.mjs --base v55      # 指定比较基线
     node tools/test_plan.mjs --files a.js,b.js
     node tools/test_plan.mjs --run           # 依次跑 fast + 推荐模块 + server
   ===================================================================== */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const has = (name) => args.indexOf(name) >= 0;
const BASE = arg('--base', 'HEAD');
const RUN = has('--run');
const JSON_OUT = has('--json');

/* 文件 -> 模块。顺序无关，最后去重。 */
const RULES = [
  // 玩法 / 战役 / BOSS / 敌人 / 任务 / 成长 / 训练
  [/^src\/(config\/balance|campaign|boss|ext_boss2|ext_ai|ext_enemies2|ext_missions2|ext_progress|training)\.js$/, ['gameplay']],
  // 存档 / 军械库 / 无障碍
  [/^src\/(core_save|core_bridge|armory|access)\.js$/, ['save']],
  // 联机客户端 / 协议
  [/^src\/(mp|ext_net2)\.js$/, ['net']],
  [/^packages\/net\//, ['net']],
  // 共享模拟：客户端/服务器都要跑
  [/^packages\/sim\//, ['net', 'gameplay']],
  // 地图 / 切图 / 海面
  [/^src\/(mapkit|map_.*)\.js$/, ['map', 'visual']],
  // 画面 / 灯光 / 角色 LOD / 画质
  [/^src\/(ext_visual|ext_lights|mp_avatar|config\/(quality|avatar))\.js$/, ['visual', 'perf']],
  // UI / 本地化
  [/^src\/(ext_ui2|ext_input|core_i18n|i18n_extra)\.js$/, ['ui']],
  // 音频
  [/^src\/(ext_audio2|audio_ext|ext_music2)\.js$/, ['audio']],
  // 核心循环 / 错误 / 反馈 / 武器：玩法 + 画面都容易受影响
  [/^src\/(core_loop|core_errors|core_clock|core_systems|ext_feedback|ext_weapons2|weapon_ext|ext|core_bridge)\.js$/, ['gameplay', 'visual']],
  [/^src\/game\//, ['gameplay', 'visual']],
  // 服务器：独立命令，不进 module
  [/^server\//, ['__server__']],
  // 测试自身：按文件名归类；未知测试只跑 lint/unit
  [/^tools\/test_v35_ui|^tools\/test_v38_ui|^tools\/test_v39_i18n|^tools\/test_v50_quality/, ['ui']],
  [/^tools\/test_v34_missions|^tools\/test_v37_|^tools\/test_v44_drone|^tools\/test_v51_enemy/, ['gameplay']],
  [/^tools\/test_mapdata|^tools\/test_v32_ground|^tools\/test_v46_map/, ['map']],
  [/^tools\/test_v36_net|^tools\/test_v39_mp_e2e/, ['net']],
  [/^tools\/test_v35_visual|^tools\/test_v39_visual|^tools\/test_v43_avatar/, ['visual']],
  [/^tools\/test_v35_audio|^tools\/test_v38_audio/, ['audio']],
  [/^tools\/test_save|^tools\/test_v38_armory/, ['save']],
  [/^tools\/test_v4[01]_perf|^tools\/test_v38_mp_perf/, ['perf']],
];

function gitList(args) {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) return [];
  return r.stdout.split('\n').map((s) => s.trim()).filter(Boolean);
}
function changedFiles() {
  const explicit = arg('--files', '');
  if (explicit) return explicit.split(',').map((s) => s.trim()).filter(Boolean);
  const tracked = gitList(['diff', '--name-only', BASE]);
  const untracked = gitList(['ls-files', '--others', '--exclude-standard']);
  return [...new Set([...tracked, ...untracked])];
}
function modulesFor(files) {
  const mods = new Set();
  for (const file of files) {
    let matched = false;
    for (const [re, list] of RULES) {
      if (re.test(file)) {
        for (const m of list) mods.add(m);
        matched = true;
        break;
      }
    }
    if (!matched && /^(src|packages)\//.test(file)) {
      // 未知源码：至少跑玩法 + 画面
      mods.add('gameplay');
      mods.add('visual');
    }
  }
  return [...mods];
}

const files = changedFiles();
const mods = modulesFor(files);
const modules = mods.filter((m) => m !== '__server__');
const server = mods.includes('__server__');
const commands = [];
if (!files.length) {
  commands.push('npm run test:fast');
  commands.push('# 无变更；如需发布前门禁：npm run test:full');
} else {
  commands.push('npm run test:fast');
  if (modules.length) commands.push('npm run test:module -- ' + modules.join(','));
  if (server) commands.push('npm run test:server');
  commands.push('# 发布前：npm run test:full（需另开 npm run serve:test）');
}

if (JSON_OUT) {
  console.log(JSON.stringify({ base: BASE, files, modules, server, commands }, null, 2));
} else {
  console.log('== V55 测试计划 ==');
  console.log('基线: ' + BASE + '   变更: ' + (files.length ? files.length + ' 个文件' : '无'));
  for (const f of files.slice(0, 30)) console.log('  · ' + f);
  if (files.length > 30) console.log('  · … 其余 ' + (files.length - 30) + ' 个');
  console.log('建议模块: ' + (modules.length ? modules.join(', ') : '无（只跑 fast）') + (server ? ' + server' : ''));
  console.log('建议命令:');
  for (const c of commands) console.log('  ' + c);
}

if (RUN) {
  const run = (cmdArgs) => {
    console.log('\n[test-plan] $ ' + [process.execPath, ...cmdArgs].join(' '));
    const r = spawnSync(process.execPath, cmdArgs, { cwd: ROOT, stdio: 'inherit' });
    if (r.status !== 0) process.exit(r.status || 1);
  };
  run(['tools/run_tests.mjs', 'fast']);
  if (modules.length) run(['tools/run_tests.mjs', 'module', modules.join(',')]);
  if (server) run(['tools/run_server_tests.mjs']);
}
