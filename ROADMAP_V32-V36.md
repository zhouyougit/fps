# 几猫 · SALTLINE 迭代规划（V32 → V36）

> 基线版本：V31（`versions/几猫_V31.html`，2026-11-13）
> 审查范围：`src/`（引擎包 + 18 个扩展模块）、`server/`、`tools/`、`README.md`、`CHANGELOG.md`、各版本截图
> 文档目的：让接手的人**只看这份文档**就知道每个版本做什么、为什么做、怎么做、做到什么程度算完成。

---

## 0. 如何阅读这份文档

| 章节 | 内容 | 谁该读 |
| --- | --- | --- |
| 第 1 章 | 现状审查：优点、问题清单（带文件行号）、与 3A 标准的差距 | 所有人 |
| 第 2 章 | 五个版本的总体路线、依赖关系、通用原则、目标工程结构 | 所有人 |
| 第 3–7 章 | V32–V36 每个版本的工作包（WP）：设计、数据结构、伪代码、改动文件、测试、验收标准 | 实现者 |
| 附录 A | 已确认缺陷清单与逐条修法 | 实现者（V32 第一周） |
| 附录 B | 数值表（武器、敌人、经济） | 策划 / 实现者 |
| 附录 C | 测试矩阵与性能预算 | QA / 实现者 |
| 附录 D | 风险登记 | 负责人 |
| 附录 E | 实施前需复核的事项（审查中未能验证的点） | 实现者 |

约定：

- 工作包编号 `WP<版本>-<序号>`，例如 `WP33-4`。每个工作包都有「完成定义（DoD）」。
- 行号以 V31 的 `src/` 为准（`src/game.js` 是美化后的压缩包，行号稳定）。拆包（WP32-2）之后行号失效，改以函数名定位。
- 伪代码用 JavaScript 风格书写，可直接作为实现骨架；标了 `// 调参` 的常量是起始值，需要试玩后调整。
- 工作量以「人周」估算，按 2 名程序 + 1 名策划 + 1 名美术/音频的小团队计；这是估算，不是承诺。

---

## 1. 现状审查

### 1.1 总评

V31 是一个**内容广度惊人、但地基很薄**的作品：一天多的时间里从单关原型堆到了六关战役、五张地图、两种联机模式。渲染底子（HDR 管线、PCSS 软阴影、体积雾、自动曝光、动态分辨率、GPU 程序化 PBR 贴图）在浏览器游戏里属于上乘。

但所有新内容都是以「字符串标记替换 + 对 `window.__G` 打猴子补丁」的方式叠在一个 7.3 万行的压缩包上的。继续这样加内容，每一轮的回归成本都会上升，而且以下几件 3A 射击游戏的基本功根本无法在现有结构上做出来：帧率无关的确定性模拟、带输入回放和延迟补偿的联机、会用掩体和配合的 AI、可扩展的关卡目标。

所以五个版本的顺序是：**先重建地基（V32），再做手感（V33）、对手与关卡（V34）、视听表现（V35），最后做联机与长线（V36）**。

### 1.2 值得保留的资产

| 资产 | 位置 | 说明 |
| --- | --- | --- |
| HDR 后处理链 | `game.js:36045–36600` | 半分辨率 AO、体积雾、6 级 bloom、自动曝光、ACES/AgX 混合调色、FXAA |
| PCSS 软阴影 | `game.js:35556` | Vogel 盘采样，带编译失败回退 |
| 动态分辨率与画质档 | `game.js:34649–34744, 36862–36906` | 五档画质 + 帧时间驱动的缩放 |
| GPU 程序化材质 | `game.js:39099, 39518` | 片元着色器生成 albedo/ORM/normal，三平面映射、全局湿润度 |
| 手感细节 | `game.js:63281–63320` | 土狼时间 0.12s、跳跃缓冲 0.13s、落地弹簧、9 弹簧枪模 |
| 事件总线 / 种子 RNG / 桩模块 | `game.js:34774, 34799, 34827` | 是后续解耦的现成抓手 |
| 调试参数 | `?q ?seed ?dt ?show ?bench ?shot ?cam …` | 自动化测试与截图的基础 |
| MapKit | `src/mapkit.js` | 运行期换图、按材质合并、碰撞盒往返恢复 |
| 可访问性 | `src/access.js` | HUD 缩放、字幕大小、高对比、减少动态 |
| 攻击令牌 | `game.js:70160+` | 同时开火敌人数上限 2–3，是小队协同的雏形 |

### 1.3 问题清单

「归属」列是修复所在的工作包。标 ★ 的是已用代码核实的缺陷，其余来自通读代码的结构性结论。

#### 工程（E）

| ID | 问题 | 证据 | 影响 | 归属 |
| --- | --- | --- | --- | --- |
| E1 | 真源码是一个美化过的压缩包，标识符全部被混淆（`Hg` `d3` `mM`），three.js r180 内联在前 3.4 万行 | `src/game.js` 72,942 行 | 任何引擎级改动都是考古 | WP32-2 |
| E2 | 构建是 `String.replace` 标记拼接，多处替换不校验；哨兵靠中文注释文本；`String.replace` 会解释被注入源码中的 `$` 序列 | `tools/build.cjs:21–40` | 静默构建出坏包 | WP32-3 |
| E3 | 扩展层靠猴子补丁：`P.damage` `P.reset` `G.enemies.spawn` `G.game.update` `G.hud.radio` `addShake` 都被重写，`mp.js` 再叠一层 | `ext.js:373–402, 886–899, 913–923`；`mp.js:375–380` | 补丁顺序即行为，无法单测 | WP32-7 |
| E4 | 约 12 处裸 `setTimeout` 驱动游戏状态（BOSS 开场 1200ms、检查点复活 2500ms、结算 400ms） | `boss.js`、`ext.js:698–704`、`campaign.js:908` | 暂停/加速/切状态时错乱 | WP32-7 |
| E5 | 模拟用可变步长（`dt = min(frame, 0.05)`），无固定步累加器 | `game.js:72744–72752` | 跳跃高度、后坐、弹簧随帧率变；联机无法做输入回放 | WP32-4 |
| E6 | 服务器物理是客户端的**手抄移植**，没有共享代码，也没有一致性测试 | `server/sim.js:5`、`server.cjs:65–79` | 预测误差是结构性的 | WP32-5 |
| E7 | 物理没有粗筛：射线、视线、地面高度、胶囊移动都线性扫全部 AABB（港区 566 个） | `game.js:39946, 40066` | AI 一多就掉帧；限制敌人数量上限 | WP32-5 |
| E8 | 不是 git 仓库；`tools/` 下约 477 个一次性补丁/诊断脚本；`versions/` 存了 31 份 2.4MB 的产物 | 目录结构 | 无法回滚、无法评审 | WP32-1 |
| E9 ★ | `src/dmr.js` 是死代码（构建不读它，内容是 `weapon_ext.js:140–257` 的旧副本）；`src/armory.js` 等正常 | `tools/build.cjs` | 误导维护者 | WP32-0 |
| E10 | 到处是 `try{}catch(e){}` 吞异常；主循环每个模块只报第一次错；`window.__errors` 无上限 | `game.js:72729–72741` 等 | 故障被隐藏 | WP32-11 |
| E11 | 存档散在 6 组 localStorage 键里，没有版本迁移、没有校验 | 见 1.5 | 改数据结构就丢档 | WP32-8 |
| E12 | 没有本地化：所有文案硬编码中文，引擎电台台词靠中文前缀匹配来改说话人 | `ext.js:913–923` | 无法出其他语言 | WP32-9 |

#### 玩法与关卡（G）

| ID | 问题 | 证据 | 归属 |
| --- | --- | --- | --- |
| G1 | 六关只有一种目标模板：切 N 个中继 → 坚守或打 BOSS → 走到撤离点 | `campaign.js:6–151` | WP34-6 |
| G2 | 两场 BOSS 是同一只放大 1.8 倍的猎犬，只改血量和名字；两种攻击 + 召唤无人机；震地无预警 | `game.js:69479–69533`、`boss.js` | WP34-5 |
| G3 | 没有成长经济：全部配件开局解锁，18 个挑战的唯一奖励是 3 种准星颜色 | `armory.js`、`access.js:12–13` | WP34-8 |
| G4 | 评级公式的时间阈值全局固定（270s/400s），不看关卡长度、击杀、受伤、难度 | `game.js:72376–72387` | WP34-8 |
| G5 | 难度只改受伤倍率和敌人血量，不改 AI、数量、奖励 | `access.js:6–11` | WP34-4 |
| G6 ★ | 散布公式有运算符优先级错误：`spreadScale` 和配件散布修正只乘在「蹲伏减免」一项上，长眼的 0.32 散布系数和所有散布类配件**实际无效** | `game.js:67097–67103` | WP32-0 |
| G7 | 换弹事件时间点硬编码成步枪的（0.47/1.345/2.19），不随武器 `reloadT` 变 | `game.js:66437+` | WP33-3 |
| G8 | 弹道极简：瞬时命中、无距离衰减、无穿透；霰弹 9 颗弹丸共用一条曳光 | `game.js:63745, 66902–66925` | WP33-2 |
| G9 | 移动只有走/跑/蹲/跳，没有滑铲、翻越、探身 | `game.js:63320+` | WP33-1 |
| G10 | 拾取物坐标是港区的，在所有地图上通用；BOSS 出生点候选也只有港区的 | `ext.js:463–478`、`boss.js:23` | WP32-6 |
| G11 | 炮台敌人已实现并有测试，但没有任何关卡放置；`core` 地图单机不用；冷库和货轮没有空中敌人 | `campaign.js` 波次表 | WP34-6 |
| G12 | 检查点只在内存里，只存当前武器弹药 | `ext.js:651–714` | WP34-7 |
| G13 | 叙事只有文字卡；双结局只改一段文字和一个存档标记 | `campaign.js:756–838` | WP35-9 |

#### AI（A）

| ID | 问题 | 证据 | 归属 |
| --- | --- | --- | --- |
| A1 | 只有两种真实体型（飞鸦、猎犬），其余五种是出生时的参数覆盖；炮台是「把腿缩到 0.01 的猎犬」 | `game.js:70499–70574` | WP34-3 |
| A2 | 行为是一个 `think` 函数里的模式切换（巡逻/调查/搜索/交战），没有行为树或效用评估 | `game.js:69083+` | WP34-1 |
| A3 | 所谓「掩体点」是按「对玩家有视线」打分的**射击位**，不评估是否能挡住来自玩家的子弹；没有侧翼、压制、撤退 | `game.js:69390` | WP34-2 |
| A4 | 寻路是 0.5m 均匀网格 A*，整图重建，每次寻路分配 Vector3；`randomPoint` 用的是未播种的 `Math.random` | `game.js:39909–40368` | WP34-1 |
| A5 | 对象池上限 10 飞鸦 + 12 猎犬；刚性单骨蒙皮、程序动画、脚本化死亡翻滚 | `game.js:70160+` | WP34-3 / WP35-5 |

#### 画面（R）

| ID | 问题 | 证据 | 归属 |
| --- | --- | --- | --- |
| R1 | 单张不分级的阴影图覆盖整张 80×60m 地图，非 ultra 档隔帧刷新 | `game.js:35505, 36938–36942` | WP35-1 |
| R2 | 抗锯齿只有 MSAA + FXAA，没有时域抗锯齿；半分辨率 AO 和体积雾没有时域累积 | `game.js:36410–36600` | WP35-2 |
| R3 | 间接光与反射很薄：一张天空 PMREM + 一个写死给 `interiorBoxes[0]` 的 128px 室内探针；无屏幕空间反射 | `game.js:35492, 37177` | WP35-3 |
| R4 | 新地图明显弱于港区：冷库和货轮偏暗、体块简单、甲板空旷；暗场景里第一人称枪模糊成黑块 | 截图 `v15_depot.png` `v18_ship.png` | WP35-6 / WP35-4 |
| R5 | 联机角色是 35 个方块/球拼的人形，与场景写实质感脱节；无开火/换弹动画 | `mp.js:475–529`；截图 `v30_remote.png` | WP35-5 |
| R6 | 没有 LOD 和遮挡剔除；约 20 个对象关掉了视锥剔除 | `game.js:35484` 等 | WP35-7 |
| R7 | 软阴影靠字符串替换 three r180 的着色器片段实现，升级 three 即可能失效 | `game.js:35556` | WP35-1 |
| R8 | 长眼的瞄准镜是 DOM 遮罩，不是渲染到纹理 | `ext.js:763` | WP35-4 |

#### 音频（S）

| ID | 问题 | 证据 | 归属 |
| --- | --- | --- | --- |
| S1 | 全部用 `equalpower` 声像，HRTF 分支存在但从未启用；没有逐声源遮挡 | `game.js:61538–62830` | WP33-6 |
| S2 | 约 57 个音效全部在主线程启动时合成（6ms 切片 + `setTimeout`） | `game.js:61603` | WP33-6 |
| S3 | 动态音乐只是按状态阶跃设置四条 loop 的增益，没有节拍对齐的过渡；BOSS 音乐只在阶段切换时触发并在 30 秒后过期，BOSS 登场到 66% 血之间没有 BOSS 音乐 | `audio_ext.js:41–90` | WP32-0 / WP35-8 |
| S4 | 只有主音量，没有音乐/音效/语音分轨；没有人声 | `README.md` 已知限制 | WP33-6 / WP35-9 |

#### 联机（N）

| ID | 问题 | 证据 | 归属 |
| --- | --- | --- | --- |
| N1 ★ | 部署单元里开着开发后门 `MP_DEV=1`：任何客户端可传送、满血复活、强制结束回合 | `server/fps-mp.service:13`、`server.cjs:784–798` | WP32-0 |
| N2 ★ | 回合计时器不会结束回合：`roundSeconds` 只用来算 `timeLeft`，到 0:00 后一直等到击杀上限 | `server.cjs:552, 635` | WP32-0 |
| N3 ★ | 客户端校正只有软插值（>0.8m 硬拉，>0.22m 每个快照拉 22%），没有输入回放；高延迟下冲刺会被持续往回拽 | `mp.js:423–432` | WP36-2 |
| N4 | 没有延迟补偿：服务器用当前位置做射线 | `server.cjs:592–642` | WP36-3 |
| N5 | 服务器上所有武器都按步枪结算（26 伤害、720rpm）；不校验弹药、换弹、射击方向 | `server.cjs:565, 595–606` | WP36-4 |
| N6 | 全量 JSON 快照，每人 18 个字段、每 tick 重发名字和 K/D；12 人房约 90KB/s 每客户端（估算） | `server.cjs:259–278, 346` | WP36-1 |
| N7 | 快照把所有敌人的精确位置/血量发给所有人，透视外挂零成本 | `server.cjs:330` | WP36-6 |
| N8 | 名字经 `innerHTML` 进入击杀播报、姓名板、计分板；服务器只过滤 `<>"'`，而客户端信任 `?mp=` 给的任意服务器 | `mp.js:285, 538, 698` | WP32-0 |
| N9 ★ | `maps.json` 里四张图都没有 `groundY/seaY/quayX`，室内图沿用港区的海面默认值 | `server/maps.json` | WP32-6 |
| N10 | 房间键含地图，投票换图后键不变，新玩家会进到另一个同名房间 | `server.cjs:662` | WP32-0 |
| N11 | 客户端上报的 `team` 被无条件采纳，可以堆队；离开后不重新平衡 | `server.cjs:675, 422–427` | WP32-0 / WP36-5 |
| N12 | 看不到也听不到其他玩家开火：没有远端曳光、枪口焰、枪声 | `mp.js` 无对应处理 | WP36-4 |
| N13 | 无重连、无挂机踢出、无鉴权、无 TLS、无 Origin 检查；默认地址硬编码为内网 IP | `mp.js:30, 222–228` | WP36-6 / WP36-8 |
| N14 | 联机测试默认打线上内网主机并依赖 `MP_DEV=1`，没有本地无头测试 | `tools/test_mp_*.mjs:3` | WP32-10 |

#### 体验与测试（U / Q）

| ID | 问题 | 证据 | 归属 |
| --- | --- | --- | --- |
| U1 | 全部界面是 DOM 字符串拼出来的，没有手柄导航；按键不可重绑 | `game.js:70790–71760` | WP33-7 / WP35-10 |
| U2 | 触屏缺近战按钮、军械库和扫描的触屏交互 | `ext.js:862–883` | WP35-10 |
| U3 | 军械库与档案面板 CSS 类名冲突（`.x-ar-*` 定义了两次） | `ext.js:146–167, 226–238` | WP32-0 |
| Q1 | 测试是一条 637 行的线性 Playwright 脚本，靠 `cutAll`、`launchFast`、99999 伤害等捷径；没有任何纯逻辑单元测试 | `tools/test_suite.mjs` | WP32-10 |
| Q2 | `?dt=0.1` 只是固定步长，不是确定性（循环仍由 rAF 驱动，测试里还有真实 `setTimeout` 等待） | `game.js:72749` | WP32-4 |
| Q3 | 没有性能预算回归、没有视觉回归、没有存档损坏测试 | — | WP32-10 |

### 1.4 与 3A 标准的差距

评分 1–5（5 = 同类商业大作水准）。「V36 目标」是本规划完成后应达到的水平。

| 维度 | 现状 | V36 目标 | 关键差距 |
| --- | --- | --- | --- |
| 移动与镜头（3C） | 2.5 | 4.5 | 滑铲/翻越/探身、帧率无关、手柄与辅助瞄准 |
| 枪械手感 | 2.5 | 4.5 | 后坐模式、弹道、分阶段换弹、命中反馈层次 |
| 敌人 AI | 1.5 | 4 | 掩体、侧翼、小队角色、节奏导演 |
| 关卡与任务 | 2 | 4 | 目标类型、脚本事件、每关独有机制 |
| BOSS | 1 | 4 | 独立模型、阶段机制、预警可读性 |
| 画面 | 3 | 4 | 级联阴影、时域抗锯齿、反射/探针、角色与动画 |
| 音频 | 2 | 4 | HRTF、遮挡、分层枪声、节拍对齐音乐、人声 |
| 界面与可访问性 | 3 | 4.5 | 设计系统、手柄导航、重绑、色盲、双语 |
| 成长与重玩 | 1 | 4 | 货币、解锁、挑战、变异条件、成就 |
| 联机 | 1.5 | 4 | 输入回放、延迟补偿、二进制增量快照、模式、反作弊 |
| 工程与质量 | 1.5 | 4.5 | 模块化、测试金字塔、CI、性能预算 |

### 1.5 现实约束（必须先讲清楚）

「按 3A 标准要求」在这里指**每个维度的品质门槛**（手感、可读性、稳定性、打磨度），不是指内容体量或制作预算。以下几点是本规划的硬前提：

1. **单文件形态保留，但不再是唯一形态。** V35 起采用双发行：`lite`（单文件、全程序化、双击即玩）与 `full`（单页 + 资产包：glTF 模型、KTX2 贴图、Opus 音频）。玩法代码完全相同，资产通过同一套接口加载，缺失时回退到程序化版本。
2. **手工资产需要美术和音频人力。** 规划里凡是需要手工资产的工作包都给出了资产规格（面数、贴图尺寸、骨骼、动画清单），并给出「没有美术时的程序化替代方案」。
3. **主题保持「机械敌人」。** 这回避了人形角色动画与面部的巨大成本，也是本作的辨识度所在。新敌人都是机械体。
4. **不做的事**：动作捕捉、摄影测量、开放世界、载具（留到 V36 之后）。

当前 localStorage 键（WP32-8 要迁移的对象）：

| 键 | 结构 |
| --- | --- |
| `saltline.campaign.v1` | `{unlocked, best:{[mid]:{time,kills,rating,acc}, train:{…}}, current, trainSel, challenges:{[mid]:{time,head,clean}}, ending, briefIdx}` |
| `saltline.armory.v1` | `{pac9|breaker12|dmr:{muzzle,mag,optic}}` |
| `saltline.access.v1` | `{difficulty,cross,shake,reduceMotion,hudScale,subSize,contrast}` |
| `saltline.settings.v1` | `{quality,sens,invertY,volume,fov}` |
| `saltline.guide.v1` | `"1"` |
| `saltline.mp.url/name/map/mode` | 字符串 |

---

## 2. 总体路线

### 2.1 五个版本

| 版本 | 代号 | 主题 | 核心交付 | 估算 |
| --- | --- | --- | --- | --- |
| **V32** | 地基 | 工程重构与确定性核心 | 拆包模块化、esbuild 构建、60Hz 固定步、客户端/服务器共享 sim、空间粗筛、地图数据管线、统一存档、测试金字塔与 CI、全部已知缺陷修复 | 6 人周 ×2 程序 |
| **V33** | 手感 | 3C、枪械与战斗反馈 | 滑铲/翻越/探身、后坐模式与弹道、数据驱动换弹、三把新武器、命中反馈分层、HRTF 与遮挡、手柄与辅助瞄准、按键重绑 | 6 周 |
| **V34** | 对手 | AI 2.0、遭遇与成长 | 行为树 + 效用 AI、真掩体系统、小队角色、节奏导演、四种新机体、两场重做的 BOSS、任务目标图、六关重做 + 两关新增、货币与解锁、成就 | 8 周 |
| **V35** | 世界 | 视听表现与界面 | 级联阴影、时域抗锯齿、反射探针与 SSR、骨骼动画与角色模型、三张弱图的关卡美术重做、节拍对齐音乐、人声、过场序列器、界面重做、中英双语 | 10 周 |
| **V36** | 联机 | 网络 2.0 与长线运营 | 二进制增量快照、输入回放、延迟补偿、逐武器权威结算、比赛状态机、两个新模式、机器人、合作模式、账号与进度、反作弊、可观测性 | 10 周 |

### 2.2 依赖关系

```
V32 地基 ──┬─► V33 手感 ──┬─► V34 对手 ──┬─► V35 世界 ──► V36 联机
           │              │              │
固定步 ────┼──────────────┼──────────────┼────────────────► 输入回放 / 延迟补偿
共享 sim ──┼─► 翻越探测   ├─► AI 无头运行 ┼────────────────► 服务器机器人 / 合作模式
地图数据 ──┼──────────────┼─► 掩体/触发器 ┼─► 探针/遮挡数据 ► 模式点位
武器数据表 ┴─► 弹道/后坐 ─┴──────────────┴────────────────► 服务器逐武器结算
```

三条贯穿全程的硬约束，从 V32 起就要遵守，否则 V36 做不出来：

1. **模拟与表现分离。** `sim/` 下的代码不得引用 three.js、DOM、WebAudio；它必须能在 Node 里无头运行。AI（V34）也放在 `sim/` 下。
2. **模拟只在固定步里推进。** 任何影响玩法结果的状态（位置、血量、弹药、冷却、AI 决策）只在 `fixedUpdate(1/60)` 里改；表现层（特效、枪模弹簧、HUD、音频）在 `update(dt)` 里读取并插值。
3. **数值与内容在数据表里。** 武器、敌人、关卡目标、地图点位都是 JSON/JS 数据，客户端和服务器读同一份。

### 2.3 通用原则

- **每个版本结束时都可发布**：回归测试全绿、性能预算不退步、`lite` 单文件可双击运行。
- **功能开关**：未完成的系统用 `FLAGS.<name>` 包住，默认关；合入主干不等于对玩家开放。
- **先补测试再重构**：动某个系统之前，先给它现有行为写「特征测试」（把当前输出固化为基准），重构后对比。
- **数值改动必须过试玩**：伪代码里的常量是起点。每个 WP 的 DoD 里有「试玩项」的，需要至少 3 个人各玩 20 分钟并记录反馈。
- **性能预算是验收项**：见附录 C。超预算的合并请求不合入。

### 2.4 目标工程结构（V32 结束时）

```
fps/
  package.json                 # scripts: dev / build / build:lite / test / test:e2e / test:mp / bench / lint
  esbuild.config.mjs
  .github/workflows/ci.yml     # 或本地 tools/ci.sh（无远端仓库时）
  packages/
    sim/                       # 纯逻辑，零依赖，Node 与浏览器共用
      math.js                  # v3 标量数学（不依赖 three）
      world.js                 # 碰撞世界：AABB + 均匀网格粗筛 + 射线 + 胶囊移动
      nav.js                   # 导航网格、A*、路径平滑
      movement.js              # stepPlayer(state, cmd, world, dt)
      weapons.js               # 武器数据表与纯函数（散布、后坐、伤害）
      damage.js                # 伤害管线
      rng.js                   # 种子 RNG
      ai/                      # V34
      index.js
    data/
      weapons/*.json
      enemies/*.json
      missions/*.json
      maps/*.map.json          # 碰撞、点位、掩体、触发器（由导出器生成 + 手工编辑）
      i18n/zh-CN.json
  src/
    main.js                    # 启动、主循环（固定步累加器）
    core/                      # events, clock(scheduler), flags, save, i18n, errors
    engine/                    # 从 game.js 拆出的渲染/材质/特效/音频/输入
      render/ post/ materials/ fx/ audio/ input/
    game/                      # 状态机、玩家表现层、武器表现层、敌人表现层、HUD
      state/ player/ weapon/ enemies/ hud/ objectives/
    features/                  # 原扩展模块，改为显式注册的系统
      campaign/ boss/ armory/ tactics/ training/ access/ onboarding/ pickups/ grenades/
    maps/                      # harbor/ depot/ ship/ core/ 的可视构建器 + mapkit
    net/                       # 联机客户端
    ui/                        # 界面外壳与样式
  server/
    server.js                  # 引用 packages/sim
    rooms/ match/ protocol/
  tests/
    unit/                      # vitest：sim、存档、评级、挑战
    golden/                    # 新旧实现对比基准
    e2e/                       # playwright：按功能拆分的用例
    mp/                        # Node 无头客户端 + 本地服务器
    bench/                     # 性能基准与预算
  tools/
    export_maps.mjs  split/  _archive/   # 旧的 477 个脚本移入 _archive
  releases/                    # 发布产物（不再把每一版 html 放进源码树）
```

---

## 3. V32「地基」：工程重构与确定性核心

**版本目标**：玩家看到的内容与 V31 基本一致（只多了缺陷修复），但代码从「压缩包 + 补丁」变成可维护、可测试、客户端与服务器共享模拟的工程。这是后四个版本的前提，不能跳过，也不能边做内容边做。

**退出标准（全部满足才算 V32 完成）**

- `npm run build:lite` 产出单文件，原 85 项单机验收 + 全部联机专项通过；
- `packages/sim` 在 Node 下单测覆盖率 ≥ 80%，移动/射线与旧实现的基准对比误差 < 1e-4；
- 30/60/144 fps 下跳跃顶点高度差 < 1cm，连射 30 发后的镜头上抬角差 < 1%；
- 联机测试完全在本机跑（本地起服务器 + Node 无头客户端），不依赖内网主机和 `MP_DEV`；
- 附录 A 的缺陷全部关闭；
- `src/` 内不再有 `/*__MARKER__*/`、不再有对 `G.*` 方法的重新赋值、不再有驱动玩法的裸 `setTimeout`。

### WP32-0 止血修复（第 1 周，先于一切重构）

在旧结构上直接修，立刻发 V31.1。这样重构期间线上版本是干净的，而且这些修复本身就是之后特征测试的一部分。逐条修法见附录 A，这里只列要点：

