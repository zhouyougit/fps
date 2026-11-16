# 测试清单（V53 · TEST-3）

> 生成：2026-11-16 · `node tools/test_inventory.mjs`（机器可读：`node tools/test_inventory.mjs --json`）
> 口径：**被引用** = 在 `tools/run_tests.mjs`（fast/full/domain）或 `tools/test_suite.mjs` 中被字符串引用。只读源码，不启动浏览器。

## 统计

| 项 | 数量 |
|---|---:|
| 扫描到的 `tools/test_*.mjs` | 115 |
| 测试脚本（不含清单工具自身） | 114 |
| 被 runner/套件引用 | 26 |
| 孤儿（未被任何套件引用） | 88 |
| 清单工具自身（不计入测试） | 1 |

- `test_suite.mjs` 没有再引用其它 `test_*.mjs`，因此 25 个引用全部来自 `run_tests.mjs`；被引用脚本按 fast/full/domain 标注在下方。
- 没有“被引用但文件缺失”的条目（`missingReferences=0`）。
- 未删除任何测试文件；孤儿去留留待 TEST-3 后续决策。

## 被引用（25）

| 文件 | 引用位置 |
|---|---|
| `test_fast.mjs` | fast |
| `test_mapdata.mjs` | domain:map |
| `test_save_migration.mjs` | domain:save |
| `test_suite.mjs` | full |
| `test_v32_ground.mjs` | domain:map |
| `test_v34_missions.mjs` | domain:gameplay |
| `test_v35_audio.mjs` | domain:audio |
| `test_v35_ui_smoke.mjs` | domain:ui |
| `test_v35_visual.mjs` | domain:visual |
| `test_v36_net.mjs` | domain:net |
| `test_v37_dead_complete.mjs` | domain:gameplay |
| `test_v37_gameplay.mjs` | domain:gameplay |
| `test_v38_armory_sim.mjs` | domain:save |
| `test_v38_audio_perf.mjs` | domain:audio |
| `test_v38_mp_perf.mjs` | domain:perf |
| `test_v38_ui_polish.mjs` | domain:ui |
| `test_v39_i18n.mjs` | domain:ui |
| `test_v39_mp_e2e2.mjs` | domain:net, full |
| `test_v53_acceptance.mjs` | full |
| `test_v39_visual.mjs` | domain:visual |
| `test_v41_perf.mjs` | domain:perf |
| `test_v43_avatar.mjs` | domain:visual |
| `test_v44_drone.mjs` | domain:gameplay |
| `test_v46_map_release.mjs` | domain:map |
| `test_v50_quality_auto.mjs` | domain:ui |
| `test_v51_enemy_shadow.mjs` | domain:gameplay |

## 孤儿（88）

<details>
<summary>展开孤儿名单（88）</summary>

`test_ads_cp.mjs`, `test_all.mjs`, `test_audio.mjs`, `test_boss.mjs`
`test_boss2.mjs`, `test_boss3.mjs`, `test_camp.mjs`, `test_click.mjs`
`test_click2.mjs`, `test_combat.mjs`, `test_complete.mjs`, `test_current.mjs`
`test_depot.mjs`, `test_dmr.mjs`, `test_elite.mjs`, `test_elite2.mjs`
`test_file.mjs`, `test_final.mjs`, `test_fire.mjs`, `test_fire2.mjs`
`test_hit.mjs`, `test_hit2.mjs`, `test_hound_ctl.mjs`, `test_m4.mjs`
`test_missions.mjs`, `test_mp.mjs`, `test_mp_avatar.mjs`, `test_mp_avatar2.mjs`
`test_mp_combat.mjs`, `test_mp_core.mjs`, `test_mp_debug.mjs`, `test_mp_maps.mjs`
`test_mp_tdm.mjs`, `test_mp_v16.mjs`, `test_mp_vote.mjs`, `test_profiles.mjs`
`test_relay_cut.mjs`, `test_semi.mjs`, `test_semi2.mjs`, `test_semi3.mjs`
`test_semi4.mjs`, `test_ship.mjs`, `test_shotgun.mjs`, `test_soak.mjs`
`test_targets.mjs`, `test_v10.mjs`, `test_v10c.mjs`, `test_v10ux.mjs`
`test_v10ux2.mjs`, `test_v11.mjs`, `test_v12.mjs`, `test_v13.mjs`
`test_v14.mjs`, `test_v15.mjs`, `test_v18.mjs`, `test_v19.mjs`
`test_v2.mjs`, `test_v24.mjs`, `test_v27.mjs`, `test_v28.mjs`
`test_v30.mjs`, `test_v30_remote.mjs`, `test_v30_remote2.mjs`, `test_v31.mjs`
`test_v31_spawn.mjs`, `test_v32.mjs`, `test_v33_feedback.mjs`, `test_v33_input_audio.mjs`
`test_v33_movement.mjs`, `test_v33_weapons.mjs`, `test_v34_ai.mjs`, `test_v34_boss.mjs`
`test_v34_progress.mjs`, `test_v35_ui.mjs`, `test_v36_smoke.mjs`, `test_v39_mp_e2e.mjs`
`test_v39_perf.mjs`, `test_v49_avatar_lod.mjs`, `test_v6.mjs`, `test_v6_file.mjs`
`test_v7.mjs`, `test_v8.mjs`, `test_v8_damage_focus.mjs`, `test_v8_file.mjs`
`test_v8_focus.mjs`, `test_v8b.mjs`, `test_v9.mjs`, `test_v9_file.mjs`

