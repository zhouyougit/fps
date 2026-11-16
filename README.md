# 几猫 · SALTLINE

单文件 3D FPS，在原型《几猫国产3A大作 V1》上持续迭代 53 轮（V41 性能 / V42 架构 / V43 角色 / V44 平衡 / V45 精简 / V46 内存 / V47 打磨 / V48 稳定 / V49 视距 / V50 设置 / V51 可读 / V52 收口 / V53 改进）。
three.js 与全部资产程序化内联，双击即玩；联机模式通过 60Hz 权威服务器中转，协议 2.0 支持二进制增量快照与客户端预测。

## 立即游玩

- **最新版**：[几猫_V53.html](versions/几猫_V53.html)（改进）
- 收口版：[几猫_V52.html](versions/几猫_V52.html) · 可读版：[几猫_V51.html](versions/几猫_V51.html) · 设置版：[几猫_V50.html](versions/几猫_V50.html) · 视距版：[几猫_V49.html](versions/几猫_V49.html) · 稳定版：[几猫_V48.html](versions/几猫_V48.html) · 打磨版：[几猫_V47.html](versions/几猫_V47.html) · 内存版：[几猫_V46.html](versions/几猫_V46.html) · 精简版：[几猫_V45.html](versions/几猫_V45.html) · 平衡版：[几猫_V44.html](versions/几猫_V44.html) · 角色版：[几猫_V43.html](versions/几猫_V43.html) · 架构版：[几猫_V42.html](versions/几猫_V42.html) · 性能版：[几猫_V41.html](versions/几猫_V41.html) · 地图版：[几猫_V40.html](versions/几猫_V40.html)
- 历史：[几猫_V39.html](versions/几猫_V39.html) · [几猫_V38.html](versions/几猫_V38.html) · [几猫_V37.html](versions/几猫_V37.html) · [几猫_V36.html](versions/几猫_V36.html) · [几猫_V35.html](versions/几猫_V35.html) · [几猫_V34.html](versions/几猫_V34.html) · [几猫_V33.html](versions/几猫_V33.html) · [几猫_V32.html](versions/几猫_V32.html)
- 开发构建：[game.html](game.html)

Chrome / Edge，建议 1280×720 以上；支持鼠标键盘、手柄与触屏。

> 开发/协作前先读 [AGENTS.md](AGENTS.md)（构建、测试、性能、agent 边界与硬约束）；测试细节见 [TESTING.md](TESTING.md)；**调平衡/画质先看 [CONFIG.md](CONFIG.md)**；模块边界见 [ARCHITECTURE.md](ARCHITECTURE.md)。

## 最终内容

### 战役

八关、三幕、双结局：

1. **第一幕 · 断电**：四号泊位 → 二号仓库
2. **第二幕 · 反扑**：码头封锁（港区主控·蜃）→ 冷链仓库 → 外锚地货轮
3. **第三幕 · 溯源**：深水区 → 归途 → 归零（核心舱 · 蜃·残响）

- 每关独立简报、三项挑战、波次/环境/难度；
- 目标图：切断中继 → 击杀配额 → 坚守 → 撤离 / BOSS，阶段在 HUD 与电台推进；
- 检查点持久化：位置/血量/护甲/弹药/中继进度写入统一存档，可跨刷新继续；
- 通关二选一：**沉船·沉默** / **带核心回港·公开**，写入存档；
- 剧情档案可回看八幕、评级与封存结局。

### 地图

| 地图 | 场景 | 用途 |
| --- | --- | --- |
| 四号泊位 | 黄昏/破晓港区、集装箱堆场、龙门吊、维修角、码头临水带、月台雨棚 | 战役 01/03/06/07、联机 |
| 二号仓库 | 暴雨仓库内景（港区仓库区，含夹层/箱顶通道） | 战役 02 |
| 冷链仓库 | 76×51m：东装卸月台、西冷库/机房、北卡车场、南深冷库、跨厅马道 | 战役 04、联机 |
| 外锚地 | 70×43m：双 7 号货舱、上层建筑/机舱、首楼锚设备、尾部甲板室 | 战役 05、联机 |
| 核心舱 | 76×56m：反应堆主厅、四翼、二层环廊、外环汽轮机厅/冷却塔/热交换院/蓄电池库 | 战役 08、联机 |

地图碰撞、出生点、拾取物、中继、掩体、区域全部来自 `packages/data/maps/<id>.map.json`，导出器构建期校验。

### 性能（V41）

