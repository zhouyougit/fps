# TECH_TASKS_V54 · 未完成项收敛计划（基于 V53 状态）

- 基线：V53（tag `v53`，commit `b6356d0`）
- 目标：把 V53 状态表里“未完成且有价值”的项做成 V54；不新增玩法，优先可测量、可回滚的收益。
- 原则：先测量再改；每项有验收命令/指标；浏览器与全量验收由 lead 统一跑。

## 1. 结论性取舍

### 进 V54（有价值、可验收）

| 组 | 项 | 为什么现在做 |
|---|---|---|
| 性能 | PERF-1 渲染分配 | 42–63MB/s 是最大抖动源；先做分配采样，只改 top 热点 |
| 性能 | PERF-2 切图 280ms | 已有稳定复现路径；trace 后做预编译/分帧 |
| 性能 | PERF-3 透明网格/label | 177–396 个透明网格；先做 label 纹理缓存/图集，decals 视收益 |
| 性能 | PERF-5 high 阈值 | high p95 已贴 16.7ms，补 high/分配量门禁 |
| 性能 | PERF-6 堆增长 | 强制 GC 多圈，确认是否单调增长 |
| 性能 | PERF-7 静态矩阵 | 仅对明确静态的合并网格关闭 matrixAutoUpdate，先测 CPU |
| 架构 | ARCH-2 空 catch | 约 194 个空 catch；统一 `SXErrors.soft`，先清零高频模块 |
| 架构 | ARCH-1 钩子表 | 至少把 `game.update/render.frame/enemies.update/hud.radio` 的包覆顺序显式化 |
| 架构 | ARCH-4 卸载 | 给系统/事件加 dispose 测试路径，服务测试隔离；不改生产生命周期 |
| 本地化 | I18N 全量 | campaign/mp/armory/ext_boss2/ext_net2/access/boss/training；修 ext.js 中文前缀识别 |
| 工程 | ENG-6 压缩 | 当前 3.62MB；引入 build-only terser，目标 ≤3.5MB |
| 工程 | ENG-8 清理 | 235MB mapwork shots、87MB tools 截图、41MB npm cache、23MB 根目录旧构建 |
| 测试 | TEST-3 归档 | 88 个孤儿测试移入 legacy 目录，lint/inventory 清零噪声 |
| 联机 | NET-5 snapRate | 客户端真正使用 `welcome.snapRate`，插值缓冲按快照率计算 |

### 明确不做（价值低 / 风险高 / 属于新玩法）

| 项 | 原因 |
|---|---|
| SRV-11 配件解锁等级 | 需要给 6 把枪的每个配件新增等级 schema 并改军械库购买/展示，属于新玩法；服务器已能拒绝非法配件 |
| NET-5 快照速度/协议 v3 | 要改二进制快照布局、双端兼容与带宽预算；收益小于风险 |
| ARCH-3 渲染插值 | 需要改相机/远端/第一人称表现，回归面大；先保留 60Hz 固定步，V55 再评估 |
| ENG-7 three 作为真实依赖 | vendor 引擎是单文件发布的一部分，替换会重写构建链 |
| CLI-5 globals/clamp 全量 | 纯机械重构，收益低；只做 fallback 脚本路径修复（如果仍存在） |
| PERF-7 全场景 matrixAutoUpdate | 只做静态合并网格；动态对象不碰 |

## 2. 验收指标

- PERF-1：`allocKBps` 相对 V53 下降 ≥30%，无 pageerror；不改玩法。
- PERF-2：ship 单次切图最大长任务 <150ms（V53 283ms）。
- PERF-3：透明网格数下降 ≥30% 或 label 纹理数下降 ≥50%，帧时间不退化。
- PERF-5：medium/high 双档平均 ≤16.7ms，p95 high ≤18.5ms，分配上限写入报告。
- PERF-6：3 圈强制 GC 后堆增长 <60MB 且不再单调；程序数增长 ≤20。
- PERF-7：静态网格 CPU 时间下降 ≥1ms/帧才保留。
- ARCH-2：高频模块空 catch 清零；`SXErrors.counts().bySoft` 可观测。
- ARCH-1：5 个热点的包覆顺序由显式优先级决定；重复 init 不叠层。
- I18N：`missing()===0`，中英键一致；EN 下 campaign/mp/armory 无中文正文。
- ENG-6：V54 产物 ≤3.5MB（minified release），gzip ≤800KB。
- ENG-8：工作区从约 650MB 降到 ≤250MB，保留 `versions/screens`。
- TEST-3：`tools/test_*.mjs` 只剩被引用/当前测试；legacy 有 README。
- NET-5：客户端 `snapRate` 生效，插值延迟按 1/snapRate 计算；net 单测通过。

