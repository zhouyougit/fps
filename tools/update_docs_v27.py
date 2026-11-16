
import io
p='CHANGELOG.md'
s=io.open(p,encoding='utf-8').read()
s=s.replace('## V26 · 动态音乐与环境声（当前）','## V26 · 动态音乐与环境声')
v27='''# 更新日志

## V27 · 可访问性与 HUD 自适应（当前）
- **HUD 缩放**：90% / 100% / 115%，用 CSS zoom 重排，不裁切四角信息。
- **字幕大小**：小 / 中 / 大，作用于通讯字幕与说话人；与 HUD 缩放独立。
- **高对比模式**：HUD 文本加黑边/阴影，通讯字幕加深背景，关键 HUD 文字转纯白。
- **持久化**：三项写入 saltline.access.v1，刷新后保留。
- **设置页**：辅助区新增 HUD 缩放、字幕大小、高对比；原有难度/准星/晃动/减少动态保留。
- **测试**：V27 专项 5 项（HUD 缩放、字幕大小、高对比、持久化、无错误）全部通过；设置分组回归更新为 6+ 个 seg。

'''
assert s.startswith('# 更新日志\n')
s=s.replace('# 更新日志\n', v27, 1)
io.open(p,'w',encoding='utf-8').write(s)

p2='README.md'
r=io.open(p2,encoding='utf-8').read()
r=r.replace('- **最新版**：[`几猫_V26.html`](versions/几猫_V26.html)','- **最新版**：[`几猫_V27.html`](versions/几猫_V27.html)')
r=r.replace('| **V26** | 动态音频 | 五状态音乐层、四图环境声、联机命中/击杀/回合音效、音频专项 6 项 |','| **V26** | 动态音频 | 五状态音乐层、四图环境声、联机命中/击杀/回合音效、音频专项 6 项 |\n| **V27** | 可访问性 | HUD 缩放、字幕大小、高对比模式、设置持久化、专项 5 项 |')
r=r.replace('- **动态音频（V26）**：','- **可访问性（V27）**：HUD 90–115%、字幕小中大、高对比模式，全部持久化。\n- **动态音频（V26）**：')
io.open(p2,'w',encoding='utf-8').write(r)
print('docs v27 updated')
