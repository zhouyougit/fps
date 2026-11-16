# src/game/ — 游戏主包片段（V42）

`src/game.js` 原本是 72,918 行的单文件（three.js + 渲染 + 世界 + 玩法 + 启动）。
V42 按“整行切分、拼接后逐字节一致”的方式拆成 6 个片段，由 `tools/build.cjs`
按 `manifest.json` 的顺序拼接进单文件构建。

> 这些片段**不能单独执行**：它们共享同一个 IIFE 作用域与 `var` 声明。
> 改动时请保持顺序，不要移动片段之间的声明依赖。

## 片段顺序

| # | 文件 | 行范围（拆分前） | 内容 |
|---|---|---|---|
| 1 | `00_engine.js` | 1–35289 | three.js 打包、几何/合并工具 |
| 2 | `10_render.js` | 35290–37951 | 天空/软阴影/后处理/HDR/自适应分辨率、showcase |
| 3 | `20_world.js` | 37952–55178 | 材质、物理、道具、港区/关卡构建 |
| 4 | `25_fx.js` | 55179–58805 | 雨雪、粒子、爆炸、碎屑、贴花 |
| 5 | `30_gameplay.js` | 58806–71301 | 音频、玩家、武器、敌人、AI、HUD、目标 |
| 6 | `40_ui_boot.js` | 71302–72918 | 设置/菜单、固定步循环、启动 |

`manifest.json` 是构建契约：新增/调整片段时同时更新它，构建会校验文件存在。

## 检查 / 还原

    # 按 manifest 重新拼出可阅读的完整包（输出到 build/game.bundle.js）
    node tools/game_bundle.mjs
    node --check build/game.bundle.js

    # 快速验证拆分没有改变语义
    node --test tests/unit/config.test.mjs

## 调参入口

玩法/性能参数不要直接改这些片段，优先改：

- `src/config/quality.js` — 画质档位
- `src/config/balance.js` — 玩家/任务/敌人/移动/灯光/自适应
- `packages/data/weapons/*.json` — 武器数值（构建时内联）

详见根目录 `CONFIG.md`。
