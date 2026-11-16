# CONFIG.md · 几猫 · SALTLINE 调参指南（V42/V43）

V42 把“代码”和“配置”分开：**改平衡/画质只动下面的文件，不需要进 2MB 的
引擎/玩法片段里找数字。**

改完统一重建：

    node tools/build.cjs game.html v43
    node tools/build.cjs "versions/几猫_V43.html" v43

跑验证：

    npm run test:fast
    node tools/test_v41_perf.mjs       # 性能回归（Metal）
    node tools/test_v39_visual.mjs     # 画面层（需要 SX_TARGET=game.html）

---

## 1. 画质档位 · `src/config/quality.js`

`SX_QUALITY_PRESETS` 同时被 `src/game/10_render.js` 的 `Pr` 和
`src/ext_visual.js` 的 `QP` 使用，改一处即全生效。

| 字段 | 含义 | 代价 |
|---|---|---|
| `scale` | 质量档位的基础渲染比例 | 线性影响像素数 |
| `msaa` | MSAA 采样数（0/2/4） | 显存带宽；high 默认 2，有 TAA |
| `shadow` | 太阳阴影贴图尺寸 | 阴影 pass 分辨率 |
| `tex` | 环境探针 cube 尺寸 | 探针捕获成本 |
| `volSteps` | 体积光步数 | 片元成本；0 = 关闭 |
| `ao` | AO | 中高频片元成本 |
| `planar` | 平面反射强度（0–1） | 反射 pass |
| `bloom` | 泛光 | 后处理带宽 |
| `motionBlur` | 动态模糊 | 后处理 |
| `rain` | 雨量/雨丝密度 | 透明 overdraw |

像素预算在 `SX_QUALITY_PIXEL_BUDGET`（low 100 万 / medium 150 万 /
high 230 万 / ultra 370 万），渲染器会先按档位 scale 截断预算，再乘动态
分辨率（V41 修复：以前动态 scale 被预算吃掉，降档不降像素）。

## 2. 玩法平衡 · `src/config/balance.js`

### player
| 字段 | 默认 | 说明 |
|---|---:|---|
| `eye` | 1.68 | 站立眼高 |
| `crouchEye` | 1.05 | 蹲伏眼高 |
| `radius` | 0.32 | 胶囊半径 |
| `height` | 1.8 | 站立碰撞高度 |
| `fov` | 74 | 世界相机 FOV |
| `viewFov` | 54 | 第一人称模型相机 FOV |

### mission
| 字段 | 默认 | 说明 |
|---|---:|---|
| `introSeconds` | 3.5 | 任务开场演出 |
| `interactRange` | 2.2 | 中继交互距离 |
| `cutSeconds` | 2.4 | 切断中继耗时 |
| `waves` | 3 波 | 每波 `{gull, hound}` 数量 |
| `maxAlive` | 9 | 同时存活上限 |
| `spawnStagger` | 0.85 | 刷怪间隔 |
| `pursuitEvery` / `pursuitMinAlive` / `pursuitExtra` | 7 / 4 / 5 | 追击波触发节奏与追加数量 |

### enemies.suicideDrone（V44）
| 字段 | 默认 | 说明 |
|---|---:|---|
| `explodeDamage` | 44 | 自爆基础伤害；对玩家按 50% 结算（旧 62 → 现 22 中心承伤） |
| `explodeRadius` | 4.4 | 自爆半径，线性衰减 |
| `speed` | 10.5 | 俯冲速度 |
| `triggerRadius` | 1.9 | 眼位距离触发 |
| `triggerDistance` | 1.5 | 身体距离触发 |

回归：`node tools/test_v44_drone.mjs`（满血近身约 100→84.3，旧值约 100→77.8）。

### enemies.variants
四种特殊机体：`scout`（侦察蜂）、`siege`（攻城蛛）、`emp`（电磁犬）、
`warden`（盾墙无人机）。常用字段：`hp`、`speed`/`runSpeed`、`credits`、
`telegraph`、`burstCount`、`shield`。改 `hp` 会直接改变关卡难度。

### movement
`slide` / `vault` / `lean` 三段，分别控制滑铲速度/摩擦/时长、翻越高度/
耗时、探身距离/角度。字段旁有中文注释。

### lights（V41 性能核心）
| 字段 | 默认 | 说明 |
|---|---:|---|
| `pool` | 8 | 常驻地图点光源数量（固定，不随地图涨） |
| `flash` | 2 | 枪口/爆炸闪光池 |
| `fill` | 1 | 第一人称补光 |
| `selectEvery` | 0.1 | 选灯间隔（秒） |
| `fadeOut` / `fadeIn` | 0.12 / 0.18 | 换灯淡出/淡入 |

总预算 = 8 + 2 + 1 = 11 盏。**不要为了“更亮”把 pool 调大**：实测 16 盏
以后帧时间超线性上升（计划书 2.5 节）。要补亮请改地图灯记录的
`distance/intensity` 或环境探针。

