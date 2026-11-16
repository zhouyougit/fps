
import io
p='src/campaign.js'
s=io.open(p,encoding='utf-8').read()

# per-mission completion headings
s=s.replace('''      intro: "几猫队员，这里是行动指挥。按顺序切断三处中继，撤离艇在南端舷梯等你。",
      all: "三处中继全部断开！撤离艇已靠泊，快撤！"''','''      intro: "几猫队员，这里是行动指挥。按顺序切断三处中继，撤离艇在南端舷梯等你。",
      all: "三处中继全部断开！撤离艇已靠泊，快撤！",
      done: "四号泊位已解除封锁"''')
s=s.replace('''      intro: "指挥部通报：暴雨封港，仓库内有三个上行中继。猎犬已经进场，注意近距离交火。",
      all: "仓库中继全部离线！东门集结点已标定，动作快！"''','''      intro: "指挥部通报：暴雨封港，仓库内有三个上行中继。猎犬已经进场，注意近距离交火。",
      all: "仓库中继全部离线！东门集结点已标定，动作快！",
      done: "仓库区已恢复控制"''')
s=s.replace('''      intro: "最后一班接驳将在四十秒后关闭。切断四处中继，然后守住撤离点。",
      all: "四处中继全部断开！撤离窗口开始计时，守住阵地！"''','''      intro: "最后一班接驳将在四十秒后关闭。切断四处中继，然后守住撤离点。",
      all: "四处中继全部断开！撤离窗口开始计时，守住阵地！",
      done: "码头封锁已解除"''')

# generic title premise + debrief labels
old='''    var premise = document.querySelector(".m-title .m-premise");
    if (premise) premise.textContent = "行动 " + m.code + " · " + m.name + "。" + m.desc;'''
new='''    var premise = document.querySelector(".m-title .m-premise");
    if (premise) premise.textContent = "港区防御系统失控。三个行动阶段，逐步切断封锁并撤离。";
    var dk = document.querySelector(".m-debrief .m-k");
    if (dk) dk.textContent = "行动 " + m.code + " · " + m.name + " · 行动简报";
    var dh = document.querySelector(".m-debrief .m-h");
    if (dh) dh.textContent = m.done || "行动完成";'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)

p2='src/ext.js'
s=io.open(p2,encoding='utf-8').read()
old2='''        setTimeout(function () {
          if (G.game.state === "playing")
            G.hud.message("1 / 2 切换武器 · G 投掷手雷 · V 近战", 5);
        }, 2600);'''
new2='''        setTimeout(function () {
          if (G.game.state !== "playing") return;
          var m = G.game.currentMission;
          G.hud.message((m ? "行动 " + m.code + " · " + m.name : "") + "  |  1/2 切换武器 · G 手雷 · V 近战", 5);
        }, 2600);'''
assert s.count(old2)==1
s=s.replace(old2,new2,1)
io.open(p2,'w',encoding='utf-8').write(s)
print('v3 polish applied')
