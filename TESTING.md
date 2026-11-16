# 测试与开发流程（P0）

## 验证分层（先选层，再跑）

| 层 | 命令 | 典型耗时 | 适用 |
|---|---|---|---|
| L0 静态 | `npm run test:lint` + `npm run test:unit` | <1s | 改完任何代码先跑 |
| L1 快速 | `npm run test:fast` | ~25s | 日常提交；lint + unit + 12 项冒烟 |
| L2 模块 | `npm run test:module -- ui` / `gameplay,save` | 45–150s/模块 | 只改一个子系统 |
| L2.5 服务器 | `npm run test:server` | 1–2min | 改 `server/`、协议、档案 |
| L3 完全 | `npm run test:full` | ~19min | 发布前/大改；需另开 `npm run serve:test` |

按需选择：

| 改动 | 建议 |
|---|---|
| 文案 / UI / i18n / 设置 | `test:fast` + `test:module -- ui` |
| 单模块玩法/BOSS/敌人 | `test:fast` + `test:module -- gameplay` |
| 地图 / 切图 / 天空 | `test:fast` + `test:module -- map,visual` |
| 存档 / 军械库 | `test:fast` + `test:module -- save` |
| 联机客户端 / 协议 | `test:fast` + `test:module -- net`（服务端再跑 `test:server`） |
| 音频 | `test:fast` + `test:module -- audio` |
| 性能 / 灯池 / 画质 | `test:fast` + `test:module -- visual,perf` |
| 发布 | `npm run serve:test` + `npm run test:full` |

自动选层：

    npm run test:plan              # 看当前 git 变更推荐哪层
    npm run test:changed           # 自动跑 fast + 推荐模块 + server
    npm run test:plan -- --base v55

命令说明：

    npm run test:fast              # lint + unit + 12 项状态驱动冒烟，约 25s
    npm run test:module -- ui      # 单模块（ui/gameplay/map/net/visual/audio/save/perf）
    npm run test:module -- ui,save # 多模块，自动去重
    npm run test:server            # 服务器 profiles + round + net2
    npm run test:full              # suite85 + V55 + 全版本 + e2e + server
    npm run test:perf              # V41 性能回归
    npm run test:config            # 配置/拆分/manifest
    npm run test:avatar            # V43 联机士兵
    npm run test:drone             # V55 自杀无人机
    node tools/run_tests.mjs --only=tools/test_v39_visual.mjs

日志写在 `tools/logs/<时间>-<名字>.log`，退出码 0/1，末尾有耗时汇总。

实测基线（V55，macOS Metal）：`test:fast` **~24s**；模块 ui ~123s / gameplay ~145s / map ~100s / net ~134s / visual ~122s / audio ~45s / save ~82s / perf ~49s；`test:full` **~1125s（约19分钟）**。

## GPU 模式（P0 最大收益）

`tools/pwargs.mjs` 统一启动参数：

- macOS 默认：`--enable-gpu --use-angle=metal`（失败仍有 `--enable-unsafe-swiftshader` 兜底）
- Linux/CI：默认 SwiftShader；可设 `SX_GPU=metal|sw` 覆盖
- 需要 GUI 调试：`SX_HEADLESS=0`

实测（同一台 Mac，V39）：

| 配置 | 首次 ready | FPS |
|---|---:|---:|
| SwiftShader + low | 36.9s | 1.0 |
| Metal + low | 18.0s | 30.9 |
| Metal + low + novisual | 12.6s | 60.2 |

因此**逻辑测试默认 `novisual=1`**，画面专项（test_v35_visual / test_v39_visual）不开。

## 写测试的硬规则

1. **不裸 sleep 后断言**：用 `waitState(page, 'playing')`、`waitForFunction`、事件计数。
2. **时间推进用固定步**：`await step(page, n)` 调 `__SX_LOOP.step(n)`；不要靠 rAF 等 2 秒。
3. **一项测试只开一个 page**；同文件复用 page，必要时 `__SX.applyMission` / `enemies.clear` 重置，而不是 New Page。
4. **开测前**：`launchBrowser()` + `openGame(browser, { params: logicParams() })`，用 `tools/testkit.mjs`。
5. **收尾**：`closeBrowser(browser)`，最后 `process.exit(fail ? 1 : 0)`，避免 browser.close 挂住 CI。
6. **页面错误**：`page.__testErrors`（testkit 自动收集），断言为空。
7. **日志/超时**：由 `tools/run_tests.mjs` 统一负责，单个文件超时会 SIGKILL 并标 FAIL。

## 分层

- `tools/test_fast.mjs`：启动、6 枪、8 关、固定步哈希、4/5/6 槽、新机体、m7 图、滑铲、语言、pageerror。
- `tools/test_v55_acceptance.mjs`：V55 第三关无人机/未压缩产物、暂停时钟、四图海面/天空、LOD 恢复、存档旧键镜像、通关回写、pageerror；已加入 `test:full`。
- `test:full` 的 85 项默认连 `127.0.0.1:3311`，先另开终端跑 `npm run serve:test`。
- 域测试：按改动选一个域，不要每次 85 项。
- `test_suite.mjs`：发布前 85 项全量；V32–V55 复现用 `check_versions.mjs --all`。
- 性能：`tools/test_v41_perf.mjs`（四图同步 gl.finish 帧时间、灯池恒定、程序数稳定、动态分辨率）；基线 `bench/v40_baseline.json`，详细结果 `bench/V41_RESULTS.md`。
- 配置：`tests/unit/config.test.mjs`（画质/平衡/武器 JSON/manifest/构建顺序）；拆分后用 `node tools/game_bundle.mjs --check` 做语法检查。
- 角色：`tools/test_v43_avatar.mjs`（模型层级/43 mesh/双队配色/蹲伏/死亡/行走/清理）；成本 `tools/perf/bench_mp_avatar.mjs`，姿势标定 `tools/perf/probe_avatar.mjs`。
- 双端联机：`test_v39_mp_e2e2.mjs`（两个独立浏览器进程，避开第二标签页卡死）。

## 智能体协作约定

- 子智能体只改代码/补单测，**不启动 Playwright**；浏览器测试统一由 lead 跑 `run_tests.mjs`。
- 一次最多 2 个需要浏览器的任务并行。
- 每个 agent 限定文件清单与验收命令，15–20 分钟收口；长任务落盘后立即报告。
