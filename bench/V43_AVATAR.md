# V43 · 联机士兵模型（程序化）

- 目标：把对战模式的远端角色从 V36 方盒占位升级为参考 CS / 使命召唤的战术士兵，不引入外部美术资产/新依赖。
- 实现：`src/mp_avatar.js`（独立 feature，加载为 `window.SX_MP_AVATAR`）；`src/mp.js` 的 `buildRemoteModel` 优先调用它，旧 V39 无该模块时回退方盒模型。
- 截图：[versions/screens/v43_avatar](../versions/screens/v43_avatar)（front_two_teams / closeup_front / back / crouch / dead）。

## 模型

| 部位 | 内容 |
|---|---|
| 头 | 头骨/巴拉克拉瓦、头盔壳 + 布罩 + 盔带、护目镜（双镜片）、面罩、降噪耳机、麦克风、NVG 座 |
| 躯干 | 胸/腹、前后防弹板、肩带、侧板、三联弹匣袋 + 插扣、医疗包、电台、天线、水袋、腰带 |
| 手臂 | 肩甲、压缩袖、护肘、前臂、腕带、战术手套 + 四指/拇指、队标 |
| 腿 | 大腿、腿挂枪套、护膝、胫甲、战斗靴（鞋底/鞋头/鞋带/踝托） |
| 武器 | 机匣、护木、枪管、消焰器、枪托、握把、弹匣、瞄具/镜片、枪带 |
| 材质 | 程序化迷彩贴图 + 法线贴图；布料/装甲/装具/队标/镜片 5 种 |

几何按“关节 × 材质”用 `BufferGeometry` 合批：浏览器约 **43 mesh/人、5 材质**；VM 测试桩缺少 BufferGeometry 时逐件 Mesh 回退，逻辑测试可跑。

## 动作

- 行走：摆腿 + 膝弯，手臂保持持枪小幅摆；
- 持枪：由 `tools/perf/probe_avatar.mjs` 网格搜索肩/肘旋转，使双手贴合握把/护木；
- 蹲伏：屈膝 + 降髋（0.92→0.70），不再整体压扁；
- 死亡：整体前倾 + 四肢松垂；
- 开火/换弹：沿用 `fireT`/`reloadT` 协议字段，`riflePitch`/`magY`/`armL` 可观测，旧测试兼容。

## 成本（8 人同屏 / 1280×720 / q=medium / 同步 90 帧）

| 模型 | 平均帧时间 | draw calls | 三角形 |
|---|---:|---:|---:|
| V36 方盒 | 9.01 ms | 772 | 498,225 |
| V43 士兵 | 9.98 ms | 996 | 575,121 |

+0.97ms / +224 calls，仍低于 16.7ms 预算。复现：`node tools/perf/bench_mp_avatar.mjs`。

## 验收

- `node tools/test_v43_avatar.mjs`：11/11（模型层级、43 mesh、双队配色、蹲伏降髋、死亡倒地、行走关节、清理、无 pageerror）；
- `node tools/test_v38_mp_perf.mjs`：20/20（30k 帧堆增量 6.3KB、dispose 逐件回收）；
- `node tools/test_v39_i18n.mjs`：18/18（含远端换弹动作）；
- `npm run test:fast`：lint + unit + 12 项冒烟全绿。

## 已知限制 / 下一步

- 程序化刚体分段，无蒙皮、骨骼、ragdoll、脚步 IK；近看是“高细节低多边形”，不是扫描级 3A 模型。
- 8 人比旧模型多约 224 draw calls；如需进一步压，可把 5 材质降为 3 或对小队做 InstancedMesh。
- 高负载环境下 `test_v39_mp_e2e2` 出现过服务端命令队列限流断线（ws=3 / queue_full），与模型改动无关；空闲时复测。