四张地图的同步帧时间（1600×900@2x / medium / Metal）：

| 地图 | V40 | V41/V42 | 降幅 |
|---|---:|---:|---:|
| 四号泊位 | 15.5 ms | 12.1 ms | 22.2% |
| 冷链仓库 | 111.4 ms | 13.5 ms | 87.8% |
| 外锚地 | 24.6 ms | 9.8 ms | 60.4% |
| 核心舱 | 45.1 ms | 9.9 ms | 78.1% |

根因是前向渲染的逐像素点光源数量（冷库 55 盏）。V41 改为**固定 8 盏地图灯池**
（+2 闪光 +1 补光），灯数恒定、换灯淡入淡出，不再触发着色器重编译；同时修复
动态分辨率被像素预算吃掉、自动画质只降不升、近级阴影跟随转向每帧重绘。
完整测量与 A/B 见 [bench/V41_RESULTS.md](bench/V41_RESULTS.md)。

### 收口（V52）

- 新增 [ARCHITECTURE.md](ARCHITECTURE.md)：构建流水线、模块边界、配置层、测试分层、不可破坏约定；
- 新增 `tests/unit/architecture.test.mjs`：校验 manifest 无空洞、config 顺序、武器表单一源、灯池/地图 LRU/命令背压/角色 LOD 关键常量；
- 清理联机角色死配置（`fabricDark`），并移除旧单文件残留；
- 单元测试 73/73。

### 收口（V52）

- 新增 [ARCHITECTURE.md](ARCHITECTURE.md)：构建流水线、模块边界、配置层、测试分层、不可破坏约定；
- 新增 `tests/unit/architecture.test.mjs`：manifest 无空洞、config 顺序、武器表单一源、灯池/地图 LRU/命令背压/角色 LOD 关键常量；
- 清理联机角色死配置（fabricDark），单元测试 73/73。

### 可读（V51）

- hound / siege / emp 增加接地阴影（gull 不加），暗图与货舱地面更容易判断敌人脚部位置；
- 新增 `test_v51_enemy_shadow` 5/5；
- 接地阴影复用共享几何/材质，每个地面敌人只多 1 个 draw call。

### 设置（V50）

- 设置页补上“自动”画质按钮，支持手动档位切回自动；自动档会重新按设备探测并持久化；
- 新增 `test_v50_quality_auto` 5/5。

### 视距（V49）

- 联机远端距离 LOD：>55m 切 3 mesh 轮廓替身；
- 8 人远距 draw calls **955 → 798**（近距仍为全身 33 mesh）；
- 新增 `SXSave.bootSource()`，修复迁移来源被 boot 后二次 load 覆盖的测试观测问题；
- 验收：LOD 4/4、角色 12/12、存档迁移全绿。

### 稳定（V48）

- 定位联机 e2e 失败根因：负载下客户端 60Hz 输入快于服务端 tick 消费，预测队列堆到 120 后触发服务端 `queue_full`；
- 客户端自适应发令：预测队列 ≥90 时暂停新命令，等 ACK 排空（`net.cmdBackoff` 可观测）；
- `test_v39_mp_e2e2` 5/9 → **9/9**：A/B 互见远端、自己不成远端、二进制协议、传送、无 pageerror；
- 产物：0.48.0 / V48 · 稳定。

### 打磨（V47）

- 新增 [src/config/avatar.js](src/config/avatar.js)：队服色、装具/镜片材质、头部比例、站立/蹲伏髋高、落地阴影参数集中管理；
- 远端士兵增加**程序化落地接触阴影**（径向渐变贴图），暗图/水面甲板更容易判断脚部位置；
- 8 人同屏 1280×720：836 calls / 9.85ms（V46 820 / 9.51ms），仍低于旧方盒 + 性能预算；
- 修复角色截图测试被标题菜单/未进入 playing 污染的问题，验收 12/12。

### 内存（V46）

- `MapKit` 增加切图 LRU：非 harbor 已构建地图最多 2 张；切走时释放地图自有几何/标签贴图，共享 `G.mats` 材质不释放；
- 回访地图按需重建；陈旧灯光记录不再被 `ext_lights` 索引；
- 8 次来回切图：场景存活几何体稳定在 **756–932**，缓存始终 ≤2 张非 harbor 地图，返回 depot 仍为 727 碰撞盒；
- 回归：`node tools/test_v46_map_release.mjs` 7/7、map 域 144/144、视觉 13/13、V41 性能 21/21。