| 项 | 修法摘要 |
| --- | --- |
| 关闭后门（N1） | `fps-mp.service` 删除 `Environment=MP_DEV=1`；`dev` 消息额外要求 `MP_DEV_TOKEN` 匹配 |
| 回合计时（N2） | tick 中 `timeLeft<=0 && !roundOver` 时按比分结束回合；平分进入 60 秒加时 |
| 散布公式（G6） | 给求和项加括号；同步重调长眼与散布配件数值（见下） |
| 名字注入（N8） | 客户端所有名字改用 `textContent`；服务器名字白名单化 |
| 房间键（N10） | 键改为 `roomId@modeId`，地图是房间状态 |
| 堆队（N11） | 忽略客户端 `team`，除非 `MP_DEV` |
| BOSS 音乐（S3） | BOSS 生成时进入 boss 状态，死亡时退出，不再用 30 秒过期 |
| CSS 冲突（U3） | 档案面板类名改为 `.x-arc-*` |
| 死代码（E9） | 删除 `src/dmr.js` |
| 中场击杀 | `handleFire` 开头加 `if (room.roundOver) return` |
| 传送用错世界 | `world` → `p.room.world` |

散布修复会改变平衡，必须同时处理。正确公式：

```js
// game.js:67097 —— 修复后
const base  = lerp(0.0125, 0.0012, ads);
const move  = speed01 * lerp(0.013, 0.004, ads);
const bloom = k.bloom * lerp(0.0065, 0.0022, ads);
const air   = onGround ? 0 : 0.022;
const crouch = crouching ? 0.002 * (1 - ads) : 0;
const target = Math.max(0.0004, (base + move + bloom + air - crouch) * (cfg.spreadScale || 1) * mods.spread);
```

修复后长眼的腰射散布会从 0.0125 变成 0.004，开镜从 0.0012 变成 0.0004（几乎零散布）。这是设计原意，但敌人会明显变好打，需要：把长眼 `spreadScale` 先调到 0.45 // 调参，跑一遍六关确认限时/爆头挑战阈值仍合理；军械库的数值预览面板核对「散布」一栏与实际一致。

**DoD**：附录 A 每条有对应的自动化检查；V31.1 构建通过 85 项验收；NUC 上 `/healthz` 正常且 `dev` 消息无响应。

### WP32-1 仓库与目录整理（0.5 周）

1. `git init`；`.gitignore` 加 `node_modules/ .npmcache/ releases/ *.log`。
2. 首个提交原样收录 V31（包括 `versions/`），打标签 `v31`，之后从源码树移除 `versions/*.html`（需要时从标签取）。截图保留在 `docs/screens/`。
3. `tools/` 下的 `patch_*.py update_docs_*.py diag_* debug_* probe_* shot_* test_v*.mjs *.png *.log` 全部移入 `tools/_archive/`，只保留 `build.cjs test_suite.mjs test_current.mjs test_mp_*.mjs split.cjs`。
4. `baseline/` 和 `reference/` 移到 `docs/reference/`（`reference/src_base.js` 是拆包时对照用的原始包）。
5. `package.json` 加 `"type":"module"`、`scripts`、`engines.node >= 22`。

**DoD**：`git status` 干净；`npm test` 能跑（此时仍是旧套件）。

### WP32-2 拆包：把 `game.js` 还原为模块（2 周，本版本最大风险）

**目标**：`src/game.js` 的 3.4 万行 three.js 改为 npm 依赖 `three@0.180.0`；后 3.8 万行游戏代码按工厂函数切成约 40 个 ES 模块，并逐步恢复可读命名。

**为什么可行**：包是 esbuild 的 IIFE 输出，顶层是约 327 个函数声明和若干 `var`，模块边界就是工厂函数。已知的切分点：

| 工厂 | 行号 | 目标模块 |
| --- | --- | --- |
| 画质档 `Pr` / 选档 `zy` | 34649 / 34744 | `engine/render/quality.js` |
| 事件总线 `Dy`、RNG `il`、桩 `dr` | 34774 / 34799 / 34827 | `core/events.js` `packages/sim/rng.js` `core/stubs.js` |
| 天空/PMREM `Vy`、阴影拟合 `Gy`、PCSS `qy` | 35492 / 35505 / 35556 | `engine/render/sky.js` `shadows.js` |
| 后处理 `jy` | 36045 | `engine/post/*.js`（每个 pass 一个文件） |
| 渲染 `Hg` | 36662 | `engine/render/renderer.js` |
| 材质 `Gg`（贴图集 `c3`） | 39518（39099） | `engine/materials/*.js` |
| 物理 `d3` | 39909 | `packages/sim/world.js` + `nav.js`（WP32-5 重写） |
| 道具 `Yg`（目录 `Gi`） | 40421（40379） | `maps/props.js` |
| 港区 `C1` / 背景 `pv` / 地面 `O1` | 50293 / 53749 / 55055 | `maps/harbor/*.js` |
| 特效 `Cf` | 57107 | `engine/fx/*.js` |
| 音频 `c_`（音效表 `Go`） | 61538（60933） | `engine/audio/*.js` |
| 输入 `v_` | 62830 | `engine/input/*.js` |
| 玩家 `x_`（调参 `Mt`） | 63320（63281） | `packages/sim/movement.js` + `game/player/view.js` |
| 战斗 `zv` | 63745 | `game/combat.js` |
| 枪模 `w_` / 武器 `dm` | 64094 / 66437 | `game/weapon/*.js` |
| 飞鸦 `Q_` / 猎犬 `iM` / 敌人管理 `Em`（调参 `Ui`） | 68445 / 69083 / 70160（70131） | `game/enemies/*.js` |
| HUD `hM` / 菜单 `pM` | 70790 | `game/hud/*.js` `ui/menus.js` |
| 状态机 `mM`（常量 `Yi`） | 71760（71717） | `game/state/*.js` |
| 启动 `QC` + 主循环 | 72553 / 72744 | `src/main.js` |

**步骤**

1. **切 three**：写 `tools/split/extract_three.mjs`，解析 `var lt = {}; br(lt, {ACESFilmicToneMapping: () => xc, …})` 这张导出表（`game.js:6` 起），得到「压缩名 → three 导出名」映射（例如 `W → Vector3`、`rn → PlaneGeometry`，以映射表实际输出为准）。
2. **切游戏代码**：用 `@babel/parser` 解析 34,649 行之后的部分，按上表的行区间把顶层声明分组；对每组计算自由变量：
   - 命中 three 映射的 → 生成 `import { Vector3 as W } from 'three'`（先保留别名，保证零行为变化）；
   - 命中其他组的顶层声明 → 生成 `import { x } from '../…'` 并在源组加 `export`；
   - 循环依赖用「延迟取用」解决（工厂函数内部才访问，不在模块顶层求值）。
3. **扩展模块归位**：`weapon_ext.js` 原本注入在武器模块内部、直接用压缩名，现在改成 `game/weapon/inventory.js`，显式 import 它用到的符号。`ext.js` 及其内联的各模块暂时原样放进 `features/legacy_ext.js`，只把 `window.__G` 的轮询改成 `export function initExt(G)`，由 `main.js` 在启动完成后调用（去掉 100ms×600 次的 `wait()`）。
4. **行为对比**：新旧构建各跑一遍 `?seed=4207&dt=0.0166&autostart=1&noaudio=1&bench=1`，每 60 帧记录玩家位置、敌人位置数组、`combat.stats`、`render.stats()` 的 calls/tris，输出 JSON 做逐字段对比；再用 `?shot` 在 12 个固定机位截图，像素差均值 < 1/255。
5. **改名**：对比通过后再改名，每次只改一个模块、一次提交。优先级：`sim` 相关 > 武器 > 敌人 > 状态机 > 渲染。局部变量用 IDE 重命名即可，不追求一次到位；规则是「动到哪个函数就把它改可读」。

```js
// tools/split/split_game.mjs（骨架）
const ast = parse(src, { sourceType: 'script' });
const top = iifeBody(ast);                         // IIFE 内的顶层语句
const groups = assignByLineRanges(top, RANGES);    // RANGES 即上表
const declOwner = new Map();                       // 顶层名字 -> 组
for (const g of groups) for (const d of g.decls) declOwner.set(d.name, g);
for (const g of groups) {
  const free = freeVariables(g.nodes);             // @babel/traverse scope 分析
  const imports = new Map();
  for (const name of free) {
    if (THREE_MAP.has(name)) add(imports, 'three', `${THREE_MAP.get(name)} as ${name}`);
    else if (declOwner.has(name) && declOwner.get(name) !== g) {
      add(imports, relPath(g, declOwner.get(name)), name);
      declOwner.get(name).exports.add(name);
    } else if (!GLOBALS.has(name)) warn(`unresolved ${name} in ${g.file}`);
  }
  emit(g.file, renderImports(imports) + generate(g.nodes) + renderExports(g.exports));
}
```

**风险与对策**：压缩器可能把多个模块的顶层 `var` 合并声明、或让函数依赖声明提升——拆分脚本遇到跨组的 `var` 多重声明时要先拆成单条；对比不过时用二分法（一半模块用新文件、一半仍从旧包引用）定位。若两周内无法做到逐帧一致，退路是：只切出 three 和 `sim` 相关的 4 个模块，其余保持一个大文件 `engine/legacy_bundle.js` 并导出工厂函数，后续版本「用到哪块拆哪块」。

**DoD**：`src/game.js` 删除；行为对比与截图对比通过；85 项验收通过；产物体积不大于 V31。

### WP32-3 构建系统（0.5 周）

用 esbuild 取代 `tools/build.cjs`。

```js
// esbuild.config.mjs
import { build } from 'esbuild';
import fs from 'node:fs';
const target = process.argv[2] || 'lite';              // lite | full | dev
const result = await build({
  entryPoints: ['src/main.js'], bundle: true, format: 'iife',
  minify: target !== 'dev', sourcemap: target === 'dev' ? 'inline' : false,
  define: { __BUILD__: JSON.stringify({ target, version: pkg.version, commit: gitShort() }),
            __DEV__: String(target === 'dev') },
  loader: { '.glsl': 'text', '.json': 'json' },
  write: false, metafile: true,
});
const js = result.outputFiles[0].text;
const html = fs.readFileSync('src/ui/shell.html', 'utf8')
  .replace('<!--CSS-->', () => `<style>${fs.readFileSync('src/ui/shell.css', 'utf8')}</style>`)
  .replace('<!--JS-->',  () => `<script>${js.replace(/<\/script/g, '<\\/script')}</script>`);
  // 注意：replace 的第二个参数用函数形式，避免 `$&` 等序列被解释（旧构建的隐患 E2）
fs.writeFileSync(`releases/saltline-${target}.html`, html);
assertBudget(result.metafile, { lite: 2.6 * 1024 * 1024 });   // 体积预算，超出即失败
```

- `npm run dev`：esbuild `--watch` + 本地静态服务器（同时把 `/ws` 代理到本地联机服务器）。
- `__SX_PROFILE` 版本分支全部删除（它只为了让旧版 html 复现历史行为，标签里已有历史产物）。
- GLSL 从 JS 字符串挪到 `.glsl` 文件（改到哪个 pass 挪哪个，不强制一次完成）。

**DoD**：`build.cjs` 删除；`npm run build:lite` < 3 秒；产物双击可玩。

### WP32-4 固定步模拟（1.5 周）

**设计**：模拟 60Hz 固定步；渲染任意帧率，对模拟状态做插值。视角（yaw/pitch）不走固定步——鼠标输入每个渲染帧立即作用到视角，保证零延迟手感；位移、速度、武器射击计时、AI、手雷走固定步。

```js
// src/main.js
const STEP = 1 / 60, MAX_STEPS = 5;
let acc = 0, simTick = 0;
function frame(nowMs) {
  const realDt = Math.min((nowMs - last) / 1000, 0.25); last = nowMs;
  const dt = DEBUG.dt ? +DEBUG.dt : realDt;
  input.sample();                         // 读设备：累积 look 增量、按键边沿
  view.applyLook(input.consumeLook());    // 视角立即生效（不进固定步）
  if (game.simRunning()) {
    acc += dt * clock.timeScale;          // timeScale：暂停=0，子弹时间<1
    let n = 0;
    while (acc >= STEP && n < MAX_STEPS) {
      const cmd = input.buildCommand(simTick, view.yaw, view.pitch);  // 本步的输入快照
      world.snapshotPrev();               // 保存上一步的可插值状态
      fixedUpdate(cmd, STEP);
      acc -= STEP; simTick++; n++;
    }
    if (n === MAX_STEPS) acc = 0;         // 螺旋保护：丢弃积压而不是越追越慢
  }
  const alpha = game.simRunning() ? acc / STEP : 1;
  update(dt, alpha);                      // 表现层：插值、特效、枪模弹簧、HUD、音频
  renderer.frame(dt);
  input.endFrame();
}

function fixedUpdate(cmd, h) {            // 顺序固定，写进文档，不允许系统自行决定先后
  clock.tick(h);                          // 调度器（WP32-7）在这里触发到期任务
  playerSim.step(cmd, h);                 // packages/sim/movement.js
  weaponSim.step(cmd, h);                 // 射击计时、换弹阶段、命中判定
  enemySim.step(h);
  projectiles.step(h);                    // 手雷、敌方弹丸
  objectives.step(h);
  director.step(h);
}
```

**输入命令**（单机与联机同一结构，V36 直接上线传输）：

```js
// packages/sim/command.js
/** @typedef {{ tick:number, mx:number, my:number,      // 移动轴，已归一化到单位圆内
 *   yaw:number, pitch:number,
 *   buttons:number,                                    // 位掩码，见下
 *   weaponSlot:number }} Command */
export const BTN = { FIRE:1, ADS:2, JUMP:4, SPRINT:8, CROUCH:16, RELOAD:32, MELEE:64,
                     GRENADE:128, INTERACT:256, SCAN:512, LEAN_L:1024, LEAN_R:2048 };
// 边沿（刚按下）由 sim 用 prevButtons 自行推导，命令里只放电平，保证回放一致
```

**插值**：玩家相机位置 `lerp(prevPos, pos, alpha)`；敌人 `Object3D` 的位置/朝向同理。实现上每个可插值实体带 `prev` 与 `curr` 两份变换，`snapshotPrev()` 做拷贝，表现层只读。瞬移（重生、传送）时令 `prev = curr` 以免拉丝。

**迁移清单**（原来在 `update(dt)` 里直接改玩法状态的地方）：

| 系统 | 进固定步的部分 | 留在表现层的部分 |
| --- | --- | --- |
| 玩家 `x_` | 加减速、重力、跳跃、土狼时间、碰撞、摔伤、回血 | 视角、镜头晃动、头部起伏、FOV、落地弹簧 |
| 武器 `dm` | 射速计时、弹药、换弹阶段、散布/后坐**数值**、命中 | 枪模姿态与弹簧、枪口焰、曳光、音效 |
| 敌人 `Em` | 感知、决策、移动、开火、伤害 | 骨骼/程序动画、特效 |
| 手雷 `ext.js:596` | 弹道、弹跳、引信、爆炸伤害 | 轨迹预览、爆炸特效 |
| 状态机 `mM` | 目标进度、波次、撤离计时 | 电台字幕、淡入淡出 |

后坐要特别处理：后坐产生的镜头上抬属于「视角」，但它必须帧率无关。做法是固定步里只累加「待施加的后坐角」`recoil.pending += kick`，表现层每帧按指数趋近把 `pending` 转移到视角：`const d = pending * (1 - Math.exp(-dt * 60)); pitch += d; pending -= d;`。

**确定性**：`sim/` 内禁止 `Math.random`、`Date.now`、`performance.now`（ESLint `no-restricted-properties` 强制），随机数全部来自 `rng.js` 的命名流（`rng.stream('spread')`、`rng.stream('ai')`），互不干扰。`nav.randomPoint`（A4）改用 `rng.stream('nav')`。

**无头步进**（替代 `?dt=0.1` 的测试方式）：`window.__SX.step(n)` 直接同步调用 `fixedUpdate` n 次，不经过 rAF。测试里「等 3 秒」写成 `await page.evaluate(() => __SX.step(180))`，既快又确定。

**DoD**：帧率无关性测试通过（见退出标准）；同一种子 + 同一命令序列跑两遍，第 3600 步的世界状态哈希相等；`?dt=` 仍可用但测试套件不再依赖它。

### WP32-5 共享模拟层与空间粗筛（1.5 周）

把 `d3`（客户端物理）和 `server/sim.js`（手抄移植）合并为 `packages/sim/world.js`，客户端与服务器 import 同一份。

**数据表示**：AABB 存成结构化数组，不用对象；粗筛是 2m 单元的均匀网格（地图最大 80×60m → 40×30 格），高度方向不分层（关卡高度有限，Y 用盒内测试）。

```js
// packages/sim/world.js
export function createWorld(mapData) {
  const N = mapData.boxes.length;
  const min = new Float32Array(N * 3), max = new Float32Array(N * 3);
  const flags = new Uint8Array(N);            // 1=bulletOnly 2=playerOnly 4=noNav 8=thin(可穿透)
  const surf = new Uint8Array(N);             // 材质索引：concrete/metal/wood/glass/water…
  // ……填充……
  const CELL = 2, ox = mapData.bounds.min[0], oz = mapData.bounds.min[2];
  const gw = Math.ceil((mapData.bounds.max[0] - ox) / CELL), gh = Math.ceil((mapData.bounds.max[2] - oz) / CELL);
  const cellStart = new Uint32Array(gw * gh + 1), cellItems = buildCSR(/* 每格覆盖到的盒索引 */);
  const stamp = new Uint32Array(N); let stampId = 0;      // 去重：一个盒跨多格时只测一次

  function raycast(o, d, maxDist, mask, out) {            // out 由调用方提供，零分配
    stampId++; let best = maxDist, hit = -1;
    // 地面/海面平面先测，得到 best 上界
    // 2D DDA 沿 XZ 走格
    let cx = Math.floor((o.x - ox) / CELL), cz = Math.floor((o.z - oz) / CELL);
    const sx = d.x > 0 ? 1 : -1, sz = d.z > 0 ? 1 : -1;
    let tMaxX = nextBoundaryT(o.x, d.x, cx, ox), tMaxZ = nextBoundaryT(o.z, d.z, cz, oz);
    const tDX = Math.abs(CELL / d.x), tDZ = Math.abs(CELL / d.z);
    let tEnter = 0;
    while (tEnter <= best && inGrid(cx, cz)) {
      const c = cz * gw + cx;
      for (let k = cellStart[c]; k < cellStart[c + 1]; k++) {
        const i = cellItems[k];
        if (stamp[i] === stampId || (flags[i] & mask)) continue;
        stamp[i] = stampId;
        const t = slab(o, d, i);                          // 标准 slab 测试，返回进入 t 或 -1
        if (t >= 0 && t < best) { best = t; hit = i; }
      }
      if (tMaxX < tMaxZ) { tEnter = tMaxX; tMaxX += tDX; cx += sx; }
      else               { tEnter = tMaxZ; tMaxZ += tDZ; cz += sz; }
    }
    return fillHit(out, o, d, best, hit);                 // 含 point/normal/surface/boxIndex
  }
  function queryCylinder(x, z, r, cb) { /* 遍历覆盖到的格，去重后回调 */ }
  function moveCapsule(pos, vel, radius, height, h, out) { /* 逻辑照搬 d3:40066，只把「扫全部盒」换成 queryCylinder */ }
  function groundHeight(x, z, maxY) { /* 同上 */ }
  function lineOfSight(a, b) { return raycast(a, dirTo(a, b), dist(a, b), MASK_PLAYER_ONLY, _tmp).t >= dist(a, b) - 1e-3; }
  return { raycast, moveCapsule, groundHeight, lineOfSight, queryCylinder, boxes: { min, max, flags, surf, count: N } };
}
```

**移动**：`packages/sim/movement.js` 导出纯函数 `stepPlayer(state, cmd, world, h)`，`state = {pos, vel, onGround, crouch01, coyote, jumpBuf, stamina?, …}`。常量从 `Mt`（`game.js:63281`）搬到 `packages/data/movement.json`，服务器的 `MOVE`（`server.cjs:66–79`）删除并改读同一份。服务器 tick 从 30Hz 改为 60Hz 模拟、30Hz 发快照，每个 tick 消费一条客户端命令（真正的命令队列留到 WP36-2，这里先保持「取最新」）。

**基准对比测试**（先写，再重构）：

```js
// tests/golden/physics.test.js
// 1) 用旧实现生成基准：对 harbor/depot/ship/core 各取 5000 条随机射线、2000 次随机胶囊移动、5000 次 groundHeight
//    结果存为 tests/golden/*.bin（旧代码在 WP32-2 拆出来后以 legacy_world.js 形式临时保留）
// 2) 新实现逐条对比：t、命中盒索引、法线、移动后位置，误差 < 1e-4
// 3) 对比通过后删除 legacy_world.js，基准文件保留为回归用
```

**性能目标**：港区 566 盒下，`raycast` 平均 < 2µs（旧实现估计 15–25µs，需实测确认）；整帧物理查询 < 0.5ms（12 个敌人交战）。

**DoD**：`server/sim.js` 删除；客户端/服务器从同一包引用；基准对比通过；`tests/bench/physics.bench.js` 记录到 `bench/baseline.json`。

### WP32-6 地图数据管线（1 周）

**问题**：地图的碰撞、出生点、掩体、中继、拾取物分散在可视构建代码、`maps.json`、`ext.js` 的硬编码坐标里；服务器的 `maps.json` 缺字段（N9）；拾取物和 BOSS 点位只有港区的（G10）。

**方案**：每张图一个 `packages/data/maps/<id>.map.json`，是玩法数据的唯一来源；可视几何仍由 `src/maps/<id>/build.js` 生成（V35 起可换成 glTF）。

```jsonc
// packages/data/maps/depot.map.json
{
  "id": "depot", "version": 3,
  "bounds": { "min": [-32, 0, -22], "max": [32, 12, 22] },   // 真实包围盒（现在四张图都抄了港区的 ±40/±30）
  "ground": { "y": 0, "seaY": null, "quayX": null },          // 室内图没有海
  "boxes": [ { "min": [..], "max": [..], "surf": "metal", "flags": ["noNav"] } ],
  "spawns": {
    "player": { "pos": [0, 0, 13.6], "yaw": 0 },
    "enemy":  [ { "pos": [..], "type": "ground", "zone": "racks_n" } ],
    "air":    [ { "pos": [..], "zone": "ceiling" } ],          // 冷库/货轮补上空中出生点（G11）
    "team":   [ { "team": 0, "pos": [..], "yaw": 0, "radius": 9 }, { "team": 1, "pos": [..], "yaw": 3.1416, "radius": 9 } ],
    "boss":   [ { "pos": [..], "yaw": 0 } ]
  },
  "cover":   [ { "pos": [..], "normal": [..], "height": "low|high", "zone": ".." } ],   // V34 自动生成，可手工增删
  "pickups": [ { "kind": "medkit|armor|ammo|grenade", "pos": [..], "respawn": 0 } ],
  "relays":  [ { "id": "a", "pos": [..], "labelKey": "map.depot.relay.a" } ],
  "zones":   [ { "id": "racks_n", "min": [..], "max": [..], "interior": true, "reverb": "shed" } ],
  "triggers": [],            // V34 任务脚本用
  "probes": [],              // V35 反射探针位置
  "nav": { "cell": 0.5, "agentRadius": 0.5 }
}
```

**导出器** `tools/export_maps.mjs`：无头启动客户端，逐图 `MapKit.build(id)`，从构建器收集 boxes/relays/cover/spawns，写出 JSON；手工维护的字段（pickups、team、boss、triggers）放在 `<id>.authored.json`，导出时合并。导出器对每张图跑校验：

```js
function validateMap(m, world, nav) {
  const errs = [];
  const start = m.spawns.player.pos;
  for (const [kind, list] of pointLists(m))            // 所有点位：出生点/中继/拾取物/掩体/队伍基地
    for (const p of list) {
      const gy = world.groundHeight(p.pos[0], p.pos[2], p.pos[1] + 2.5);
      if (Math.abs(gy - p.pos[1]) > 0.6) errs.push(`${kind} 悬空或埋地 ${p.pos}`);
      if (world.overlapsCylinder(p.pos, 0.32, 1.8)) errs.push(`${kind} 卡在碰撞里 ${p.pos}`);
      if (kind !== 'air' && !nav.findPath(start, p.pos)) errs.push(`${kind} 从出生点不可达 ${p.pos}`);
    }
  if (m.spawns.team.length !== 2) errs.push('需要两个队伍基地');
  return errs;                                          // 非空则导出失败（CI 也跑这一步）
}
```

这把现有的 `validateObjectives`（`campaign.js:290–312`，运行时只 `console.warn`）前移到了构建期，并覆盖所有点位。

客户端 `features/pickups` 改为读 `map.pickups`；`boss.js` 读 `map.spawns.boss`；MapKit 修复「非港区 → 非港区切换时不重置天空/不隐藏港区」（`mapkit.js:257–258`）和 `def.env` 从未应用的问题。

**DoD**：四张图各有 `.map.json` 且校验通过；服务器删除 `maps.json`/`map_boxes.json`/`export_boxes.mjs`；冷库与货轮的拾取物位置正确（新增 e2e 检查）。

### WP32-7 系统注册、调度器与补丁清除（1 周）

把 `features/legacy_ext.js` 拆成显式系统，去掉猴子补丁和裸定时器。

```js
// src/core/systems.js
/** 系统接口：全部可选 */
// { id, deps:[], init(ctx), fixedUpdate(cmd,h), update(dt,alpha), onState(next,prev), dispose() }
export function createSystems(ctx) {
  const list = [];
  return {
    register(sys) { list.push(sys); },
    initAll() { for (const s of topoSort(list)) guard(s, 'init', () => s.init?.(ctx)); },
    fixedUpdate(cmd, h) { for (const s of list) s.fixedUpdate && guard(s, 'fixedUpdate', () => s.fixedUpdate(cmd, h)); },
    update(dt, a)       { for (const s of list) s.update && guard(s, 'update', () => s.update(dt, a)); },
  };
}
```

**用钩子取代补丁**——在引擎侧提供正式扩展点：

| 原补丁 | 新扩展点 |
| --- | --- |
| `P.damage` 被护甲逻辑包一层 | 伤害管线 `damage.pipeline.use(stage, fn)`，阶段：`pre → armor → difficulty → apply → post` |
| `G.enemies.spawn` 被难度/变体包一层 | `enemies.onSpawn(fn)` 修饰器列表，按注册顺序执行 |
| `G.game.update` 被 BOSS/训练/联机各包一层 | 各自注册为系统；联机用 `game.setMode('mp')` 切换一组系统的启停 |
| `G.hud.radio` 按中文前缀改说话人 | 电台调用改为 `radio.say({speaker:'command', key:'radio.m1.relay1'})`，说话人是数据 |
| `addShake` 被可访问性缩放包一层 | `camera.shakeScale` 配置项 |

```js
// packages/sim/damage.js
export function createDamagePipeline() {
  const stages = { pre: [], armor: [], difficulty: [], apply: [], post: [] };
  return {
    use(stage, fn) { stages[stage].push(fn); },
    run(ev) {            // ev = {target, amount, source, kind:'bullet|blast|melee|fall', part, point, dir, cancelled}
      for (const s of ['pre', 'armor', 'difficulty', 'apply', 'post'])
        for (const fn of stages[s]) { fn(ev); if (ev.cancelled) return ev; }
      return ev;
    },
  };
}
// 护甲成为一个阶段函数，而不是对 P.damage 的重写：
pipeline.use('armor', ev => { if (ev.target.isPlayer && ev.kind !== 'fall') {
  const a = Math.min(ev.target.armor, ev.amount * 0.65); ev.target.armor -= a; ev.amount -= a; } });
```

**调度器**（取代裸 `setTimeout`，E4）：跑在模拟时钟上，暂停即停、加速即快、切状态可整组取消。

