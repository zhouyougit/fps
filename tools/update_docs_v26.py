
import io
p='CHANGELOG.md'
s=io.open(p,encoding='utf-8').read()
s=s.replace('## V25 · 第四张联机地图「核心舱」（当前）','## V25 · 第四张联机地图「核心舱」')
v26='''# 更新日志

## V26 · 动态音乐与环境声（当前）
- **动态音乐层**：music_drone / ost / perc / brass 四条程序化 loop，按标题、探索、交火、BOSS、联机五种状态交叉淡化。
- **地图环境声**：港区/货轮海声、货轮风声、冷库与核心舱设备低鸣；随 MapKit 地图切换自动调整。
- **联机音效**：命中、击杀、阵亡、回合结束提示音；联机状态自动切换 MP 音乐层。
- **低血量心跳**：沿用 V9 心跳，与动态音乐叠加。
- **测试**：音频专项 6 项全部通过（层启动、战斗切换、冷库环境、BOSS、联机状态、无错误）。
- **已知范围**：音乐为程序化 loop，无人声 VO；只有主音量滑杆，无独立音乐/音效分轨。

'''
assert s.startswith('# 更新日志\n')
s=s.replace('# 更新日志\n', v26, 1)
io.open(p,'w',encoding='utf-8').write(s)

p2='README.md'
r=io.open(p2,encoding='utf-8').read()
r=r.replace('- **最新版**：[`几猫_V25.html`](versions/几猫_V25.html)','- **最新版**：[`几猫_V26.html`](versions/几猫_V26.html)')
r=r.replace('| **V25** | 核心舱 | 第四张联机地图、反应堆/冷却回路/天桥、大厅选图、核心舱专项 5 项 |','| **V25** | 核心舱 | 第四张联机地图、反应堆/冷却回路/天桥、大厅选图、核心舱专项 5 项 |\n| **V26** | 动态音频 | 五状态音乐层、四图环境声、联机命中/击杀/回合音效、音频专项 6 项 |')
r=r.replace('- **联机第四图（V25）**：','- **动态音频（V26）**：探索/交火/BOSS/联机音乐层，四张地图环境声与联机战斗音效。\n- **联机第四图（V25）**：')
io.open(p2,'w',encoding='utf-8').write(r)
print('docs v26 updated')
