# V54 性能测量工具与门禁（PERF-1/2/3/5/6）

基线：V53（tag `v53` / `b6356d0`）。本目录报告由以下脚本生成；脚本只写，浏览器验收由 lead 统一跑。

## 1. 文件与门禁

| 项 | 脚本 | 产出 | 门禁 |
|---|---|---|---|
| PERF-5 high 档 + alloc | `tools/test_v41_perf.mjs` | `bench/v54_perf_high.json` | 四图 high avg ≤ 16.7ms、p95 ≤ 18.5ms；每图 allocKBps ≤ 81900KB/s（V53 63MB/s × 1.3） |
| PERF-6 堆增长 | `tools/test_v54_heap.mjs` | `bench/v54_heap.json` | 3 圈四图后 JS heap 增长 < 60MiB；programs 增长 ≤ 20 |
| PERF-1 分配采样 | `tools/prof_v54_alloc.mjs` | `bench/v54_alloc.json` | 无（只报告 top 30 callFrame / top 20 URL / allocKBps） |
| PERF-2 切图剖析 | `tools/prof_v54_map.mjs` | `bench/v54_map_profile.json` | 无（报告阶段耗时与 ≥100ms 长任务） |
| PERF-3 透明/label 基线 | `tools/test_v54_transparent.mjs` | `bench/v54_transparent.json` | 无（只测量，后续 lead 收紧） |

所有脚本支持 `SX_TARGET`（默认 `game.html`），通过 `tools/testkit.mjs` / `tools/pwargs.mjs` 启动完整 Chrome；不要用 Playwright headless-shell 跑 Metal。

## 2. 建议 lead 先跑的命令

    # 1) 先跑 high 门禁（最重要，含 alloc 上限）
    node tools/test_v41_perf.mjs

    # 2) 再看堆是否单调增长
    node tools/test_v54_heap.mjs

    # 3) 看渲染分配热点
    node tools/prof_v54_alloc.mjs

    # 4) 看切图 8 次往返的阶段/长任务
    node tools/prof_v54_map.mjs

    # 5) 透明/label 基线
    node tools/test_v54_transparent.mjs

只跑原有 medium（跳过 high）：`SX_PERF_HIGH=0 node tools/test_v41_perf.mjs`。

## 3. 指标怎么读

### PERF-5（test_v41_perf.mjs）

- medium 断言保持 V41 原样：四图 avg ≤ 16.7ms、点光源 ≤12 且恒定、程序数稳定、动态分辨率生效、无 pageerror。
- high 段用 `__SX_VISUAL.setQuality('high')` 切档，重新测四图；avg/p95 分别看均值与第 95 百分位。
- `allocKBps` 优先读页面暴露值（`__SX_PERF.allocKBps` / `__PERF_STATS.allocKBps` / `__G.render.stats().allocKBps`），页面没有时用 CDP `HeapProfiler.startSampling`（32768B 间隔）兜底；两者都没有时打印 `SKIP`，不伪造成通过。
- 上限 81900KB/s = 81.9MB/s（十进制），即 V53 63MB/s × 1.3。lead 复测后可直接 `SX_ALLOC_LIMIT_KBPS=...` 收紧。

### PERF-6（test_v54_heap.mjs）

- 基线：先跑 1 圈暖机（默认），再 `HeapProfiler.collectGarbage`，记录 `Runtime.getHeapUsage().usedSize`、programs/geometries/textures。
- 每圈：depot → ship → core → harbor，每图旋转相机 `SX_HEAP_FRAMES`（默认 30）帧；圈末强制 GC 再记录。
- `growth.heapGrowthMB` 是最后圈减基线；`monotonic` 只提示每圈都上涨，不单独判失败。
- 默认先跑 1 圈暖机再强制 GC 取基线，避免把四图首次 build 的 programs/纹理算成“泄漏”；要严格从启动后的 harbor 基线算时用 `SX_HEAP_WARMUP=0`。
- 阈值覆盖：`SX_HEAP_GROWTH_MB`、`SX_HEAP_PROGRAM_GROWTH`。

### PERF-1（prof_v54_alloc.mjs）