```js
// src/core/clock.js
export function createClock() {
  let t = 0, seq = 0; const heap = new MinHeap((a, b) => a.at - b.at || a.seq - b.seq);
  return {
    get now() { return t; }, timeScale: 1,
    after(sec, fn, group = 'default') { const h = { at: t + sec, fn, group, seq: seq++, dead: false }; heap.push(h); return () => (h.dead = true); },
    cancelGroup(group) { heap.forEach(h => { if (h.group === group) h.dead = true; }); },
    tick(h) { t += h; while (heap.size && heap.peek().at <= t) { const e = heap.pop(); if (!e.dead) e.fn(); } },
  };
}
// 用法：clock.after(1.2, spawnBoss, 'mission');  离开任务时 clock.cancelGroup('mission')
```

界面动效用的定时器（按钮「确认重试？」2.6 秒复位之类）走另一个 `uiClock`（真实时间），与玩法时钟分开。

顺带清理：四份「返回标题」逻辑（`campaign.js:664–679, 783–797, 825–833`；`training.js:253–269`）合并为 `game.returnToTitle()`；手雷不再发 `weapon:fire`（改发 `grenade:thrown`，战斗音乐与警报各自订阅）；「近战击杀」提示改为订阅 `enemy:killed` 且 `source==='melee'`。

**DoD**：`grep -R "G\.[a-z.]* = function\|setTimeout" src/game src/features packages/sim` 只剩白名单内的界面用法；每个 feature 目录有 `index.js` 导出系统对象。

### WP32-8 统一存档（0.5 周）

```js
// src/core/save.js
const KEY = 'saltline.save', CURRENT = 2;
const DEFAULTS = () => ({
  v: CURRENT, profile: { name: '几猫', createdAt: 0 },
  settings: { quality: 'auto', sens: 1, invertY: false, fov: 74, volume: { master: 0.9, music: 0.8, sfx: 1, voice: 1 }, binds: {} },
  access:   { difficulty: 'normal', cross: 'white', shake: 1, reduceMotion: false, hudScale: 1, subSize: 'm', contrast: false },
  campaign: { unlocked: 1, current: 'm1', best: {}, challenges: {}, ending: null, checkpoint: null },
  armory:   { pac9: {}, breaker12: {}, dmr: {} },
  economy:  { credits: 0, unlocked: [] },             // V34 使用
  stats:    {}, achievements: {}, guide: { dismissed: false }, mp: { url: '', name: '', map: 'harbor', mode: 'tdm' },
});
const MIGRATIONS = {
  1: (legacy) => {                                     // v1 = 六组散键
    const s = DEFAULTS();
    Object.assign(s.campaign, readJSON('saltline.campaign.v1'));
    Object.assign(s.armory,   readJSON('saltline.armory.v1'));
    Object.assign(s.access,   readJSON('saltline.access.v1'));
    const old = readJSON('saltline.settings.v1') || {};
    s.settings.quality = old.quality ?? 'auto'; s.settings.sens = old.sens ?? 1;
    s.settings.invertY = !!old.invertY; s.settings.fov = old.fov ?? 74;
    if (typeof old.volume === 'number') s.settings.volume.master = old.volume;
    s.guide.dismissed = localStorage.getItem('saltline.guide.v1') === '1';
    return s;
  },
};
export function load() {
  let raw = readJSON(KEY);
  if (!raw) raw = hasLegacyKeys() ? MIGRATIONS[1]() : DEFAULTS();
  while (raw.v < CURRENT) raw = MIGRATIONS[raw.v](raw);
  return sanitize(raw, SCHEMA);            // 逐字段校验类型/枚举/范围，非法值回退默认（修 access.js:158 未校验写入）
}
export function commit(state) {            // 写两份：主档 + 备份；读主档失败时读备份
  const text = JSON.stringify(state);
  localStorage.setItem(KEY + '.bak', localStorage.getItem(KEY) ?? text);
  localStorage.setItem(KEY, text);
}
```

旧键迁移后**保留不删**一个版本周期（V33 再清），以便回退。设置页加「导出存档 / 导入存档」（下载/读取 JSON 文件）。

**DoD**：单测覆盖：全新安装、V31 旧档迁移、主档损坏读备份、字段非法回退默认；带 V31 存档打开 V32 后进度、配件、设置全部保留。

### WP32-9 本地化底座（0.5 周）

本版本只搭底座并把文案抽成键，英文翻译在 V35 交付。

```js
// src/core/i18n.js
let dict = {}, fallback = {};
export function t(key, vars) {
  let s = dict[key] ?? fallback[key];
  if (s == null) { if (__DEV__) console.warn('[i18n] missing', key); return key; }
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '') : s;
}
```

- `tools/i18n_extract.mjs`：扫描 `src/` 中含中文字符的字符串字面量，输出候选清单（文件、行、文本），人工归键。命名：`ui.title.start`、`hud.objective.cut_relays`、`mission.m1.name`、`radio.m1.intro`、`enemy.hound.name`。
- 任务数据里的 `name/sub/goal/brief/intro/interlude` 全部换成键。
- ESLint 自定义规则：`src/` 内出现中文字面量报警告（`i18n/` 目录和注释除外）。
- DOM 写入统一走 `el.textContent = t(key)`；需要富文本的地方用模板节点克隆，不拼 HTML 字符串。

**DoD**：`zh-CN.json` 覆盖全部界面与任务文案；抽取脚本对 `src/` 零遗留；界面显示与 V31 逐屏一致。

### WP32-10 测试金字塔与持续集成（1.5 周）

| 层 | 工具 | 内容 | 目标规模 / 时长 |
| --- | --- | --- | --- |
| 单元 | vitest（Node） | `sim/`（射线、移动、导航、伤害、武器公式）、存档迁移、评级、挑战判定、i18n | 300+ 用例 / < 10s |
| 基准对比 | vitest | 物理新旧对比、世界状态哈希回放 | 20 / < 20s |
| 联机集成 | vitest + 本地服务器 + Node 无头客户端 | 加入、移动同步、命中、回合、投票、换图、满员、限流 | 40 / < 60s |
| 端到端 | Playwright（按功能拆文件，可并行） | 启动、每关完整通关（机器人打，不用作弊）、界面流程、存档、触屏、可访问性 | 120 / < 8min |
| 性能 | `tests/bench` | 固定机位路径的帧时间、draw call、物理微基准、包体积 | 对比 `baseline.json`，退步 > 10% 失败 |
| 视觉 | Playwright 截图 + pixelmatch | 12 个机位 × 4 张图，SwiftShader 下 | 阈值 2% 像素 |

**通关机器人**（取代 `cutAll`/99999 伤害等捷径，Q1）：一个只通过 `Command` 与游戏交互的脚本玩家，运行在无头步进模式下。

```js
// tests/e2e/bot.js —— 在页面内运行
function botCommand(G, tick) {
  const me = G.player, goal = G.objectives.current();          // 当前目标点
  const foe = nearestVisibleEnemy(G, me, 45);
  let aim = foe ? aimAt(me.eye, foe.weakPoint ?? foe.center) : aimAlongPath(G.nav, me.pos, goal.pos);
  const path = G.nav.findPath(me.pos, foe && me.health < 40 ? nearestCover(G, me, foe) : goal.pos);
  const [mx, my] = steerLocal(me, path, aim.yaw);
  let buttons = 0;
  if (foe && angleErr(me, aim) < 0.02) buttons |= BTN.FIRE;
  if (G.weapon.ammo === 0) buttons |= BTN.RELOAD;
  if (goal.kind === 'interact' && dist(me.pos, goal.pos) < 2) buttons |= BTN.INTERACT;
  return { tick, mx, my, yaw: stepToward(me.yaw, aim.yaw, 0.12), pitch: stepToward(me.pitch, aim.pitch, 0.12), buttons, weaponSlot: 0 };
}
// 用例：新兵难度下机器人在 N 步内通关 m1..m6；任一关失败即回归。它同时是关卡可达性与软锁的探测器。
```

**联机本地测试**（N14）：`tests/mp/harness.js` 在随机端口启动 `server/server.js`（进程内），`FakeClient` 用 `ws` 直连并复用 `packages/sim` 做本地预测，不需要浏览器。原 `test_mp_*.mjs` 的 34 项断言迁移过来；需要「强制回合结束」的用例通过给服务器传 `roundSeconds: 3` 的测试配置实现，不再需要 `dev` 消息。

**CI**（`tools/ci.sh`，有远端仓库时挂到 GitHub Actions）：`lint → unit → golden → mp → build:lite → 体积预算 → e2e（4 分片）→ bench`。主干保护：全绿才能合并。

**DoD**：`npm test` 一条命令跑完单元 + 基准 + 联机；CI 总时长 < 12 分钟；旧 `test_suite.mjs` 的 85 项全部有对应的新用例后删除旧文件。

### WP32-11 错误处理与诊断（0.5 周）

- 删除空 `catch`。规则：能恢复的就地处理并 `errors.report(e, {system, phase})`；不能恢复的往上抛。
- `guard(system, phase, fn)`：同一系统同一阶段的错误按「首次 + 每 300 次」上报，连续 600 步出错则停用该系统并在 HUD 显示「<系统名> 已停用」，而不是静默。
- `window.__errors` 改为容量 200 的环形缓冲。
- F3 面板加一页「诊断」：最近错误、模拟步耗时分解（玩家/武器/敌人/弹丸）、物理查询次数、每帧分配估算（`performance.memory` 可用时）。
- 崩溃报告：`errors.dump()` 生成 JSON（版本、提交、画质档、GPU 字符串、最近 200 条错误、最近 600 步的命令记录），玩家可一键下载。**命令记录 + 种子即可回放重现**，这是固定步带来的直接收益。

**DoD**：`grep -R "catch *(e) *{ *}" src packages` 为空；人为在某系统抛错时游戏不黑屏且面板可见。

### V32 排期

| 周 | 程序 A | 程序 B |
| --- | --- | --- |
| 1 | WP32-0 止血 + WP32-1 | WP32-10（先给旧行为写特征测试与基准采集） |
| 2–3 | WP32-2 拆包 | WP32-3 构建、WP32-5 共享 sim（在拆出的物理模块上） |
| 4 | WP32-4 固定步 | WP32-6 地图管线 |
| 5 | WP32-7 系统/调度器 | WP32-8 存档、WP32-9 i18n |
| 6 | WP32-11、回归、性能对比 | WP32-10 收尾（机器人通关、CI） |

---

## 4. V33「手感」：3C、枪械与战斗反馈

**版本目标**：玩家拿起枪的前 30 秒就能感到「这是一个认真做的射击游戏」。本版本不加关卡、不加敌人，只打磨「移动—瞄准—开火—命中—反馈」这条核心循环，并把武器从 3 把扩到 6 把。

**退出标准**

- 移动：滑铲、翻越、探身可用，且全部跑在 `packages/sim/movement.js`（Node 单测覆盖）；
- 枪械：6 把武器全部由 `packages/data/weapons/*.json` 驱动，引擎内不再有针对某把枪的硬编码时间点；
- 每把枪的前 10 发弹着点在同一种子下可复现（后坐模式 + 有界随机），靶场有弹着点可视化；
- 手柄可从标题一路玩到通关（含菜单导航），辅助瞄准可开关；
- 全部按键可重绑并持久化；
- 音频：HRTF 可选、逐声源遮挡生效、音量四路分轨；启动时主线程音效合成阻塞 < 50ms；
- 试玩项：5 名试玩者盲测 V31 与 V33，「射击手感」评分（1–5）均值提升 ≥ 1。

### WP33-1 移动 2.0：滑铲、翻越、探身（1.5 周）

所有新动作都是 `movement.js` 里的状态，输入只来自 `Command`。移动状态机：

```
            ┌────────── jump ──────────┐
 ground ◄───┤                          ├──► air ──(前方有可翻越沿)──► mantle ──► ground
   │  ▲     └──────── land ◄───────────┘
   │  └──────────── 速度 < 2.2 或 0.9s 到 ─────────────┐
   └─(冲刺中按蹲 且 速度 ≥ 5.2)──► slide ───────────────┘
 探身（lean）是与上述正交的叠加状态，只在 ground 且非 sprint/slide 时允许
```

**参数表**（`packages/data/movement.json`，全部 // 调参）

| 参数 | 值 | 说明 |
| --- | --- | --- |
| walk / sprint / crouch / ads | 3.8 / 6.4 / 1.9 / 2.4 m/s | 沿用 V31 |
| slide.minSpeed | 5.2 | 进入滑铲的最低水平速度 |
| slide.boost | +1.6 m/s | 进入瞬间沿速度方向的冲量，上限 8.0 |
| slide.friction | 5.5 m/s² | 滑铲期间的减速度（下坡不存在，无坡度） |
| slide.maxTime / exitSpeed | 0.9s / 2.2 | 任一满足即退出到蹲姿 |
| slide.cooldown | 0.35s | 防止连续滑铲加速 |
| slide.steer | 35°/s | 滑铲中可调整方向的角速度上限 |
| slide.eye | 0.95 | 眼高 |
| mantle.maxHeight / minHeight | 1.9 / 0.5 m | 沿顶相对脚底的高度范围（< 0.42 走 stepHeight） |
| mantle.reach | 0.6 m | 前向探测距离 |
| mantle.time | 0.28s（≤1.1m）/ 0.46s（>1.1m） | 低翻越 / 高攀爬 |
| lean.angle / offset | 12° / 0.38 m | 镜头滚转与眼位横移 |
| lean.time | 0.14s | 进入/退出 |
| sprint.strafePenalty | 0.6 | 沿用 V31 的冲刺门槛（`my>0.55 && |mx|<0.6`） |

**滑铲**

```js
// packages/sim/movement.js（节选）
function tryEnterSlide(s, cmd, P) {
  const sp = Math.hypot(s.vel.x, s.vel.z);
  if (s.mode !== 'ground' || !s.sprinting || s.slideCd > 0 || sp < P.slide.minSpeed) return false;
  if (!pressedEdge(s, cmd, BTN.CROUCH)) return false;
  const k = Math.min(P.slide.maxSpeed, sp + P.slide.boost) / sp;
  s.vel.x *= k; s.vel.z *= k;
  s.mode = 'slide'; s.slideT = 0; s.height = P.crouchHeight;
  s.events.push({ type: 'slide:start' });          // 表现层订阅：镜头压低+滚转 3°、摩擦音、枪模侧倾
  return true;
}
function stepSlide(s, cmd, world, h, P) {
  s.slideT += h;
  const sp = Math.hypot(s.vel.x, s.vel.z), ns = Math.max(0, sp - P.slide.friction * h);
  // 有限转向：把速度方向朝视角前向旋转，至多 steer*h
  const want = Math.atan2(-Math.sin(cmd.yaw), -Math.cos(cmd.yaw)), cur = Math.atan2(s.vel.x, s.vel.z);
  const a = cur + clamp(angDiff(want, cur), -P.slide.steer * h, P.slide.steer * h);
  s.vel.x = Math.sin(a) * ns; s.vel.z = Math.cos(a) * ns;
  moveAndCollide(s, world, h);
  if (cmd.buttons & BTN.JUMP) { s.vel.y = P.jumpSpeed; s.mode = 'air'; s.slideCd = P.slide.cooldown; return; }  // 滑跳
  if (ns < P.slide.exitSpeed || s.slideT > P.slide.maxTime || !s.onGround) {
    s.mode = s.onGround ? 'ground' : 'air'; s.crouching = true; s.slideCd = P.slide.cooldown;
  }
}
```

滑铲期间可以开火（散布 ×1.4），不能开镜到满（ADS 上限 0.6）。敌人对滑铲中的玩家命中率 ×0.75（V34 的 AI 瞄准误差里实现）。

**翻越**

```js
function tryMantle(s, cmd, world, P) {
  if (s.mode !== 'air' && !(s.mode === 'ground' && (cmd.buttons & BTN.JUMP))) return false;
  if (cmd.my < 0.3) return false;                                   // 必须在向前推
  const f = forwardXZ(cmd.yaw);
  // 1) 胸口高度前方必须有墙
  if (!world.raycast(at(s.pos, 1.0), f, P.radius + P.mantle.reach, MASK_PLAYER, _h)) return false;
  const wallN = _h.normal, wallD = _h.t;
  if (dot(wallN, f) > -0.6) return false;                           // 斜着蹭墙不触发
  // 2) 从上往下找沿顶
  const probe = { x: s.pos.x + f.x * (wallD + 0.25), z: s.pos.z + f.z * (wallD + 0.25) };
  const top = world.groundHeight(probe.x, probe.z, s.pos.y + P.mantle.maxHeight + 0.1);
  const rise = top - s.pos.y;
  if (rise < P.mantle.minHeight || rise > P.mantle.maxHeight) return false;
  // 3) 沿顶上要站得下（蹲姿高度即可）
  if (world.overlapsCylinder({ x: probe.x, y: top + 0.02, z: probe.z }, P.radius, P.crouchHeight)) return false;
  s.mode = 'mantle'; s.mantleT = 0; s.mantleDur = rise <= 1.1 ? P.mantle.timeLow : P.mantle.timeHigh;
  copy(s.mantleFrom, s.pos); set(s.mantleTo, probe.x, top + 0.02, probe.z);
  s.vel.x = s.vel.y = s.vel.z = 0;
  s.events.push({ type: 'mantle:start', rise });
  return true;
}
function stepMantle(s, h) {
  s.mantleT += h; const k = Math.min(1, s.mantleT / s.mantleDur);
  // 先升后进：y 用 easeOut，xz 用 easeIn，避免穿过沿角
  s.pos.y = lerp(s.mantleFrom.y, s.mantleTo.y, 1 - (1 - k) ** 2);
  const kk = k * k; s.pos.x = lerp(s.mantleFrom.x, s.mantleTo.x, kk); s.pos.z = lerp(s.mantleFrom.z, s.mantleTo.z, kk);
  if (k >= 1) { s.mode = 'ground'; s.onGround = true; s.crouching = world.overlapsCylinder(s.pos, 0.32, 1.8); }
}
```

翻越期间武器放下（不能开火），枪模播放「左手撑沿」的程序姿态（在现有姿态混合里加一个 `mantle` 姿态）。地图校验（WP32-6）新增一项：列出所有高度 0.42–0.5m 的「尴尬沿」（既走不上去也翻不过去），由关卡设计调整。

**探身**

```js
function stepLean(s, cmd, world, h, P) {
  const want = s.mode === 'ground' && !s.sprinting ? ((cmd.buttons & BTN.LEAN_R ? 1 : 0) - (cmd.buttons & BTN.LEAN_L ? 1 : 0)) : 0;
  s.lean = approach(s.lean, want, h / P.lean.time);
  // 眼位横移做碰撞裁剪：从身体中轴向侧面打一条射线，留 0.12m 余量
  const side = rightXZ(cmd.yaw), max = P.lean.offset * Math.abs(s.lean);
  const blocked = world.raycast(at(s.pos, s.eyeHeight), scale(side, Math.sign(s.lean)), max + 0.12, MASK_PLAYER, _h);
  s.leanOffset = Math.sign(s.lean) * (blocked ? Math.max(0, _h.t - 0.12) : max);
}
// 眼位 = pos + up*eyeHeight + right*leanOffset；射线起点用这个眼位。
// 敌人的可见性检测对探身玩家只检测头+肩两个采样点（V34），让探身真正降低暴露面积。
```

默认键位：Q/E 探身。这与现有「Q 扫描 / E 交互」冲突，改为：**探身 Q/E，扫描改 T，交互改 F，近战保留 V**；V31 老玩家首次启动时弹一次「键位已调整」提示，并提供「经典键位」预设（WP33-7）。

**DoD**：单测：滑铲距离（平地 6.4m/s 进入应滑行 4.5–5.5m）、翻越矩阵（0.5/0.9/1.3/1.9m 成功，0.45/2.0m 失败，沿顶被占失败）、探身被墙裁剪；30/60/144fps 表现一致；四张图各做一次「翻越点普查」，无法到达的高处不因翻越而变成可达的图外区域（机器人随机游走 10 分钟无出界）。

### WP33-2 弹道与后坐（1.5 周）

**后坐：模式 + 有界随机**。每把枪有一条后坐轨迹（前 N 发的逐发增量），之后循环尾段；每发叠加小幅随机，随机源是 `rng.stream('recoil')`。

```jsonc
// packages/data/weapons/pac9.json（节选）
"recoil": {
  "pattern": [[0,1.00],[0.05,1.00],[-0.08,0.95],[0.12,0.90],[0.20,0.80],[0.28,0.62],[0.22,0.45],
              [-0.10,0.40],[-0.30,0.38],[-0.34,0.38],[-0.20,0.38],[0.15,0.38],[0.32,0.38],[0.30,0.38]],
  "loopFrom": 7,              // 第 8 发起循环（左右摆动段）
  "unit": [0.0050, 0.0068],   // [水平, 垂直] 每单位对应的弧度；垂直值即 V31 的 0.0068
  "jitter": [0.18, 0.10],     // 相对 unit 的随机幅度
  "recover": { "delay": 0.09, "rate": 6.5, "keep": 0.35 },   // 沿用 V31：35% 永久保留
  "adsMul": 0.72, "crouchMul": 0.85, "moveMul": 1.15
}
```

```js
// packages/sim/weapons.js
export function recoilKick(w, shotIndex, st, rng) {
  const p = w.recoil.pattern, i = shotIndex < p.length ? shotIndex : w.recoil.loopFrom + (shotIndex - w.recoil.loopFrom) % (p.length - w.recoil.loopFrom);
  const m = (st.ads > 0.8 ? w.recoil.adsMul : 1) * (st.crouching ? w.recoil.crouchMul : 1) * (st.speed01 > 0.5 ? w.recoil.moveMul : 1) * st.mods.recoil;
  return { yaw:   (p[i][0] + rng.signed() * w.recoil.jitter[0]) * w.recoil.unit[0] * m,
           pitch: (p[i][1] + rng.signed() * w.recoil.jitter[1]) * w.recoil.unit[1] * m };
}
// shotIndex 在停火 > recover.delay + 0.25s 后归零。
```

**散布**：沿用修复后的公式（WP32-0），但采样改为「首发精准 + 高斯近似」：`r = spread * sqrt(-2 ln(u1)) * 0.5`，截断到 `1.5*spread`；`shotIndex===0 && ads>0.9 && speed01<0.1` 时散布 ×0.25。准星张开量直接显示 `spreadS`（现已如此），保证「所见即所得」。

**距离衰减**

```js
export function falloff(w, dist) {             // w.falloff = {start, end, minMul}
  if (dist <= w.falloff.start) return 1;
  if (dist >= w.falloff.end) return w.falloff.minMul;
  return lerp(1, w.falloff.minMul, (dist - w.falloff.start) / (w.falloff.end - w.falloff.start));
}
```

**穿透**：碰撞盒在 WP32-5 已带材质 `surf` 与 `thin` 标记。子弹命中盒后，若剩余穿透力足够则继续。

```js
const PEN = { wood: 1.0, glass: 0.3, sheet: 1.6, metal: 4.0, concrete: 8.0 };   // 每米消耗的「穿透力」
export function traceBullet(world, o, d, w, hitEntity, out) {
  let power = w.penetration, dmgMul = 1, travelled = 0, origin = o; out.length = 0;
  for (let n = 0; n < 4 && travelled < w.range; n++) {
    const e = hitEntity(origin, d, w.range - travelled);              // 敌人/玩家命中体
    const hit = world.raycast(origin, d, w.range - travelled, MASK_BULLET, _h) ? _h : null;
    if (e && (!hit || e.t < hit.t)) { out.push({ kind: 'entity', ...e, dist: travelled + e.t, dmgMul }); return out; }  // 不穿人（重机枪例外，见数据）
    if (!hit) return out;
    out.push({ kind: 'world', point: hit.point, normal: hit.normal, surf: hit.surf, dist: travelled + hit.t });
    const thick = world.exitDistance(hit.boxIndex, hit.point, d);     // 射线在该盒内的穿行长度
    const cost = thick * PEN[hit.surf];
    if (power < cost || thick > 0.6) return out;                      // 厚于 0.6m 一律不穿
    power -= cost; dmgMul *= 1 - 0.5 * cost / w.penetration;          // 穿透后伤害衰减
    travelled += hit.t + thick + 0.01; origin = add(hit.point, scale(d, thick + 0.01));
    out.push({ kind: 'exit', point: origin, surf: hit.surf });        // 表现层：出口弹孔与碎屑
  }
  return out;
}
```

穿透力：手枪 0.2、冲锋枪 0.25、步枪 0.5、精确射手 0.9、轻机枪 0.7、霰弹丸 0.1。效果：木箱/铁皮后面不再绝对安全，混凝土与集装箱仍是硬掩体。AI（V34）评估掩体时读取同一张表。

**投射物**：只有榴弹、敌方弹丸、BOSS 导弹是真投射物（已有）。玩家子弹保持瞬时命中，但**曳光用有限速度飞行**（900 m/s，纯表现），远距离能看到弹道，且霰弹每颗弹丸一条曳光（修 G8；用一个 64 实例的 InstancedMesh 池）。

**伤害部位**：头 ×（武器 `headMul`，1.6–2.4）、躯干 ×1、四肢 ×0.8；敌人弱点沿用 `weakMul`。部位倍率放进武器数据而不是全局 2.2。

**靶场工具**（开发 + 玩家都能用）：训练场新增一面 10m/25m/50m 的弹着点墙，显示最近 30 发的落点、散布圆、每发后坐轨迹；`__SX.pattern(weaponId, n, seed)` 返回落点数组，单测用它对比基准。

**DoD**：6 把枪的弹着点基准固化为测试；穿透单测（0.1m 木板穿、0.3m 混凝土不穿、连续两层薄板的伤害衰减）；霰弹 9 条曳光；零每发分配（`traceBullet` 复用输出数组，修 `game.js:66925` 的每弹丸 `new Vector3`）。

### WP33-3 数据驱动的武器状态机（1 周）

武器的全部时序来自数据；引擎里 0.47/1.345/2.19 这类步枪专属时间点（G7）删除。

```jsonc
// packages/data/weapons/pac9.json（完整结构）
{
  "id": "pac9", "nameKey": "weapon.pac9.name", "class": "ar", "slot": "primary",
  "fire": { "mode": "auto", "rpm": 720, "burst": 0, "pellets": 1 },
  "damage": 26, "headMul": 2.0, "limbMul": 0.8, "range": 300,
  "falloff": { "start": 35, "end": 80, "minMul": 0.65 }, "penetration": 0.5,
  "mag": 30, "reserve": 150, "chamber": true,
  "spread": { "hip": 0.0125, "ads": 0.0012, "move": [0.013, 0.004], "bloomPerShot": 0.16, "bloom": [0.0065, 0.0022], "air": 0.022, "scale": 1 },
  "recoil": { "...": "见 WP33-2" },
  "ads": { "time": 0.18, "fov": 52, "moveMul": 0.63, "lookMul": 0.6 },
  "handling": { "draw": 0.42, "holster": 0.30, "sprintOut": 0.20 },
  "reload": {
    "tactical": { "time": 2.10, "stages": [ {"at":0.00,"ev":"start"}, {"at":0.47,"ev":"mag_out"}, {"at":1.345,"ev":"mag_in","commit":true}, {"at":2.10,"ev":"done"} ] },
    "empty":    { "time": 2.72, "stages": [ {"at":0.00,"ev":"start"}, {"at":0.47,"ev":"mag_out"}, {"at":1.345,"ev":"mag_in","commit":true}, {"at":2.19,"ev":"bolt"}, {"at":2.72,"ev":"done"} ] }
  },
  "audio": { "shot": "ar_shot", "tail": "ar_tail", "mech": "ar_mech", "alertRadius": 45 },
  "view": { "builder": "pac9", "muzzle": [0, 0.02, -0.62], "eject": [0.03, 0.03, -0.12] }
}
```

