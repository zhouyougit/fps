# V41 · 性能优化结果（同机 A/B）

- 机器：Apple M1 Max / 64GB / macOS 27.0.1
- 口径：`tools/perf/bench.mjs`，1600×900 @ DPR2，ANGLE Metal，medium，`dynres=0`
- 方法：每图 60 帧预热 + 90/60 帧同步渲染（`gl.finish` + `readPixels`）
- 基线：`bench/v40_baseline.json`（V40 构建，2026-11-13 22:22）
- 结果：`bench/v42_medium.json`、`tools/test_v41_perf.mjs`（21 PASS / 0 FAIL）

## 1. 同步帧时间（ms，越低越好）

| 地图 | V40 | V41/V42 | 降幅 | 可见点光源 |
|---|---:|---:|---:|---:|
| harbor | 15.50 | 12.06 | 22.2% | 10 |
| depot | 111.36 | 13.54 | 87.8% | 10 |
| ship | 24.62 | 9.75 | 60.4% | 10 |
| core | 45.05 | 9.85 | 78.1% | 10 |

四图全部 ≤ 16.7ms（60fps 预算）。点光源恒定为 8 盏地图灯 + 2 盏闪光灯 = 10 盏场景点光源，另有 1 盏第一人称补光（相机子节点）。

## 2. 关键改动

1. **固定灯池（P1）**：`K.light()` 不再创建 `PointLight`，改为记录；`src/ext_lights.js` 常驻 8 盏地图灯，每 0.1s 按“距离 − 范围 + 视野 + 强度”选灯，0.12s 淡出 / 0.18s 淡入；切图首帧直接满强度，避免黑屏。闪光池 6→2 并纳入预算。
2. **灯光数量恒定**：`NUM_POINT_LIGHTS` 不再随地图/区域变化，连续 60 帧着色器程序数增长 0。
3. **动态分辨率（P2-1）**：像素预算先作用于画质 scale，再乘动态 scale；`scale=0.6` 时 1633×919 → 980×551（旧版不变）。
4. **自动画质回升（P2-2）**：满分辨率连续 3 个采样窗口 < 12.5ms 回升一档，降档后 20s 冷却；切图重置自适应状态（P2-3）。
5. **近级阴影（P3-1）**：只按位置判脏，不再跟随鼠标转向；移动时最多 30Hz 更新。港区静止/转向不再每帧重绘 shadow map。
6. **high 档 MSAA 4→2**（已有 TAA），ultra 保持 4。

## 3. 画面验证

- `tools/test_v39_visual.mjs`（`SX_TARGET=game.html`）13/13 通过：TAA、探针、静止/移动阴影、300 帧无 pageerror。
- 截图对比：`versions/screens/v41_perf/`（depot cold/hall、harbor yard 的 before/after）。
- 冷库冷通道在 8 灯 + 相机位置选灯后与 V40 亮度接近；大厅略暗但保留灯光高光与货架层次。

## 4. 复现

    node tools/build.cjs game.html v41
    node tools/perf/bench.mjs --quality medium --frames 90 --tag v41_medium
    node tools/test_v41_perf.mjs

SwiftShader/CI 上帧时间会显著更高，请用 `SX_PERF_LIMIT=...` 放宽绝对阈值；相对基线断言仍保留。
