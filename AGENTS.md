# AGENTS.md · 《几猫 · SALTLINE》开发约定

本文件是给后续 coding agent / 协作者的“经验压缩包”。项目是单文件 3D FPS：源码拆在 `src/`、`packages/`、`server/`，构建时拼成一个约 3.69MB（未压缩）的 HTML。

**当前状态（以实际构建为准）**：最新产物 `versions/几猫_V55.html`，`game.html` 也是 V55（平衡，未压缩约 3.69MB）；V54 是收敛版、V53 是改进版、V52 是收口版、V51 是可读版、V50 是设置版、V49 是视距版、V48 是稳定版、V47 是打磨版、V46 是内存版、V45 是精简版、V44 是平衡版、V43 是角色版、V42 是架构版、V41 是性能版。`package.json` 版本 0.55.0。判断版本请看 `window.__VERSION_LABEL` / `__BUILD__.version`。

---

## 1. 开始前必读

1. [README.md](README.md)：构建、目录、运行方式。
2. [TESTING.md](TESTING.md)：GPU、快/全套件、状态驱动规则。
3. [CHANGELOG.md](CHANGELOG.md)：最近版本的修复与已知限制。
4. 本文件：协作边界、关键不变量、常见坑。

原则：**没有明确要求，不加玩法/内容/新依赖**。优先修 bug、可复现性、性能地基。

---

## 2. 构建

构建必须显式给 target 和 profile：

    node tools/build.cjs versions/几猫_V55.html v55
    node tools/build.cjs game.html v55

- profile：`v32..v55` / `dev`；v41+ 在 v39 功能集上加入 `ext_lights.js`（固定灯池）与 `mp_avatar.js`（联机士兵）。
- **不要无参数运行**：旧默认会把 `game.html` 覆盖成 v32；构建脚本现在会直接报错退出。
- **历史快照只读**：目标在 `versions/` 下且已存在时，构建会拒绝覆盖；确需重建必须显式加 `--force`。
- **发布不压缩**：项目没有尺寸限制，V55 最终产物约 3.69MB；`--minify` 仅作为可选实验能力保留，不作为默认构建。
- **不要为了修一个版本重建所有版本**：V32–V55 是历史快照，平时只构建当前版本；发布/校验时才用 `check_versions.mjs`。
- 构建会拼接 `src/config/*` + `src/game/manifest.json` 列出的 6 个 game 片段 + 扩展 + sim/net；缺失模块会明确报错，不要绕过。
- `src/game.js` 已拆到 `src/game/`；不要重新生成/覆盖单文件，改片段并保持 manifest 顺序。可用 `node tools/game_bundle.mjs --check` 还原检查。
- 不要并发构建同一个 target；`tools/build.cjs`、`package.json` 由 lead 统一改。

---

## 3. 测试：默认 GPU + 状态驱动

### 3.1 一条命令

    npm run test:fast        # lint + unit + 12 项浏览器冒烟，约 20s
    npm run serve:test       # 另开终端；test:full 的 85 项默认连 127.0.0.1:3311
    npm run test:full        # unit + 85 项 + V55 专项 + V32–V55 版本 + 双端 e2e + server
    npm run test:domain ui   # ui/gameplay/map/net/visual/audio/save/perf
    node tools/run_tests.mjs --only=tools/test_v39_visual.mjs

日志：`tools/logs/<时间>-<名字>.log`，runner 会输出耗时汇总并以 0/1 退出。

### 3.2 GPU 是最大加速项（实测）

| 配置 | 首次 ready | FPS |
|---|---:|---:|
| SwiftShader + low | 36.9s | 1.0 |
| Metal + low | 18.0s | 30.9 |
| Metal + low + `novisual=1` | 12.6s | 60.2 |

- [tools/pwargs.mjs](tools/pwargs.mjs) 统一参数：macOS 默认 Metal，保留 SwiftShader 兜底；Linux/CI 默认软件渲染，可用 `SX_GPU=metal|sw` 覆盖。
- 逻辑测试一律加 `novisual=1`；只有 `test_v35_visual`、`test_v39_visual` 这类画面测试不开。
- 不要用 Playwright 的 headless-shell 跑 Metal：要显式 `executablePath` 指向完整 Chrome（testkit 已处理）。

### 3.3 测试硬规则