`commit:true` 的阶段是「弹药落袋点」：在它之后被打断（切枪、冲刺、近战），弹药已补上，再次举枪只需补完剩余阶段（空仓换弹还要拉栓）。霰弹枪用逐发装填：`"reload": {"perShell": {"insert": 0.52, "start": 0.35, "end": 0.40, "pumpIfEmpty": 0.45}}`，开火可随时打断。

```js
// packages/sim/weapons.js —— 每把武器实例的状态机（固定步）
// 状态：ready | firing(射速计时) | reloading | drawing | holstering | sprintLock | meleeLock
export function stepWeapon(inst, w, cmd, st, h, out) {
  inst.cool = Math.max(0, inst.cool - h);
  switch (inst.state) {
    case 'reloading': {
      const R = inst.reloadDef; inst.t += h / st.mods.reload;
      while (inst.stage < R.stages.length && inst.t >= R.stages[inst.stage].at) {
        const sg = R.stages[inst.stage++]; out.push({ type: 'reload:' + sg.ev });
        if (sg.commit) commitAmmo(inst, w, st);
      }
      if (inst.t >= R.time) inst.state = 'ready';
      else if (wantsCancel(cmd, st)) inst.state = 'ready';          // 阶段指针保留在 inst.resume 供续接
      return;
    }
    case 'drawing':    if ((inst.t += h) >= w.handling.draw) inst.state = 'ready'; return;
    case 'holstering': if ((inst.t += h) >= w.handling.holster) out.push({ type: 'holstered' }); return;
  }
  if (pressed(cmd, BTN.RELOAD) && inst.ammo < magCap(w, st) && inst.reserve > 0) return beginReload(inst, w);
  const trigger = w.fire.mode === 'auto' ? held(cmd, BTN.FIRE) : pressedEdge(cmd, BTN.FIRE) || inst.buffered;
  if (trigger && inst.cool > 0 && w.fire.mode !== 'auto') { inst.buffered = inst.cool < 0.12; return; }   // 半自动输入缓冲 120ms
  if (trigger && inst.cool <= 0 && st.sprintOut <= 0) {
    if (inst.ammo === 0) { out.push({ type: 'dryfire' }); if (inst.reserve > 0) beginReload(inst, w); return; }
    inst.ammo--; inst.cool += 60 / w.fire.rpm; inst.buffered = false;
    out.push({ type: 'shot', index: inst.shotIndex++ });               // 上层据此调用 traceBullet / recoilKick
  }
}
```

表现层订阅 `reload:mag_out/mag_in/bolt` 等事件驱动枪模关键帧与音效，关键帧表按 `stage.at / time` 归一化，所以配件改变换弹时间时动画自动等比缩放。军械库的配件修正从散落在 `game.js:66442, 66837–67103` 的读取点收敛为 `resolveStats(w, attachments) → 最终数据`，界面预览和实际结算调用同一个函数。

**DoD**：`grep` 引擎内无武器 id 分支；换弹打断/续接单测；`resolveStats` 快照测试覆盖全部配件组合（6 把 × 配件）。

### WP33-4 军械扩充：三把新武器与副武器槽（1.5 周）

装备栏改为：**主武器 ×2 + 副武器 ×1 + 投掷物 ×2 种**。数字键 1/2 主武器、3 副武器、4 切投掷物类型。完整数值见附录 B。

| 武器 | 定位 | 关键数值 | 特色 |
| --- | --- | --- | --- |
| **几猫·蜂刺** 冲锋枪 | 近距机动 | 19 伤害 / 900rpm / 32 发 / 衰减 15–40m ×0.5 | 移动散布惩罚减半、冲刺转开火 0.12s、滑铲中散布不加成 |
| **几猫·长夜** 轻机枪 | 压制 | 30 伤害 / 600rpm / 80 发 / 换弹 5.2s | 持续射击 12 发后散布反而收敛（架势稳定）；蹲姿后坐 ×0.6；移速 ×0.88；对护盾伤害 ×1.5 |
| **几猫·短讯** 手枪 | 副武器 | 34 伤害 / 半自动上限 400rpm / 12 发 / 切出 0.22s | 无限备弹；主武器空仓时双击切枪键快拔 |

投掷物新增**电磁脉冲雷**（对机械敌人的主题化战术道具）：半径 7m，无伤害，瘫痪飞鸦 3s（坠落后重启）、猎犬类 2s、关闭护盾 6s、炮台 5s；对 BOSS 只打断当前招式。携带上限：破片 2 + 脉冲 2。

枪模：三把新枪沿用 `w_` 的程序化建模方式各写一个 builder（体块 + 倒角 + 现有材质集），V35 再替换为 glTF。每把枪至少有：独立轮廓、独立的开火/换弹/检视姿态关键帧表、独立枪声合成参数。

**DoD**：6 把枪 + 2 种投掷物在训练场可用；配件各 3 槽齐备；机器人用每把枪通关 m1；数值走查表（TTK 表，见附录 B）由策划签字。

### WP33-5 命中反馈分层（1 周）

一次命中同时在五个通道给出反馈，强度按「普通 < 弱点 < 破盾 < 击杀 < 爆头击杀」递增：

| 通道 | 普通命中 | 弱点 | 击杀 | 爆头击杀 |
| --- | --- | --- | --- | --- |
| 准星标记 | 白色 ×，120ms | 琥珀色，带外扩 | 红色加粗 ×，220ms | 红色 + 中心菱形 |
| 音效 | 短促金属「嗒」 | 高一个八度的「叮」 | 低频「咚」+ 上扬尾音 | 再叠一层清脆碎裂 |
| 敌人表现 | 命中方向的火花 + 局部装甲板位移 6cm 回弹 | 弱点泄电、发光增强 150ms | 分部件解体（WP35-5 前用现有翻滚 + 额外碎片） | 头部组件飞出 |
| 镜头/手柄 | 无 | 无 | 微震 0.04 / 震动 40ms | 微震 0.07 / 震动 70ms |
| 时间 | 无 | 无 | 无 | 顿帧 35ms（`clock.timeScale=0.05`，联机中禁用） |

```js
// src/game/feedback/hit.js —— 订阅 sim 事件，纯表现
events.on('damage:dealt', (ev) => {
  const tier = ev.killed ? (ev.part === 'weak' ? 4 : 3) : ev.shieldBroken ? 2 : ev.part === 'weak' ? 1 : 0;
  hud.hitmarker(tier);
  audio.play(HIT_SFX[tier], { bus: 'ui', pitch: 1 + (ev.killed ? 0 : Math.min(0.25, combo.hits * 0.02)) });  // 连续命中音高微升
  fx.impact(ev.point, ev.normal, ev.surf ?? 'robot', tier);
  if (tier >= 3) { camera.kick(TIER_KICK[tier]); pad.rumble(TIER_RUMBLE[tier]); }
  if (tier === 4 && !net.active && !access.reduceMotion) clock.hitstop(0.035);
  if (access.damageNumbers) hud.damageNumber(ev.point, ev.amount, tier);       // 可选，默认关
});
```

**受击反馈**：方向指示弧沿用；新增——护甲吸收时是蓝白色屏缘闪 + 金属声，掉血时是红色暗角 + 闷响（两者可区分）；血量 < 30 时画面去饱和 + 心跳 + 低通（已有心跳，补齐其余）；被狙击激光锁定时屏缘出现红色方向提示。

**环境反馈**：按 `surf` 区分的弹孔贴花、碎屑粒子和命中音（混凝土灰尘、金属火花、木屑、玻璃碎裂、水花）；贴花池 256 个循环复用；弹壳抛出（实例化，落地一次弹跳 + 按地面材质的落地声，3 秒后淡出）。

**DoD**：五档反馈在训练场逐项可见可听；减少动态模式下无顿帧、震动减到 0.18；贴花/弹壳池无每帧分配；试玩项「不看血条也知道有没有打中、打死」通过。

### WP33-6 音频 2.0：空间化、遮挡、分层枪声（1.5 周）

**混音总线**：`master → {music, sfx(world/near/ui), voice, ambience}`，设置页四个滑杆（主/音乐/音效/语音）。加入**侧链压低**：电台语音播放时 music −6dB、ambience −4dB；己方开火时 world −2dB（让自己的枪声清晰）。

**HRTF**：`PannerNode.panningModel = 'HRTF'` 只用于优先级最高的 8 个声源（敌人开火、脚步、狙击充能、BOSS 招式），其余保持 `equalpower`。设置项「空间音频：关 / 标准 / HRTF」，低画质档默认标准。

**遮挡**：每个活跃声源每 0.1s（错帧）从听者向声源打 1 条射线（用 `world.raycast`，V32 之后足够便宜）；被挡时逐步关小低通并衰减。

```js
// src/engine/audio/occlusion.js
function updateOcclusion(voice, listener, world) {
  if ((frame + voice.id) % 6) return;
  const d = dist(listener, voice.pos);
  const blocked = d > 1 && world.raycast(listener, dirTo(listener, voice.pos), d - 0.2, MASK_SOUND, _h);
  let occ = 0;
  if (blocked) { const thick = world.exitDistance(_h.boxIndex, _h.point, _dir); occ = clamp(0.45 + thick * 0.5, 0, 1); }
  voice.occTarget = occ;                     // 表现帧里平滑：occ += (target-occ) * (1-exp(-dt*8))
}
function applyOcclusion(voice) {
  voice.lowpass.frequency.value = lerp(18000, 900, voice.occ);
  voice.occGain.gain.value = lerp(1, 0.45, voice.occ);
}
```

**混响分区**：从「一个室内盒」改为读 `map.zones[].reverb`（`outdoor / shed / corridor / hull / cold`），进入分区 0.6s 交叉淡化；再合成 3 个新脉冲响应。

**分层枪声**：每把枪 = `机械层(近、干) + 主体层 + 低频层 + 尾音层(按分区切换室内/室外尾音)`，听者距离 > 25m 时主体层换成「远距版」（高频衰减、起音软），> 60m 只剩尾音 + 延迟（按 343m/s）。敌人枪声同理，这让玩家能凭声音判断距离和室内外。

**离线合成移出主线程**（S2）：57+ 个音效的合成函数搬到 Worker，用 `OfflineAudioContext`（Worker 内不可用时回退为 Worker 里的纯数组合成）产出 `Float32Array`，`postMessage` 可转移对象回主线程建 `AudioBuffer`。启动只同步合成 6 个必需音效（界面点击、步枪开火、脚步），其余异步到达；未到达的音效被请求时静默跳过并记录一次。

**脚步**：按 `surf` 与移动状态（走/跑/蹲/滑铲/落地）选样本，敌人脚步进 HRTF 优先队列——这是「听声辨位」的基础。

**DoD**：遮挡 A/B 可听（隔着集装箱的炮台明显发闷）；启动合成主线程阻塞 < 50ms（Performance 面板实测）；同时发声数不超过 44 且无爆音；四路音量持久化。

### WP33-7 输入：手柄、辅助瞄准、按键重绑（1 周）

**动作映射层**：游戏逻辑只认「动作」，设备绑定是数据。

```js
// src/engine/input/actions.js
export const DEFAULT_BINDS = {
  kbm: { fire: 'Mouse0', ads: 'Mouse2', jump: 'Space', sprint: 'ShiftLeft', crouch: 'KeyC', reload: 'KeyR',
         leanL: 'KeyQ', leanR: 'KeyE', interact: 'KeyF', melee: 'KeyV', grenade: 'KeyG', scan: 'KeyT',
         slot1: 'Digit1', slot2: 'Digit2', slot3: 'Digit3', throwable: 'Digit4', pause: 'Escape', score: 'Tab' },
  pad: { fire: 'RT', ads: 'LT', jump: 'A', sprint: 'L3', crouch: 'B', reload: 'X', interact: 'X(hold)',
         melee: 'R3', grenade: 'RB', scan: 'DpadUp', swap: 'Y', leanL: 'DpadLeft', leanR: 'DpadRight', pause: 'Start' },
};
// 预设：默认 / 经典（V31 键位：Q 扫描、E 交互，无探身键）/ 左手
// 重绑界面：点击条目 → 监听下一个按键 → 冲突时提示「与 <动作> 冲突，是否交换」→ 写入 save.settings.binds
```

**手柄摇杆曲线**：径向死区 0.12（内）/ 0.95（外）；响应 `out = sign(x) * |x|^1.8`；视角速度 水平 220°/s、垂直 150°/s，推满 0.25s 后加速到 ×1.6；ADS 时 ×0.55。

**辅助瞄准**（仅手柄与触屏；联机中由服务器配置决定是否允许）：

```js
// src/game/player/aim_assist.js —— 表现帧执行，作用在视角上
function aimAssist(view, targets, input, dt, cfg) {
  const t = pickTarget(view, targets, cfg.coneDeg /*6*/, cfg.range /*45*/);   // 准星锥内、有视线、角距最小
  if (!t) return;
  const err = angleTo(view, t.aimPoint), near = 1 - err.mag / rad(cfg.coneDeg);
  // 1) 减速（粘滞）：准星越近目标，摇杆灵敏度越低
  input.lookScale *= lerp(1, cfg.slowdown /*0.55*/, near);
  // 2) 跟随：仅当玩家在移动或在推视角时，补偿目标相对角速度的一部分——不会在玩家静止时自己动
  if (input.moveMag > 0.2 || input.lookMag > 0.1) {
    view.yaw += t.angVel.yaw * dt * cfg.follow /*0.35*/ * near;
    view.pitch += t.angVel.pitch * dt * cfg.follow * near;
  }
  // 3) 开镜吸附：ADS 从 0 上升的 0.2s 窗口内，向目标转至多 cfg.snapDeg /*2.5°*/
  if (view.adsRising && view.adsT < 0.2) rotateToward(view, t.aimPoint, rad(cfg.snapDeg) * dt / 0.2);
}
```

强度档：关 / 低 / 标准 / 高（`slowdown/follow/snapDeg` 三元组），放在辅助设置里。**子弹磁性**不做（会影响联机公平与命中判定的权威性）。

**手柄界面导航**：所有可交互元素带 `data-nav`，焦点管理器按空间方向找最近元素（方向键/左摇杆移动，A 确认，B 返回），焦点环样式统一；界面上的按键提示图标随最近使用的设备切换（键鼠 / 手柄字形）。完整的界面重做在 WP35-10，这里只保证能用。

**其他**：鼠标 `rawInput`（`requestPointerLock({unadjustedMovement:true})`，不支持时回退）；ADS 灵敏度独立系数；按住/切换可选（瞄准、蹲、冲刺、探身）；触屏补近战按钮（U2）。

**DoD**：纯手柄通关 m1（人工 + 机器人以手柄命令通道各一次）；重绑持久化、冲突交换、恢复默认均有 e2e 用例；辅助瞄准单测（无目标不动、玩家静止不跟随、吸附不超过上限）。

### WP33-8 靶场与调参工具（0.5 周）

- 训练场扩为「靶场」：固定靶（弹着点墙）、移动靶（横移/纵深/随机）、反应靶（随机弹出，记录反应时）、每把枪的 TTK 计时假人（100HP + 可切换护盾）。
- 开发面板（`__DEV__` 或 `?tune=1`）：对 `movement.json` 与当前武器数据做滑杆热改，一键「导出 JSON 差异」。数值调完直接粘回数据文件，免去改代码—构建—重启的循环。
- 遥测（本地）：每局记录各武器的开火数/命中率/爆头率/击杀数/平均交战距离到 `save.stats`，结算页显示；这也是之后平衡的依据。

**DoD**：策划不写代码即可完成一轮武器调参并导出。

### V33 排期

| 周 | 程序 A | 程序 B | 策划 / 音频 |
| --- | --- | --- | --- |
| 1 | WP33-1 滑铲/探身 | WP33-3 武器状态机 | 武器数值表初稿、键位方案 |
| 2 | WP33-1 翻越 + 普查 | WP33-2 后坐/散布/衰减 | 后坐轨迹设计、枪声分层参数 |
| 3 | WP33-7 动作映射/重绑 | WP33-2 穿透/曳光/靶场 | 新武器轮廓与姿态 |
| 4 | WP33-7 手柄/辅助瞄准 | WP33-4 新武器与投掷物 | TTK 走查 |
| 5 | WP33-6 音频 | WP33-5 命中反馈 | 脚步/命中/尾音合成参数 |
| 6 | WP33-6 收尾、WP33-8 | 回归、性能、试玩修正 | 盲测与调参 |

---

## 5. V34「对手」：AI 2.0、遭遇与成长

**版本目标**：敌人从「会走到有视线的地方开枪的靶子」变成「会躲、会绕、会配合、会逼你移动的对手」；六关从同一个模板变成各有主机制的关卡；玩家每打一局都有东西可拿、有理由再打。

**退出标准**

- AI 全部位于 `packages/sim/ai/`，可在 Node 下无头运行；同种子同命令序列下 AI 决策可复现；
- 16 个敌人同时交战时，AI 总耗时 < 2.0ms/步（中档机器），寻路零分配；
- 掩体评估单测：玩家位置变化后，被侧翼暴露的敌人在 1.5s 内转移；
- 8 关（6 重做 + 2 新增）各有至少一个其他关没有的目标类型或机制；机器人在标准难度下全部通关；
- 两场 BOSS 不共享模型和招式表；每个招式有 ≥ 0.6s 的可读预警；
- 经济闭环：新档玩家通关一遍战役约可解锁 55–65% 的配件；全部解锁约需 2.5 遍 + 挑战；
- 试玩项：「敌人会不会让你感到被包抄/被压制」5 人中 ≥ 4 人答是。

### WP34-1 AI 架构：感知、黑板、行为树 + 效用选择（2 周）

**分层**

```
感知 Perception（每 0.1–0.2s，错帧）──► 黑板 Blackboard（个体 + 小队共享）
                                              │
小队 Squad（每 0.5s）：分配角色与令牌 ────────┤
                                              ▼
个体决策：效用选择器挑「意图」（每 0.3s 或被事件打断）──► 行为树执行意图 ──► 移动/瞄准/开火命令
```

效用负责「做什么」（进攻、找掩体、侧翼、压制、撤退、换弹、投掷），行为树负责「怎么做」（一连串带条件的动作）。两者分开后，新敌人只需要一张效用权重表 + 复用的行为子树。

**感知**

```js
// packages/sim/ai/perception.js
export function sense(e, world, targets, bb, h, rng) {
  if ((e.senseT -= h) > 0) return; e.senseT = e.def.sense.interval + rng.range(0, 0.06);
  for (const t of targets) {                               // 单机只有玩家；合作模式有多名玩家
    const d = dist(e.eye, t.pos); let vis = 0;
    if (d < e.def.sense.sightRange && inCone(e, t, e.def.sense.fovDeg)) {
      // 多点采样：头、胸、（非探身时）髋。探身/蹲在矮掩体后只露头 → 可见度低
      const pts = t.leaning ? [t.head, t.shoulder] : [t.head, t.chest, t.hip];
      let seen = 0; for (const p of pts) if (world.lineOfSight(e.eye, p)) seen++;
      vis = seen / pts.length;
    }
    const k = bb.known(t.id);
    // 察觉度累积：距离越近、可见度越高、目标移动越快，涨得越快；看不见时衰减
    const gain = vis * lerp(2.6, 0.5, d / e.def.sense.sightRange) * (t.sprinting ? 1.4 : t.crouching ? 0.6 : 1) * e.diff.awareMul;
    k.awareness = clamp(k.awareness + (vis > 0 ? gain : -0.35) * e.def.sense.interval, 0, 1);
    if (vis > 0 && k.awareness >= 1) { k.lastSeenPos.copy(t.pos); k.lastSeenVel.copy(t.vel); k.lastSeenT = bb.now; k.visible = true; k.vis = vis; }
    else k.visible = false;
  }
  for (const n of bb.drainNoises(e.pos)) {                 // 枪声/脚步/爆炸/友军阵亡：{pos, radius, kind, t}
    if (dist(e.pos, n.pos) < n.radius * e.def.sense.hearMul) bb.investigate(n.pos, n.kind);
  }
}
```

察觉度带来了 V31 没有的东西：**潜行窗口**。察觉度 0–1 期间 HUD 显示方向性的「察觉弧」（白→黄→红），玩家可以缩回去；消音器把枪声噪音半径从 45m 降到 14m（数据已有）。

**黑板**

```js
// 个体：known[targetId] = {awareness, visible, vis, lastSeenPos, lastSeenVel, lastSeenT}
//       self = {hp01, ammo01, suppression, inCover, coverId, role, token, lastHitT, lastHitDir}
// 小队：squad = {members, knownTargetPos, lastContactT, tokens:{attack:n, flank:1, grenade:1}, claimedCover:Set, focus}
// 小队共享：任一成员 visible → 0.4s 后（通讯延迟）全队 knownTargetPos 更新。EMP 瘫痪期间不共享。
```

**效用选择**

```js
// packages/sim/ai/utility.js
// 每个意图：score = base * Π considerations(curve(input))；取最高分，带 15% 滞回（当前意图得分 ×1.15）防抖动
export const INTENTS = {
  takeCover:  { base: 1.0, cons: [ c('threatened', linear), c('notInGoodCover', step), c('hpLow', quad) ] },
  holdAndFire:{ base: 0.9, cons: [ c('inGoodCover', step), c('hasLOS', step), c('hasToken', step), c('ammo', linear) ] },
  advance:    { base: 0.7, cons: [ c('targetFar', linear), c('squadAdvantage', linear), c('notSuppressed', step) ] },
  flank:      { base: 0.8, cons: [ c('roleFlanker', step), c('flankTokenFree', step), c('targetStationary', linear) ] },
  suppress:   { base: 0.75,cons: [ c('roleSuppressor', step), c('targetInCoverRecently', step), c('ammo', linear) ] },
  flush:      { base: 0.85,cons: [ c('hasGrenade', step), c('targetCamping', linear), c('grenadeTokenFree', step), c('rangeOK', bell) ] },
  retreat:    { base: 1.1, cons: [ c('hpCritical', step), c('alliesNearby', inverse) ] },
  reload:     { base: 1.2, cons: [ c('magEmpty', step) ] },
  search:     { base: 0.5, cons: [ c('lostTarget', step) ] },
  patrol:     { base: 0.2, cons: [] },
};
// 输入示例：threatened = 最近 1.5s 被命中 或 suppression>0.4；targetCamping = 玩家 4s 内位移 < 2.5m；
// squadAdvantage = 存活队友数/4；每个敌人定义可覆盖 base 权重（重装 retreat=0，狙击 advance=0.1 …）
```

**行为树**（节点返回 `RUN | OK | FAIL`，树是数据，状态存在个体上）

```js
// packages/sim/ai/trees.js
export const TREES = {
  takeCover: seq(
    act('pickCover', { mode: 'defensive' }),           // 调 WP34-2 的评估；占用 claimedCover
    act('moveTo', { key: 'coverPos', speed: 'run', strafeFire: true }),   // 移动中若持令牌可点射
    act('enterCover')),
  holdAndFire: loop(seq(
    act('peek', { side: 'auto', time: [0.25, 0.4] }),  // 从掩体探出：位移 0.6m 或站起
    act('aim', { time: 'def.telegraph' }),             // 预瞄：激光/枪口亮起，给玩家可读窗口
    act('burst'),
    act('unpeek'),
    wait([0.6, 1.4]))),
  flank: seq(
    act('pickFlankRoute'),                             // 见下
    act('moveTo', { key: 'flankPos', speed: 'run', avoidLOS: true }),
    act('pickCover', { mode: 'aggressive' }), act('moveTo', { key: 'coverPos' }), sub('holdAndFire')),
  suppress: seq(act('aimAtLastSeen'), act('sustainedFire', { time: [1.5, 2.5], accuracy: 0.35 })),
  flush: seq(act('telegraphThrow', { time: 0.7 }), act('throwGrenade', { at: 'lastSeenPos' }), wait(1.0)),
  search: seq(act('moveTo', { key: 'lastSeenPos', speed: 'walk' }), act('sweepLook', { time: 3 }), act('pickSearchPoint'), repeat(3)),
};
```

**侧翼路线**：在导航图上做一次「带威胁代价」的 A*——格子若对玩家最后已知位置有视线，代价 +8（用 WP34-2 预计算的可见性近似），于是路径自然绕到遮挡后面；终点从「与玩家—小队连线夹角 60°–120°、距离 8–18m」的掩体里挑。

**瞄准与命中率**：AI 不再「必中/随机散布」，而是有一个追踪玩家的瞄准点，带反应延迟和误差：

```js
aimErr = base(def) * diffMul * (1 + targetSpeed01 * 0.8) * (target.sliding ? 1.33 : 1) * (1 + self.suppression) * distCurve(d);
// 首发惩罚：目标刚露头的 0.35s（难度可调）内 aimErr ×3 —— 给玩家「探头打一枪缩回去」的空间
// 压制值：玩家子弹从敌人 1.2m 内掠过 +0.25，每秒衰减 0.5；>0.6 时强制缩回掩体、不探头
```

**导航升级**（A4）：
- 网格保留 0.5m 分辨率，但改为增量重建（只重建脏矩形）；
- A* 的开放表/来源表用按格索引的 `Int32Array/Float32Array` + 代数戳，零分配；路径输出写入调用方提供的环形缓冲；
- 每步寻路预算 3 次（队列排队，超出的下一步再算），单次展开上限 9000 保留；
- 局部避让：敌人之间用简化的分离力（半径 0.6m）+ 路径点预约，杜绝门口挤成一团；
- 飞行单位用独立的 3 层稀疏体素（1.5m）做路径，冷库与货轮因此可以有空中敌人（G11）。

**AI 调试**（没有它 AI 做不出来）：`?ai=1` 叠加显示每个敌人的意图、得分前三、当前树节点、已知目标位置、占用掩体、路径、压制值；可暂停并单步；可录制 30 秒决策日志导出。

**DoD**：`tests/unit/ai/*.test.js` 覆盖感知累积、效用滞回、每棵树的成功/失败路径；无头场景测试「玩家站桩 6 秒 → 有敌人投掷或侧翼」「玩家压制 → 敌人缩回」；性能达标。

### WP34-2 真掩体系统（1 周）

**生成**：导出器（WP32-6）对每张图自动产出掩体点，替代手摆的 55 个「射击位」。

```js
// tools/gen_cover.mjs
for (const cell of nav.walkableCells())               // 0.5m 网格
  for (const dir of DIRS8) {
    const p = cell.center;
    // 该方向 0.7m 内有障碍：膝高(0.5m)必须挡住
    if (!world.raycast(at(p, 0.5), dir, 0.7, MASK_BULLET, h)) continue;
    const high = world.raycast(at(p, 1.5), dir, 0.9, MASK_BULLET, h2);        // 胸高也挡住 → 高掩体
    const surf = h.surf, thick = world.exitDistance(h.boxIndex, h.point, dir);
    const hard = thick * PEN[surf] >= 0.9;                                    // 步枪打不穿才算硬掩体
    // 探头位：高掩体向左/右各试 0.7m，那里胸高必须无遮挡；矮掩体直接站起
    const peeks = high ? ['L', 'R'].filter(s => !world.raycast(at(sideStep(p, dir, s, 0.7), 1.5), dir, 2, MASK_BULLET, _)) : ['UP'];
    if (!peeks.length) continue;
    out.push({ pos: p, normal: neg(dir), height: high ? 'high' : 'low', hard, peeks, zone: zoneAt(p) });
  }
dedupe(out, 0.9);          // 同法线 0.9m 内合并；港区预计 250–400 个
```

每个掩体点再预计算一个 16 方向 × 3 距离档的「可见性指纹」（位掩码），用于廉价估计「从某方向来的威胁能否看到这里」，运行时只对最终候选做真射线。

**运行时评估**

