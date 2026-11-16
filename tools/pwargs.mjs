/* 统一 Playwright 启动参数：macOS 默认 Metal GPU，失败回退 SwiftShader；Chrome 路径集中探测 */
import os from 'node:os';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** 仓库根目录：不依赖调用方的 cwd */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const GPU_MODE = process.env.SX_GPU || (os.platform() === 'darwin' ? 'metal' : 'sw');
export const HEADLESS = process.env.SX_HEADLESS !== '0';
export const VIEWPORT = {
  width: Number(process.env.SX_W || 900),
  height: Number(process.env.SX_H || 520)
};

const COMMON = [
  '--ignore-gpu-blocklist',
  '--allow-file-access-from-files',
  '--autoplay-policy=no-user-gesture-required',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows'
];

export const PW_ARGS = GPU_MODE === 'metal'
  ? ['--enable-gpu', '--use-angle=metal', '--enable-unsafe-swiftshader', ...COMMON]
  : ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', ...COMMON];

/** 按平台列出完整 Chrome/Chromium 候选路径（Playwright headless-shell 不支持 Metal，不能替代） */
export function chromeCandidates() {
  const out = [];
  const home = os.homedir();
  if (process.platform === 'darwin') {
    out.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      path.join(home, 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    );
  }
  if (process.platform === 'win32') {
    const winDirs = [
      process.env.LOCALAPPDATA,
      process.env.PROGRAMFILES,
      process.env['PROGRAMFILES(X86)']
    ].filter(Boolean);
    for (const dir of winDirs) out.push(path.join(dir, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    out.push('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
    out.push('C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe');
  }
  // Linux 常见安装位置；PATH 探测在所有平台都做，覆盖自定义安装目录。
  out.push(
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/opt/google/chrome/chrome'
  );
  const names = process.platform === 'win32'
    ? ['chrome.exe', 'chromium.exe']
    : ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome'];
  for (const dir of String(process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    for (const name of names) out.push(path.join(dir, name));
  }
  return [...new Set(out)];
}

/**
 * 找到可用的 Chrome 可执行文件。
 * 顺序：CHROME_EXE > 平台常见路径 > PATH。找不到时抛出带排查提示的错误。
 */
export function findChrome() {
  const explicit = process.env.CHROME_EXE;
  if (explicit) {
    if (existsSync(explicit)) return explicit;
    throw new Error(
      'CHROME_EXE 指向的文件不存在：' + explicit + '\n' +
      '请把它设为完整 Chrome/Chromium 的可执行文件路径（不要指向 Playwright 的 headless-shell）。'
    );
  }
  const candidates = chromeCandidates();
  const found = candidates.find((p) => existsSync(p));
  if (found) return found;
  throw new Error(
    '找不到 Chrome/Chromium 可执行文件（用于 Playwright 浏览器测试）。\n' +
    '请设置 CHROME_EXE=/absolute/path/to/chrome 后重试；Metal 需要完整 Chrome，不能用 headless-shell。\n' +
    '已尝试：\n  - ' + candidates.join('\n  - ')
  );
}

/** 逻辑测试用的轻量 URL：关闭画面扩展、低画质、固定 0.1 步长。相对路径按仓库根解析，不依赖 cwd。 */
export function gameUrl(file, params) {
  const raw = file || process.env.SX_TARGET || 'game.html';
  const base = /^(file|https?):\/\//i.test(raw) ? raw : pathToFileURL(path.resolve(ROOT, raw)).href;
  const q = Object.assign({ q: 'low', noaudio: '1', autostart: '1', dt: '0.1' }, params || {});
  const qs = Object.entries(q).filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v))).join('&');
  return base + (base.indexOf('?') >= 0 ? '&' : '?') + qs;
}

export function launchOptions(overrides) {
  const opts = Object.assign({ headless: HEADLESS, args: PW_ARGS }, overrides || {});
  if (!opts.executablePath) opts.executablePath = findChrome();
  return opts;
}

export default { ROOT, PW_ARGS, GPU_MODE, HEADLESS, VIEWPORT, gameUrl, launchOptions, findChrome, chromeCandidates };