### 精简（V45）

- 联机士兵材质从 5 种合为 4 种（布料/战术装具/队标/镜片），网格 43 → **32 mesh/人**；
- 8 人同屏 1280×720：**820 calls / 9.51ms**（V43 为 996 / 9.98ms，V36 方盒 772 / 8.87ms）；
- 修复军械库回归：新增 `__SX.armorySelect`（只改选择、不解锁），锁定价格配件不再被调试接口误判为已拥有；
- `node tools/test_v37_gameplay.mjs` 恢复 24/24；`test_v43_avatar` 11/11。

### 平衡（V44）

- 自杀无人机（自爆无人机）自爆伤害从 **62 → 44**（玩家中心承伤 31 → 22；近身实测 100→84.3）。
- 参数集中在 [src/config/balance.js](src/config/balance.js) 的 `enemies.suicideDrone`，可继续调 `explodeDamage/explodeRadius`。
- 回归：`node tools/test_v44_drone.mjs`（5/5）。

### 联机角色（V43）

对战模式的远端士兵从“方盒人”换成程序化战术士兵：

- 头盔 + 布罩 + 护目镜 + 面罩 + 降噪耳机 + 麦克风；防弹衣、肩甲、弹匣袋、医疗包、电台/天线、水袋、腰带、腿挂枪套；
- 战斗靴（鞋底/鞋头/鞋带）、护膝/护肘、战术手套与手指；带枪管/护木/枪托/握把/弹匣/瞄具的步枪与持枪姿势；
- 两队低饱和队服 + 臂章/胸章/头盔条识别；程序化迷彩 + 法线细节；
- 行走摆腿/持枪/蹲伏屈膝/死亡倒地/换弹动画；几何按“关节 × 材质”合批，浏览器约 43 mesh/人、5 种材质；
- 8 人同屏 A/B（1280×720）：V43 9.98ms / 996 calls，V36 方盒 9.01ms / 772 calls。

截图与验收：[versions/screens/v43_avatar](versions/screens/v43_avatar)；测试 `node tools/test_v43_avatar.mjs`。

### 架构（V42）

- `src/game.js`（72,918 行）拆成 `src/game/` 下 6 个片段，由 manifest 顺序拼接；
- 画质/平衡参数集中到 `src/config/quality.js`、`src/config/balance.js`；
- 武器数值只保留 `packages/data/weapons/*.json`，构建时内联，删除 `weapon_ext.js` 的重复表；
- 调参指南：[CONFIG.md](CONFIG.md)；片段说明：[src/game/README.md](src/game/README.md)；
- 新增 `tools/game_bundle.mjs`（还原完整包）、`tools/perf/`（测量）、`tools/test_v41_perf.mjs`（性能回归）。

### 地图深化（V40）

- 四张地图由独立子 Agent 连续迭代 **12-18 轮**：harbor 781 / depot 727 / ship 572 / core 705 个碰撞盒，可玩面积合计 16,551m²；
- 密度：harbor 0.163 / depot 0.161 / ship 0.192 / core 0.166 boxes/m²；
- 全部通过 `tools/mapwork/verify.mjs` 与 `tools/test_mapdata.mjs`（144/144）；medium 单视角 calls ≤ 761；
- 详细轮次记录见 `MAP_REVIEW/<map>/ROUNDS.md`，汇总见 `MAP_REVIEW/V40_SUMMARY.md`。

### 联机

- 协议 2.0：二进制输入 18B、快照每玩家 16B 量化增量、60Hz 模拟 / 30Hz 快照；
- 客户端预测 + 输入回放 + 平滑校正；服务器 1 秒历史 + RTT/2 延迟补偿；
- 逐武器权威结算：六把枪的伤害/射速/弹匣/换弹/弹丸/衰减/穿透；
- 团队死斗 4v4 / 大乱战 6v6 / 据点争夺 3 据点；warmup → live → roundEnd，加时/平局；
- 服务器机器人补位 4v4（BOTS=8）；BOT 标识，真人加入顶替；
- 账号 Profile + XP、/metrics 可观测、Origin/令牌/限速/消息上限；
- 大厅选图/选模式、Tab 计分板、回合结束投票换图、断线 3 次重连。

### 战斗