```js
// packages/sim/ai/cover.js
export function pickCover(e, bb, world, cover, mode, out) {
  const threat = bb.known(e.targetId).lastSeenPos; let best = null, bestS = -1e9;
  for (const c of cover.query(e.pos, 22)) {                                // 空间哈希，22m 内
    if (bb.squad.claimedCover.has(c.id) && c.id !== e.coverId) continue;
    const toT = dirXZ(c.pos, threat), d = distXZ(c.pos, threat);
    const protects = dot(c.normal, toT) > 0.5;                             // 掩体朝向威胁
    if (!protects) continue;
    let s = 0;
    s += c.hard ? 3 : 1;
    s += c.height === 'high' ? 1 : 0.5;
    s += bell(d, e.def.range.ideal, e.def.range.width) * 4;                // 在本兵种的理想交战距离
    s -= distXZ(e.pos, c.pos) * 0.15;                                      // 近的优先
    s -= pathExposure(e.pos, c.pos, threat, cover) * 2;                    // 去的路上别被打
    s += mode === 'aggressive' ? flankAngle(c.pos, threat, bb.squad) * 2 : 0;
    s -= nearAllies(c.pos, bb.squad, 3) * 1.5;                             // 别扎堆（防一颗雷全灭）
    if (s > bestS) { bestS = s; best = c; }
  }
  if (best && !world.lineOfSight(at(best.pos, best.height === 'high' ? 1.5 : 0.9), at(threat, 1.4))) return claim(e, bb, best, out);
  return null;      // 指纹说安全但实测有视线 → 失败，行为树走备选分支（后撤并还击）
}
// 掩体失效：每 0.5s 复查当前掩体 dot(normal, 威胁方向)。< 0.2（被侧翼）→ 触发 takeCover 重新选择。
// 这就是「玩家绕到侧面，敌人会转移」的全部机制。
```

玩家也受益：掩体数据给探身提示（靠近高掩体边缘时 HUD 提示可探身方向），以及 V36 机器人的站位。

**DoD**：四张图掩体自动生成并入库；可视化工具能显示全部掩体点及朝向；退出标准中的侧翼转移测试通过。

### WP34-3 小队、兵种与四种新机体（2 周）

**小队**：导演（WP34-4）以 3–5 个单位为一队生成；小队管理器每 0.5s 运行一次。

```js
// packages/sim/ai/squad.js
function updateSquad(sq, bb) {
  // 角色：按兵种默认 + 态势调整
  // assault 突击（持攻击令牌轮流开火）/ suppressor 压制 / flanker 侧翼（全队至多 1–2）/ marksman 远程 / anchor 固守
  const alive = sq.members.filter(m => m.alive);
  if (!alive.some(m => m.role === 'flanker') && alive.length >= 3 && bb.targetStationaryFor > 3)
    nearestToFlankRoute(alive).role = 'flanker';
  // 令牌：attack 同时 2（>5 人时 3）—— 沿用 V31 的数量，但改为小队级并带优先级：有视线 > 距离近 > 等待久
  // 交替掩护推进：suppressor 持续射击期间，assault 才允许执行 advance
  sq.canAdvance = alive.some(m => m.intent === 'suppress' && m.firing);
  // 士气：队伍减员 ≥ 60% 且无精英 → 剩余单位 retreat 权重 ×2，退向最近的友军小队或增援点
  // 语音/信号：角色切换时发事件 → 表现层播放机械「通讯音」+ 字幕（可关），让玩家读懂敌人意图
  //   「正在包抄」「压制目标」「投掷」「装填掩护」—— 这是可读性的关键，不要省
}
```

**兵种表**（V31 的 7 种保留并各自获得真实行为；新增 4 种。完整数值见附录 B）

| 机体 | 状态 | 模型 | 行为要点 | 克制方式 |
| --- | --- | --- | --- | --- |
| 飞鸦 gull | 保留 | 现有 | 3 机编队，高位绕飞点射；被 EMP 击落 | 霰弹、EMP |
| 自爆无人机 drone | 保留 | 现有 | 俯冲前 0.8s 红光 + 升调蜂鸣 | 击落会殉爆，可利用 |
| 猎犬 hound | 保留 | 现有 | 标准突击手：掩体、探头、交替推进 | 爆头 |
| 精英猎犬 elite | 保留 | 现有 + 肩甲 | 小队长：存活时全队命中率 +15%、士气不崩；会投 EMP 干扰玩家 HUD 2s | 优先击杀 |
| 狙击 marksman | 保留 | 现有 | 远程固守高位，1.15s 激光预警；被接近 12m 内则转移 | 侧翼、烟/掩体推进 |
| 盾卫 heavy | 保留 | 现有 | 持盾正面推进，为身后友军提供移动掩体；盾破后暴怒冲锋 | 侧后、EMP 关盾、轻机枪 |
| 炮台 turret | **重做** | 新模型：三脚架 + 旋转炮塔 | 固定，120° 扇区扫描，预热 0.6s；背面有检修面板弱点 ×3；可被玩家在背后「骇入」（按住 F 2s）倒戈 20s | 绕后 |
| **蛛雷 skitter** | 新 | 六足小型，0.4m | 6–8 只成群贴地快速接近（6.5m/s），可爬过 1m 障碍；贴身自爆 22 伤害/2.5m；18HP | 霰弹、手雷、别站桩 |
| **工蜂 mender** | 新 | 悬浮修理机 | 不攻击；以光束为 12m 内友军每秒修复 25HP，优先修盾卫/炮台；受威胁时躲到友军身后 | 优先级目标，逼玩家换目标 |
| **投弹手 lobber** | 新 | 双足 + 背部发射筒 | 15–35m 外从掩体后抛射榴弹（2.2s 飞行，落点有地面红圈预警），专打蹲坑；近战弱 | 冲脸 |
| **猎杀者 stalker** | 新 | 细长四足，光学迷彩 | 不走正面；始终寻找玩家视野外的接近路线，背后 4m 内扑击 40 伤害；移动时有折射扭曲轮廓，扫描（T）可标记 6s | 听脚步、扫描、背靠墙 |

设计意图：每种敌人回答一个问题——「玩家此刻最想做的事是什么，这个敌人怎样让它变得不安全」。蹲坑→投弹手/蛛雷；只盯正面→猎杀者/侧翼手；慢慢磨血→工蜂；堵门口→盾卫。

**实现**：敌人定义为数据 + 组合：

```jsonc
// packages/data/enemies/lobber.json
{ "id": "lobber", "rig": "biped_lobber", "hp": 160, "speed": { "walk": 1.8, "run": 3.4 },
  "sense": { "interval": 0.14, "sightRange": 50, "fovDeg": 160, "hearMul": 1 },
  "range": { "ideal": 24, "width": 9, "min": 12 },
  "weapons": [ { "kind": "lob", "damage": 55, "radius": 4.2, "flight": 2.2, "cooldown": [4.5, 6], "telegraph": 0.8, "needsLOS": false } ],
  "hit": { "zones": [ { "id": "body", "mul": 1 }, { "id": "tube", "mul": 2.2, "weak": true, "onDestroy": "disarm" } ] },
  "utility": { "holdAndFire": 1.1, "advance": 0.2, "flank": 0, "retreat": 1.3, "flush": 0 },
  "roleDefault": "anchor", "threat": 3.0, "credits": 40, "nameKey": "enemy.lobber.name" }
```

对象池按 rig 分池并改为按需扩容（上限由导演的 `maxAlive` 与性能预算决定，目标同屏 16–20）。新机体在 V34 先用程序化体块 rig（多骨、程序动画），V35 换成蒙皮模型（WP35-5）；因此本包只交付 `sim` 行为 + 临时 rig。

**DoD**：11 种敌人各有靶场展示关与单测；每种敌人有独特的轮廓、预警信号（光/声）与击杀播报；「兵种图鉴」界面（首次击杀解锁条目：行为、弱点、克制提示）。

### WP34-4 节奏导演与难度（1 周）

取代「每切一个中继刷一波固定表」。导演维护一个**强度值**并在「铺垫 → 升压 → 高潮 → 喘息」之间循环。

```js
// packages/sim/director.js
// 强度 I∈[0,1]：受伤 +dmg/100*0.9；近处(≤8m)有敌 +0.15/s；击杀近处敌人 +0.08；其余时间每秒 -0.06（喘息期 -0.12）
function step(dir, h) {
  updateIntensity(dir, h);
  switch (dir.phase) {
    case 'buildup': if (aliveThreat(dir) < dir.budget * 0.5) spawnSquad(dir, pickSquad(dir, dir.budget * 0.5));
                    if (dir.I > 0.7 || dir.phaseT > dir.cfg.buildupMax) enter(dir, 'peak'); break;
    case 'peak':    if (dir.phaseT < dir.cfg.peakTime && aliveThreat(dir) < dir.budget) spawnSquad(dir, pickSquad(dir, dir.budget - aliveThreat(dir)));
                    if (dir.phaseT >= dir.cfg.peakTime) enter(dir, 'relax'); break;
    case 'relax':   /* 不生成；残敌士气下降倾向撤退；检查点；拾取物补给概率上调 */
                    if (dir.phaseT > dir.cfg.relaxTime && dir.I < 0.25) enter(dir, 'buildup'); break;
  }
  // 任务脚本可强制：director.force('peak', {budget: 14}) / director.hold()（剧情段落不刷怪）
}
// 威胁预算：每个敌人有 threat 值（蛛雷 0.4、猎犬 1、盾卫 3、投弹手 3、猎杀者 2.5…）
// budget = mission.baseBudget * difficulty.budgetMul * (1 + 0.15 * 已完成目标数)
// pickSquad：从 mission.squadTemplates 里按权重抽，约束：不连续两次同模板；玩家低血时避开高爆发模板；
//            出生点选择沿用 V31 评分（距离、对玩家不可见、6s 复用惩罚），外加「优先玩家没在看的方向」
// 自适应补给：玩家血量 <35 且无医疗包超过 20s → 下一个被击杀的敌人掉落小型修复包（每关上限 3 次，噩梦难度关闭）
```

**难度重做**（G5）：四档不再只改两个倍率。

| 参数 | 新兵 | 标准 | 老兵 | 噩梦 |
| --- | --- | --- | --- | --- |
| 敌人伤害 / 血量 | 0.7 / 0.9 | 1 / 1 | 1.25 / 1.1 | 1.5 / 1.2 |
| 威胁预算 | 0.8 | 1 | 1.2 | 1.4 |
| 瞄准误差 / 首发惩罚时长 | ×1.5 / 0.55s | ×1 / 0.35s | ×0.8 / 0.25s | ×0.65 / 0.15s |
| 察觉速度 | ×0.7 | ×1 | ×1.2 | ×1.5 |
| 侧翼/投掷令牌 | 1 / 0 | 1 / 1 | 2 / 1 | 2 / 2 |
| 预警时长 | ×1.25 | ×1 | ×0.9 | ×0.8 |
| 回血 | 4s 后 25/s 至满 | 至 60 | 至 40 | 无 |
| 信用点倍率 | 0.8 | 1 | 1.3 | 1.6 |

噩梦不是「血更厚」而是「更聪明、更不留情」——血量倍率反而从 V31 的 1.35 降到 1.2，避免海绵感。修复 m6 BOSS 血量绕过难度的问题（`boss.js:49`）：`bossHp` 作为基础值再乘难度。

**DoD**：导演单测（强度曲线、阶段转换、预算不超）；每关记录一条「强度—时间」曲线并在调试面板可视；机器人各难度通关时长落在设计区间。

### WP34-5 BOSS 重做（2 周）

原则：独立轮廓、每阶段改变场地或规则、每个招式都有可读预警和明确应对、弱点需要用到本作的工具（EMP、探身、翻越、扫描）。BOSS 是脚本化状态机（不是效用 AI），招式表为数据。

**BOSS 一「港区主控 · 蜃」（m3）——龙门吊上的主控核心**

不再是大号猎犬。蜃是挂在龙门吊小车上的装甲核心，沿吊臂横移，玩家在堆场里与它周旋。

| 阶段 | 血量 | 机制 |
| --- | --- | --- |
| 一「扫描」 | 100–66% | 核心沿吊臂移动，探照光束扫过堆场（地面光斑 = 危险区，被照到 1.2s 后机炮扫射）。弱点：核心下方冷却口，仅在机炮开火后的 3s 过热窗口打开。玩家要借集装箱躲光束、等窗口 |
| 二「吊装」 | 66–33% | 吊机开始抓取集装箱砸向玩家位置（地面阴影预警 1.5s，落点变成新掩体/新高台——场地被改写）。召唤蛛雷群。弱点新增：两侧供电臂，EMP 命中可让核心下降到 4m 高度 6s（近距离输出窗口） |
| 三「过载」 | 33–0% | 核心脱离吊臂落地，变为六足行走形态（独立模型部件展开），冲撞 + 环形冲击波（需跳/翻越上集装箱躲避）+ 追踪导弹（可被击落）。背部核心外露，但只有绕后或让它撞墙眩晕 2.5s 才能稳定输出 |

**BOSS 二「蜃 · 终形」（m8 终章）——货轮反应堆舱里的本体**

场地是 `core` 地图的单机改版（让这张图在战役里出场，G11）。本体是中央反应堆柱，不可移动；战斗是「场地解谜 + 生存」。

| 阶段 | 机制 |
| --- | --- |
| 一「防壁」 | 反应堆有旋转能量护壁，四条冷却回路各有一个阀门（按住 F 2.4s 关闭，期间需队友/自己清场）。每关一个阀门，护壁出现一个缺口并随护壁旋转——只能从缺口打到核心。敌人持续增援（导演 `force('peak')`） |
| 二「镜像」 | 蜃在天桥上投射 3 个全息分身（外观与猎杀者相同），只有一个是真的（扫描 T 可分辨，或观察谁有影子/脚步声）。打错会被反击。击破真身 3 次进入下一阶段 |
| 三「坍缩」 | 反应堆失稳：地面分区轮流带电（预警 2s），安全区不断缩小并向天桥转移；核心完全暴露但会发射贯穿全场的旋转光束（需蹲/跳/借柱子）。限时 150s，超时全场爆炸 |

击破后接结局选择。两个结局在 V35 获得不同的终幕关卡段落（WP35-9）。

```js
// packages/sim/boss/boss.js —— 通用框架
// def = { phases:[{ until:0.66, onEnter:[…动作], moves:[{id, weight, cooldown, cond}], vulnerable:{…} }], moves:{ id:{ telegraph, exec, recover } } }
function stepBoss(b, h, ctx) {
  const ph = b.def.phases[b.phase];
  if (b.hp / b.maxHp <= ph.until && !b.transitioning) return beginTransition(b, ctx);   // 转阶段：无敌 2s + 演出 + 场地事件
  if (b.move) {
    b.moveT += h; const m = b.def.moves[b.move];
    if (b.stage === 'telegraph' && b.moveT >= m.telegraph.time) { b.stage = 'exec'; b.moveT = 0; m.exec.start(b, ctx); }
    else if (b.stage === 'exec') { if (m.exec.step(b, ctx, h) === 'done') { b.stage = 'recover'; b.moveT = 0; } }
    else if (b.stage === 'recover' && b.moveT >= m.recover) { b.cool[b.move] = m.cooldown; b.move = null; }
    if (b.interruptible && b.stunned) cancelMove(b);         // EMP / 撞墙
    return;
  }
  const options = ph.moves.filter(mv => !(b.cool[mv.id] > 0) && (!mv.cond || mv.cond(b, ctx)));
  const pick = weightedPick(options, ctx.rng, { avoidRepeat: b.lastMove });
  if (pick) { b.move = pick.id; b.stage = 'telegraph'; b.moveT = 0; b.lastMove = pick.id; ctx.events.push({ type: 'boss:telegraph', move: pick.id }); }
}
// 预警规范（所有招式必须满足）：≥0.6s；同时有 视觉（地面标记/发光/姿态）+ 听觉（专属音效）两个通道；危险区用统一的橙红色语言
```

BOSS 血条重做：分段显示阶段、弱点开放时高亮、无敌时变灰并显示原因图标（「护壁」「转阶段」）。BOSS 音乐在生成时进入（已在 WP32-0 修复），V35 做阶段分层。

**DoD**：两场 BOSS 各有独立 rig（V34 可为程序化多部件体，V35 换模型）；招式预警规范自动检查（数据校验：`telegraph.time >= 0.6` 且声画通道齐全）；机器人不依赖作弊在标准难度击破；试玩项「死的时候知道自己为什么死」≥ 4/5。

### WP34-6 任务目标图与八关战役（2.5 周）

**目标系统**：任务是一张由「目标节点」和「触发器」组成的图，取代写死在状态机里的「中继 → 坚守 → 撤离」。

```jsonc
// packages/data/missions/m2.json（节选）
{ "id": "m2", "map": "harbor", "envKey": "storm", "start": "spawn_shed_inside",
  "director": { "baseBudget": 6, "squadTemplates": ["hound3", "hound2_mender", "skitter8", "heavy_lobber"] },
  "objectives": [
    { "id": "o1", "type": "reach",    "at": "trig_east_door",  "textKey": "m2.o1" },
    { "id": "o2", "type": "interact", "at": ["relay_w", "relay_e"], "hold": 2.4, "requires": ["o1"], "any": false, "textKey": "m2.o2" },
    { "id": "o3", "type": "escort",   "actor": "loader_bot", "path": "path_loader", "requires": ["o2"], "failIf": "actor_dead", "textKey": "m2.o3" },
    { "id": "o4", "type": "defend",   "zone": "zone_dock", "time": 60, "requires": ["o3"], "director": { "force": "peak", "budget": 10 } },
    { "id": "o5", "type": "extract",  "at": "extract_gate", "requires": ["o4"] },
    { "id": "s1", "type": "collect",  "items": "intel", "count": 3, "optional": true, "reward": { "credits": 150 } }
  ],
  "events": [
    { "on": "objective:start:o3", "do": [ ["radio", "m2.loader_go"], ["spawn", "squad_ambush", "sp_roof"], ["door", "shutter_2", "open"] ] },
    { "on": "trigger:enter:trig_cold_room", "once": true, "do": [ ["director", "hold", 8], ["radio", "m2.quiet"], ["lights", "zone_cold", "off"] ] }
  ] }
```

目标类型（每种是一个带 `start/step/isDone/isFailed/hud` 的小模块）：

| 类型 | 说明 | HUD |
| --- | --- | --- |
| `reach` | 到达区域 | 标记 + 距离 |
| `interact` | 按住交互若干秒（原「切中继」的泛化），可多点、可任意顺序 | 进度环、n/N |
| `destroy` | 摧毁指定目标（发电机、天线、弹药堆），目标有血条 | 目标血条 |
| `eliminate` | 击杀指定敌人/清空区域 | 剩余数 |
| `defend` | 守住区域/物体若干秒，物体有耐久 | 计时 + 耐久条 |
| `escort` | 护送沿路径移动的友方单位（停下修复：靠近按 F） | 友方血条 + 路径 |
| `collect` | 收集散落物（情报、电池），可为可选目标 | n/N |
| `carry` | 把物体从 A 搬到 B（搬运时只能用副武器、不能冲刺） | 携带图标 |
| `survive` / `timer` | 存活到计时结束 / 限时完成 | 倒计时 |
| `stealth` | 在未被完全察觉（察觉度未满）前完成子目标；被发现则转为强攻分支，不失败 | 察觉弧 |
| `boss` | BOSS 战 | BOSS 血条 |
| `extract` | 到达撤离点，可带坚守 | 标记 |

```js
// packages/sim/objectives.js
function step(graph, ctx, h) {
  for (const o of graph.active) {
    TYPES[o.type].step(o, ctx, h);
    if (TYPES[o.type].isFailed?.(o, ctx)) return ctx.events.push({ type: 'mission:failed', reason: o.id });
    if (TYPES[o.type].isDone(o, ctx)) complete(graph, o, ctx);
  }
}
function complete(graph, o, ctx) {
  o.state = 'done'; ctx.events.push({ type: 'objective:done', id: o.id });
  ctx.checkpoint.save('objective:' + o.id);                               // WP34-7
  for (const n of graph.nodes) if (n.state === 'locked' && n.requires.every(id => graph.byId[id].state === 'done')) {
    n.state = 'active'; TYPES[n.type].start(n, ctx); ctx.events.push({ type: 'objective:start', id: n.id });
  }
  if (graph.nodes.filter(n => !n.optional).every(n => n.state === 'done')) ctx.events.push({ type: 'mission:complete' });
}
// 触发器：map.triggers 的体积盒；events 的动作表是一个小型命令解释器（radio/spawn/door/lights/director/fx/camera/objective/wait）。
// 任务校验（构建期）：引用的点位/触发器/小队模板都存在；目标图无环、从起点可达全部必需节点；每个 at 点通过 WP32-6 的可达性校验。
```

关卡需要的新场景交互物：可开关的门/卷帘（改变导航与视线，导航增量重建）、可破坏掩体（木箱/油桶，油桶爆炸）、电闸（关灯：敌人察觉速度 ×0.6，玩家需靠扫描/枪口焰）、弹药/医疗补给站、可骇入炮台。

**八关设计**

| 关 | 地图 | 主机制（本关独有） | 目标链 | 首次登场 |
| --- | --- | --- | --- | --- |
| 01 四号泊位 | 港区·黄昏 | 教学式开局：前 90 秒可潜行（察觉弧教学），第一处中继可悄悄切 | stealth→interact×3→defend 45s→extract | 飞鸦、猎犬 |
| 02 二号仓库 | 港区·暴雨 | **护送**：启动一台装卸机器人撞开东门封锁；雷暴闪电瞬间照亮/暴露位置 | reach→interact×2→escort→defend→extract | 蛛雷、工蜂 |
| 03 北码头 | 港区·黎明 | **BOSS 蜃**（龙门吊）；战前要摧毁 3 座供电天线削弱其一阶段 | destroy×3→boss→survive 25s→extract | 炮台、盾卫 |
| 04 冷链仓库 | 冷库 | **断电**：关总闸后全场黑暗 + 冷雾，敌人靠热成像（玩家蹲着不动时察觉更慢）；搬运冷却剂罐 | reach→interact(总闸)→carry×2→defend→extract | 猎杀者 |
| 05 外锚地 | 货轮甲板·夜 | **限时**：货轮在倾斜下沉（表现为甲板分区逐个被海水淹没 = 可活动区域缩小），10 分钟内完成 | timer{ interact×3 → destroy(舵机) }→extract(救生艇) | 投弹手、狙击编组 |
| 06 货舱深处（新） | 货轮内舱（新图 `hold`） | **垂直 CQB**：三层货舱，自上而下；大量翻越/滑铲路线；收集 3 份航行日志揭示剧情 | reach→collect×3→eliminate(精英小队)→reach | 精英小队长 |
| 07 归途 | 港区·破晓（反向） | **防守战**：守住接驳点三波，可在波次间用信用点在补给站购买炮台/地雷/弹药（本关内的小型塔防） | reach→defend 波次×3→reach | 全兵种混编 |
| 08 蜃·终形（新） | 核心舱（单机版） | **终章 BOSS**（三阶段） | reach→boss→选择结局 | — |

原 m6「归途 + 终形」拆为 07 与 08；原 `core` 地图和炮台都进入战役。训练场保留并入靶场。每关时长目标 10–15 分钟，全战役约 100 分钟首通。

新图 `hold`（货舱）在本版本先交付「灰盒 + 完整玩法数据」，美术在 V35（WP35-6）完成。灰盒标准：碰撞/导航/掩体/触发器/点位全部定稿并通过校验，可视部分用现有材质的体块。

**DoD**：8 关数据通过任务校验；每关机器人通关；每关「强度曲线」评审通过（至少两次高潮、高潮间有 ≥ 40s 喘息）；目标类型各有单测；旧 `G.game.flow` 的波次表与 `evac/bossAlive` 标志删除。

### WP34-7 持久化检查点（0.5 周）

检查点（G12）在每个必需目标完成时写入存档，关闭页面后可「继续行动」。

```js
// 检查点内容（全部是 sim 状态，可 JSON 序列化）
{ missionId, tick, seed, rngState,                 // 命名随机流各自的状态
  player: { pos, yaw, hp, armor, weapons: [{ id, ammo, reserve, attachments }], throwables, slot },
  objectives: { [id]: { state, progress } }, firedEvents: [..], doors: {..}, destroyed: [..], pickupsTaken: [..],
  director: { phase, I, spawnedSquads }, stats: { time, shots, hits, kills, headKills, damageTaken, retries },
  actors: [{ id, kind, pos, hp }] }                // 护送对象、已骇入炮台等持久单位
// 不保存存活的普通敌人：读档时清场，导演回到 relax 阶段并在 6s 后恢复 —— 避免「读档即被围」
// 读档时玩家血量下限 45、护甲下限 25、每种投掷物下限 1（沿用 V31 的宽容规则），并计一次 retry
```

标题页出现「继续：行动 0X · <目标名>」；手动「重新开始行动」清除检查点。BOSS 战的检查点在每个阶段转换处（噩梦难度只有战前一个）。

**DoD**：每关任取 3 个检查点做「存 → 刷新页面 → 读 → 机器人通关」；存档体积 < 8KB/检查点。

### WP34-8 成长、评级、挑战与成就（1.5 周）

**信用点**（唯一货币，只能游戏内获得，无任何付费设计）

| 来源 | 数量 |
| --- | --- |
| 击杀 | 按敌人 `credits`（猎犬 15、盾卫 45、猎杀者 40、BOSS 600…），爆头/弱点击杀 +30% |
| 必需目标 / 可选目标 | 100 / 150–250 |
| 通关 | 400 × 评级系数（D 0.6 … S 1.5）× 难度系数 |
| 挑战首次完成 | 200–500 |
| 每日/每周行动（V36 联机后也适用） | 300 / 1200 |

**消费**：解锁武器（蜂刺 1200、长夜 2200、长眼 1500；九式/破门锤/短讯初始拥有）、配件（200–900，按强度）、投掷物上限、涂装与准星/挂件（纯外观）。配件从每槽 3 个扩到每槽 5 个，并新增「枪托」「握把」两个槽——**每个配件必须有代价**（例：长枪管 +射程 −开镜速度），不存在纯升级，保证配装是选择而不是进度条。完整表见附录 B。

V31 老档迁移：已有通关进度的玩家按进度补发信用点（每关 800）并保留当前已装配件的所有权，避免「更新后东西被锁」。

**评级重做**（G4）：五项各 0–100，加权总分映射 D/C/B/A/S；阈值是每关数据。

```js
// packages/sim/rating.js
export function rate(stats, m, diff) {
  const time   = score01(stats.time, m.par.time * 1.6, m.par.time * 0.8);        // 标准时间由设计给出，每关不同
  const acc    = score01(stats.hits / Math.max(1, stats.shots), 0.2, 0.55);
  const lethal = score01(stats.weakKills / Math.max(1, stats.kills), 0.1, 0.5);
  const surv   = score01(stats.damageTaken, m.par.damage * 2, m.par.damage * 0.5) * (stats.retries ? Math.pow(0.8, stats.retries) : 1);
  const obj    = stats.optionalDone / Math.max(1, m.optionalCount);
  const total = (time * 0.25 + acc * 0.2 + lethal * 0.15 + surv * 0.25 + obj * 0.15) * 100;
  const grade = total >= 90 ? 'S' : total >= 75 ? 'A' : total >= 60 ? 'B' : total >= 40 ? 'C' : 'D';
  return { total, grade, parts: { time, acc, lethal, surv, obj }, diff };        // 最佳记录按难度分别保存
}
```

结算页展示五项雷达图与「距下一级差什么」的一句话建议。最佳记录的替换规则改为「总分更高」（V31 是「时间更短」，`campaign.js:726`）。

