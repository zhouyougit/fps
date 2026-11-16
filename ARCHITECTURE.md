# ARCHITECTURE.md · 几猫 · SALTLINE（V54）

单文件 3D FPS 的源码结构与维护边界。目标：改一个系统时知道该动哪些文件、哪些文件不能碰。

## 1. 构建流水线

`tools/build.cjs <target.html> <profile>` 按顺序拼接：

1. `src/template.head.html`：HTML/CSS/启动壳；
2. `src/config/quality.js` → `balance.js` → `avatar.js`：先于引擎执行，挂到 `window.SX_*`；
3. `src/game/manifest.json` 列出的 6 个游戏片段（顺序是契约）：
   `00_engine` → `10_render` → `20_world` → `25_fx` → `30_gameplay` → `40_ui_boot`；
4. `packages/sim` / `packages/net/protocol.js` / `src/core_*`；
5. `src/ext.js`（构建期注入 `weapon_ext` / `campaign` / `mapkit` / `mp.js` 等）；
6. profile 对应的 feature 模块（`ext_lights`、`mp_avatar`、`ext_lod` 等）。

构建必须显式给 target 和 profile；不允许无参数覆盖 `game.html`。`src/game.js` 已删除，不要再生成单文件。
V53 起 `versions/` 下已存在的快照默认拒绝覆盖（必须显式 `--force`），产物 `__BUILD__` 记录 `commit` 与 three.js 版本。V54 起发布默认 `--minify`（terser 逐 script 压缩，保留全局名），体积预算 3.5MB；标签由 mapkit 烘焙为每图 1–2 张图集。

## 2. 源码地图

| 路径 | 职责 | 维护边界 |
|---|---|---|
| `src/config/quality.js` | 五档画质、像素预算 | 调画质只改这里 |
| `src/config/balance.js` | 玩家/任务/敌人/移动/灯池/自适应/自杀无人机 | 调平衡只改这里 |
| `src/config/avatar.js` | 队服/材质/比例/落地阴影/LOD | 调联机外观只改这里 |
| `packages/data/weapons/*.json` | 六把武器数值唯一源 | 构建时内联，`weapon_ext` 不再存重复表 |
| `packages/data/maps/*.map.json` | 四图碰撞/点位 | 走导出器，不手改生成物 |
| `src/mapkit.js` | 地图注册/加载、合并、V46 LRU | 只释放地图自有几何，不 dispose 共享材质 |
| `src/ext_lights.js` | 固定灯池（8 地图 + 2 闪光 + 1 补光） | 灯数恒定，禁止逐灯 PointLight |
| `src/mp_avatar.js` | 程序化联机士兵、合批、LOD、落地阴影 | 32–33 mesh / 4 材质；保留下文 rig 字段 |
| `src/mp.js` | 协议 2.0、预测/插值、远端、HUD、房间 UI | 命令背压/插值 scratch 不要破坏 |
| `src/game/*.js` | 引擎、渲染、世界、FX、玩法、菜单 | 片段共享 IIFE 作用域，按 manifest 顺序 |
| `src/ext_visual.js` | 阴影/TAA/探针/FX/第一人称表现 | 只通过公开 API 接引擎 |
| `src/core_save.js` | 统一存档/迁移/备份/旧键镜像 | 主档损坏先读备份；迁移不可反向覆盖 |

## 3. 运行时关键链路

- **固定步 60Hz**：`core_loop` 的 `step/hash` 是测试/回放根契约；`mp.js` 的预测也按 tick 回放。V53 的 hash 还包含 BOSS/移动/时钟/手雷，低帧率丢时会计入 `stats.droppedMs`。
- **服务器模拟**：`server.cjs` 通过 `packages/sim/movement.stepPlayer` 与客户端共享移动；模拟时间用 `tick × STEP_MS`，墙钟只用于网络/HTTP。
- **错误诊断**：空 catch 统一走 `SXErrors.soft(tag,e)`（按标签只记一条），`__SX_LOOP` 的持续错误也按此限频。
- **渲染**：`10_render` 先算自适应分辨率，再相机 → 世界/视图层 → post；灯数恒定避免 `NUM_POINT_LIGHTS` 重编译。
- **切图**：`MapKit.load` 隐藏 harbor/旧图，build 新图，trim 到 2 张非 harbor；`map:loaded` 通知 ext_visual / ext_lights / ext_lod。
- **联机**：`mp.js` 接收二进制快照 → 插值 → 远端模型；客户端命令队列 ≥90 时背压，避免服务端 `queue_full`。
- **存档**：`SXSave.bootSource()` 保留首载来源；`loadSource()` 反映最近一次 load；`mirrorLegacy` 维护旧键。

## 4. 测试分层

| 层 | 命令 | 说明 |
|---|---|---|
| 静态 | `npm run test:lint` | 测试反模式/文件检查 |
| 单元 | `npm test` / `node --test tests/unit/*.test.mjs` | 配置、sim、save、clock、architecture |
| 快速 | `npm run test:fast` | lint + unit + 12 项浏览器冒烟 |
| 领域 | `npm run test:domain <ui/gameplay/map/net/visual/audio/save/perf>` | 按改动选域 |
| 全量 | `npm run test:full` | 85 项 + 版本 + e2e + server |

## 5. 新增模块/配置的步骤

1. 参数进 `src/config/*`（不要写死在玩法代码）；
2. 需要多文件时加到 `src/game/manifest.json` 或 build 的 feature 集；
3. 保持构建顺序：config → game parts → ext → features；
4. 补单元/领域测试；改地图/协议/存档/sim 时同时跑对应回归；
5. 更新 `CHANGELOG.md` / `README.md` / 本文件。

## 6. 不要破坏的约定

- `src/game.js` 不再存在；改 `src/game/*` 并保持 manifest 行覆盖。
- 不新增逐灯 PointLight；灯池预算 ≤12 场景点光源。
- 不恢复 `weapon_ext.js` 的武器数值重复表。
- 联机远端必须有 `armL/R`、`elbowL/R`、`kneeL/R`、`rifle`、`mag`、`magBase`、`muzzleLocal`、`far`、`lodFar`。
- 地图释放只处理 `sxMapOwned` 几何/标签材质；共享 `G.mats` 不释放。
- 存档迁移来源用 `bootSource` 观测，不能用二次 `load()` 后的 `loadSource` 判断。