- 六把武器：几猫九式、破门锤、长眼、短哨（SMG）、重锚（LMG）、侧牙（手枪）；
- 距离衰减、薄墙穿透、每把枪独立后坐模式、分阶段换弹、逐弹丸霰弹；
- 军械库：枪口/弹匣/瞄具/枪托/握把，22 个配件分 0/120/260/400 信用点解锁；
- 滑铲、翻越、左右探身；护甲、医疗包、弹药箱、手雷、近战、检查点；
- 四类新机体：侦察蜂、攻城蛛、电磁犬、盾墙无人机；AI 效用选择 + 真掩体 + 小队角色；
- 两场 BOSS：港区主控·蜃、蜃·终形/残响；预警震地、扇形弹幕、过载冲刺、EMP、残响分身。

### 体验

- 两级阴影级联、增强 FXAA（TAA-lite 预留）、室内环境探针、第一人称/敌人受击表现；
- 节拍对齐动态音乐五状态（标题/探索/交火/BOSS/联机/结局），三层环境声、电台质感；
- 命中反馈分层（普通/爆头/击杀/护甲）、伤害数字、击杀播报、受击方向、低血量脉冲；
- 战术扫描 Q、手雷弹道预览、连杀播报；
- 中英双语（337 键）、色盲主题、字幕大小/背景、HUD 缩放/安全区、减少动态；
- 手柄 + 辅助瞄准 + 按键重绑；F3 性能、F6 BOSS、F7 掩体、F8 弹着、F9 伤害数字。

## 操作

| 操作 | 键位 |
| --- | --- |
| 移动 / 冲刺 / 蹲伏 | WASD / Shift / C |
| 开火 / 瞄准 | 鼠标左键 / 右键 |
| 换弹 | R |
| 切换武器 | 1–6 / 滚轮 |
| 探身 | Z / X |
| 手雷 | 按住 G 预览，松开投掷 |
| 战术扫描 | Q |
| 近战 | V / F |
| 滑铲 | 冲刺 + C |
| 翻越 | 跳跃（贴沿） |
| 切断中继 / 交互 | 按住 E |
| 跳跃 | Space |
| 性能面板 | F3 |
| 暂停 | Esc / P |

## 进度与挑战

- 每关 3 项挑战：限时 / 爆头 / 无死亡；
- 信用点：击杀/爆头/精英/BOSS/任务/训练；配件解锁、12 个成就、挑战 3/6/9/12/15/18 档奖励；
- 动态评级 S/A/B/C：用时/击杀/生存/目标四维 + 难度系数；
- 最佳用时/评级/挑战/成就/检查点保存在统一存档 `saltline.save`（v2，自动迁移旧六键）；
- 难度四档：新兵 / 标准 / 老兵 / 噩梦；设置保存在 `saltline.access.v1`。

