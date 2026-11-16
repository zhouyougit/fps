
import io

p='CHANGELOG.md'
s=io.open(p,encoding='utf-8').read()
v6='''# 更新日志

## V6 · 战术与反馈（当前）
- **战术扫描（Q）**：48 米内标记全部敌人 7 秒，穿墙显示 HUD 菱形与距离；14 秒冷却，扫描时全屏脉冲环 + 提示音。
- **手雷弹道预览**：按住 G 显示抛物线点阵与落点环，松开投掷；触屏按钮同样支持按住/松开。
- **连杀播报**：4 秒内连续击杀触发「双杀 / 三杀 / 四杀 / 五杀」全屏提示。
- **首次交火提示**：第一次被敌人发现时提示 Q 扫描、G 手雷、右键瞄准。
- **触屏**：新增「扫描」按钮，手雷按钮改为按住预览。
- **测试体系**：新增 `tools/test_suite.mjs`，21 项自动化验收（各版本启动、武器数量、扫描、手雷、行动档案真实点击、BOSS 流程）。

'''
assert s.startswith('# 更新日志\n')
s = s.replace('# 更新日志\n', v6, 1)
io.open(p,'w',encoding='utf-8').write(s)

p2='README.md'
r=io.open(p2,encoding='utf-8').read()
r=r.replace('- **最新版**：[`几猫_V5.html`](versions/几猫_V5.html)','- **最新版**：[`几猫_V6.html`](versions/几猫_V6.html)')
r=r.replace('| **V5** | 精确火力 | 精确射手步枪「长眼」（半自动 + 3x 镜）、开镜遮罩、切换武器、专属音效 |',
'''| **V5** | 精确火力 | 精确射手步枪「长眼」（半自动 + 3x 镜）、开镜遮罩、切换武器、专属音效 |
| **V6** | 战术与反馈 | Q 战术扫描、手雷弹道预览、连杀播报、首次交火提示、21 项自动化验收 |''')
r=r.replace('| 投掷手雷 | G |','| 投掷手雷 | 按住 G 预览弹道，松开投掷 |')
r=r.replace('| 近战 | V / F |','| 战术扫描 | Q |\n| 近战 | V / F |')
r=r.replace('node tools/test_all.mjs        # 各版本启动 + 武器数量','node tools/test_suite.mjs      # 21 项完整验收（推荐）\nnode tools/test_all.mjs        # 各版本启动 + 武器数量')
io.open(p2,'w',encoding='utf-8').write(r)
print('docs updated')
