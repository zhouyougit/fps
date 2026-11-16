# 地图开发提速记录（2026-11-13）

## 结论
工具链已经不是瓶颈：截图/校验从分钟级降到秒级；现在的主要成本是每个子 Agent
“改多少代码 + 迭代几次 + 写多长日志”。因此提速分两部分：工具降本 + 轮次纪律。

## 实测对比

| 环节 | 优化前 | 优化后 | 倍数 |
| --- | --- | --- | --- |
| 6 机位 medium（船） | 123s（SwiftShader） | 40s（Metal） | 3.1x |
| 6 机位 medium（港区） | 271s | 约 60-90s | 3-4x |
| verify（每次启动 Chrome） | 46s | 0.3s（--live 复用） | 150x |
| 单轮工具耗时 | 3-5 分钟 | 1-2 分钟 | 2-3x |
| 单轮总耗时（实测） | 25-30 分钟 | 目标 10-12 分钟 | 2-3x |

## 已落地

1. **Metal GPU**：`tools/pwargs.mjs` 统一参数；shoot/verify/server 导出全部改用它。
2. **浏览器信号量**：`tools/mapwork/gpulock.mjs`，2 槽 + PID 存活检测 + 5 分钟陈旧回收。
3. **verify 不再开浏览器**：shoot 落盘 `tools/mapwork/<id>/live.json`（boxes/bounds/relays），
   verify `--live` 0.3s 完成；源码比 live 新时会警告。
4. **fast 预设**：`shoot --fast` = 800x450 / low / 只跑 `--names` 指定的 2-3 机位。
5. **`novisual=1`**：verify 与 server 导出使用，减少画面扩展启动开销。
6. **轮次纪律**：每轮 1 个主题、≤60 行、1 次 shoot + 1 次 verify、2-3 张图、
   ROUNDS.md ≤12 行；每次激活做 4 轮（R4-7 / R8-10），减少激活/汇报开销。
7. **预算**：用户明确允许放宽体积，V40 先完成内容、后续再统一优化；build.cjs 临时预算 6MB（当前约 3.54MB），避免为体积反复压缩拖慢轮次。
8. **测试集中**：子 Agent 不跑全量；lead 用 `tools/run_tests.mjs` + GPU 统一验收。

## 下一步可选（按 ROI）

- **持久化截图服务**：常驻一个 Chrome，多轮复用页面，省掉每次 ~25s 启动；
  预计总共省 15-20 分钟，但实现/协调成本较高，暂不做。
- **自动指标追加**：脚本把 calls/tris/boxes/verify 自动写进 ROUNDS.md，省 Agent 输出。
- **单轮单机位**：只保留 1 张关键机位 + 1 张 wide，进一步省视觉 token；
  对细节轮次可行，对结构轮次仍需 2-3 张。
- **2 槽并行**：已开；如机器负载 > 30 再降回 1 槽。