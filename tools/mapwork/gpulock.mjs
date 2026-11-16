import fs from 'node:fs';
import path from 'node:path';

/* Cross-process browser/GPU semaphore.
 * AGENTS.md allows 1-2 Chrome instances; we default to 2 slots so four map
 * agents can make progress without thrashing the machine. Stale locks are
 * detected by PID liveness and a short age fallback. */
const ROOT = path.resolve('tools/mapwork');
const SLOTS = Math.max(1, Math.min(2, Number(process.env.SX_GPU_SLOTS || 2)));
const STALE_MS = 5 * 60 * 1000;
const LEGACY = path.join(ROOT, '.gpu.lock');

function alive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; }
  catch (e) { return e && e.code === 'EPERM'; }
}
function readOwner(dir) {
  try {
    const f = path.join(dir, 'owner');
    const txt = fs.readFileSync(f, 'utf8').trim();
    return { pid: Number(txt.split(/\s+/)[0]) || 0, age: Date.now() - fs.statSync(dir).mtimeMs };
  } catch (e) { return null; }
}
function usable(dir) {
  const o = readOwner(dir);
  if (!o) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} return true; }
  if (!alive(o.pid)) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} return true; }
  if (o.age > STALE_MS) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} return true; }
  return false;
}

let held = null;
export async function acquireGPU(timeoutMs = 10 * 60 * 1000) {
  const start = Date.now();
  // legacy single lock may still be held by an older harness process: skip slot 0
  const legacyHeld = fs.existsSync(LEGACY) && !usable(LEGACY);
  for (;;) {
    for (let i = 0; i < SLOTS; i++) {
      if (i === 0 && legacyHeld) continue;
      const dir = path.join(ROOT, '.gpu.lock.' + i);
      if (!fs.existsSync(dir) || usable(dir)) {
        try {
          fs.mkdirSync(dir);
          fs.writeFileSync(path.join(dir, 'owner'), String(process.pid) + ' ' + new Date().toISOString());
          held = dir;
          return i;
        } catch (e) { if (e.code !== 'EEXIST') throw e; }
      }
    }
    if (Date.now() - start > timeoutMs) throw new Error('[gpu-lock] timeout waiting for a slot (' + SLOTS + ')');
    await new Promise((r) => setTimeout(r, 1500));
  }
}

export function releaseGPU() {
  if (!held) return;
  try { fs.rmSync(held, { recursive: true, force: true }); } catch (e) {}
  held = null;
}

export function gpuSlots() { return SLOTS; }