**挑战**：每关 3 项固定挑战扩为 5 项（限时、爆头数、无死亡 + 两项关卡专属，如「m4 全程不被完全察觉」「m3 一阶段不被光束照到」）；另有全局的武器精通（每把枪 击杀数/爆头数/远距击杀 三条线，各 3 档，奖励该武器的涂装与一个专属配件）。

**变异条件**（重玩核心）：通关后解锁「变异行动」——任选已通关关卡 + 1–3 个变异条件，信用点倍率叠加。

| 变异 | 效果 | 倍率 |
| --- | --- | --- |
| 铁人 | 无检查点 | +40% |
| 弹药紧缺 | 备弹 ×0.5，拾取物减半 | +25% |
| 蜂群 | 威胁预算 ×1.3，蛛雷/无人机权重 ×3 | +30% |
| 精英编队 | 每个小队带一名小队长 | +30% |
| 玻璃大炮 | 双方伤害 ×2 | +20% |
| 无 HUD | 隐藏除字幕外的全部 HUD | +20% |
| 单枪 | 只能带一把主武器，无副武器 | +15% |
| 浓雾 | 可视距离 25m，敌人察觉 ×0.7 | +10% |

每周自动生成一组「周行动」（关卡 + 变异 + 指定武器类型，种子 = 年周数），本地排行榜（V36 接入在线）。

**成就**：40 个，分 战役 / 武器 / 敌人 / 技巧 / 收集 / 隐藏 六类；本地存储，触发时右上角提示；成就页显示进度条。统计项（`save.stats`）是成就与精通的共同数据源，由事件驱动累加，单测覆盖每个成就的判定函数。

**DoD**：经济模拟脚本（`tools/sim_economy.mjs`：按机器人各关表现估算收入曲线）输出满足退出标准的解锁节奏；评级单测（各项边界、难度分档保存）；老档迁移 e2e；变异条件各有一个冒烟用例。

### V34 排期

| 周 | 程序 A（AI） | 程序 B（关卡/系统） | 策划 |
| --- | --- | --- | --- |
| 1 | WP34-1 感知/黑板/调试叠加 | WP34-6 目标图框架 + 触发器 | 八关纸面设计、兵种表 |
| 2 | WP34-1 效用 + 行为树 + 导航升级 | WP34-6 目标类型 + 交互物 | 01–03 关数据 |
| 3 | WP34-2 掩体 | WP34-4 导演/难度、WP34-7 检查点 | 04–05 关数据 |
| 4 | WP34-3 小队 + 旧兵种迁移 | WP34-6 01–05 关落地 | 经济表、评级标准时间 |
| 5 | WP34-3 四种新机体 | WP34-6 06–07 关 + `hold` 灰盒 | BOSS 招式表 |
| 6 | WP34-5 BOSS 框架 + 蜃 | WP34-8 经济/评级/挑战 | 变异条件、成就清单 |
| 7 | WP34-5 终形 + 08 关 | WP34-8 成就/精通/界面 | 全关强度曲线评审 |
| 8 | 调优、性能、回归 | 机器人通关全矩阵、迁移测试 | 试玩与数值修正 |

---

## 6. V35「世界」：视听表现与界面

**版本目标**：让画面、动画、声音、界面的品质追上 V33/V34 建立的玩法。本版本起采用双发行：`lite`（单文件、全程序化）与 `full`（单页 + 资产包）。所有渲染特性都必须挂在画质档上，并遵守附录 C 的性能预算。

**退出标准**

- 高画质档在参考机（见附录 C）1080p 稳定 60fps，中档在集显 1080p（动态分辨率下）≥ 45fps；
- 12 个固定机位 × 5 张图的「前后对比」截图评审通过（美术负责人签字）；
- 冷库、货轮、货舱三张图的画面评分追平港区（内部 1–5 评分差 ≤ 0.5）；
- 所有敌人与联机角色使用蒙皮骨骼动画（`full`）或多骨程序 rig（`lite`），无「缩腿猎犬」式的复用；
- 全部界面可用手柄/键盘/触屏操作；中英双语完整；色盲模式三种；
- `lite` 包 ≤ 3.2MB，`full` 首屏下载 ≤ 12MB、总计 ≤ 60MB，首次进入战斗无 > 100ms 的着色器编译卡顿。

### WP35-0 资产管线与双发行（1 周，先行）

```js
// src/engine/assets/registry.js
// 每个资产有 id、程序化回退 builder 和（可选）外部文件。玩法代码只按 id 取。
export const ASSETS = {
  'enemy.hound':  { kind: 'model', file: 'models/hound.glb',  fallback: () => buildHoundProcedural() },
  'weapon.pac9':  { kind: 'model', file: 'models/pac9.glb',   fallback: () => buildPac9Procedural() },
  'vo.m1.intro':  { kind: 'audio', file: 'vo/zh/m1_intro.opus', fallback: null },        // 无回退 = 只显示字幕
  'tex.concrete': { kind: 'pbr',   file: 'tex/concrete.ktx2', fallback: () => genPBR('concrete') },
};
export async function load(id) {
  const a = ASSETS[id];
  if (__BUILD__.target === 'lite' || !a.file) return a.fallback?.();
  try { return await loaders[a.kind](BASE + a.file); }
  catch (e) { errors.report(e, { asset: id }); return a.fallback?.(); }     // 资产缺失不致命
}
```

- 格式：模型 glTF 2.0（Draco 网格压缩 + KTX2/Basis 贴图），音频 Opus（语音 32kbps 单声道，音乐 96kbps 立体声）。
- 分包：`core`（界面、主角武器、通用敌人）+ 每张图一个包 + 每种语言语音一个包；进入关卡前在简报页后台预取，加载屏显示真实进度。
- Service Worker 缓存资产包，二次进入离线可玩。
- `tools/asset_check.mjs`：校验面数、贴图尺寸、骨骼数、命名、缺失回退，超预算则构建失败。

**资产规格**

| 类别 | 三角面 | 贴图 | 骨骼 | 备注 |
| --- | --- | --- | --- | --- |
| 第一人称武器 | 18–25k | 2048 ×(albedo/ORM/normal) | 12–20 | 含手臂 8k |
| 普通敌人 | 8–12k（LOD1 4k，LOD2 1.2k） | 1024 | 20–30 | 机械体，刚性蒙皮为主 |
| BOSS | 40–60k | 2×2048 | 50–70 | 分部件可拆 |
| 联机角色 | 14k（LOD1 6k，LOD2 2k） | 2048 | 45（人形标准骨架） | 队伍色用遮罩通道 |
| 场景模块件 | 200–3k / 件 | 图集 4096 共享 | — | 模块化，每图 60–100 件 |

**DoD**：`lite` 与 `full` 同一套测试全绿；断网/缺包情况下 `full` 回退到程序化资产且有一次性提示。

### WP35-1 阴影：级联阴影与逐帧更新策略（1 周）

替换「单张阴影图覆盖全图 + 隔帧刷新」（R1）和对 three 着色器片段的字符串替换（R7）。

- 3 级联（低档 2 级）：分割用实用分割法 `split_i = lerp(near·(far/near)^(i/N), near + (far−near)·i/N, 0.7)`，远端 90m；每级 2048（高）/1024（中）/768（低），打进一张图集。
- 稳定化：每级的正交投影按包围球拟合，并把光空间原点对齐到纹素网格，消除镜头移动时的阴影爬行。
- 更新频率：级联 0 每帧；级联 1 每 2 帧；级联 2 每 4 帧（静态几何缓存一份只含静态物体的深度，动态物体每帧叠加渲染）。
- 级联间 10% 距离的抖动混合；PCSS 只在级联 0 开启，其余用 3×3 PCF。
- 实现方式：不再 `replace` three 的 `shadowmap_pars_fragment`，改为通过 `material.onBeforeCompile` 注入一个自有的 `#include <saltline_shadow>` 片段，并在 `engine/render/shadows.js` 启动时做编译自检；自检失败回退 three 原生 PCF 并上报。
- 室内图（冷库/货舱/核心舱）没有太阳：改用最多 4 盏带阴影的聚光灯（每盏 1024，静态缓存 + 动态叠加），其余灯光烘焙进光照探针（WP35-3）。
- 第一人称枪模接收场景阴影但不投射到场景；另给枪模一盏跟随相机的弱补光（强度按场景平均亮度自适应），解决暗场景枪模糊成黑块的问题（R4）。

```js
function updateCascades(cam, sunDir, csm, frame) {
  for (let i = 0; i < csm.count; i++) {
    if (frame % csm.interval[i] && !csm.dirty[i]) continue;
    const sphere = boundingSphereOfFrustumSlice(cam, csm.split[i], csm.split[i + 1]);
    const texel = (sphere.radius * 2) / csm.size[i];
    const c = toLightSpace(sphere.center, sunDir);
    c.x = Math.floor(c.x / texel) * texel; c.y = Math.floor(c.y / texel) * texel;      // 纹素对齐
    setOrtho(csm.cam[i], fromLightSpace(c, sunDir), sphere.radius, sunDir);
    if (csm.staticDirty[i]) renderDepth(csm.staticRT[i], STATIC_LAYER, csm.cam[i]);
    blit(csm.staticRT[i], csm.atlasViewport[i]); renderDepth(csm.atlas, DYNAMIC_LAYER, csm.cam[i], { clear: false });
  }
}
```

**DoD**：港区远处集装箱阴影边缘清晰且镜头平移无闪烁（录屏对比）；阴影总耗时 高档 ≤ 2.5ms；three 升级自检测试存在。

### WP35-2 时域抗锯齿与时域累积（1.5 周）

- 渲染运动矢量：G 缓冲附加一张 RG16F 速度图（静态物体由相机重投影算出，蒙皮/动态物体在顶点着色器输出上一帧位置）。
- TAA：Halton(2,3) 8 样本亚像素抖动；历史重投影 + YCoCg 邻域方差裁剪（γ=1.25）；速度大或深度不连续处降低历史权重；输出后做一次轻锐化（替代现有 0.3 sharpen）。
- 第一人称枪模层单独处理：它的运动矢量按视模相机计算，否则会拖影。
- 有了历史缓冲之后：AO 降为每帧 4 采样 + 时域累积（质量高于现在的 16 采样）；体积雾每帧 8 步 + 抖动起点 + 累积；这两项省下的时间用来支付 TAA。
- 动态分辨率改为 TAA 上采样（TAAU）：内部分辨率 60–100%，输出始终是原生分辨率，文字与 HUD 不糊。
- 画质档：低 = FXAA（保持现状）；中 = TAA；高/超高 = TAAU + 累积式 AO/体积雾。「减少动态」模式下抖动幅度减半并关闭运动模糊。

```glsl
// post/taa.frag.glsl（核心）
vec2 vel = texture(uVelocity, closestDepthUV(vUv)).xy;          // 取 3×3 最近深度处的速度，改善边缘
vec3 hist = toYCoCg(sampleCatmullRom(uHistory, vUv - vel));
vec3 m1 = vec3(0.), m2 = vec3(0.);
for (int i = 0; i < 9; i++) { vec3 c = toYCoCg(texelFetchOffset9(uCurrent, vUv, i)); m1 += c; m2 += c * c; }
vec3 mu = m1 / 9., sigma = sqrt(max(m2 / 9. - mu * mu, 0.));
hist = clipAABB(mu - 1.25 * sigma, mu + 1.25 * sigma, hist);
float w = mix(0.9, 0.6, clamp(length(vel) * uVelScale, 0., 1.));   // 运动越大历史越少
w *= offscreen(vUv - vel) ? 0. : 1.;
outColor = fromYCoCg(mix(toYCoCg(cur), hist, w));
```

**DoD**：铁丝网/栏杆/远处吊臂的闪烁消失（固定机位录屏）；快速转身无明显拖影；TAA 全链路 ≤ 1.2ms（1080p 高档）。

### WP35-3 间接光与反射（1.5 周）

- **反射探针**：读取 `map.probes`（每图 6–14 个，带影响盒），加载关卡时逐个渲染 128px 立方图并 PMREM 预滤波，打进一张立方图数组；材质按像素位置选最近两个探针混合，并做盒投影校正（室内反射不再「滑动」）。取代写死的 `interiorBoxes[0]` 单探针（R3）。
- **漫反射光照探针**：每图一个稀疏网格（4m 间距，室内 2m），每个探针存 L1 球谐（4 系数 ×RGB），加载时由探针立方图积分得到；动态物体（敌人、枪模、拾取物）按位置三线性插值取环境光——敌人走进阴影会变暗，走到应急红灯下会泛红。
- **静态几何光照**：`full` 发行附带离线烘焙的光照贴图（工具：`tools/bake_lightmap.mjs`，无头渲染器路径追踪 64spp + 降噪，每图一张 2048 图集）；`lite` 用探针网格 + AO 近似。
- **屏幕空间反射**（高/超高档）：半分辨率，层级深度步进最多 24 步，粗糙度 > 0.5 的像素跳过，结果进入 TAA 历史去噪；失败处回退到探针。湿地面、冷库金属地板、货轮甲板积水是主要受益面。地面原有的平面反射保留给超高档的港区水洼。
- **接触阴影**：对太阳做 8 步屏幕空间短射线，补级联阴影的细节缺失（枪模、小道具贴地感）。

**DoD**：室内关卡不再「全局发灰或全黑」；探针烘焙时间每图 ≤ 1.5s（加载屏内完成）；SSR ≤ 1.5ms。

### WP35-4 第一人称表现：武器模型、瞄具与动作（1.5 周）

- 六把武器换为 glTF 模型（规格见 WP35-0），`lite` 保留程序化模型但补倒角、螺丝、防滑纹的法线细节。
- 动画：关键帧动画片段（举枪、收枪、开火、战术/空仓换弹各阶段、检视、冲刺、翻越、近战、投掷）+ 现有 9 弹簧程序层叠加。片段时间轴与 WP33-3 的换弹阶段事件对齐：导出工具读取片段里的事件标记，校验与武器 JSON 的 `stages[].at` 误差 < 1 帧。
- **真实瞄具**（R8）：
  - 红点/全息：镜片上的准星是「无限远虚像」着色器——按视线方向采样准星贴图，眼位偏移时准星在镜框内相应移动，不再是贴在镜片上的贴纸。
  - 高倍镜（长眼 3×/4.5×）：镜内画面用渲染到纹理的第二相机（分辨率 = 屏幕的 50%，只在 ADS > 0.5 时渲染，更新 30Hz），镜筒外缘保持模糊的周边视野，取代全屏 DOM 遮罩；低画质档保留 DOM 遮罩回退。
  - 景深：ADS 时近处枪身轻微虚化（用 `focusDist` 这个现成但未使用的字段，圆形散景 6 采样，仅高档）。
- 手臂与手套模型、换弹时可见的弹匣实体（丢弃的弹匣落地并保留 10 秒）。
- 枪口焰改为 4 帧翻页贴图 + 点光闪烁 + 短暂镜头曝光抬升；持续射击时枪管热扭曲和烟雾。
- 检视武器（长按 R 且满弹）展示配件与涂装——成长系统的展示出口。

**DoD**：每把枪 12 个动画片段齐全且事件对齐校验通过；瞄具在 21:9 与 4:3 下不穿帮；枪模渲染 ≤ 0.8ms。

### WP35-5 角色与敌人：骨骼动画、解体与布娃娃（2 周）

**动画系统**（`src/engine/anim/`）

```js
// 每个角色一个 Animator：分层状态机 + 混合树 + 程序叠加
const houndAnimator = {
  layers: [
    { name: 'locomotion', mask: 'full', tree: blend2D('speed', 'turn', { idle, walk, trot, run, turnL, turnR, strafeL, strafeR }) },
    { name: 'upper',      mask: 'turret', states: { idle, aim: additiveAim('pitch', 'yaw'), fire, reload, flinch }, weight: 1 },
    { name: 'reaction',   mask: 'full',  states: { none, hitFront, hitBack, hitLeft, hitRight, stagger, emp }, additive: true },
  ],
  procedural: [ footIK({ legs: 4, rayLen: 0.6 }), lookAt({ bone: 'head', maxDeg: 70 }), lean({ byAccel: 0.15 }) ],
};
// sim 只输出：速度、朝向、瞄准角、意图/动作事件；Animator 在表现帧消费。动画不反向影响 sim（根运动关闭，位移完全由 sim 决定）。
// 脚步滑动控制：混合树的播放速率 = 实际速度 / 片段标称速度。
```

- 足部 IK：每条腿向下射线找地面，两骨解析 IK 修正落脚点（楼梯、集装箱边缘不再悬空）。机械多足的步态用程序化步态生成器（按速度决定迈步相位），蛛雷/蜃三阶段的六足全靠它，不需要逐帧动画。
- 受击反应：按命中方向播放叠加动画；被命中的装甲板做弹簧位移；累计伤害到阈值时部件脱落（盾卫的盾、投弹手的发射筒、炮台装甲板——与 WP34-3 的 `hit.zones.onDestroy` 对接）。
- **死亡**：机械敌人用「解体式死亡」而非人形布娃娃——死亡瞬间把模型按预切分的 6–10 个部件转为刚体碎片（简化刚体：盒形碰撞、对静态世界的冲量解算、最多 3 次弹跳后休眠），核心处放电 + 烟雾，残骸保留 20 秒后沉入地面。同屏碎片上限 80，超出回收最旧的。
- **联机/友军人形角色**（R5）：标准 45 骨骼人形，动画集：8 向移动（走/跑/蹲走）、跳/落、滑铲、翻越、探身、6 把武器的上半身持枪/开火/换弹叠加、投掷、近战、受击、死亡（4 方向 → 转布娃娃）。布娃娃用 11 刚体 + 锥形/铰链约束的简化 Verlet 解算，仅表现层，联机中各客户端各自模拟（不同步）。上半身瞄准俯仰用脊柱三骨分摊。
- LOD：每个角色三级网格，按屏幕占比切换；> 40m 的角色动画更新降到 15Hz，屏幕外只推进时间不求值。
- `lite` 发行：同一套 Animator 驱动程序化多骨 rig（刚性分段，无蒙皮），动画片段以 JSON 关键帧内联（每个片段 < 2KB，通用机体共用）。

**DoD**：11 种敌人 + 2 个 BOSS + 人形角色全部接入；16 个敌人同屏时动画总耗时 ≤ 1.5ms；炮台不再是缩腿猎犬；联机角色不再是方块人（截图对比）。

### WP35-6 关卡美术重做：冷库、货轮、货舱、核心舱（2.5 周）

港区是标杆。其余四张图按同一流程重做，玩法数据（碰撞/掩体/点位）不动或只做小调整并重新过校验。

**每张图的美术检查表**

1. **构图与地标**：每张图 3 个从任意位置都能辨认方位的地标（冷库：巨型制冷机组、红色装卸口、二层控制室；货轮：桥楼、吊机、船首锚机；货舱：中央升降井、破损舱壁的进水口、底层龙骨灯带）。
2. **光照叙事**：主光 + 引导光 + 危险光三层。目标方向永远比背后更亮或有色彩对比；敌人出生方向用冷/暖色区分。冷库现状偏暗（截图 `v15_depot.png`）：曝光基准抬高 0.6 档，加顶灯体积光柱与地面冷雾反光。
3. **模块件与细节密度**：近景每 2m 至少一个中等细节（管线、标牌、线缆、货物），远景用大块剪影；货轮甲板现状过空（截图 `v18_ship.png`）：加舱盖、绑扎桥、集装箱堆、缆桩、积水、摇晃的吊灯、驾驶台内景。
4. **贴花层**：污渍、水渍、轮胎印、警示线、编号喷字（每图 150–300 个，合批为一张图集的实例化四边形）。
5. **动态元素**：风扇、摇晃吊钩、闪烁故障灯、冷凝滴水、飘动的塑料帘、货轮的缓慢横摇（相机地平线 ±1.2°，周期 9s，可在减少动态中关闭）。
6. **天气与大气**：货轮暴雨夜加闪电（照亮 0.15s + 2–5s 后雷声）、海浪拍舷的水雾粒子；冷库加呼吸白气和枪口热气；货舱下层有齐踝积水（脚步水花、反射）。
7. **可读性校验**：敌人轮廓在所有背景上的对比度抽样（工具：在 40 个敌人可能出现的位置渲染纯色敌人剪影，计算与背景的亮度对比，< 1.6:1 的点位报警），避免「暗处的黑色敌人」。

**水体**：海面换为 FFT 近似的 4 层 Gerstner 波 + 屏幕空间折射/泡沫 + 探针反射；货轮舷边浪花。

**港区补强**：远景加城市天际线与航标灯；堆场加可破坏物；黄昏/暴雨/黎明/破晓四套环境各校一次色。

**DoD**：每张图过检查表并附前后对比图；draw call ≤ 450、三角面 ≤ 1.2M（高档）；轮廓对比度校验通过。

### WP35-7 渲染性能：实例化、LOD、遮挡剔除（1 周）

- 道具实例化：同种道具（托盘、桶、锥桶、集装箱）改为 `InstancedMesh`，按材质 + 网格合批；目标把港区 draw call 从当前水平再降 40%（先用 F3 面板记录基线）。
- 静态几何按 16m 网格分块合并（现在是整图按材质合并，无法剔除）：每块有包围盒，参与视锥剔除。
- 遮挡剔除：离线预计算「单元—单元可见性」（PVS）——导出器把地图划成 8m 单元，从每个单元采样 64 个视点向其他单元包围盒投射射线，得到可见集位图，写入 `.map.json`；运行时按相机所在单元隐藏不可见块与其中的动态物体。室内图收益最大。
- 取消约 20 处 `frustumCulled = false`（R6），改为给这些对象设置正确的包围体。
- 着色器预热：加载屏内对「材质 × 光照配置 × 阴影开关」的全部变体调用 `compileAsync`，并把程序二进制的键写入日志，消灭首战卡顿；F3 面板显示运行期新编译的着色器数量，CI 中该值必须为 0。
- 粒子与贴花改为 GPU 实例化的单一缓冲，按距离排序分桶；雨滴改为相机附近的体积内实例。

**DoD**：附录 C 的帧预算全部达标；`bench` 路径的 p99 帧时间较 V34 不退步。

### WP35-8 音乐与声音设计（1.5 周）

- **节拍对齐的分层音乐**：每个音乐状态（探索/紧张/交火/高潮/BOSS 各阶段/喘息）由 4–6 个同速同调的分层 stem 组成；状态切换只在小节线（或 2 拍处）发生，由调度器用 `AudioContext.currentTime` 精确排程；切换时插入一个「过渡乐句」（鼓过门/上行琶音）。强度直接取导演的 `I`（WP34-4），不再是「开枪后 8 秒」的计时器。
- 击杀/爆头/目标完成的提示音按当前调式量化到音阶音（听感上「融入」音乐）。
- `full` 发行用录制/制作的音乐 stem（规格：每关一个主题，110–140 BPM，stem 时长 8 或 16 小节，Opus）；`lite` 沿用程序化合成，但改为同一套分层/对齐引擎。
- 每个 BOSS 阶段一层配器递进；终章有完整的主题变奏；标题曲与片尾曲各一首。
- 环境声场：每张图 1 条立体声底噪 + 6–12 个定位点声源（机组、滴水、海鸥、远处汽笛、船体金属呻吟）+ 随机一次性事件。

```js
// src/engine/audio/music.js
function requestState(next) {
  if (next === cur || pending === next) return; pending = next;
  const bar = 60 / bpm * 4, now = ctx.currentTime;
  const at = startT + Math.ceil((now - startT + 0.05) / bar) * bar;     // 下一小节线
  playOneShot(TRANSITIONS[cur + '>' + next] ?? TRANSITIONS.default, at - bar * 0.5);
  for (const s of STEMS) s.gain.gain.setTargetAtTime(MIX[next][s.id] ?? 0, at, 0.35);
  scheduler.at(at, () => { cur = next; pending = null; });
}
```

**DoD**：任意时刻切换状态无错拍（自动化：记录切换时间戳，断言落在小节线 ±20ms）；试玩项「音乐是否跟着战况走」≥ 4/5。

### WP35-9 叙事表现：语音、过场与结局（1.5 周）

- **语音**：全部电台台词配音（约 220 句：指挥中心、小队频道、舵手、蜃）；`full` 附带中文语音包，英文语音包可选；`lite` 只有字幕 + 电台底噪。蜃的声线做机械化处理（环形调制 + 共振峰偏移），三阶段逐步失真。字幕带说话人颜色与方向指示（听障辅助）。敌方小队的「通讯音」（WP34-3）配短促的合成语音。
- **过场序列器**：时间轴数据驱动，轨道：相机（样条 + 注视目标 + FOV）、角色动画、灯光、音频、字幕、淡入淡出、慢动作；可跳过（按住任意键 0.8s）；跳过后状态与看完一致。

```jsonc
// packages/data/cinematics/m3_boss_intro.json
{ "id": "m3_boss_intro", "duration": 9.5, "letterbox": true, "skippable": true,
  "tracks": [
    { "type": "camera", "keys": [ { "t": 0, "pos": [8, 2, 4], "look": "boss.core", "fov": 50 }, { "t": 6, "pos": [2, 9, -3], "look": "boss.core", "fov": 38, "ease": "inOut" } ] },
    { "type": "actor", "target": "boss", "clips": [ { "t": 1.2, "clip": "awaken" } ] },
    { "type": "audio", "cues": [ { "t": 1.2, "id": "boss_awaken" }, { "t": 4.0, "vo": "radio.m3.boss_intro" } ] },
    { "type": "fx", "cues": [ { "t": 5.5, "do": ["lights", "zone_quay", "flicker"] } ] } ] }
```

- 每关开场 8–12 秒实时过场（替代纯文字 intro）、每个 BOSS 的登场与击破过场、关间 interlude 改为「带镜头的简报」（地图俯视 + 路线标注 + 配音）。
- **环境叙事**：WP34-6 的可收集情报（航行日志、维修记录、蜃的日志片段）进入档案页，带配音；集齐解锁一段隐藏结局后日谈。
- **结局**（G13）：两个选择各有一段不同的可玩尾声（3–4 分钟）——「沉船」：倒计时内从下沉的货舱逃生（复用 m5 的淹没机制，无战斗，纯跑酷，检验翻越/滑铲）；「带核心回港」：携带核心（`carry` 规则）穿过港区，沿途原本的敌人变成中立/跟随，气氛反转。之后是各自的片尾画面与制作名单。结局选择影响通关后的标题页场景与「第二轮」的若干台词。

**DoD**：全部台词有语音（`full`）与字幕（两种语言）；过场可跳过且跳过状态一致性有 e2e；两条结局尾声机器人可通关。

### WP35-10 界面重做与可访问性、本地化（2 周）

- **设计系统**：把分散在 `template.head.html` 与运行时注入的 `<style id="sx-css">` 里的样式统一为设计令牌（色板、字号阶梯、间距、圆角、动效时长）+ 约 20 个组件（按钮、分段选择、滑杆、卡片、标签页、弹窗、提示、进度环、列表行）。组件是轻量函数（创建 DOM + 更新函数），不引入框架。
- **屏幕清单重做**：标题（实时 3D 背景：当前进度对应的场景与天气）、行动选择（章节地图）、简报、军械库（3D 武器预览、可旋转、配件热点、数值对比条）、兵种图鉴、档案、成就、设置（标签页：画面/音频/操控/游戏性/辅助/语言）、暂停、结算（五项雷达 + 奖励动画）、联机大厅。
- **HUD 重做**：信息分三级——常驻（准星、弹药、血甲）、情境（目标、标记、交互提示，只在相关时出现）、瞬时（命中、击杀、拾取）。战斗中自动收起非必要元素；HUD 元素可在设置里逐项开关与调透明度；安全区边距可调（电视/曲面屏）。指南针整合目标与扫描标记；新增小地图开关（默认关，以保持沉浸；辅助选项里可开）。
- **可访问性**（在 V31 已有基础上补齐到行业清单水平）：
  - 色盲：红绿/蓝黄三种预设 + 敌我/危险区/拾取物颜色可自定义；所有靠颜色传达的信息同时有形状或图标。
  - 字幕：背景不透明度、说话人名、方向箭头、非语音声音字幕（「[远处] 狙击充能」）。
  - 运动：镜头晃动、头部起伏、武器摆动、视野、运动模糊、顿帧、屏幕闪光分别可调/可关。
  - 操控：全部「按住」可改「切换」；交互按住时长可缩短为点按；单手键位预设；辅助瞄准档位；慢动作辅助（单机，游戏速度 50–100%）。
  - 视觉：HUD 缩放 80–150%、高对比、敌人高亮描边（可选颜色）、准星形状/粗细/描边编辑器。
  - 音频：单声道混音、听觉事件的视觉指示环（脚步/枪声方向）。
  - 首次启动时先进入「辅助与基础设置」向导。