### render
`pixelBudget` 与 `autoQuality`（降档阈值 `dropAboveMs`、回升阈值
`riseBelowMs`、回升采样数、冷却秒数、scale 上下限）。自动画质只在
设置里选“自动”且没有 `?q=` / `?shot` 时生效。

## 3. 武器 · `packages/data/weapons/*.json`

六把枪（pac9/breaker12/dmr/smg/lmg/sidearm）的**唯一数值源**。
构建时 `tools/build.cjs` 把 JSON 内联成 `__SX_WEAPON_DATA_SOURCE`，
`src/weapon_ext.js` 不再保存重复表。

常用字段：`damage`、`headMul`、`limbMul`、`range`、`falloff`、
`fire.rpm`、`fire.mode`、`fire.pellets`、`mag`、`reserve`、
`reload.tactical.time`、`spread.*`、`recoilPattern.*`。

改完跑：

    node --test tests/unit/config.test.mjs
    node --test tests/unit/sim.test.mjs

## 3.5 联机角色 · `src/mp_avatar.js`

V43 的远端士兵是程序化模型，参数集中在文件顶部/构建函数：

| 位置 | 可调项 |
|---|---|
| `teamColors(team)` | 两队队服底色（蓝灰 / 沙棕）与臂章色 |
| `fabric/armor/gear/accent/glass` 材质 | 粗糙度、金属度、颜色、法线强度 |
| `capsule/box` 调用 | 身高、肩宽、肢体粗细、装备尺寸 |
| `build()` 返回的 `mass` | 手臂/腿部关节位置（肩 x=0.25、髋 y=0.92、头 y=0.66） |
| `bench_mp_avatar.mjs` | 8 人同屏 draw call / 帧时间 A/B |

模型硬约束：
- 每个远端约 32 mesh / 4 材质（`mp-fabric`/`mp-kit`/`mp-accent`/`mp-glass`）；
- `grp.children` ≥ 8，保留 `armL/R`、`elbowL/R`、`kneeL/R`、`rifle`、`mag`、`magBase`、`muzzleLocal`，旧 V39 回退与联机调试依赖这些字段；
- 改姿势后跑 `node tools/perf/probe_avatar.mjs`，让双手重新贴合握把/护木；
- 验收：`node tools/test_v43_avatar.mjs`，截图在 `versions/screens/v43_avatar/`。

## 3.7 联机角色外观 · `src/config/avatar.js`

| 段 | 内容 |
|---|---|
| `team.0/1` | 队服底色 / 暗部 / 臂章色 |
| `materials` | `kit` 装具色、`glass` 镜片色/自发光、法线强度 |
| `proportions` | `headScale`、`standHip`、`crouchHip` |
| `blob` | 落地接触阴影尺寸/透明度 |
| `lod` | 远距 LOD 阈值（默认 55m）与检查间隔（0.25s） |

改完跑 `node tools/test_v43_avatar.mjs`；预算参考：33 mesh/人、836 calls/8 人。

## 3.6 切图资源 · `src/mapkit.js`

- `MAP_CACHE_LIMIT = 2`：非 harbor 已构建地图上限；`MapKit.cache()` 可查当前缓存，`release(id)` 可手动释放。
- 只释放 `geometry.userData.sxMapOwned` 的地图自有几何和 `material.userData.sxMapOwned` 的标签材质/贴图；共享 `G.mats` 不释放。
- 地图回访会重新 build；新增地图资源时请确保几何在 build 内新建，或显式标记为共享，避免释放后破坏其他地图。
- 验收：`node tools/test_v46_map_release.mjs`。

## 4. 地图

地图碰撞/点位是生成物，不要手改：

    client 导出 → server/export_maps.mjs → tools/export_maps_data.mjs
      → server/maps.json + packages/data/maps/*.map.json + src/data_maps.js

灯光不再写进地图碰撞数据：`K.light()` 只登记记录，由
`src/ext_lights.js` 统一调度。

## 5. 运行时临时调参

控制台可用（刷新即恢复）：

    SX_BALANCE.mission.waves[2].hound = 5
    SX_BALANCE.enemies.variants.siege.hp = 420
    SX_BALANCE.lights.pool            // 只读建议：改 pool 需要重建灯池
    SX_QUALITY_PRESETS.high.msaa = 0  // 下次 setQuality 生效
    __SX_LIGHTS.stats()               // 当前灯池/记录数/真实点光源数

## 6. 配置文件的边界

- 配置层必须在 game 片段之前执行（`tools/build.cjs` 已保证）。
- `balance.js` 里的对象会被运行时直接引用，**不要**在模块里改写共享字段
  （`ext_movement` 只额外挂 `C.step`）。
- 新增配置段时同步更新 `tests/unit/config.test.mjs`，避免键名漂移。