1. **禁止“睡 2 秒再断言”**：用 `waitState(page, 'playing')`、`waitForFunction`、事件计数。
2. **时间推进用固定步**：`await step(page, n)` 调 `__SX_LOOP.step(n)`，不要靠 rAF。
3. **一个测试文件一个 browser**；同一场景复用 page，必要时 `__SX.applyMission` / `enemies.clear` 重置，不要每项 new page。
4. **页面错误**：testkit 自动收集 `page.__testErrors`，断言为空。
5. **收尾**：`closeBrowser(browser)`（3s race）+ `process.exit(fail?1:0)`，避免 `browser.close()` 挂住 CI。
6. **不要并发开多个 Chrome**：同一时间最多 1–2 个浏览器进程；8 个 agent 同时跑 Playwright 会把机器 load 打到 20–68，测试全部变慢/超时。
7. 双端联机 e2e 必须用**两个独立 `chromium.launch()` 进程**，不要同一浏览器的两个标签页（第二页 SwiftShader/Metal 都可能卡死）。
8. 新增测试前先跑 `npm run test:lint`；快速套件里出现 `waitForTimeout` 会被判失败。

### 3.4 全量 vs 快速

- 改一行 UI / 文案 / 单模块：`test:fast` + 本域（如 `test:domain ui`）。
- 改地图/协议/存档/核心循环：对应域 + `test:fast`。
- 版本收尾/发版：`test:full`，85 项全绿才留档。
- 85 项在 Metal 下约 9–11 分钟；SwiftShader 约 30 分钟。不要因为“保险”每改一行跑全量。

---

## 4. 代码地图与关键不变量

### 4.1 目录

- `src/game/`：three.js + 引擎 + 玩法，按 `manifest.json` 拆成 6 个片段（V42）；改片段要克制，保持顺序。
- `src/config/quality.js` / `balance.js`：画质与玩法/性能参数的唯一源（V42）；调平衡先改这里。
- `src/ext_lights.js`：V41 固定点光源池（8 地图灯 + 2 闪光 + 1 补光）。
- `src/mp_avatar.js`：V43/V45/V47 程序化联机士兵（几何合批、4 材质、持枪/蹲伏/死亡动作、落地阴影）；`window.SX_MP_AVATAR`。
- `src/config/avatar.js`：V47 队服/材质/比例/落地阴影参数；`window.SX_AVATAR_CONFIG`。
- `src/mapkit.js`：V46 切图 LRU（非 harbor 最多 2 张；`release/cache/cacheStats`）。
- `src/template.head.html`：HTML/CSS 外壳。
- `src/core_loop.js`：固定 60Hz 循环、`step/hash`、状态机。
- `src/core_save.js` / `core_bridge.js`：统一存档、旧键镜像、迁移。
- `src/ext_*.js`：手感/反馈/音频/输入/AI/敌人/BOSS/任务/成长/画面/UI/音乐/联机/LOD。
- `packages/sim/`：客户端/服务器共享物理与伤害。
- `packages/net/protocol.js`：二进制协议（SNAP=1、ACK=5，version=2）。
- `packages/data/maps/*.map.json`、`server/maps.json`、`src/data_maps.js`：地图碰撞数据。
- `server/server.cjs`：60Hz 权威服务器；`server/test_*.cjs` 回归。
- `tools/`：构建、测试、导出、基准；`versions/`：单文件留档。

### 4.2 不能破坏的硬约束

- **固定步 60Hz**：`__SX_LOOP.step(n)` 必须精确推进 n 个 tick；`hash()` 对同状态可复现。测试/回放依赖它。
- **客户端/服务器物理同源**：改 `packages/sim` 必须同时跑客户端和服务端测试。
- **地图碰撞三方同步**：客户端、`server/maps.json`、`packages/data/maps/*.json`；V40 当前箱数 harbor 781 / depot 727 / ship 572 / core 705。不要手改生成物，走：
  `client 导出 → server/export_maps.mjs → tools/export_maps_data.mjs → server/maps.json + packages/data/maps/*.map.json + src/data_maps.js`。