</details>

## lint 覆盖与遗留债务

- `tools/lint_tests.mjs` 的 FILES 共 38 个：原有 31 个 + runner 引用的 test 脚本 + V41–V52 的 `test_*.mjs`（去重）。新增两项检查的严格范围 27 个（套件/测试 + V41–V52 + `check_versions.mjs`）。
- 本机绝对路径：全量 77 文件 / 102 处；严格范围 15 文件 / 28 处已登记为基线（只允许减少，新增一处即 lint 失败）。V41–V52 测试已全部清零（test_v41_perf/test_v43_avatar/test_v44_drone/test_v46_map_release/test_v49_avatar_lod/test_v50_quality_auto/test_v51_enemy_shadow）；test_suite/e2e2/testkit 也已清除启动用硬编码；pwargs 仅保留 findChrome 的候选探测列表（不含用户主目录）。
- 收尾：55/114 个历史测试缺少 `process.exit(...)` 或 testkit `closeBrowser`；严格范围 0。新增测试必须显式 `process.exit` 或使用 testkit 收尾。
- `waitForTimeout`：94 文件 / 349 处历史遗留；只有 `test_fast.mjs` 禁止新增，其余留给后续清理。
- 新增检查未一次性卡死历史文件：已知本机路径按文件/次数登记基线，数量下降不报错，数量上升报错。

## 跨平台路径（ENG-5）

- `tools/pwargs.mjs` 集中实现 `findChrome()`：`CHROME_EXE` 优先，其次 macOS 常见安装位置、Linux `google-chrome`/`chromium`/`chromium-browser`（含 PATH 探测）、Windows Chrome 安装目录；找不到时抛出带“已尝试路径”的明确错误。
- `ROOT` 由 `import.meta.url` 推导；`gameUrl()` 的相对路径按仓库根解析，不依赖调用方 cwd。
- `testkit.mjs`、`test_suite.mjs`、`check_versions.mjs`、`test_v39_mp_e2e2.mjs`、`test_v41_perf.mjs`、`test_v43_avatar.mjs`、`test_v44_drone.mjs`、`test_v46_map_release.mjs`、`test_v49_avatar_lod.mjs`、`test_v50_quality_auto.mjs`、`test_v51_enemy_shadow.mjs` 已改用 `findChrome()`；`test_fast.mjs` 通过 testkit 继承同一解析。`test_v44_drone` / `test_v46_map_release` / `test_v49_avatar_lod` / `test_v50_quality_auto` / `test_v51_enemy_shadow` 五个测试改用 pwargs 的 `ROOT` + `pathToFileURL` 打开 `game.html`，不再依赖 cwd。`check_versions.mjs --no-browser` 不触发 Chrome 探测。

## 剩余风险

- 15 个历史套件文件仍含本机路径（28 处），全部是 V32–V39 的旧套件测试：`test_mapdata`、`test_save_migration`、`test_v32_ground`、`test_v34_missions`、`test_v35_audio`、`test_v35_ui_smoke`、`test_v35_visual`、`test_v36_net`、`test_v37_dead_complete`、`test_v37_gameplay`、`test_v38_armory_sim`、`test_v38_audio_perf`、`test_v38_ui_polish`、`test_v39_i18n`、`test_v39_visual`；V41+ 已清零。这些只登记基线，新增一处即失败。
- 88 个孤儿测试未纳入任何套件，无法从 `test:full` 获得回归信号；其中 `test_v39_mp_e2e.mjs` 已被 `test_v39_mp_e2e2.mjs` 取代，建议后续归档而不是直接删除。
- `test_v39_perf.mjs` 仍被 perf 域引用（TEST-4 计划移除），在 runner 改动前会计入“被引用”。
- 全量 lint 仍会读取全部 115 个 `test_*.mjs`（114 个测试 + 清单工具）做遗留统计；文件继续增加时输出会变长，但不影响退出码。