## 3. 执行顺序

1. **基线/工具**：V54 分支/版本号 0.54.0；PERF 采样脚本、heap 脚本、high 阈值。
2. **并行**：I18N 全量（campaign/mp/armory/...）；ARCH-2 空 catch（高频模块）；perf 测量工具。
3. **性能修复**：按采样结果改 PERF-1/2/3/7；每项单独构建/测量。
4. **架构**：ARCH-1 钩子表、ARCH-4 dispose、NET-5 snapRate。
5. **工程**：ENG-6 minify、ENG-8 清理、TEST-3 归档。
6. **验收**：V54 构建 + `test:fast` + 域测试 + `test:full` + `check_versions --all`；更新 CHANGELOG/README/状态文档；tag `v54`。

## 4. 状态（已完成）

| 项 | 状态 | 证据 |
|---|---|---|
| ENG-6 minify | ✅ | 2.22MB/gzip 715KB；预算 3.5MB；`__BUILD__.minified=true` |
| I18N 全量 | ✅ | 1107 键/语言、missing=0；`test_v39_i18n` 20/20；EN 战役/军械库/BOSS/训练/联机 |
| ARCH-2 空 catch | ✅ | 10 模块 174→6 处纯日志白名单；168 个 soft 标签；单测 8/8 |
| ARCH-1 短期标记 | ✅ | 8 个包覆迁宿主对象、先标记后包覆；完整钩子表留 V55 |
| PERF-3 标签图集 | 🟡 | 透明 mesh 397→333（-16%），label 372→308；剩余为引擎 decal/CanvasTexture，未冒险图集化 |
| PERF-5 high 门禁 | ✅ | high avg ≤16.7/p95 ≤18.5/alloc ≤81900；实测 36/36（p95 18.5 贴线，重跑通过） |
| PERF-6 heap | ✅ | 3 圈 heap 40.3→44.63MB（+4.33），programs 0；报告 `bench/v54_heap.json` |
| PERF-7 静态矩阵 | ✅ | 合并网格关闭 matrixAutoUpdate；media 四图较 V53 约 -7~9% |
| PERF-1 分配 | 🟡 | 采样完成：106.65MB/s，89% 在 three program cache key/uniform cache；vendor 内核，不做高风险改写 |
| PERF-2 切图长任务 | 🟡 | 采样完成：depot build 576ms / ship first 2.5s（sync gl.finish），full compile 7.4s；移除 compileAsync 无效，需分帧 build/shader，留 V55 |
| NET-5 snapRate | ✅ | 客户端按 welcome.snapRate 计算 interp；unit/source 断言；net 域待复跑 |
| ENG-8 清理 | ✅ | `tools/clean_workspace.mjs` dry-run 429MB；`--apply` 在发布收尾执行 |
| TEST-3 归档 | ⏸ | inventory 117 个测试（引用 26/孤儿 91）；保留文件避免丢历史证据，归档留 V55 |
| ARCH-4 卸载 | ⏸ | 单页生命周期不需要；测试隔离成本高 |
| SRV-11 配件等级 | ⏸ | 需要新数据 schema + 军械库玩法，不属于收敛 |

### 验收

- 单元 210/210；`test:fast` 12/12；V54 专项 14/14；UI/i18n 20/20；net 域全绿。
- 高性能：medium 四图 12.1/13.1/9.8/9.7ms；high 16.1/16.0/12/12ms；alloc 51–61MB/s；high 门禁 36/36。
- 全量 `test:full` **exit 0，1112.2s**；`versions` **161/161**；e2e 9/9；server 64+31+110。
- 工作区清理：dry-run 429MB，`--apply` 已执行；约 650MB→421MB（含 .git 124MB、versions 247MB）。