## 工程结构

    src/
      template.head.html   HTML/CSS 外壳
      game.js              引擎包（three.js + 原始游戏代码）
      core_loop.js         60Hz 固定步主循环 / __SX_LOOP.step / 状态哈希
      core_save.js         统一存档 v2（迁移/备份/校验/导入导出）
      core_clock.js        模拟调度器 + 真实时钟
      core_systems.js      系统注册表（依赖排序/错误隔离）
      core_i18n.js         中英文本地化底座
      core_errors.js       200 条错误环形缓冲 / 守护 / 崩溃报告
      core_bridge.js       旧模块存档 → 统一档桥接
      data_maps.js         四图玩法数据（构建时生成）
      ext.js               护甲/拾取/手雷/近战/HUD
      ext_movement.js      V33 滑铲/翻越/探身
      ext_weapons2.js      V33 弹道/穿透/后坐/六把武器
      ext_feedback.js      V33 命中反馈分层
      ext_input.js         V33 手柄/辅助瞄准/重绑
      ext_audio2.js        V33 分轨/HRTF/遮挡
      ext_ai.js            V34 效用 AI / 真掩体 / 小队
      ext_enemies2.js      V34 四种新机体
      ext_boss2.js         V34 BOSS 招式/阶段
      ext_missions2.js     V34 目标图/检查点/八关接线
      ext_progress.js      V34 经济/解锁/评级/成就
      ext_visual.js        V35 阴影/TAA/探针/角色表现
      ext_ui2.js           V35 双语/色盲/叙事
      ext_music2.js        V35 节拍音乐/环境声/电台
      ext_net2.js          V36 客户端协议/预测纯函数
      ext_lod.js           V39 静态装饰距离 LOD
      weapon_ext.js        武器构建与六把武器数据
      campaign.js          八关数据、档案、简报、过场、结局
      boss.js              BOSS 遭遇、阶段、血条
      mapkit.js            运行期地图注册/切换/可达性
      map_depot.js         冷链仓库
      map_ship.js          货轮甲板
      map_core.js          核心舱
      map_harbor_ext.js    港区追加层（MapKit.extend）
      mp.js                V36 联机客户端
      audio_ext.js         动态音乐兼容外壳
      onboarding.js        新手引导/训练目标
      access.js            难度/辅助/可访问性
    packages/
      sim/                 共享确定性模拟（world/movement/weapons/damage/rng/command）
      net/protocol.js      二进制输入/快照协议（客户端/服务器共用）
      data/maps/           四张 .map.json + authored JSON
      data/weapons/        六把武器数据表
    server/
      server.cjs           60Hz 权威服务器（TDM/大乱战/据点/机器人/指标）
      test_net2.cjs        V36 服务器 57 项
      test_round.cjs       V32 服务器 31 项
      maps.json            旧格式碰撞（新代码优先 packages/data/maps）
      fps-mp.service       systemd --user 单元
    tools/
      build.cjs            拼接构建（按版本裁剪 features）
      export_maps_data.mjs 地图数据导出与校验
      test_suite.mjs       85 项单机验收
      test_v32_ground.mjs  固定步/确定性 10 项
      test_save_migration.mjs 存档迁移 7 项
      test_mapdata.mjs     地图数据 144 项
      test_v33_*.mjs       V33 移动/武器/反馈/输入音频
      test_v34_*.mjs       V34 AI/BOSS/八关/成长
      test_v35_*.mjs       V35 画面/UI/音乐
      test_v36_net.mjs     V36 协议/预测/双客户端
      test_mp_*.mjs        联机移动/战斗/TDM/四图/投票/核心舱
    tests/unit/            sim + core Node 单测
    tests/bench/           物理微基准
    bench/baseline.json    物理基准
    versions/              各轮产物与截图

## 构建

    npm run build          # game.html（V53 开发构建）
    npm run build:release  # versions/几猫_V53.html（显式 profile v53）
    node tools/build.cjs "versions/几猫_V53.html" v53   # 必须显式传 target + profile

历史快照保护：目标在 `versions/` 下且已存在时，构建会拒绝覆盖并以非 0 退出；确需重建请显式追加 `--force`。V32–V52 的快照保持只读。
profile 白名单：v32 / v33 / v34 / v35 / v36 / v37 / v38 / v39 / v40 / v41 / v42 / v43 / v44 / v45 / v46 / v47 / v48 / v49 / v50 / v51 / v52 / v53 / dev。无参数运行会打印用法并 exit 1，不会覆盖 game.html。
构建体积预算：V40–V53 临时放宽到 6MB（当前约 3.6MB，超出即失败）；后续优化目标回到 3.5MB。每次构建都会打印 head/game.js/sim/net/core/ext/features 明细，并把 `commit` 与 three.js 版本写入 `window.__BUILD__`。

## 测试

    npm run serve:test                              # 另开终端：3311 静态服务器（test:full 的 85 项需要）
    npm run test:lint                               # 静态检查（测试参数/睡眠/本机路径/收尾）
    npm run test:fast                               # ~25s：lint + unit + 状态驱动冒烟（Metal）
    npm run test:full                               # 发布前：85 项 + V53 专项 + 版本复现 + e2e + server
    npm run test:domain ui                          # 只跑某一域
    npm run test:v53                                # V53 专项：暂停时钟/切图海面/LOD/存档镜像

