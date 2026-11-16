# SALTLINE · 地图深化计划（MAP_REVIEW）

本目录是「地图细节大幅完善」项目的协作区。每张地图由一名独立子 Agent 负责，
按轮次（Round）分析 → 改进 → 构建 → 截图 → 校验 → 记录。每张地图至少 10 轮；
为追上标杆港区的复杂度，允许做到 12-14 轮。10 轮是下限，不是上限。
港区（harbor / 四号泊位，含二号仓库内景）是标杆；其余地图在密度、层次、光照、
纹理、设施数量上向它对齐并争取超越。

## 地图与负责人

| 地图 | 场景 | 负责人 | 源文件 | 玩法数据 |
| --- | --- | --- | --- | --- |
| harbor | 四号泊位（黄昏港区、堆场、仓库、码头） | harbor | `src/map_harbor_ext.js`（追加层；主体在 game.js） | `packages/data/maps/harbor.authored.json` |
| depot | 冷链仓库（室内 CQB） | depot | `src/map_depot.js` | `packages/data/maps/depot.authored.json` |
| ship | 外锚地（暴雨夜货轮甲板） | ship | `src/map_ship.js` | `packages/data/maps/ship.authored.json` |
| core | 核心舱（室内反应堆） | core | `src/map_core.js` | `packages/data/maps/core.authored.json` |

## 开发提速（2026-11-13 起，对齐新 AGENTS.md）

- **GPU**：`shoot.mjs` / `verify.mjs` 已改用 `tools/pwargs.mjs`，macOS 默认 Metal；
  6 机位 medium 从 2-4 分钟降到 40-90 秒。逻辑校验用 `novisual=1`。
- **浏览器并发**：两个工具会自动抢 `tools/mapwork/.gpu.lock`，同一时间只有 1 个
  Chrome；排队等待属正常。不要再手动并发跑多个 Playwright。
- **时间盒**：每轮 15-20 分钟（分析 3 分 / 改 6 分 / 构建截图 5 分 / 校验记录 3 分），
  一轮只做一个主题，避免陷入无限打磨。
- **状态驱动**：截图工具已用 `G.game.pause()` + `G.render.frame()` 固定画面，
  不要用 sleep 等动画。
- **预算**：用户明确允许先宽松（build.cjs 临时 6MB，当前约 3.55MB）；优先做内容，后续再统一优化。

## 每轮固定流程

1. **分析**：读自己的地图源码 + 上一轮截图；找 1~2 个明确问题（空旷、重复、
   缺设施、光照平、材质糊、动线差、遮挡不对、性能热点）。
2. **改进**：只改自己负责的地图源文件（必要时同步自己的 authored.json），
   一次解决一个主题，保持可回滚。
3. **构建**：
   ```bash
   mkdir -p tools/mapwork/<id>
   node tools/build.cjs tools/mapwork/<id>/preview.html v39
   ```
4. **截图**（先低画质快速看构图，再 medium 出证据图）：
   ```bash
   node tools/mapwork/shoot.mjs --map <id> --target tools/mapwork/<id>/preview.html \
     --out tools/mapwork/shots/<id> --tag r<N> --quality low --views tools/mapwork/views/<id>.json
   ```
5. **校验**：
   ```bash
   node tools/mapwork/verify.mjs --map <id> --target tools/mapwork/<id>/preview.html
   ```
6. **记录**：在 `MAP_REVIEW/<id>/ROUNDS.md` 追加一轮：目标、改了什么、证据
   （截图路径、draw calls / triangles、boxes/cover 数）、遗留问题。

## 硬性约束

- **文件所有权**：只改自己的地图源文件 + 自己的 authored.json + 自己的目录；
  绝不改 `src/game.js`、`src/mapkit.js`、其他 `src/map_*.js`、`src/ext*.js`、
  `tools/build.cjs`、`game.html`、`versions/`、`server/`、`packages/data/maps/*.map.json`、
  `packages/data/maps/index.json`、`src/data_maps.js`。
- **不要**运行 `tools/export_maps_data.mjs` / `server/export_maps.mjs`（由 lead 在集成点统一执行）。
- **构建目标**只能写 `tools/mapwork/<id>/preview.html`，不能覆盖 `game.html`。
- 地图源文件必须始终是合法 JS（`node --check src/map_<id>.js`）。
- 若构建因别人的文件暂时报错：等 15 秒重试，不要替别人改。
- 碰撞盒只能通过地图 API 追加（`K.box` / `K.prop`），不要手写不可见的假碰撞。
- 所有新增几何必须落在 authored bounds 内；扩大地图时同步更新 bounds、zones、
  出生点/拾取物/中继，并让 `verify.mjs` 通过。
- 性能红线：单图 draw calls 不超过港区标杆同视角量级（港区约 790 calls /
  3.7M tris，但那是户外大场景）；室内图单视角建议 ≤ 700 calls。新增细节优先
  使用合并/复用材质/低多边形。

## 质量标杆（港区做到了什么）

- 层次：远/中/近景都有内容，天际线、吊机、堆场、仓库、码头分区明确。
- 设施：龙门吊、围栏、灯塔、集装箱堆、叉车、托盘、油桶、管线、标牌、警示漆。
- 材质：锈迹、油污、水膜、磨损、贴花、程序化细节纹理。
- 光照：黄昏主光 + 塔灯 + 室内暖光 + 发射材质，明暗层次清楚。
- 动线：掩体密度、视线遮挡、上下层次、可读的通道与目标点。

其它地图的目标：**在各自场景语境下达到同样的密度与可信度**，而不是堆无意义方块。

## 复杂度基准（2026-11-13 live 数据）

| 地图 | boxes | 面积 | 密度 | 目标 |
| --- | --- | --- | --- | --- |
| harbor | 781 | 4800m² | 0.163/m² | ≥900 boxes（标杆） |
| depot | 339 | 3344m² | 0.101/m² | ≥650 boxes / ≥4500m² |
| ship | 195 | 2100m² | 0.093/m² | ≥500 boxes / ≥3000m² |
| core | 279 | 2240m² | 0.125/m² | ≥650 boxes / ≥4200m² |

扩建时玩法点（出生/中继/拾取/撤离）保持在引擎 nav 区 x -39.5..29.5 / z -31.5..29.5；
x>29.5 做玩家探索/视觉区。