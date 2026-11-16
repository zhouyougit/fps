
import io
p='src/campaign.js'
s=io.open(p,encoding='utf-8').read()
old='''      desc: "码头四处中继。全部断电后必须守住撤离窗口 40 秒，等待接驳。",
      locTitle: "几猫港区 · 北码头 · 黎明", locSub: "几猫突击小队 · 主控核心仍在活动",'''
new='''      desc: "码头四处中继。全部断电后港区主控启动，摧毁核心，打开撤离窗口。",
      locTitle: "几猫港区 · 北码头 · 黎明", locSub: "几猫突击小队 · 主控核心仍在活动",'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('m3 text updated')