- 默认 harbor、medium、600 帧、相机绕 Y 轴旋转；用 CDP sampling 记录总分配字节，除以渲染时长得到 `allocKBps`。
- `topCallFrames` 是 self bytes（函数直接分配），按 url/函数/行号聚合；`topUrls` 用来看热点在引擎还是扩展层。
- 单次 ±10% 正常；改代码前后各跑 2–3 次看中位数。`SX_ALLOC_MAP` 可换图，`SX_ALLOC_FRAMES` 可缩短软渲染时间。
- A/B 基线示例：`SX_TARGET=versions/几猫_V53.html SX_ALLOC_REPORT=bench/v53_alloc.json node tools/prof_v54_alloc.mjs`。

### PERF-2（prof_v54_map.mjs）

- 每次切图拆成 build / load / compile / first / probe 五段；build 先预构建，load 内部命中 `built=true`，避免重复建图。
- `compileMs` = `renderer.compile + gl.finish`，是 shader 编译主信号；`firstFrameMs` 是新图第一帧尖峰；`probeMs/probeFrames` 是 medium 档 PMREM 探针分帧收尾。
- `longTasks` 记录 `PerformanceObserver('longtask')` 的所有条目；`longTasksOverThreshold` 默认 ≥100ms（`SX_LONG_TASK_MS`）。V53 ship 单次切图最大长任务约 283ms，是目标对照。
- 阶段切换都写了 `performance.mark('v54:<phase>:<start|end>:<map>')` / `measure`，可在 trace 里过滤 `v54:*`。

### PERF-3（test_v54_transparent.mjs）

- 只统计当前激活地图根节点（harbor 用 `G.level.root`，其余用 `MapKit.def(id).merged`），不含敌人/FX/第一人称。
- `transparentMeshes` = 材质 `transparent===true` 的 mesh 数（V53 约 177–396）；alphaTest / depthWrite=false 单独列。
- `labelMeshes` / `labelTextureCount`：label mesh 数与唯一 CanvasTexture 数；图集/缓存优化主要看后者。
- `topMaterials` 按 mesh 数排序；`transparentTop` 只看透明材质，避免被不透明主体淹没。

## 4. 预期阈值（首轮）

| 指标 | 阈值 | 备注 |
|---|---|---|
| high avg（四图） | ≤ 16.7ms | 1600x900@2x / Metal；软渲染需放宽 |
| high p95（四图） | ≤ 18.5ms | `SX_PERF_P95_HIGH` |
| high allocKBps（每图） | ≤ 81900KB/s | V53 63MB/s × 1.3；后续收紧 |
| heap growth（3 圈） | < 60MiB | `SX_HEAP_GROWTH_MB` |
| programs growth（3 圈） | ≤ 20 | `SX_HEAP_PROGRAM_GROWTH` |
| ship 单次切图最大长任务 | < 150ms（目标） | V53 约 283ms；PERF-2 只报告 |

报告 JSON 均包含 `label`、`gpu`、`target`、阈值和原始读数，便于 lead 在 CHANGELOG/状态表中引用。

## 5. V54 首轮实测

| 指标 | V54 结果 | 对比/结论 |
|---|---|---|
| medium 四图 | harbor 12.1 / depot 13.1 / ship 9.8 / core 9.7ms | 较 V53 约 -7~9%；标签图集 + 静态矩阵 |
| high 四图 | 16.1 / 16.0 / 12.0 / 12.0ms；p95 18.3–18.5 / 18.5 / 13 / 13.1 | 36/36 门禁通过；p95 贴线，复跑通过 |
| high alloc | 51.3–61.6MB/s | 均低于 81.9 上限 |
| 3 圈 heap | 40.3→44.63MiB（+4.33） | programs 0 增长；geometries +1101（LRU 重建，非堆主因） |
| 透明 mesh | 397→333（-16%） | label mesh 372→308；剩余多为引擎 decal/CanvasTexture |
| 分配热点 | 106.65MB/s；约 89% 在 three program cache key/uniform cache | 引擎内部，V54 不改内核 |
| 切图长任务 | depot build 576ms / ship first 2.5s / full compile 7.4s | 需分帧 build/shader，V55 候选 |
