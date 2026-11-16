
import io
p='src/campaign.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

# m6 data
rep('''      done: "外锚地已控制"
    }
  ];''','''      done: "外锚地已控制"
    },
    {
      id: "m6", code: "06", name: "归途", sub: "05:42 · 破晓 · 最终行动",
      desc: "回到四号泊位。接管组已经进场，蜃把整座港区接进了自己身体。两处中继、一个终形，然后做出选择。",
      locTitle: "几猫港区 · 四号泊位 · 破晓", locSub: "几猫突击小队 · 蜃 · 终形",
      goal: "切断最后两处中继", extractText: "前往大门撤离",
      map: "harbor",
      relays: [
        { id: "a", label: "堆场中继 · 西" },
        { id: "c", label: "码头中继 · 中" }
      ],
      extraction: { x: -32, z: 6, radius: 2.6 },
      start: { x: 29, z: 20, yaw: 1.57 },
      waves: [{ gull: 3, hound: 2, drone: 2 }, { gull: 3, hound: 3, drone: 2, marksman: 1 }, { gull: 4, hound: 3, drone: 3, elite: 2, heavy: 1, marksman: 2 }],
      patrol: { gull: 2, hound: 2 }, maxAlive: 10, damageScale: 1.22, hpScale: 1.16,
      rain: 0, exposure: 1.1, saturation: 1.1, evac: 0, boss: true,
      bossHp: 2600, bossName: "蜃 · 终形", bossEvac: 30,
      env: { sun: [0.5, 0.42, 0.76], zen: [0.07, 0.1, 0.18], hor: [1.0, 0.6, 0.42], away: [0.15, 0.17, 0.24], col: [1, 0.72, 0.5], light: 0xffd7b0, intensity: 9.5, exposure: 1.1, envIntensity: 2.1, rain: 0, saturation: 1.1 },
      challenges: { time: 480, head: 12 },
      speaker: "蜃",
      threats: "全兵种 · 蜃 · 终形",
      recommend: "精确射手 / 破门锤",
      brief: ["切断最后两处中继", "摧毁蜃·终形", "在撤离窗口内做出选择"],
      intro: "回到四号泊位。接管组已经进场——蜃把整座港区的防线接进了自己身体。它只想拖住他们，给你时间。",
      all: "最后两处中继断开！蜃·终形展开，摧毁核心！",
      done: "四号泊位 · 归途"
    }
  ];''')

# camp ending load
rep('''        camp.challenges = raw.challenges && typeof raw.challenges === "object" ? raw.challenges : {};''','''        camp.challenges = raw.challenges && typeof raw.challenges === "object" ? raw.challenges : {};
        camp.ending = raw.ending === "silent" || raw.ending === "open" ? raw.ending : null;''')

# clear ending UI
rep('''    var back = document.querySelector(".x-final-back");
    if (back && back.parentNode) back.parentNode.removeChild(back);
  }''','''    var back = document.querySelector(".x-final-back");
    if (back && back.parentNode) back.parentNode.removeChild(back);
    var ch = document.querySelector(".x-end-choice");
    if (ch && ch.parentNode) ch.parentNode.removeChild(ch);
    var en = document.querySelector(".x-ending");
    if (en && en.parentNode) en.parentNode.removeChild(en);
  }''')

# replace addCampaignComplete body ending
rep('''    var redeploy2 = actions.querySelector('[data-act="redeploy"]');
    if (redeploy2) { redeploy2.classList.remove("primary"); }
    var note = document.createElement("p");
    note.className = "x-final";
    note.textContent = "全部 " + MISSIONS.length + " 个行动完成 · 港区行动结束";
    panel.insertBefore(note, actions);
    var back = document.createElement("button");
    back.className = "btn x-final-back";
    back.textContent = "返回标题";''','''    var redeploy2 = actions.querySelector('[data-act="redeploy"]');
    if (redeploy2) { redeploy2.classList.remove("primary"); }
    var isFinal = MISSIONS[MISSIONS.length - 1].id === "m6";
    if (isFinal && camp.ending) {
      showEnding(camp.ending, panel, actions, false);
      return;
    }
    var note = document.createElement("p");
    note.className = "x-final";
    note.textContent = isFinal ? "全部 " + MISSIONS.length + " 个行动完成 · 最后的决定" : "全部 " + MISSIONS.length + " 个行动完成 · 港区行动结束";
    panel.insertBefore(note, actions);
    if (isFinal) {
      var choice = document.createElement("div");
      choice.className = "x-end-choice";
      choice.innerHTML = '<button class="btn primary" data-end="silent">沉船 · 沉默</button><button class="btn" data-end="open">带核心回港 · 公开</button>';
      panel.insertBefore(choice, actions);
      choice.querySelector('[data-end="silent"]').onclick = function () { showEnding("silent", panel, actions, true); };
      choice.querySelector('[data-end="open"]').onclick = function () { showEnding("open", panel, actions, true); };
    }
    var back = document.createElement("button");
    back.className = "btn x-final-back";
    back.textContent = "返回标题";''')

# showEnding function
rep('''  /*__TRAINING__*/''','''  function endingText(kind) {
    if (kind === "open") {
      return "你把核心搬上接驳艇。全港广播被劫持，一个不属于任何人的声音开始念名单。<br>岸台没有回答。她的频道在 05:43 之后一直是空的。<br><b>蜃：第 4 次。</b>";
    }
    return "接驳艇撤到安全距离。港区主控在日出前下线。<br>四号泊位在 06:20 恢复作业，调度表上多了三个名字，又很快被划掉。<br><b>蜃：第 4 次。</b>";
  }

  function showEnding(kind, panel, actions, save) {
    camp.ending = kind;
    if (save) saveCamp();
    var choice = panel.querySelector(".x-end-choice");
    if (choice) choice.remove();
    var note = panel.querySelector(".x-final");
    if (!note) {
      note = document.createElement("p");
      note.className = "x-final";
      panel.insertBefore(note, actions);
    }
    note.classList.add("x-ending");
    note.innerHTML = endingText(kind);
    if (!panel.querySelector(".x-final-back")) {
      var back = document.createElement("button");
      back.className = "btn x-final-back";
      back.textContent = "返回标题";
      back.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        G.game.menus.show("none");
        applyMission(0); camp.current = 0; camp.trainSel = false;
        G.game.state = "title"; G.game.menus.show("title");
        G.hud.show(false); G.input.setGameplay && G.input.setGameplay(false);
        G.player.enabled = false; G.render.post.fade = 1;
        G.events.emit("game:state", { state: "title", prev: "complete" });
      });
      actions.appendChild(back);
    }
    var dim = document.querySelector(".m-title .m-eyebrow .m-dim");
    if (dim) dim.textContent = "几猫港区 · 档案 B4-0271 已封存";
  }

  /*__TRAINING__*/''')
io.open(p,'w',encoding='utf-8').write(s)
print('m6 + ending patched')