- **协议**：首字节分发（SNAP=1 / ACK=5）；二进制快照 id 是数值 nid，客户端要 nid↔字符串 id 映射；ACK 单调；全量帧 `baseline=0` 才能删除离开玩家。
- **存档**：主档损坏先读备份并修复主档；备份只从有效主档写；迁移不能反向覆盖新值；导入失败不能污染内存；军械库/四轨音量 schema 要兼容 6 把枪。
- **联机锁**：`server.cjs` 对 `PROFILES_FILE` 有单进程锁；测试服务器必须用独立 `PROFILES_FILE`（`test_round.cjs` 已按端口隔离），否则第二个实例会拒绝启动。
- **本地化**：`SXI18n` 中英同键、`missing()===0`；新增文案必须同时补 zh/en，不能只补中文。
- **画面**：只通过 `G.render.postModule.materials` 找 `post-final`；低画质 FXAA、medium+ TAA；阴影静止时不应每帧重绘；低画质切图探针同步完成。
- **灯光预算**：任何时刻场景点光源 ≤12（8 地图灯 + 2 闪光，另有 1 盏相机补光）；`K.light()` 只登记记录，不要直接 `new PointLight`；灯数恒定，避免 `NUM_POINT_LIGHTS` 变化触发重编译。
- **配置层**：`src/config/*` 必须在 game 片段之前执行；武器数值只改 `packages/data/weapons/*.json`，不要恢复 `weapon_ext.js` 的重复表。
- **V44 平衡**：自杀无人机自爆参数只改 `src/config/balance.js → enemies.suicideDrone`；旧 `30_gameplay.js` 里的 62 已移除，不要再写死。
- **联机角色**：`buildRemoteModel` 优先调用 `SX_MP_AVATAR.build`；模型必须保持 `grp.children >=8`、`armL/R`、`elbowL/R`、`rifle`、`mag`、`magBase`、`muzzleLocal` 字段，旧 V39 回退依赖这些。
- **角色预算**：近距约 33 mesh/人（含落地阴影）、4 材质；>55m 切 3 mesh 轮廓替身（8 人远距 ~798 calls）。不要再无脑增加独立 Mesh，优先进 `mp_avatar.js` 合批。
- **军械库调试接口**：`armorySet` 会解锁并装备；只验证选择/锁定路径用 `armorySelect`（不解锁）。
- **联机命令背压**：`mp.js` 预测队列 ≥90 时暂停发新命令（`net.cmdBackoff`）；不要移除，否则高负载下服务端 queue_full/断线会复现。
- **联机远端 LOD**：>55m 隐藏全身切 `mp-far` 轮廓；改模型时保持 `r.far` 与 `lodFar` 可见性切换。
- **敌人接地阴影**：hound/siege/emp 由 `ext_enemies2.attachGroundBlob` 挂共享圆形阴影；gull 不加。
- **架构文档**：模块边界/新增模块流程见 `ARCHITECTURE.md`；`tests/unit/architecture.test.mjs` 会校验关键契约。
- **构建体积**：项目没有尺寸限制（V55 未压缩约 3.69MB）；新增模块/资源仍先看构建明细，但不要为了体积牺牲可读性/调试性。

### 4.3 调试入口

常用 query：

    ?q=low&noaudio=1&autostart=1&dt=0.1&novisual=1

常用全局：

- `__G`：game/player/weapon/enemies/level/render。
- `__SX`：god、cutAll、applyMission、armorySet、launchFast。
- `__SX_LOOP`：step(n)、tick()、hash()、stats()。
- `__SX_MOVE`：slide、vault、lean、state。
- `__SX2`：missions、graph、kill、checkpoint。
- `__MP` / `__SX_NET`：联机状态、remotes、debug。
- `__SX_LANG`：set、missing。
- `__SX_VISUAL` / `__SX_LOD`：画面统计、LOD。
- `window.__errors` / pageerror：运行时错误。

---

## 5. 智能体协作（最重要的流程经验）

### 5.1 角色与边界

- **lead**：拆任务、给文件所有权、统一构建/跑浏览器测试、审最终 diff、发版。
- **子智能体**：只改指定文件 + 补单测；**不启动 Playwright**，不跑全量，不改 `tools/build.cjs`/`package.json`/别人的文件。
- 一个文件同一时间只有一个 owner；需要跨文件时先报告，由 lead 调整。
- 当前目录没有 git worktree 隔离，多个 agent 共享工作区；**并发写同一文件必冲突**。

### 5.2 并发上限

- 同时最多 2–3 个子智能体；需要浏览器的任务同一时间最多 1 个。
- 不要把 6–8 个“review + fix”同时开满：CPU/GPU 被 Chrome 抢光，所有测试变慢、超时、僵尸。
- 审查和修复尽量同一个 owner 连续做，减少“reviewer 写报告 → fixer 重读 73k 行”的交接。

### 5.3 任务书写

必须包含：

1. 目标（只修 bug/性能，不加功能）；
2. 允许修改的文件清单（精确到文件）；
3. 验收命令（例如 `node --test tests/unit/sim.test.mjs`，或“只写代码，不跑浏览器”）；
4. 时间盒（15–20 分钟收口）；
5. 报告格式：改动文件、测试结果、剩余风险。

禁止：“你全面 review 一下然后都修了”——范围过大，必然读大量无关代码。

### 5.4 长任务与后台 job

