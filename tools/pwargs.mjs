/* 统一 Playwright 启动参数：macOS 默认 Metal GPU，失败回退 SwiftShader */
import os from 'node:os';

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

/** 逻辑测试用的轻量 URL：关闭画面扩展、低画质、固定 0.1 步长 */
export function gameUrl(file, params) {
  const base = 'file://' + (file || process.env.SX_TARGET || '/Users/zhouyou/codex_workspace/fps/game.html');
  const q = Object.assign({ q: 'low', noaudio: '1', autostart: '1', dt: '0.1' }, params || {});
  const qs = Object.entries(q).filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v))).join('&');
  return base + (base.indexOf('?') >= 0 ? '&' : '?') + qs;
}

export function launchOptions(overrides) {
  return Object.assign({ headless: HEADLESS, args: PW_ARGS, executablePath: process.env.CHROME_EXE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }, overrides || {});
}

export default { PW_ARGS, GPU_MODE, HEADLESS, VIEWPORT, gameUrl, launchOptions };