- **本地化交付**：英文全量翻译（界面 + 任务 + 字幕），字体子集化内嵌；伪本地化构建（`?lang=pseudo`：字符加长 40% 并加重音）用于检查截断，e2e 对每个屏幕断言无溢出；数字/时间格式走 `Intl`。
- **触屏**：布局编辑器（拖动/缩放按钮）、陀螺仪微调瞄准（可选）、自动开火选项、补齐军械库与图鉴的触屏交互（U2）。

**DoD**：每个屏幕通过「仅键盘 / 仅手柄 / 仅触屏」三种走查；伪本地化无截断；可访问性清单逐项有 e2e 或人工签字；界面帧耗时 ≤ 0.6ms（HUD 更新只在数值变化时写 DOM）。

### V35 排期

| 周 | 程序 A（渲染） | 程序 B（表现/界面） | 美术 / 音频 |
| --- | --- | --- | --- |
| 1 | WP35-0 资产管线 | WP35-0 分包/缓存 + 动画系统骨架 | 规格确认、武器模型开工 |
| 2 | WP35-1 级联阴影 | WP35-5 Animator/IK | 敌人模型（猎犬系、飞鸦） |
| 3–4 | WP35-2 TAA/累积 | WP35-5 敌人接入、解体、人形角色 | 新机体模型、动画片段 |
| 5 | WP35-3 探针/SSR | WP35-4 武器模型与瞄具 | 冷库、货轮场景件 |
| 6 | WP35-3 光照贴图烘焙 | WP35-10 设计系统 + 屏幕重做 | 货舱、核心舱场景件；音乐 stem |
| 7 | WP35-7 实例化/PVS | WP35-10 HUD/可访问性 | 关卡布光与贴花 |
| 8 | WP35-6 水体/天气/动态元素 | WP35-8 音乐引擎、WP35-9 序列器 | 语音录制、过场分镜 |
| 9 | WP35-6 收尾 + 性能 | WP35-9 过场/结局尾声、本地化 | BOSS 模型、片尾 |
| 10 | 性能预算、着色器预热、回归 | 伪本地化、三输入走查、回归 | 校色、混音终审 |

---

## 7. V36「联机」：网络 2.0 与长线运营

**版本目标**：联机从「能连上、能互相打」变成「高延迟下也公平、手感与单机一致、有模式可选、有理由每天回来」。前四个版本的固定步、共享 sim、武器数据表、AI 无头运行在这里全部兑现。

**退出标准**

- 150ms 往返延迟 + 2% 丢包 + 20ms 抖动的模拟网络下：本地移动无可感知回拉（校正误差 p95 < 5cm），对横向跑动目标的命中判定与本地所见一致率 ≥ 95%；
- 12 人房每客户端下行 ≤ 12KB/s（V31 估算约 90KB/s），服务器单房 tick 耗时 p99 < 3ms；
- 服务器按武器数据权威结算（伤害、射速、弹药、换弹、衰减、穿透），客户端无法通过改包获得额外伤害/射速/弹药；
- 4 个对战模式 + 1 个合作模式，全部支持机器人补位；
- 断线 30 秒内重连恢复原比分与队伍；
- 联机测试全部本地无头运行并包含网络损伤场景；
- 部署：TLS、Origin 校验、无开发后门、指标与告警齐备，连续 72 小时浸泡测试无内存增长。

### WP36-1 传输与协议：二进制、增量、量化（1.5 周）

**传输**：保留 WebSocket（`wss://`）作为基础通道（兼容性最好）；在支持的浏览器上协商 WebTransport 数据报承载快照与输入（不可靠、无队头阻塞），可靠消息（加入、击杀、聊天、比分）仍走流。服务器端用抽象层 `Transport { sendReliable, sendUnreliable, onMessage }`，两种实现共用上层逻辑。若部署环境不具备 HTTP/3，则仅用 WebSocket，并靠输入冗余（见 WP36-2）缓解队头阻塞。

**编码**：手写位流（`BitWriter/BitReader`），协议定义为一张表，客户端与服务器共用 `packages/sim/net/schema.js`。

```js
// packages/sim/net/schema.js（节选）
export const PLAYER_FIELDS = [                 // 顺序即位掩码位
  { k: 'pos',    enc: vec3q(-64, 64, 16, 0, 32, 14) },   // XZ 各 16 位(≈2mm)，Y 14 位
  { k: 'vel',    enc: vec3q(-16, 16, 10) },
  { k: 'yaw',    enc: angle(12) }, { k: 'pitch', enc: angleRange(-1.5, 1.5, 10) },
  { k: 'hp',     enc: uint(7) },   { k: 'armor', enc: uint(7) },
  { k: 'flags',  enc: uint(10) },                         // alive/onGround/crouch/sprint/slide/mantle/leanL/leanR/protect/ads
  { k: 'weapon', enc: uint(4) },   { k: 'anim',  enc: uint(4) },   // 上半身动作：idle/fire/reload/throw/melee
];
// 快照 = header{serverTick:u32, ackCmdTick:u32, baseTick:u16(相对)} + 实体列表
// 每个实体：id:u5 + changedMask:u9 + 仅变化字段。相对 baseTick（该客户端最近确认的快照）做差。
// 名字、队伍、K/D 不进快照：走可靠的 rosterUpdate / score 消息（V31 每 tick 重发，N6）
```

```js
// server/net/snapshot.js
function buildSnapshotFor(client, room, tick) {
  const base = client.ackedSnap ? room.history.get(client.ackedSnap) : null;     // 服务器保留 64 tick 的状态历史
  const w = pool.writer(); w.u32(tick); w.u32(client.lastCmdTick); w.u16(base ? tick - base.tick : 0xffff);
  for (const e of relevantEntities(client, room)) {                              // 兴趣管理，见 WP36-6
    const prev = base?.ents.get(e.id); let mask = 0;
    for (let i = 0; i < PLAYER_FIELDS.length; i++) if (!prev || !PLAYER_FIELDS[i].enc.eq(prev[PLAYER_FIELDS[i].k], e[PLAYER_FIELDS[i].k])) mask |= 1 << i;
    if (!mask && prev) continue;
    w.bits(e.id, 5); w.bits(mask, PLAYER_FIELDS.length);
    for (let i = 0; i < PLAYER_FIELDS.length; i++) if (mask & (1 << i)) PLAYER_FIELDS[i].enc.write(w, e[PLAYER_FIELDS[i].k]);
  }
  writeRemoved(w, base, client); writeEvents(w, client.pendingUnreliableEvents);   // 开火/命中特效等瞬时事件随快照发，重复 2 次
  return w.finish();
}
// 客户端每个输入包带 ackSnapTick；服务器据此更新 client.ackedSnap。长时间无确认 → 发全量。
```

发送频率：模拟 60Hz，快照 30Hz（可按客户端带宽降到 20Hz）；背压：`bufferedAmount > 64KB` 时跳过该客户端本次快照，超过 3 秒断开。

**DoD**：编解码往返属性测试（随机状态 10 万次）；带宽测量脚本输出达标；协议版本号握手，不匹配时给出明确提示。

### WP36-2 客户端预测与输入回放（1.5 周）

把 V31 的「软插值校正」（N3）换成标准的预测—回滚—重放。前提（V32 已具备）：客户端与服务器运行同一份 `stepPlayer`，同为 60Hz 固定步，输入是 `Command`。

```js
// src/net/prediction.js
const pending = new Ring(128);                       // 未确认命令及其预测结果
function onLocalTick(cmd) {                          // 每个固定步
  stepPlayer(local, cmd, world, STEP); stepWeaponPredicted(localWeapon, cmd, STEP);
  pending.push({ tick: cmd.tick, cmd, pos: clone(local.pos), vel: clone(local.vel) });
  outbox.push(cmd);
}
function sendInputs() {                              // 60Hz；每包带最近 3 条命令（冗余抗丢包）
  transport.sendUnreliable(encodeCmds(outbox.last(3), lastSnapTick));
}
function onSnapshot(s) {
  const me = s.self;                                 // 自己的权威状态（全精度，不量化）+ s.ackCmdTick
  pending.dropWhile(p => p.tick <= s.ackCmdTick);
  const predicted = history.at(s.ackCmdTick);        // 当时预测的位置
  const err = dist(predicted.pos, me.pos);
  if (err < 0.01) return;                            // 一致，无事发生（绝大多数情况）
  copyState(local, me);                              // 回滚到权威状态
  for (const p of pending) { stepPlayer(local, p.cmd, world, STEP); p.pos.copy(local.pos); }   // 重放未确认命令
  // 视觉平滑：把「校正前后渲染位置之差」存入 offset，表现层 100ms 内指数衰减到 0；err > 1.5m 直接瞬移
  smoothing.offset.add(sub(renderPosBefore, local.pos)); if (err > 1.5) smoothing.offset.set(0, 0, 0);
}
```

**服务器命令队列**（取代「只取最新输入」）：

```js
// server/match/input.js
function onCmds(p, cmds) {
  for (const c of cmds) if (c.tick > p.lastQueuedTick && c.tick <= p.lastSimTick + 30) { sanitize(c); p.queue.push(c); p.lastQueuedTick = c.tick; }
}
function nextCmd(p) {                                 // 每个服务器 tick 调用一次
  // 抖动缓冲：目标深度 2 条（自适应 1–4）。队列空 → 重复上一条（至多 6 tick，之后置零输入）
  if (p.queue.length === 0) { p.starved++; return p.starved <= 6 ? p.lastCmd : ZERO_CMD; }
  if (p.queue.length > p.targetDepth + 3) p.queue.splice(0, p.queue.length - p.targetDepth);   // 积压：丢弃最旧的，防加速挂
  p.starved = 0; return (p.lastCmd = p.queue.shift());
}
// sanitize：移动轴归一化到单位圆（修 V31 斜向 √2 倍速问题）、pitch 钳制、yaw 每 tick 变化上限、按钮位合法性
// 快照里的 ackCmdTick = p.lastCmd.tick（“已模拟到”，而不是 V31 的“已收到”）
```

时钟同步：客户端用 ping/pong（`performance.now()`，修 `Date.now()` RTT）估计 RTT 与服务器 tick 偏移，微调本地 tick 速率（±2%）使命令恰好提前「抖动缓冲深度」到达服务器。

武器预测：开火、弹药、换弹在本地立即表现（枪口焰、后坐、曳光），命中确认（准星标记、伤害数字、击杀）等服务器回包；服务器拒绝的射击（例如其实已空仓）在客户端静默回滚弹药数。

**DoD**：`tests/mp/prediction.test.js` 在损伤网络下断言校正误差分布；属性测试「客户端预测 = 服务器模拟」（同命令序列逐 tick 比对位置哈希）；高延迟冲刺不回拉（录屏对比 V31）。

### WP36-3 远端插值与延迟补偿（1 周）

**远端插值**：用服务器 tick 作时间轴（V31 用到达时间，抖动直接进入运动）。插值延迟 = `max(2 个快照间隔, 抖动 p95 × 1.5)`，自适应 66–150ms；缓冲见底时外推至多 100ms（按速度），之后冻结并淡出。位置用 Hermite（带速度）插值，朝向最短弧。

**延迟补偿**：服务器保存每个玩家最近 1 秒（60 tick）的命中体姿态。

```js
// server/match/lagcomp.js
function onFire(shooter, fire) {              // fire = {cmdTick, viewTick, viewFrac, dir, seedIndex}
  if (!canFire(shooter, fire)) return reject(shooter, fire);                       // WP36-4
  // 客户端开火时“看到”的远端世界时刻 = 它当时的插值时间
  const rewind = clamp(room.tick - (fire.viewTick + fire.viewFrac), 0, MAX_REWIND /*18 tick = 300ms*/);
  const origin = shooter.eyeAt(fire.cmdTick);                                       // 射手自己用已模拟的权威位置，不回溯
  if (angleBetween(fire.dir, shooter.viewDirAt(fire.cmdTick)) > 0.035) return flag(shooter, 'aim_mismatch');   // 方向必须与其命令中的视角相符
  const hits = traceBullet(room.world, origin, fire.dir, weaponOf(shooter), (o, d, max) => {
    let best = null;
    for (const q of room.enemiesOf(shooter)) {
      const pose = q.history.sample(room.tick - rewind);                           // 相邻两 tick 线性插值
      const h = rayVsHitboxes(o, d, max, pose);                                    // 头/胸/腹/四肢胶囊，随蹲/滑铲/探身变化
      if (h && (!best || h.t < best.t)) best = { ...h, target: q };
    }
    return best;
  }, _hits);
  applyHits(shooter, hits);
}
// 公平性约束：
//  - 回溯上限 300ms：延迟更高的玩家需要自己提前量，不让低延迟玩家承担“拐角后被打死”
//  - 受害者保护：若受害者当前已在掩体后超过 200ms（权威位置对射手无视线），该次命中伤害减半并标记，统计占比用于调上限
//  - 被击杀者的击杀回放/死亡镜头用服务器视角，解释“为什么我死了”
```

命中体随姿态变化（修 V31 蹲下后命中球不变的问题）。散布由服务器按 `seedIndex`（每发递增）与双方共享的种子重算，客户端不能自报落点。

**DoD**：机器人对射测试——A 以 6.4m/s 横向跑动，B 在 50/100/200ms 延迟下瞄准其「所见位置」开火，命中率 ≥ 95%；回溯上限外的命中被拒绝；命中体姿态单测。

### WP36-4 权威战斗：逐武器结算与战斗可见性（1 周）

- 服务器为每名玩家运行与单机相同的 `stepWeapon`（WP33-3）：射速、弹药、换弹阶段、切枪时间全部权威；`fire` 消息只是「该 tick 我扣了扳机」的声明，由命令中的 `BTN.FIRE` 驱动，服务器自行决定是否真的打出子弹。
- 伤害管线复用 `packages/sim/damage.js`：部位倍率、距离衰减、穿透、护甲；手雷/EMP/近战由服务器模拟投射物与判定。
- 装备：加入时上报配装（武器 + 配件 id），服务器按账号解锁状态校验（WP36-7）并用 `resolveStats` 计算最终数值。对战模式可配置「标准化配装」以保证公平。
- **战斗可见性**（N12）：服务器把「开火事件」（射手、武器、方向、是否命中及落点材质）作为不可靠事件随快照广播给兴趣范围内的客户端；客户端据此播放远端枪口焰、曳光、弹孔、分层枪声（距离/遮挡沿用 WP33-6）、第三人称开火与换弹动画。脚步声由远端状态本地推导。
- 击杀信息带武器、爆头、穿墙、距离；击杀播报用图标；助攻（最近 5 秒造成 ≥ 30 伤害）。
- 死亡后 4 秒击杀回放：服务器发送击杀者最近 4 秒的状态序列，客户端用第三人称/击杀者视角重建。

**DoD**：篡改客户端（测试用恶意 FakeClient：无限弹药、双倍射速、伪造方向、自报伤害）全部无效且被计入审计日志；六把武器在联机中的 TTK 与附录 B 一致；能看到并听到他人开火。

### WP36-5 比赛状态机、模式与机器人（2 周）

**比赛状态机**：`warmup（人数不足，可自由活动）→ countdown 5s → live → roundEnd（比分与 MVP，8s）→ vote（15s）→ mapLoad → …`。计时结束与比分达成都能结束回合（V32 已修），平分进入加时。自动平衡：队伍人数差 ≥ 2 时，在下一次重生把最近加入且比分最低的玩家换队并提示；玩家可在 warmup/死亡时申请换队（不破坏平衡时允许）。挂机 90 秒无输入移至观战，180 秒踢出。观战：自由镜头 / 跟随队友。

**模式**（规则是 `server/match/modes/*.js` 的数据 + 钩子）

| 模式 | 人数 | 规则 | 备注 |
| --- | --- | --- | --- |
| 团队死斗 | 4v4–6v6 | 击杀上限 50/75 或 5/6 分钟 | 现有，规则修正 |
| **据点争夺** | 5v5 | 每图 3 个据点（读 `map.modePoints.domination`），占领需 6s（多人加速，敌方在场则争夺中），每点每 5s 得 1 分，200 分胜 | 促进移动与配合 |
| **爆破** | 4v4 | 回合制无重生：进攻方在 A/B 点安放装置（安放 4s，倒计时 40s，拆除 6s）；先赢 6 回合；回合间用回合经济购买武器/配件/护甲 | 每回合 1:45；检验掩体/探身/投掷物 |
| **个人乱斗** | 2–8 | 各自为战，30 杀；出生点选最远离所有人的 | 热身用 |
| **合作：潮汐防线** | 1–4 | PvE：与 m7 相同的波次防守规则，服务器运行 AI（`packages/sim/ai` 无头）与导演；波次间用信用点购买炮台/补给；10 波 + BOSS 波；倒地可被队友扶起 | V34 AI 的最大复用 |

**机器人**：服务器端用 `packages/sim/ai` 驱动一个「人形机器人」定义（使用玩家的移动与武器规则，输出 `Command`），与真人走完全相同的模拟路径。难度三档（反应时间、瞄准误差、是否使用滑铲/探身/投掷物）。房间可设置「机器人补位至 N 人」，真人加入时替换。机器人名字带标识，不计入在线排行。

```js
// server/bots/bot.js
function botThink(bot, room, h) {               // 复用感知/黑板/掩体/效用（WP34-1/2），动作层改为输出 Command
  sense(bot, room.world, room.enemiesOf(bot), bot.bb, h, room.rng);
  const intent = selectIntent(bot, HUMANOID_UTILITY[bot.skill]);
  const act = runTree(bot, TREES_MP[intent], h);                    // 额外的 MP 树：占点、安放/拆除、守点、护送持包人
  return toCommand(bot, act, { aimErr: SKILL[bot.skill].aimErr, reaction: SKILL[bot.skill].reaction });
}
```

合作模式的敌人状态同步：敌人作为实体进入同一套增量快照（字段表另设），客户端只做插值与表现；敌方投射物由服务器权威、客户端按生成事件本地模拟外观。

**大厅**：房间列表（地图、模式、人数、延迟）、快速加入、私人房间（房间码）、准备状态、文字快捷语与标点（「敌人在此」标记，复用扫描标记 UI）；不做自由文本聊天（规避内容审核成本），只做预设短语轮盘。

**DoD**：每个模式有规则单测与一局完整的无头对局测试（全机器人）；4 人合作通关 10 波（机器人玩家）；模式点位通过地图校验；自动平衡与挂机处理有用例。

### WP36-6 安全、反作弊与健壮性（1 周）

- **传输与身份**：`wss://` + 反向代理终止 TLS；握手校验 `Origin` 白名单；访客账号 = 服务器签发的令牌（HMAC 签名的 `{uid, name, exp}`），存于本地，用于重连与进度；每 IP 连接数与建房数上限；未加入连接 5 秒超时并限流。
- **输入可信边界**：所有客户端消息按 schema 解码，超界即丢弃并计数；名字白名单字符集（中日韩文字、字母数字、`_-`，2–12 字）+ 保留字过滤；客户端渲染一律 `textContent`（V32 已修）。
- **兴趣管理/反透视**（N7）：服务器对每个客户端只发送「可能可见」的敌人——用 WP35-7 的 PVS（服务器读同一份 `.map.json`）加 8m 近距离圈与「最近 0.5 秒开过火」例外；不可见敌人不发位置（脚步声范围内只发粗略方向事件）。队友始终发送。血量/护甲只对队友与观战者发送精确值。
- **服务器侧检测**（只记录与踢出，不做客户端侵入式反作弊）：速度/传送审计（权威模拟下理论上不可能，出现即为 bug 或攻击）、命令速率异常（加速挂）、瞄准统计异常（爆头率、反应时间分布、瞄准角加速度的非人特征）→ 写审计日志，超过阈值标记供人工复核；击杀回放数据同时是复核材料。
- **重连**：断线后玩家实体保留 30 秒（无敌、不可见、位置冻结），凭令牌重连恢复队伍/比分/位置；客户端自动重试（1s/2s/4s/8s）并显示状态；页面刷新后可「重新加入上一场比赛」。
- **进程健壮性**：`uncaughtException` 不再直接退出——单房间的 tick 包在保护内，出错的房间被隔离关闭并通知玩家，其他房间不受影响；优雅重启（`SIGTERM`：停止接新房间，等现有回合结束或 5 分钟上限，广播「服务器即将维护」）；修 V31 的 `leave()`/`join()` 竞态（客户端连接用带代数的会话对象，旧会话的回调一律忽略）。
- 彻底移除 `dev` 消息；测试所需能力全部通过服务器启动配置注入。

**DoD**：模糊测试（随机/畸形二进制消息 100 万条，服务器不崩溃、内存不增长）；恶意客户端用例集全部被拒；透视测试（恶意客户端转储快照，墙后敌人不在其中）；重连 e2e。

### WP36-7 账号、进度与长线内容（1.5 周）

- **后端**：同一 Node 进程族新增 `profile` 服务（HTTP + SQLite，单文件数据库足够当前规模）：访客账号、云存档（上传/下载 `save`，带版本与冲突时「取进度更多的一方并合并统计」）、联机战绩、排行榜、每日/每周行动的服务器种子。
- **联机进度**：对局经验 → 等级（1–50，之后赛季重置的「段位」不做，保持轻量）；信用点与单机通用（对局按时长与表现发放，有每日上限防刷）；联机专属解锁全部为外观（角色涂装、武器挂件、击杀名片、称号）——**数值性内容不卖也不锁在联机进度后**，保证公平。
- **挑战与活动**：每日 3 个 / 每周 3 个任务（跨单机与联机，例：「用霰弹枪击杀 20 个蛛雷」「在据点争夺中占点 5 次」）；周行动排行榜（WP34-8 的变异行动，按服务器种子，上传「命令记录 + 种子」，**服务器无头重放验证成绩**——固定步确定性模拟的又一收益，天然防伪造）。
- **回放**：单机与联机对局都可保存为「种子 + 命令流（联机为快照流）」文件，回放器支持自由镜头、慢放、跳转；击杀集锦导出为 WebM（`MediaRecorder`）。
- **匹配**：按延迟与等级的简易撮合（先填充现有房间，人数不足则机器人补位）；不做排位。

**DoD**：云存档往返与冲突合并单测；周行动成绩的服务器重放验证（篡改成绩被拒）；数据库迁移脚本与备份策略文档。

### WP36-8 运维与可观测性（0.5 周）

- 配置外置（环境变量 + `config.json`）：端口、TLS、Origin 白名单、房间上限、tick/快照率、模式开关；客户端默认服务器地址由构建注入，不再硬编码内网 IP（N13）。
- 指标（`/metrics`，Prometheus 文本格式）：房间数、在线人数、tick 耗时直方图、每客户端上下行字节、快照大小分布、命令队列深度、校正幅度（客户端上报采样）、回溯时长分布、被拒射击数、审计事件数、内存与事件循环延迟。
- 结构化日志（JSON 行）+ 对局摘要（每局一条：模式、地图、时长、人数、比分、异常计数）。
- 多进程：按 CPU 核数启动 worker，每个 worker 承载若干房间，前置一个轻量房间目录服务做路由；单机先支持，跨机留接口。
- 容器化（Dockerfile + compose：game、profile、反向代理），替代手工 `rsync + systemctl`；发布流程：CI 构建镜像 → 预发环境跑无头对局冒烟 → 灰度一个 worker → 全量。
- 压测：`tests/mp/load.mjs` 启动 N 个机器人客户端（目标：单 worker 8 个 12 人房，tick p99 < 3ms），72 小时浸泡。

**DoD**：一条命令起完整环境；告警规则（tick p99 > 8ms、事件循环延迟 > 50ms、内存斜率）；运维手册（部署、回滚、扩容、常见故障）。

### V36 排期

| 周 | 程序 A（网络） | 程序 B（玩法/后端） | 策划 / 美术 |
| --- | --- | --- | --- |
| 1 | WP36-1 位流/schema/增量 | WP36-5 比赛状态机 | 模式规则书、据点/爆破点位 |
| 2 | WP36-1 传输抽象 + WP36-2 命令队列 | WP36-5 据点争夺、个人乱斗 | 四图模式点位摆放 |
| 3 | WP36-2 预测回放/时钟同步 | WP36-5 爆破 + 回合经济 | 回合经济数值 |
| 4 | WP36-3 插值/延迟补偿 | WP36-5 机器人 | 机器人难度调校 |
| 5 | WP36-4 权威战斗/战斗可见性 | WP36-5 合作模式 | 合作波次表、角色外观 |
| 6 | WP36-6 安全/兴趣管理/重连 | WP36-7 profile 服务/云存档 | 每日/每周任务池 |
| 7 | WP36-4 击杀回放、回放器 | WP36-7 进度/排行榜/验证重放 | 外观奖励 |
| 8 | WP36-8 指标/多进程/容器 | 大厅与界面 | 大厅流程走查 |
| 9 | 网络损伤测试、压测 | 模式全矩阵测试、平衡 | 对战试玩 |
| 10 | 浸泡、修复、发布演练 | 回归、文档 | 发布内容校对 |

---

## 附录 A：已确认缺陷清单与修法（WP32-0）

「核实」列：★ = 本次审查中直接读代码确认；☆ = 审查报告指出、实施前需再看一眼代码。每条修完都要加一条自动化检查。

### A.1 联机服务器

