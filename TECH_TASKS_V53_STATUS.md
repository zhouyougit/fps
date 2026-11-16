# TECH_TASKS_V53 执行状态

- 基线：V52（`bc90f50`，tag `v52`）
- 目标产物：`versions/几猫_V53.html` / `game.html`（0.53.0）
- 执行方式：lead 拆分 + 9 个子智能体按文件所有权并行/串行；浏览器与全量验收由 lead 统一跑。
- 状态：✅ 完成 / 🟡 部分完成（有明确余量）/ ⏸ 暂缓（记录原因）

## P0 · 数据与历史

| ID | 状态 | 证据 / 说明 |
|---|---|---|
| ENG-1 版本控制 | ✅ | `.gitignore` + 首个提交 + tag `v52`；`__BUILD__.commit=bc90f50` |
| ENG-2 禁止覆盖历史快照 | ✅ | `versions/` 已存在目标默认 exit 1；`--force` 才覆盖；删除 build:v32..v51 |
| SRV-1 坏档不覆盖 | ✅ | 坏档保真改名、有效 `.bak` 恢复、tmp→fsync→rename；server/test_profiles 64 项 |
| SRV-2 锁心跳 | ✅ | 5s 刷新；存活进程 >30s 仍拒绝第二实例；死 pid + 过期才回收 |

## P1 · 真实缺陷

| ID | 状态 | 证据 / 说明 |
|---|---|---|
| SRV-3 输入放大 | ✅ | 单消息 ≤8 命令、审计按 player+reason 限频；5000 命令日志 4880→1 行 |
| NET-1 一枪两次 | ✅ | 人控命令不带 FIRE、机器人保留；`shotRejected` 回带 shotSeq；2s 按住 20 发仅 1 次 rate |
| NET-2 共享移动 | ✅ | 服务器调用 `sim.movement.stepPlayer`；290 步服务器/客户端最大误差 0 |
| SRV-4 掉海白给 | ✅ | 走 `beginDeath`；1.5s 复活等待、计死亡、广播 |
| SRV-5 原型链 | ✅ | map/mode 类型+自有属性校验；`__proto__` join 不再抛/悬挂 |
| SRV-6 快照节拍 | ✅ | `tick - lastSnapTick >= SNAP_EVERY` |
| SRV-7 房间隔离 | ✅ | 每房单独 try；连续 5 次失败关闭房间，后续房间继续 |
| SAVE-1 导入回写 | ✅ | import/reset 后 mirrorLegacy；战役订阅 import/reset |
| CLI-1 BOSS 固定步 | ✅ | 逻辑 fixedUpdate、表现 update；`step(n)` 可推进 BOSS；hash 含 BOSS |
| CLI-2 暂停时钟 | ✅ | playing/intro 门控 CLOCK 与 fixedUpdate；专项验证 delta=0 |
| 通关回写（V52 老 bug） | ✅ | complete 回调改 `UICLOCK.after`，避开 `cancelGroup('mission')`；专项 beforeUnlocked=1→2、best.m1 写入 |
| CLI-3 海面/天空 | ✅ | `applySeaMode` 覆盖所有非港区加载；四图切换验收通过 |
| CLI-4 LOD 永久隐藏 | ✅ | rebuild 先 restoreAll；depot 6 组隐藏后切 ship 归零 |
| TEST-1 runner 假绿 | ✅ | 只信退出码；`20 FAIL` 不再被当绿 |
| TEST-2 全量套件 | ✅ | `npm run test:full`（需先 `node tools/serve.mjs 3311`）通过；日志见 `tools/logs/` |
| ENG-3 dev 构建 | ✅ | `--profile dev` 正常产出 |
| ENG-4 test:lint | ✅ | 新增脚本；lint 扩到 38 个文件 |

## P2 · 技术债与性能