> 默认 macOS Metal GPU；测试规则、分层与 agent 约定见 [TESTING.md](TESTING.md)。

    node --test tests/unit/*.test.mjs               # sim + core 单测
    node tools/sim_parity.mjs                       # 客户端/服务器物理一致性
    node tests/bench/physics_bench.mjs              # 物理微基准
    node server/test_round.cjs                      # 服务器 31 项
    node server/test_net2.cjs                       # 服务器 57 项（协议/模式/机器人）
    node tools/serve.mjs                            # 静态服务器 http://127.0.0.1:3311
    CHROME_EXE="..." node tools/test_suite.mjs      # 85 项单机验收（默认连 3311）
    CHROME_EXE="..." node tools/test_current.mjs    # 当前 game.html 快速回归
    CHROME_EXE="..." node tools/test_v36_smoke.mjs  # V36 产物冒烟
    CHROME_EXE="..." node tools/test_v32_ground.mjs # 固定步/确定性 10 项
    CHROME_EXE="..." node tools/test_save_migration.mjs
    CHROME_EXE="..." node tools/test_mapdata.mjs    # 地图数据 144 项
    node tools/mapwork/rounds.mjs                   # 各图轮次
    node tools/mapwork/complexity.mjs               # 各图 box/面积/密度
    node tools/mapwork/integrate.mjs                # 构建→导出→重建→测试
    CHROME_EXE="..." node tools/test_v33_weapons.mjs # 21 项
    CHROME_EXE="..." node tools/test_v33_movement.mjs # 20 项
    CHROME_EXE="..." node tools/test_v33_feedback.mjs # 16 项
    CHROME_EXE="..." node tools/test_v33_input_audio.mjs # 24 项
    CHROME_EXE="..." node tools/test_v34_ai.mjs     # 12 项
    CHROME_EXE="..." node tools/test_v34_boss.mjs   # 18 项
    CHROME_EXE="..." node tools/test_v34_missions.mjs
    CHROME_EXE="..." node tools/test_v35_audio.mjs  # 16 项
    CHROME_EXE="..." node tools/test_v36_net.mjs    # 协议/预测 + 双客户端
    node tools/test_v37_dead_complete.mjs            # 死亡/结算状态机 5 项
    node tools/test_v37_gameplay.mjs                 # V37 玩法修复 15 项
    node tools/test_v38_audio_perf.mjs               # V38 音频性能 7 项
    node tools/test_v38_mp_perf.mjs                  # V38 联机性能 20 项
    node tools/test_v38_ui_polish.mjs                # V38 界面/本地化 14 项
    node tools/test_v38_armory_sim.mjs               # V38 军械/模拟 17 项
    node tools/check_versions.mjs --all              # V32–V53 产物复现（154 项）
    node tools/test_v39_visual.mjs                   # V39 TAA/探针/阴影 13 项
    node tools/test_v39_i18n.mjs                     # V39 军械/联机本地化 18 项
    node tools/test_v39_mp_e2e2.mjs                  # V39 双浏览器联机 e2e 9 项

无头测试使用 Playwright Chromium + SwiftShader，`?dt=0.1` 加速；固定步可用 `window.__SX_LOOP.step(n)` 直接推进。

## 联机部署

NUC（Ubuntu 24.04，Node 24）：

    rsync -az --exclude node_modules server/ nuc:~/fps-net/
    rsync -az --exclude node_modules packages/ nuc:~/fps-net/packages/
    ssh nuc 'systemctl --user daemon-reload && systemctl --user restart fps-mp'
    curl http://172.16.17.189:9100/healthz
    curl http://172.16.17.189:9100/metrics

默认端口 9100，建议环境变量：TICK_HZ=60、BOTS=8、ORIGIN_WHITELIST、LOG_JSON=1、PROFILE_TOKEN（可选）。
测试传送/强制回合需要 MP_DEV_TOKEN；发布环境默认关闭。`server/README.md` 有协议、模式、部署与测试说明。

## 已知限制

- 引擎 nav 网格仍是港区固定范围（x -40..31 / z -32..30，东侧 x>29.5 被 quay 边界挡住）；扩建区主要作为玩家探索/视觉区，玩法点保持在 nav 可达区。

- 单文件 3.62MB（V40–V53 临时预算 6MB），首次编译着色器在低端设备仍可能卡顿；后续需材质合并/贴图图集/LOD 回到 3.5MB；
- 引擎/玩法已按 V42 拆到 `src/game/` 6 个片段（three.js 仍是 vendor 压缩包，未按类拆分）；
- 部分模型为程序化简化体块；新机体复用飞鸦/猎犬骨架；BOSS 骨架有限；
- TAA-lite 已在 V39 真正启用（medium+），低画质仍走 FXAA；远级阴影用逐光源 shadowRadius 退化为 pcf-lite；
- 音乐为程序化 loop，无真实人声 VO；HRTF 为全局开关；
- 联机二进制增量按“上次发送快照”做 baseline，未做逐包 ack 精确 baseline；
- 机器人寻路为射线采样避障、非导航网格；无 PVS 反透视、击杀回放、WebTransport；
- 浏览器双客户端 e2e 已在 V39 用两个独立浏览器进程跑通（9/9）；服务器 87 项、V39 全量单机回归 85/85。

## 版本

V15–V39 的逐轮说明见 [CHANGELOG.md](CHANGELOG.md)，截图见 `versions/screens/`。
