
import io
p='CHANGELOG.md'
s=io.open(p,encoding='utf-8').read()
s=s.replace('## V28 · 首次出击引导与训练目标（当前）','## V28 · 首次出击引导与训练目标')
v29='''# 更新日志

## V29 · 最终发布（当前）
- **发布版**：V15–V29 十五轮完成，最终文件 versions/几猫_V29.html；标题页显示「V29 · 发布版」。
- **回归**：完整单机验收 85/85 全部通过；MP 专项（TDM / 战斗 / 四图 / 投票 / 核心舱）在发布前全部通过。
- **发布收尾**：README 重写为最终说明（地图、战役、联机、操作、工程、部署、测试、限制）；关闭发布服务器 MP_DEV 测试后门（需要时手动开启）。
- **内容总览**：4 张地图、6 关三幕双结局、4 图联机 TDM + 地图投票、动态音乐/环境声、HUD 可访问性、新手引导与训练目标。
- **最终测试基线**：85 项单机完整验收、15 项核心冒烟、9 项 TDM、4 项四图、4 项投票、5 项核心舱、7 项联机战斗。

## V15–V29 总结
V15 冷库地图 → V16 联机骨架 → V17 联机战斗 → V18 货轮 → V19 终章 → V20 TDM → V21 三图 → V22 地图投票 → V23 地图打磨 → V24 叙事包装 → V25 核心舱 → V26 动态音频 → V27 可访问性 → V28 新手引导 → V29 发布。

'''
assert s.startswith('# 更新日志\n')
s=s.replace('# 更新日志\n', v29, 1)
io.open(p,'w',encoding='utf-8').write(s)
print('changelog v29 updated')

p2='server/fps-mp.service'
s2=io.open(p2,encoding='utf-8').read()
s2=s2.replace('Environment=MP_DEV=1\n','',1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('unit dev backdoor removed')