| # | 缺陷 | 位置 | 核实 | 修法 | 检查 |
| --- | --- | --- | --- | --- | --- |
| A1 | 部署单元开着 `MP_DEV=1`，任何人可传送/满血/强制结束回合 | `server/fps-mp.service:13`、`server.cjs:784–798` | ★ | 删除该环境变量；`dev` 分支额外要求 `msg.token === process.env.MP_DEV_TOKEN`；V36 彻底移除 | 无令牌的 `dev` 消息后玩家位置不变 |
| A2 | 回合计时到 0 不结束回合 | `server.cjs:552, 635` | ★ | tick 内：`if (!room.roundOver && timeLeft(room) <= 0) endRound(room, leader(room))`；把 635–640 的结束逻辑抽成 `endRound()` 共用 | `roundSeconds=3` 的房间 3 秒后收到 `roundEnd` |
| A3 | `dev tp` 用全局 `world`（永远是港区） | `server.cjs:793–795` | ★ | 改为 `p.room.world` | — |
| A4 | 中场 8 秒内击杀仍计分 | `server.cjs:592` | ☆ | `handleFire` 开头 `if (p.room.roundOver) return;` | 回合结束后开火不改比分 |
| A5 | 房间键含地图，投票换图后同名房间分裂 | `server.cjs:662` | ☆ | 键改为 `roomId@modeId`；`welcome.mapId` 取 `room.mapId` | 换图后新玩家进入同一房间 |
| A6 | 客户端 `team` 被无条件采纳 | `server.cjs:675` | ☆ | 仅 `MP_DEV` 下采纳 | 恶意 join 仍被分到人少的一队 |
| A7 | 满员时第一处检查不关闭连接 | `server.cjs:668–669` | ☆ | 发 `error{code:'full'}` 后 `ws.close(4001)`；删除不可达分支 | 第 9 人收到错误且连接关闭 |
| A8 | 人数经过 2 时重置回合计时但不重置比分 | `server.cjs:679` | ☆ | 仅在「从 <2 首次到 2 且比分全 0」时启动计时 | 3→1→2 不重置计时 |
| A9 | 掉海重生不广播 `respawn` | `server.cjs:531–534` | ☆ | 复用带广播的重生函数 | 掉海后客户端收到 `respawn` |
| A10 | 计分板 ping 恒为 0 | `server.cjs:556` | ☆ | 处理 `ping` 时由客户端回报上次 RTT，或服务器自测 ws ping | 计分板 ping > 0 |
| A11 | 移动轴逐轴钳制，斜向可达 √2 倍速 | `server.cjs:714–727` | ☆ | 归一化到单位圆（先确认客户端是否已归一化，见附录 E） | 斜向速度 ≤ 6.4 |
| A12 | `maps.json` 缺 `groundY/seaY/quayX`，室内图沿用港区海面默认值 | `server/maps.json` | ★ | 重新运行 `export_maps.mjs` 并确认三键写出；室内图 `seaY=null` 时跳过海面判定（WP32-6 根治） | 冷库/核心舱 x>30 处不触发掉海 |
| A13 | 协议注释与 `server/README.md` 过期且自相矛盾（仍写「无 TDM」） | `server.cjs:18–24`、`README.md:28` | ★ | 重写 | — |

### A.2 联机客户端

| # | 缺陷 | 位置 | 核实 | 修法 |
| --- | --- | --- | --- | --- |
| A14 | 名字经 `innerHTML` 写入姓名板/计分板/击杀播报 | `mp.js:538, 698`、`game.js:70786` | ★ | 改为创建节点 + `textContent`；`G.hud.feed` 增加纯文本接口 |
| A15 | `leave()` 发生在进入联机的 60ms 延时内，延时仍会把 `active` 置真 | `mp.js:354` | ☆ | 会话代数：`const gen = ++session;` 回调里 `if (gen !== session) return;` |
| A16 | 已有连接时再次 `join()`，旧连接 `onclose` 会拆掉新会话 | `mp.js:207` | ☆ | 同上，旧 socket 的全部回调校验代数 |
| A17 | 进入冷库/货轮时强制 `yaw=0`，红队面朝墙 | `mp.js:369` | ☆ | 删除该行，统一用 `welcome`/`respawn` 的朝向 |
| A18 | `m.hp || 100`、`m.armor || 50` 把 0 当缺省 | `mp.js:687–688` | ☆ | 改 `??` |
| A19 | RTT 为 0 时显示「--」；RTT 用 `Date.now()` | `mp.js:662` | ☆ | 判空用 `== null`；计时用 `performance.now()` |
| A20 | 投票界面缺 `core` | `mp.js:159` | ☆ | 用 `voteStart.maps` 生成选项 |
| A21 | 敌方姓名板与血条穿墙可见；每帧每个远端 `new Vector3` | `mp.js:651–660` | ☆ | 敌方姓名板仅在有视线且 < 40m 时显示；复用临时向量 |
| A22 | 重复 CSS 规则、死代码 `makeTagV2` | `mp.js:64/97, 448–473` | ☆ | 删除 |

### A.3 单机

| # | 缺陷 | 位置 | 核实 | 修法 |
| --- | --- | --- | --- | --- |
| A23 | 散布公式优先级错误，`spreadScale` 与散布配件无效 | `game.js:67097–67103` | ★ | 见 WP32-0 的修正公式；同步重调数值 |
| A24 | `src/dmr.js` 死代码 | — | ★（构建脚本不读它） | 删除 |
| A25 | BOSS 音乐仅在阶段切换触发、30 秒过期 | `audio_ext.js:72–90` | ☆ | BOSS 生成进入、死亡退出 |
| A26 | m6 的 `bossHp` 覆盖了难度缩放后的血量 | `boss.js:49` | ☆ | `hp = bossHp * difficulty.hp` |
| A27 | 拾取物与 BOSS 出生点只有港区坐标 | `ext.js:463–478`、`boss.js:23` | ☆ | V31.1 先按 `MapKit.current` 分表；WP32-6 数据化 |
| A28 | 手雷发 `weapon:fire`，触发枪声警报与战斗音乐 | `ext.js:579` | ☆ | 改发 `sx:grenade`（已有），订阅方各自处理 |
| A29 | 任何近战命中都提示「近战击杀」 | `ext.js:647` | ☆ | 仅目标死亡时提示 |
| A30 | 训练命中率用全局 `stats.hits`，未减基线 | `training.js:229–231` | ☆ | 开始时记录基线 |
| A31 | 手雷预览起点（0.8m）与实际投掷（0.45m）不一致，预览不含弹跳 | `tactics.js:80`、`ext.js:568` | ☆ | 预览与投掷共用同一积分函数（V33 进 `sim/projectiles.js`） |
| A32 | 军械库与档案面板 CSS 类名冲突 | `ext.js:146–167, 226–238` | ☆ | 档案改 `.x-arc-*` |
| A33 | MapKit 非港区→非港区切换不重置天空/不隐藏港区；`def.env` 未应用 | `mapkit.js:257–258, 202` | ☆ | `load()` 一律先恢复到中性状态再应用目标图 |
| A34 | 连杀与护盾特效用墙钟时间，绕过 `?dt` | `tactics.js:202`、`ext.js:788` | ☆ | 改用 `G.time.t` |
| A35 | 任务的 `rain/exposure/saturation` 与 `env.*` 重复且冲突 | `campaign.js:905–906` | ☆ | 只保留 `env`，删除顶层三项 |
| A36 | 过期文案：「三种时段」「1/2 切换武器」、威胁栏写了未出现的炮台 | `ext.js:926–937`、`campaign.js` | ☆ | 改文案；炮台在 V34 真正入关 |
| A37 | `access[key] = dataset.v` 未校验 | `access.js:158` | ☆ | 白名单校验（WP32-8 统一） |
| A38 | 构建的 `replace` 会解释 `$` 序列、部分标记不校验 | `tools/build.cjs:21–40` | ★ | V31.1：全部改函数式替换 + 断言每个标记恰好命中一次；WP32-3 根治 |

---

## 附录 B：数值表

所有数值为起始值（// 调参），以数据文件为准。TTK 按「对 100HP 无甲目标、全中躯干」计算；敌人血量见 B.2。

### B.1 武器

| 武器 | 类型 | 伤害 | 头部倍率 | 射速 rpm | 弹匣/备弹 | 换弹 战术/空仓 s | 衰减起/止 m（最低倍率） | 穿透力 | 开镜 s / FOV | 腰射/开镜散布 | 移速系数 | 躯干 TTK s | 解锁 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 九式 pac9 | 突击步枪 | 26 | 2.0 | 720 | 30/150 | 2.10 / 2.72 | 35/80（0.65） | 0.5 | 0.18 / 52 | 0.0125 / 0.0012 | 1.00 | 0.25（4 发） | 初始 |
| 破门锤 breaker12 | 霰弹 | 11×9 | 1.3 | 78 | 8/48 | 逐发 0.52 | 8/22（0.30） | 0.1 | 0.22 / 60 | 弹丸锥 1.35° | 0.97 | 0.77（2 发，近距 1 发） | 初始 |
| 长眼 dmr | 精确射手 | 62 | 2.4 | 240（半自动） | 10/90 | 2.60 / 3.15 | 60/140（0.80） | 0.9 | 0.30 / 30 | 0.0056 / 0.0005 | 0.94 | 0.25（2 发，爆头 1 发） | 1500 |
| 蜂刺 smg | 冲锋枪 | 19 | 1.6 | 900 | 32/192 | 1.75 / 2.20 | 15/40（0.50） | 0.25 | 0.14 / 58 | 0.0105 / 0.0020 | 1.05 | 0.33（6 发） | 1200 |
| 长夜 lmg | 轻机枪 | 30 | 1.8 | 600 | 80/240 | 5.20 / 6.00 | 40/100（0.70） | 0.7 | 0.34 / 50 | 0.0180 / 0.0018 | 0.88 | 0.30（4 发） | 2200 |
| 短讯 pistol | 手枪（副） | 34 | 2.0 | ≤400（半自动） | 12/∞ | 1.40 / 1.70 | 18/45（0.55） | 0.2 | 0.12 / 60 | 0.0090 / 0.0015 | 1.00 | 0.30（3 发） | 初始 |

设计校验：
- 每把枪在自己的优势距离内 TTK 最短：0–8m 霰弹；8–20m 冲锋枪；20–50m 步枪/机枪；50m+ 精确射手。
- 现有长眼 `spreadScale` 0.32 在修复公式后改为 0.45，表中散布值即 `0.0125×0.45 / 0.0012×0.45` 取整。
- 联机中头部倍率统一上限 2.0（长眼 2.4→2.0，仍可一枪爆头击杀无甲目标 62×2=124），避免延迟下的一击必杀挫败感过强。

**投掷物与近战**

| 项 | 数值 |
| --- | --- |
| 破片雷 | 初速 15.5 + 上抛 4.2，引信 2.25s，重力 21，弹跳系数 0.62；半径 6.5m，中心伤害 110，线性衰减到边缘 20；携带 2 |
| 电磁脉冲雷 | 同弹道，引信 1.6s；半径 7m；瘫痪 飞鸦 3s / 猎犬系 2s / 炮台 5s / 护盾关闭 6s；BOSS 仅打断；携带 2 |
| 近战 | 55 伤害，2.4m，冷却 0.72s；背后命中 ×2；对蛛雷必杀 |
| 护甲 | 上限 100，吸收 65%；护甲板 +50 |
| 医疗包 / 弹药箱 | +45HP / 备弹 +45% 并 +1 投掷物 |

**配件**（每槽 5 个，V34 交付；每个配件必须有代价。以九式为例，其余武器同构、数值按类型缩放）

| 槽 | 配件 | 收益 | 代价 | 价格 |
| --- | --- | --- | --- | --- |
| 枪口 | 标准制退器 | — | — | 初始 |
| | 战术补偿器 | 垂直后坐 −18% | 腰射散布 +5% | 300 |
| | 消音器 | 枪声警报半径 45→14m，无枪口焰 | 伤害 −8%，衰减起点 −20% | 500 |
| | 长枪管 | 衰减起/止 +25%，穿透 +0.1 | 开镜时间 +12%，移速 −2% | 450 |
| | 短突枪管 | 开镜时间 −15%，冲刺转开火 −20% | 衰减起/止 −25% | 350 |
| 弹匣 | 标准 30 | — | — | 初始 |
| | 扩容 45 | +15 发 | 换弹 +18%，开镜时间 +5% | 400 |
| | 快拔 25 | 换弹 −25% | −5 发 | 300 |
| | 穿甲弹 | 穿透 +0.4，对护盾 ×1.4 | 伤害 −6% | 700 |
| | 空尖弹 | 对无甲机体伤害 +12% | 穿透 −0.3，对护盾 ×0.7 | 700 |
| 瞄具 | 红点 1× | — | — | 初始 |
| | 全息 1× | 视野更开阔（镜框细） | 开镜时间 +4% | 250 |
| | 战术镜 2× | FOV 38，开镜散布 −8% | 开镜时间 +10%，开镜移速 −8% | 400 |
| | 高倍 3.5× | FOV 26 | 开镜时间 +20%，镜片反光暴露位置 | 600 |
| | 机械瞄具 | 开镜时间 −10% | 视野遮挡 | 100 |
| 枪托 | 标准 / 轻型（开镜移速 +15%，后坐 +8%）/ 重型（后坐 −12%，移速 −3%）/ 折叠（切枪 −25%，开镜散布 +15%）/ 无托（冲刺转开火 −30%，后坐 +20%） | | | 0–500 |
| 握把 | 无 / 垂直（垂直后坐 −10%，开镜时间 +5%）/ 斜角（开镜时间 −8%，腰射散布 +8%）/ 短握（腰射散布 −15%，开镜后坐 +6%）/ 两脚架（蹲姿后坐 −35%，站姿开镜时间 +15%） | | | 0–500 |

### B.2 敌人

血量为标准难度基础值，再乘任务 `hpScale` 与难度倍率。「威胁」用于导演预算，「信用点」为击杀奖励。

| 机体 | HP | 移速 走/跑 | 理想距离 m | 攻击 | 预警 s | 弱点（倍率） | 威胁 | 信用点 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 飞鸦 gull | 45 | 飞行 7 | 12–25 | 弹丸 3 连发 ×7，弹速 70 | 0.35 | 旋翼轴（2.0） | 0.8 | 10 |
| 自爆无人机 drone | 26 | 飞行 11 | 贴脸 | 殉爆 62 / 4.4m | 0.8 | 全身 | 0.7 | 10 |
| 猎犬 hound | 140 | 2.2 / 4.5 | 10–22 | 点射 4×5，扑击 15 | 0.45 | 头部传感器（2.2） | 1.0 | 15 |
| 精英 elite | 230 | 2.2 / 4.6 | 12–25 | 点射 4×7，EMP 干扰 | 0.45 | 头部（2.0） | 2.5 | 40 |
| 狙击 marksman | 95 | 1.8 / 3.3 | 20–44 | 单发 27 | 1.15（激光） | 镜头（2.4） | 2.0 | 30 |
| 盾卫 heavy | 320 + 盾 240 | 1.6 / 2.4 | 5–15 | 点射 6×6，重击 24 | 0.6 | 背部电池（2.5） | 3.0 | 45 |
| 炮台 turret | 420 | 固定 | 6–30 | 5 连发 ×8 | 0.6（预热） | 背部检修面板（3.0） | 2.5 | 35 |
| 蛛雷 skitter | 18 | — / 6.5 | 贴脸 | 自爆 22 / 2.5m | 0.5（加速蜂鸣） | 全身 | 0.4 | 5 |
| 工蜂 mender | 70 | 飞行 4 | 友军身后 | 无；修复 25HP/s，12m | — | 修复光束发射器（2.0） | 2.0 | 35 |
| 投弹手 lobber | 160 | 1.8 / 3.4 | 15–35 | 抛射 55 / 4.2m，飞行 2.2s | 0.8 + 落点红圈 | 发射筒（2.2，可打爆） | 3.0 | 40 |
| 猎杀者 stalker | 110 | 2.6 / 6.0 | 背后 4m | 扑击 40，撤离再来 | 0.6（解除迷彩 + 尖啸） | 迷彩发生器（2.0） | 2.5 | 40 |
| 蜃（m3） | 3200 | 见 WP34-5 | — | 见招式表 | ≥0.6 | 冷却口/供电臂/背部核心 | — | 600 |
| 蜃·终形（m8） | 4200 | 固定 | — | 见招式表 | ≥0.6 | 护壁缺口内核心 | — | 1000 |

BOSS 血量较 V31（1600 / 2600）上调，是因为弱点窗口内伤害倍率更高且战斗有阶段演出；目标战斗时长 蜃 5–7 分钟、终形 8–10 分钟，以试玩计时为准。

**小队模板**（`director.squadTemplates` 引用）

| 模板 | 编成 | 威胁合计 |
| --- | --- | --- |
| `hound3` | 猎犬 ×3 | 3.0 |
| `hound2_mender` | 猎犬 ×2 + 工蜂 | 4.0 |
| `gull3` | 飞鸦 ×3 | 2.4 |
| `skitter8` | 蛛雷 ×8 | 3.2 |
| `heavy_lobber` | 盾卫 + 投弹手 + 猎犬 | 7.0 |
| `sniper_pair` | 狙击 ×2 + 猎犬 | 5.0 |
| `elite_squad` | 精英 + 猎犬 ×3 | 5.5 |
| `stalker_solo` | 猎杀者 ×1（在其他小队交战时投放） | 2.5 |
| `drone_swarm` | 自爆无人机 ×4 | 2.8 |

### B.3 经济

| 项 | 数值 |
| --- | --- |
| 首通战役预期总收入（标准难度，B 级） | 约 9,000–10,500 |
| 全部数值性解锁总价（3 把武器 + 全配件） | 约 16,000 |
| 首通后可解锁比例 | 55–65% |
| 重玩一关平均收入（含变异 +30%） | 约 1,300 |
| 外观类总价 | 约 20,000（纯收集，无数值） |

`tools/sim_economy.mjs` 用机器人实测数据校准上表；任何改动敌人信用点、配件价格的提交都要重跑并附输出。

---

## 附录 C：测试矩阵与性能预算

### C.1 参考机型

| 档位 | 代表硬件 | 目标 |
| --- | --- | --- |
| 低 | 2019 年前后集显笔记本、中端手机 | 720p 动态分辨率，≥ 30fps |
| 中 | 近三年集显 / 入门独显 | 1080p 动态分辨率，≥ 45fps |
| 高（参考机） | 中端独显（GTX 1660 / M1 级别） | 1080p 原生，稳定 60fps |
| 超高 | 高端独显 | 1440p，60fps，全部特效 |

V32 开工第一周用 `?bench` 在这四类机器上各采一次 V31 基线，写入 `tests/bench/baseline.json`。之后所有预算以「不低于基线」为底线。

### C.2 帧预算（参考机，高档，16.6ms）

| 项 | 预算 ms | 首次生效 |
| --- | --- | --- |
| 模拟（玩家 + 武器 + 弹丸 + 目标 + 导演） | 0.6 | V32 |
| AI（16 个敌人） | 2.0 | V34 |
| 物理查询合计 | 0.5 | V32 |
| 动画 | 1.5 | V35 |
| 阴影 | 2.5 | V35 |
| 主场景渲染（CPU 提交 + GPU） | 5.0 | V32 起跟踪 |
| 后处理（AO + 体积雾 + TAA + SSR + bloom + 调色） | 3.0 | V35 |
| 界面/HUD | 0.6 | V35 |
| 音频主线程 | 0.3 | V33 |
| 余量 | 0.6 | — |

其他预算：

| 项 | 预算 |
| --- | --- |
| draw call（高档，任意机位） | ≤ 450 |
| 三角面 | ≤ 1.2M |
| 每帧 JS 堆分配（战斗中） | ≤ 50KB（目标趋近 0；GC 停顿 p99 < 4ms） |
| `lite` 包体积 | V32 ≤ 2.6MB，V35 ≤ 3.2MB |
| `full` 首屏 / 总计 | ≤ 12MB / ≤ 60MB |
| 冷启动到标题可交互 | `lite` ≤ 4s，`full` ≤ 6s（参考机，缓存后 ≤ 2s） |
| 关卡加载 | ≤ 5s |
| 运行期新编译着色器数 | 0 |
| 服务器 tick p99（12 人房） | < 3ms |
| 每客户端下行（12 人房） | ≤ 12KB/s |

### C.3 测试矩阵

| 维度 | 取值 |
| --- | --- |
| 浏览器 | Chrome、Edge、Firefox、Safari（桌面与 iOS）、Android Chrome |
| 输入 | 键鼠、手柄（Xbox / PlayStation 布局）、触屏 |
| 画质档 | 低 / 中 / 高 / 超高 |
| 发行 | `lite` / `full` |
| 语言 | zh-CN / en / pseudo |
| 难度 | 新兵 / 标准 / 老兵 / 噩梦 |
| 网络（联机） | 理想 / 80ms / 150ms+2% 丢包 / 250ms+5% 丢包+抖动 |

不做全组合。每次合并跑：Chrome × 键鼠 × 低档 × `lite` × zh-CN × 标准的全量自动化。每晚跑：浏览器 × 画质档的启动与单关冒烟、机器人全关 × 四难度、联机全模式 × 四种网络。每个版本发布前人工走查：三种输入 × 两种语言的全屏幕流程，以及 Safari/iOS 专项（指针锁、音频解锁、WebTransport 缺失回退）。

### C.4 各版本的自动化用例增量（目标值）

| 版本 | 单元 | 联机集成 | 端到端 | 说明 |
| --- | --- | --- | --- | --- |
| V32 | 300 | 40 | 120 | 迁移旧 85 + 34 项并补齐 |
| V33 | +150 | +5 | +40 | 移动、武器状态机、弹道、输入 |
| V34 | +250 | — | +60 | AI、目标类型、导演、评级、经济 |
| V35 | +60 | — | +70 | 动画事件对齐、界面三输入、伪本地化、视觉回归扩充 |
| V36 | +120 | +160 | +30 | 协议、预测、延迟补偿、模式、恶意客户端、模糊测试 |

---

## 附录 D：风险登记

| # | 风险 | 可能性 | 影响 | 预警信号 | 对策 / 退路 |
| --- | --- | --- | --- | --- | --- |
| D1 | 拆包（WP32-2）无法做到逐帧一致，工期失控 | 中 | 高 | 第 2 周末行为对比仍有 > 3 个模块不一致 | 退路：只拆 three 与 sim 相关模块，其余保留为 `legacy_bundle.js` 并导出工厂；之后按需拆 |
| D2 | 固定步改造引入手感退化（输入延迟感、插值拖影） | 中 | 高 | 试玩者反馈「发飘」 | 视角不走固定步；模拟可升至 120Hz（`STEP` 为常量一处修改）；高刷屏专项测试 |
| D3 | 新旧物理不一致导致关卡卡点/穿模 | 中 | 中 | 基准对比误差超阈值；机器人卡死 | 基准对比先行；机器人随机游走 10 分钟的出界/卡死检测进 CI |
| D4 | AI 性能超预算（16 敌 + 多点视线 + 掩体评估） | 中 | 中 | AI 步耗时 > 2ms | 感知错帧、可见性指纹预筛、寻路预算队列；降级：远处敌人降低决策频率 |
| D5 | AI「聪明」但不好玩（玩家被无预警击杀、过度侧翼） | 高 | 高 | 试玩「死得莫名其妙」> 1/5 | 预警规范强制校验；小队通讯音与字幕；侧翼/投掷令牌按难度限额；首发惩罚 |
| D6 | 八关内容量超出人力 | 高 | 中 | 第 5 周 01–05 关未全部可通 | 优先级：01–05 + 08 必做；06（新图货舱）与 07 可顺延到 V35 前两周 |
| D7 | 无美术/音频人力，V35 资产无法交付 | 高 | 高 | V34 结束时资产未开工 | `lite` 路线兜底：程序化多骨 rig + 程序化音乐分层引擎仍能交付动画系统、光照、界面、TAA 等全部非资产项；手工资产项标注为「可后补」 |
| D8 | TAA/SSR/级联在集显上不达标 | 中 | 中 | 中档 < 45fps | 全部挂画质档；中档关闭 SSR、级联 2 级；动态分辨率兜底 |
| D9 | 自定义着色器注入随 three 升级失效 | 低 | 中 | 启动自检失败 | three 版本锁定 0.180；升级走专项任务 + 截图回归；自检失败回退原生 PCF |
| D10 | WebTransport 部署条件不具备 | 中 | 低 | 预发环境无 HTTP/3 | 仅 WebSocket + 输入冗余也能达到退出标准（需实测）；传输层已抽象 |
| D11 | 延迟补偿引发「躲进掩体仍被打死」的投诉 | 高 | 中 | 受害者保护触发占比 > 8% | 回溯上限 300ms、受害者保护减伤、击杀回放解释；上限做成服务器配置 |
| D12 | 存档迁移出错导致玩家丢档 | 低 | 高 | 迁移单测失败；用户反馈 | 旧键保留一个版本周期；主档 + 备份；导出/导入；迁移用真实 V31 存档样本测试 |
| D13 | 键位调整（Q/E 改探身）引起老玩家不适 | 中 | 低 | — | 首次启动提示 +「经典键位」预设 + 全键位可重绑 |
| D14 | 范围蔓延：每个版本都想加内容 | 高 | 高 | 版本中途新增 WP | 版本内只接受缺陷修复与已列 WP；新想法进「V37+ 备选」清单 |
| D15 | 单文件体积膨胀破坏「双击即玩」 | 中 | 中 | `lite` 超预算 | 体积预算进 CI；动画关键帧/数据压缩；大件只进 `full` |

**V37+ 备选**（明确不在本规划内）：载具、队友 AI 战役伙伴、排位与赛季、地图编辑器与创意工坊、WebGPU 渲染后端、跨机房部署、更多语言。

---

## 附录 E：实施前需复核的事项

这份规划基于对代码的通读与抽查，没有运行游戏，也没有运行任何测试。以下各点在审查中**未能直接验证**，动手前请先确认，结论与规划假设不符时相应调整。

| # | 待确认 | 影响的工作包 | 确认方法 |
| --- | --- | --- | --- |
| E1 | 当前测试是否全绿（85 项单机 + 联机专项）。README 写「85 项」，而 `test_suite.mjs` 中 `ok(` 调用点约 72 处，两者口径不同 | WP32-0, WP32-10 | 实际运行并记录结果作为基线 |
| E2 | 真实的 draw call、三角面、帧时间。文中的降幅目标和预算缺少基线 | 附录 C, WP35-7 | 四类参考机跑 `?bench`，写入 `baseline.json` |
| E3 | `raycast` 当前单次耗时（文中「15–25µs」是估计） | WP32-5 | 微基准 |
| E4 | 联机快照体积与带宽（文中「约 90KB/s」按字段数估算） | WP36-1 | 抓包或在服务器统计 `ws.send` 字节 |
| E5 | `server/sim.js` 与客户端物理是否真的逐位一致（未做对比） | WP32-5 | 基准对比测试本身即答案 |
| E6 | 联机模式下本地玩家控制器在哪里被推进（`mp.js` 把 `G.game.update` 换成了恒返回真的包装，主循环据此继续调 `player.update`——推断，未追踪） | WP32-7, WP36-2 | 读 `mp.js:375–380` 与主循环 |
| E7 | 客户端移动输入是否已对斜向做归一化 | A11, WP36-2 | 读输入模块 `v_` |
| E8 | 手柄死区与灵敏度曲线的现状；现有 Gamepad 轮询支持到什么程度 | WP33-7 | 读 `game.js:63194–63220` |
| E9 | 特效 `Cf`、地面 `O1`、背景 `pv` 的内部实现（粒子/贴花池大小、是否已有平面反射） | WP33-5, WP35-3, WP35-6 | 读对应工厂 |
| E10 | 基础步枪 `mi` 的完整配置与飞鸦/猎犬的调参表 `Ui`（附录 B 中这三者的数值取自审查报告与代码片段，个别字段为推断） | 附录 B | 读 `game.js:66444–66450, 70131` |
| E11 | m2 的中继数量、m3/m6 的 `maxAlive` | WP34-6 | 读 `campaign.js:28–151` |
| E12 | 波次调度内部逻辑（约 `game.js:72100–72190`） | WP34-4 | 读代码后再替换为导演 |
| E13 | `maps.json` 为何缺少导出器会写出的三个键（文件比导出器旧，还是导出路径不同） | A12, WP32-6 | 重跑导出器对比 |
| E14 | 压缩包能否按顶层声明干净切分（是否存在跨模块合并声明、依赖提升顺序的代码） | WP32-2 | 拆分脚本第一遍的未解析符号报告 |
| E15 | NUC 上实际运行的服务是否与仓库一致、`MP_DEV` 是否确实生效 | A1 | 登录主机检查 unit 与进程环境（本次审查未连接任何主机） |
| E16 | `template.head.html` 前 240 行的样式细节 | WP35-10 | 重做界面前通读 |

此外，文中所有「人周」与排期都是在假定 2 程序 + 1 策划 + 1 美术/音频的前提下的粗估；V35 对美术与音频人力的依赖最重，若没有这部分人力，请按附录 D 的 D7 走 `lite` 路线并把手工资产项后移。





