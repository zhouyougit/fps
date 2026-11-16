
import io
p='CHANGELOG.md'
s=io.open(p,encoding='utf-8').read()
old='''- **测试**：自动化验收扩展到 47 项，新增难度伤害、准星颜色、镜头晃动、设置持久化、F3 性能面板等检查。'''
new='''- **测试**：自动化验收扩展到 47 项，新增难度伤害、准星颜色、镜头晃动、设置持久化、F3 性能面板等检查。
- **训练靶机修复**：靶机不再绕圈打转，改为在锚点附近缓慢漂移、上下浮动并始终面向玩家；新增青色发光靶环与红色中心点；击杀后立即碎裂（小爆点特效），不再坠地爆炸或伤及他人。'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('changelog updated')
