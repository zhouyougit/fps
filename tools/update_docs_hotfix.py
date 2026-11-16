
import io
p='CHANGELOG.md'
s=io.open(p,encoding='utf-8').read()
old='''- **测试**：自动化验收扩展到 71 项，新增设置分组、减少动态、装饰层不挡点击、暂停返回标题与当前行动；V14 专项 8 项全部通过。'''
new='''- **测试**：自动化验收扩展到 71 项，新增设置分组、减少动态、装饰层不挡点击、暂停返回标题与当前行动；V14 专项 8 项全部通过。
- **热修 · 任务标志物可达性**：行动 2 的西区/东区中继此前用 groundHeight(x,z,10) 取高度，命中仓库屋顶（8.3m/9.0m），玩家无法到达。现改为 2.5m 内取地面，并新增 validateObjectives()：逐个检查目标是否在可行走点 2.2m 内、与地面高差是否合理、从出生点是否存在导航路径；三关全部通过。新增自动化检查 2 项（共 73 项）。'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)

p2='README.md'
r=io.open(p2,encoding='utf-8').read()
r=r.replace('node tools/test_suite.mjs      # 71 项完整验收（推荐）','node tools/test_suite.mjs      # 73 项完整验收（推荐）')
r=r.replace('| **V14** | 可访问性与打磨 | 设置分组、减少动态、暂停返回标题、重试二次确认、点击穿透修复、71 项自动化验收 |','| **V14** | 可访问性与打磨 | 设置分组、减少动态、暂停返回标题、重试二次确认、点击穿透修复、标志物可达性校验、73 项自动化验收 |')
r=r.replace('- **可访问性**：','- **可达性校验**：任务开始自动检查每个中继/撤离点是否在可站立点附近且存在导航路径，异常会输出警告。\n- **可访问性**：')
io.open(p2,'w',encoding='utf-8').write(r)
print('docs hotfix updated')