- 超过 ~60s 的命令放后台，重定向日志，拿 job id；不要前台等 120s 超时。
- job 状态可能假 `running`；以日志、`ps`、退出码为准，必要时 kill。
- 测试结束仍挂起时，先看日志最后一行是否已经“全部通过”，再决定是否 kill。
- 不要反复 sleep 轮询；用 `job_output(wait:true)` 或先做别的独立工作。

### 5.5 常见协作事故

- 两个 agent 同时改 `mp.js`/`build.cjs` → 后写覆盖前写；必须串行或分文件。
- 一个 agent 跑全量测试占满机器 → 其他 agent 全部超时；浏览器测试集中给 lead。
- 构建产物过期 → 测试跑的是旧 `game.html`；测试前确认 target 的 `__VERSION_LABEL`。
- 服务器锁冲突 → 第二个测试服务器启动失败；检查 `profiles.json.lock` 与 `PROFILES_FILE`。

---

## 6. 版本与发布

1. 构建目标产物：`versions/几猫_Vxx.html` + `game.html`（显式 profile）。
2. 更新 `CHANGELOG.md`（本轮问题、修复、验证、已知限制）。
3. 更新 `README.md` 最新版链接/轮数/测试命令。
4. 需要时截图到 `versions/screens/`。
5. 跑 `node tools/check_versions.mjs --all`（V32–V55 产物）与当前版本的地图/画面/性能/服务器回归。
6. 不要用新源码重建历史版本；历史产物是快照，语义应对应当时源码。
7. `package.json` 版本与产物版本可能不同步；以产物内 `__BUILD__.version` 为准。

---

## 7. 性能与已知限制

- 测试/开发优先 Metal；SwiftShader 只作 CI 兜底。
- 不要每帧做 `querySelector`、对象 clone、全量数组扫描；HUD/远端/阴影都应缓存 + 门控。
- 静态 LOD：`ext_lod.js` 只对标记为装饰的组按 60m 显隐；不要标记碰撞/玩法对象。
- V39 的 draw call 收益主要来自阴影 pass 合批；真正的 InstancedMesh/贴花图集尚未做。
- V41 固定灯池把冷库 111ms 降到 13.4ms；high 档 MSAA 已降到 2。近级阴影只按位置判脏、30Hz 更新。
- V46 已做切图 LRU：非 harbor 最多 2 张，切走释放地图自有几何/标签；共享材质和 programs 仍可能增长（P4-2 的一部分），不要误以为已完全释放。
- V43 联机士兵仍是程序化刚体分段（无蒙皮/骨骼/ragdoll），近看是“高细节低多边形”；8 人比旧模型多约 224 draw calls。
- 远级阴影用逐光源 `shadowRadius` 退化成 pcf-lite，无法彻底按光源分离（引擎 PCSS 是全局 chunk）。
- 低画质切图同步探针会有一次百毫秒级尖峰；这是为确定性付出的代价。
- 服务器仍是单进程内存 + 单 profiles 文件；多 worker 需要独立存储/共享层。
- 遗留测试仍有 `waitForTimeout`；lint 会列出，新测试不要再加。
- 军械库购买提示等少量 `ext_progress` 文案仍可能中文；新增本地化要补全。

---

## 8. 不要做

- 不要无参数构建，或默认覆盖 `game.html`。
- 不要为一行文案改跑 85 项 / 重建 8 个版本。
- 不要同时开 8 个 Chrome 或 8 个浏览器型 agent。
- 不要在同一文件上与另一个 agent 并行写。
- 不要手改 `server/maps.json`、`packages/data/maps/*.json`、`src/data_maps.js` 的生成结果。
- 不要只补中文/英文一边的 i18n。
- 不要在逻辑测试里等真实时间/动画结束。
- 不要把“测试通过”建立在旧构建产物上。
- 不要在没有测量数据时宣称性能提升。

---

## 9. Definition of Done

- [ ] `npm run test:fast` 绿（lint + unit + 12 项）。
- [ ] 受影响域测试绿；发布前 `npm run test:full` 85/85。
- [ ] 没有新增 pageerror / `window.__errors`。
- [ ] 构建 target/profile 正确，V55 最终产物未压缩（约 3.69MB），`__VERSION_LABEL` 正确。
- [ ] 新文案中英同键、`missing()===0`。
- [ ] 改地图/协议/存档/共享 sim 时，对应的服务端/客户端回归都跑过。
- [ ] CHANGELOG/README 已更新；产物已留档。
- [ ] 报告写清：改了什么、验证了什么、还剩什么风险。