| ID | 状态 | 证据 / 说明 |
|---|---|---|
| PERF-1 渲染分配 | ⏸ | 未做第一人称独立 Scene / 统一灯集合；需 perf trace 后原型 |
| PERF-2 280ms 卡顿 | ⏸ | 未定位；建议 Chrome trace 后再预编译/分帧 |
| PERF-3 透明网格合批 | ⏸ | 标签图集/贴花合批未做，避免大改渲染管线 |
| PERF-4 常驻计时器 | 🟡 | feedback rAF 去掉、reduceMotion 缓存、visual 滚动和、missions/progress 后台跳过、ext 槽位脏检查；更多 timer 仍可继续收 |
| PERF-5 high 阈值 | ⏸ | medium 回归通过；high p95/分配上限尚未加断言 |
| PERF-6 堆增长 | ⏸ | 未做强制 GC 多圈对比脚本；V53 仍只有单次读数 |
| SRV-8 墙上时钟 | ✅ | 模拟时间 = tick×STEP_MS；射速/换弹/复活/回合/lagcomp 全部迁移 |
| SRV-9 队列追赶 | ✅ | backlog 大时单 tick ≤3 步；峰值 <30，drain 后 0 |
| NET-3 慢漂移 | ✅ | 每接收者 snapSent 阈值 + 0.5s 兜底；2s 窗口 maxGap 417ms |
| SRV-10 代理/IP | ✅ | 仅 TRUST_PROXY 读 XFF 最右合法项；file:// 仅本机回环；metrics detail 门禁 |
| SRV-11 档案增长 | 🟡 | 上限 5000/TTL/IP 脱敏/武器等级校验完成；配件等级缺 schema，未做 |
| NET-4 协议单测 | ✅ | protocol 26 + net2 43 项；0 fail |
| ARCH-1 猴子补丁 | 🟡 | ext.js 两个宿主标记；全局约 30 处钩子表未重写 |
| ARCH-2 空 catch | 🟡 | ext.js 32→0、boss2→0、core_loop 限频；mp.js 等仍有存量 |
| ARCH-3 固定步细节 | 🟡 | hash 扩展 + droppedMs/dropEvents；渲染插值未做 |
| ARCH-4 卸载路径 | ⏸ | 单页生命周期可接受，未做 removeEventListener/off |
| SAVE-2 存档健壮性 | ✅ | 未来字段保留、越界钳制、写失败重试、visibility/pagehide 落盘 |
| ARCH-5 MapKit | ✅ | Set 去重、FogExp2 复用、extend 非港区拒绝、label 抽公共实现 |
| I18N-1 硬编码中文 | 🟡 | ext_progress/ext_ui2/ext_input 替换 154 处、80 新键；campaign/mp/armory 等仍有余量 |
| TEST-3 孤儿测试/lint | 🟡 | 清单 114 个（引用 26/孤儿 88）与 lint 扩围完成；未删除文件 |
| TEST-4 过期 perf | ✅ | 已从 perf 域移除 test_v39_perf |
| ENG-5 本机路径 | 🟡 | V41+ 清零；V32–V39 旧套件仍 28 处基线 |
| ENG-6 压缩 | ⏸ | 无 minifier 依赖；gzip 约 946KB，未做压缩构建 |
| ENG-7 引擎版本 | 🟡 | 产物记录 three r180；未替换为真实依赖 |
| ENG-8 仓库清理 | 🟡 | .gitignore 移出版本库；工作区大文件仍在磁盘（未删除证据） |
| SRV-12 地图回退 | ✅ | 坏 maps.json fatal；仅无文件时回退 |

## P3 · 小项

| ID | 状态 | 说明 |
|---|---|---|
| DOC-1 文档同步 | ✅ | README/AGENTS/CHANGELOG/版本检查已更新；health 版本 V53 |
| ENG-9 devDependencies | ✅ | 依赖 moved；lockfile name=saltline |
| SRV-13 指标/静态流 | ✅ | 双 ring + static read error |
| NET-5 协议细节 | ✅ | LEAN 位补齐、客户端发送；snapRate/速度回放仍可继续 |
| CLI-5 重复 clamp/全局 | ⏸ | 未做集中化 |
| PERF-7 matrixAutoUpdate | ⏸ | 静态物体优化未做，避免误标动态对象 |

## 验收结果（V53）

| 项目 | 结果 |
|---|---|
| 单元测试 | 196/196 |
| `test:fast` | 12/12 + lint + unit |
| V53 专项 | 13/13（含通关回写回归） |
| 服务器 | profiles 64 + round 31 + net2 110 |
| 域测试 | save/map/ui/gameplay/visual/audio/perf/net 全绿 |
| 双端 e2e | 9/9 |
| 旧 JSON 兼容 | 52/52 |
| 版本产物 | `check_versions --all` 154/154 |
| 全量 `test:full` | 通过（需静态服务器 3311） |
| 产物 | 3,710.8KB / 3.62MB，V53 · 改进 |

## 明确暂缓的原因

1. PERF-1/2/3 需要真实 trace/多设备数据，盲改渲染管线风险高于收益。
2. ARCH-1/4 是 2–4 天的结构性改造，本轮只做短期宿主标记，避免影响联机/回归。
3. ENG-6 需要引入压缩依赖或自研 AST 级压缩，当前项目约定不新增依赖。
4. SRV-11 配件等级需要先扩 `packages/data/weapons/*.json` schema，属于数据协议变更。
5. I18N 全量需要改 campaign/mp/armory 等生产方，超出单轮安全范围。
6. TEST-3 孤儿测试删除会丢历史证据，先保留并静态登记。
