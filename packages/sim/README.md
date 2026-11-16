# packages/sim — 几猫·SALTLINE 共享模拟层

纯逻辑、零依赖、Node 与浏览器共用。**禁止**引用 three.js / DOM / WebAudio / `Math.random` / `Date.now` / `performance.now`。
当前版本 `0.32.0`，对应 ROADMAP_V32-V36 WP32-4 / WP32-5 的核心交付。

## 文件与加载顺序

| 顺序 | 文件 | 内容 |
| --- | --- | --- |
| 1 | `math.js` | clamp / lerp / invLerp / smoothstep / damp / dist2 / dist3 / normalize2 / normalize3 / nearlyEqual |
| 2 | `rng.js` | mulberry32 种子 RNG、命名流 `createStreams(seed)` |
| 3 | `world.js` | AABB + 2m 均匀网格 CSR + 2D DDA 射线、胶囊、地面、视线 |
| 4 | `movement.js` | `stepPlayer(state, cmd, world, h, tuning)`：走跑蹲跳、土狼、跳跃缓冲、滑铲、翻越 |
| 5 | `weapons.js` | 散布（WP32-0 修复公式）、后坐模式、距离衰减、霰弹弹丸 |
| 6 | `damage.js` | 伤害管线 pre → armor → difficulty → apply → post |
| 7 | `command.js` | BTN 位掩码、makeCommand / validateCommand |
| 8 | `index.js` | `SALT_SIM.create({ map })`、version |

每个文件都是同一套 UMD：Node 下依次 `require` 前一个文件、共享同一个命名空间；浏览器下按上表顺序
`<script>` 拼接，共享 `window.SALT_SIM`。

```html
<script src="packages/sim/math.js"></script>
<script src="packages/sim/rng.js"></script>
<script src="packages/sim/world.js"></script>
<script src="packages/sim/movement.js"></script>
<script src="packages/sim/weapons.js"></script>
<script src="packages/sim/damage.js"></script>
<script src="packages/sim/command.js"></script>
<script src="packages/sim/index.js"></script>
<script>
  const sim = SALT_SIM.create({ map: 'harbor', maps: MAPS_JSON.maps });
  sim.step({ tick: 0, mx: 0, my: 1, yaw: 0, buttons: SALT_SIM.command.BTN.SPRINT }, 1 / 60);
</script>
```

```js
// Node
const SIM = require('./packages/sim');            // index.js
const maps = require('./server/maps.json').maps;
const sim = SIM.create({ map: 'harbor', maps });
const world = SIM.world.createWorld(maps.depot);
```

## world API

```js
const world = createWorld(mapSpec, opts?);
world.raycast(origin, dir, maxDist = 500, mask = MASK.BULLET, out?) // 零分配，返回 out
// → { t, hit, point:{x,y,z}, normal:{x,y,z}, surface:number, boxIndex }
//    miss 时 hit=false、t=maxDist、boxIndex=-1
world.queryCylinder(x, z, r, cb, mask?)   // cb(boxIndex)，按索引升序，返回 false 提前结束
world.moveCapsule(pos, vel, dt, radius, height, snap) // pos/vel 原地修改
world.groundHeight(x, z, maxY = 50)
world.lineOfSight(a, b)
world.overlapsCylinder(pos, radius, height)
world.boxAt(i)                            // 调试/迁移用对象视图（复用返回值）
world.surfaceName(id) / world.surfaceIndex(name)
world.boxes = { min: Float32Array, max: Float32Array, flags: Uint8Array, surf: Uint8Array, count }
world.bounds / groundY / seaY / quayX / grid / playerStart
```

flags：`1=bulletOnly 2=playerOnly 4=noNav 8=thin`；mask 表示“要忽略的位”。
`MASK.BULLET = 2|8`（与 server/sim.js 一样跳过 playerOnly，另外跳过可穿透的 thin）、
`MASK.PLAYER = 1`、`MASK.NAV = 1|4`、`MASK.SIGHT = 2|8`。

射线语义逐条复刻 `server/sim.js` / `src/game.js d3`：先测 y=groundY / y=seaY 平面（quayX 分支），
再做 slab；从盒内部出发不命中；零方向不命中；未命中不再分配对象。
`moveCapsule` 与 d3:40066 一致：水平圆-盒推出最多 3 次迭代，垂直方向单次 floor/ceil，
台阶 0.42，snap 时贴地。

## movement

```js
const st = SIM.movement.createPlayerState(world, spawn);
SIM.movement.stepPlayer(st, cmd, world, 1/60, tuning?);
```

`cmd = { tick, mx, my, yaw, pitch, buttons, weaponSlot }`，轴已归一化到单位圆；
边沿（刚按下）由 `prevButtons` 推导。状态含 `pos/vel/onGround/crouch01/coyote/jumpBuf/slideT/lean`，
本步事件：`jumped/landed/landSpeed/hitWall/hitCeil/rescued/vaulted`。
跳跃初速 `sqrt(2*21*1)=6.48`，重力 21，滑铲 0.65s，翻越 0.3s（V33 铺垫）。

## 测试与基准

```bash
node --test tests/unit/sim.test.mjs                 # 41 项单测
node --test --experimental-test-coverage tests/unit/sim.test.mjs
node tools/sim_parity.mjs                          # 引擎 vs sim（四图，1e-4 阈值）
node tests/bench/physics_bench.mjs                 # 港区 566 盒，写 bench/baseline.json
```

## 服务器端集成建议

1. `server/sim.js` 可以删掉，改成：
   ```js
   const { createWorld, MASK } = require('../packages/sim/world.js');
   const maps = require('./maps.json').maps;
   const world = createWorld(maps[id]);
   ```
2. 服务器现有 `raycast` 返回 `{dist,point,normal,surface,box}`；sim 返回
   `{t,hit,point,normal,surface,boxIndex}` 且 miss 不再返回 `null`。适配点：
   `hit.dist → hit.t`、`hit.box → world.boxAt(hit.boxIndex)`、`if (!hit.hit)`。
   `surface` 是 Uint8 索引，用 `world.surfaceName(hit.surface)` 还原字符串。
   若要 100% 复刻旧 server 语义（thin 仍挡子弹），显式传 `FLAGS.PLAYER_ONLY`；
   默认 `MASK.BULLET` 会把 `thin` 视为可穿透。地面平面材质可用
   `createWorld(spec, { groundSurface: 'asphalt' })` 指定。
3. `moveCapsule(pos, vel, dt, radius, height, snap)` 参数顺序与 server/sim.js 完全一致，
   直接替换即可；返回对象是复用的，不要跨调用保存。
4. 服务器 tick 改为 60Hz 模拟、30Hz 发快照；每 tick 消费一条 `Command`（先“取最新”）。
5. 地图数据继续用 `maps.json` 的单图对象；WP32-6 迁移到 `packages/data/maps/*.map.json` 后
   `createWorld` 无需改动（`bounds/groundY/seaY/quayX/boxes` 字段已兼容）。
6. 目前 `server/maps.json` 未导出 `noNav`（26/102/40/86 个盒与引擎不同，仅影响导航，不影响
   射线/移动）；WP32-6 的导出器补上后即可完全一致。
