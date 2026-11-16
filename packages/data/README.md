# packages/data — 玩法数据（WP32-6）

本目录是地图玩法数据的唯一来源。可视几何仍由 `src/maps/<id>/build.js`（当前为
`src/map_depot.js` / `map_ship.js` / `map_core.js` + 港区）生成；碰撞盒由
`server/maps.json` 提供，导出时合并。

## 文件

| 文件 | 说明 |
| --- | --- |
| `maps/<id>.authored.json` | 手工维护：bounds / ground / spawns / pickups / relays / zones / nav |
| `maps/<id>.map.json` | 导出产物：authored + `server/maps.json` 的 boxes + 自动生成的 cover + `validated` |
| `maps/index.json` | 四图索引与统计 |
| `../src/data_maps.js` | 客户端内联数据 `window.__SX_MAPS_DATA`（**不含 boxes**） |

## 命令

```bash
node tools/export_maps_data.mjs   # 生成四张 .map.json + index.json + src/data_maps.js；校验失败退出码 1
node tools/test_mapdata.mjs       # 结构 + Playwright 运行时校验（需先构建 game.html）
```

## 字段约定

- `bounds`：真实可玩包围盒。四张图不再共用港区的 ±40/±30（N9）。
- `ground`：`{ y, seaY, quayX }`。室内图 `seaY=null, quayX=null`，服务器应据此跳过海面判定；
  货轮 `seaY=-1.6, quayX=null` 表示甲板外皆海。
- `spawns.player`：必须与 `MapKit` 的 `playerStart` 一致（导出器只校验地面与可达性；
  冷库出生点与纸箱相距 0.25m，引擎在出生帧会把玩家推出，这是既有地图几何）。
- `spawns.enemy`：`type:"ground"`，12–20 个（与 air 合计不超过 20）。
- `spawns.air`：冷库/货轮补的空中出生点（G11）；不做地面校验，只校验不卡在碰撞盒内。
- `spawns.team`：恰好 2 个，`{team,pos,yaw,radius}`。
- `spawns.boss`：每图至少 1 个（G10）。
- `pickups`：`{kind:"medkit"|"armor"|"ammo"|"grenade", pos, respawn}`，每图 ≥8；
  必须落在可行走地面、不在碰撞盒内、从出生点可达（G10）。
- `relays`：`{id,pos,labelKey,label}`；港区 id 为 `a/b/c`（对应关卡 `relay_a...`），
  冷库/货轮为建造器注册的 `depot_r1...` / `ship_r1...`，核心舱暂无中继。
  中继自身 1.67m 的碰撞盒会干扰 groundHeight，校验时用 `y+0.45` 且跳过自身碰撞。
- `cover`：导出器由低矮碰撞盒（0.5–2.1m 高）的四个面自动生成，偏移 0.75m，去重后每区最多 8 个。
- `nav`：`{cell:0.5, agentRadius:0.5}`。
- `triggers` / `probes`：V34/V35 使用，当前为空数组。

## 客户端接口

`src/data_maps.js` 生成：

```js
window.__SX_MAPS_DATA = {
  version: 1,
  maps: {
    harbor: { bounds, ground, spawns, cover, pickups, relays, zones, nav },
    depot:  { ... },
    ship:   { ... },
    core:   { ... }
  }
};
```

- 键为地图 id；每个地图对象只含玩法数据，**没有 boxes**（客户端碰撞仍由引擎/服务器提供）。
- 读取示例：`const m = window.__SX_MAPS_DATA.maps[MapKit.current()];`
- 文件为紧凑 JSON（约 19KB），`tools/build.cjs` 的 `CORE_ORDER` 已包含 `data_maps.js`，
  构建后可直接在 `game.html` 里读取（测试会校验内联结果与文件一致）。

## 已知限制 / 数据来源说明

- `server/maps.json` 没有导出 `noNav`，因此 `.map.json` 的 `boxes[].flags` 只能保留
  `bulletOnly` / `playerOnly`，`tag` 原样保留（如 `backdrop`）。`noNav` 需在重新导出
  `server/maps.json` 时补上。
- 港区拾取物沿用 `src/ext.js` 的 14 处；其中 `(-26.5, 1.6)` 落在货堆上（groundHeight 0.81、
  与碰撞盒相交），已微调为 `(-25.94, 2.43)`；仓库内 4 处原坐标的 `groundHeight(...,12)`
  会取到 8.33m 的屋顶，数据里按地板 `y=0.03` 记录。
- `server/maps.json` 里的港区 teamBases 第二点是 `(24,12)`（压在集装箱上），
  `server.cjs` 的默认值是 `(29,20)`；数据取 `(28,20)`（距码头边缘 0.65m，可站立）。
- 中继与拾取物的 `y` 是地面高度；引擎侧仍应按各自的碰撞体高度放置模型。
