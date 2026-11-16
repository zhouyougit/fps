# 集成状态（lead）

## V40 地图深化：已完成

| 地图 | 轮次 | boxes | 面积 | 密度 | verify |
| --- | ---: | ---: | ---: | ---: | --- |
| harbor | 12 | 781 | 4800m² | 0.163 | ok |
| depot | 12 | 727 | 4524m² | 0.161 | ok |
| ship | 18 | 572 | 2971m² | 0.192 | ok（90.3%） |
| core | 13 | 705 | 4256m² | 0.166 | ok |

## 验收
- `node tools/test_mapdata.mjs`：144/144；
- `node tools/test_v39_visual.mjs`：13/13；
- `node server/test_round.cjs` + `node server/test_net2.cjs`：31/31 + 87/87；
- `versions/几猫_V40.html` / `game.html`：3623.5KB；
- 四图终版截图：`versions/screens/v40_*.png`。

## 流程与工具
- `tools/mapwork/`：Metal 截图（shoot）、live 校验（verify）、GPU 信号量（gpulock）、复杂度/轮次/集成脚本；
- 单文件预算：V40 临时 6MB，后续优化目标 3.5MB；
- 地图数据三方同步已完成：server/maps.json + packages/data/maps/*.map.json + src/data_maps.js。
