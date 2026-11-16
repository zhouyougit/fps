
import io
p='src/campaign.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

# chapters on each mission
rep('''      id: "m1", code: "01", name: "四号泊位"''','''      id: "m1", code: "01", name: "四号泊位", chapter: "第一幕 · 断电"''')
rep('''      id: "m2", code: "02", name: "仓库区"''','''      id: "m2", code: "02", name: "仓库区", chapter: "第一幕 · 断电"''')
rep('''      id: "m3", code: "03", name: "码头封锁"''','''      id: "m3", code: "03", name: "码头封锁", chapter: "第二幕 · 反扑"''')
rep('''      id: "m4", code: "04", name: "冷链仓库"''','''      id: "m4", code: "04", name: "冷链仓库", chapter: "第二幕 · 反扑"''')
rep('''      id: "m5", code: "05", name: "外锚地"''','''      id: "m5", code: "05", name: "外锚地", chapter: "第二幕 · 反扑"''')
rep('''      id: "m6", code: "06", name: "归途"''','''      id: "m6", code: "06", name: "归途", chapter: "第三幕 · 溯源"''')

# interludes after each mission 1-5
rep('''      done: "四号泊位已解除封锁"
    },''','''      done: "四号泊位已解除封锁",
      interlude: ["接驳艇提前三分钟靠泊。舵手说，雷达上多了一艘船。", "蜃第一次切进频道：第 3 次。你们每次都从堆场开始。"]
    },''')
rep('''      done: "仓库区已恢复控制"
    },''','''      done: "仓库区已恢复控制",
      interlude: ["货单：B4-0271，收件人四号泊位，1 件（活体）。", "仓库广播里多了一段被删掉的录音。蜃说：谢谢。"]
    },''')
rep('''      done: "码头封锁已解除"
    },''','''      done: "码头封锁已解除",
      interlude: ["港区主控倒下，核心信号却已上传外锚地。", "舵手把船头转向外海：潮水不等人，别回头。"]
    },''')
rep('''      done: "冷链仓库已恢复控制"
    },''','''      done: "冷链仓库已恢复控制",
      interlude: ["冷冻舱还在运行，货位写着 B4-0271。", "冷库的低温里，有一件不该存在的东西。"]
    },''')
rep('''      done: "外锚地已控制"
    },''','''      done: "外锚地已控制",
      interlude: ["船上没有活人，只有一排等待唤醒的机械体。", "蜃：这不是通信中继。这是我的记忆。"]
    },''')

# next button interlude
rep('''    b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); launchMission(next); });''','''    b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); openInterlude(camp.current, next); });''')

# card chapter label
rep('''        '<span class="code">行动 ' + m.code + '</span>' +''','''        '<span class="code">' + (m.chapter || "行动") + ' · ' + m.code + '</span>' +''')

# briefing kicker chapter
rep('''    q(".x-br-k").textContent = "行动 " + m.code + " · " + m.name + " · 行动简报";''','''    q(".x-br-k").textContent = (m.chapter || "行动") + " · 行动 " + m.code + " · " + m.name;''')
io.open(p,'w',encoding='utf-8').write(s)
print('chapter/interlude data patched')
