
import io
p='src/mp.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

rep('''    var mpDead = false, scoreData = null, scoreVisible = false, myKills = 0, myDeaths = 0;''','''    var mpDead = false, scoreData = null, scoreVisible = false, myKills = 0, myDeaths = 0, myTeam = 0;''')

rep('''        ".x-mp-hud .kd{color:var(--bone);}"
      var s = document.createElement("style");''','''        ".x-mp-hud .kd{color:var(--bone);}" +
        ".x-mp-hud .team0{color:#7fc8ff;}" +
        ".x-mp-hud .team1{color:#ff8a7a;}" +
        ".x-mp-round{position:absolute;left:50%;top:36%;transform:translate(-50%,-50%);z-index:81;display:none;pointer-events:none;text-align:center;padding:22px 34px;background:rgba(6,8,10,.86);border:1px solid rgba(232,228,218,.2);}" +
        ".x-mp-round.on{display:block;}" +
        ".x-mp-round .t{font:900 36px/1.1 var(--f-display);letter-spacing:.14em;color:var(--signal);}" +
        ".x-mp-round .s{margin-top:8px;font:500 12px/1.5 var(--f-mono);color:var(--bone-dim);letter-spacing:.1em;}"
      var s = document.createElement("style");''')

rep('''<b data-mp-room>harbor-1</b><span data-mp-count>0 在线</span><span class="kd" data-mp-kd>0K / 0D</span><span data-mp-time>5:00</span><span data-mp-ping>-- ms</span>''','''<b data-mp-room>harbor-1</b><span class="team0" data-mp-team>蓝队</span><span data-mp-score>0 : 0</span><span data-mp-count>0 在线</span><span class="kd" data-mp-kd>0K / 0D</span><span data-mp-time>5:00</span><span data-mp-ping>-- ms</span>''')

rep('''      scoreUi = el("div", "x-mp-score", '<h3>计分板</h3><table><thead><tr><th>呼号</th><th>击杀</th><th>死亡</th></tr></thead><tbody></tbody></table>');
      document.getElementById("ui").appendChild(scoreUi);''','''      scoreUi = el("div", "x-mp-score", '<h3>计分板</h3><table><thead><tr><th>呼号</th><th>队伍</th><th>击杀</th><th>死亡</th></tr></thead><tbody></tbody></table>');
      document.getElementById("ui").appendChild(scoreUi);
      var roundUi = el("div", "x-mp-round", '<div class="t" data-mp-round-t></div><div class="s">下一回合即将开始</div>');
      document.getElementById("ui").appendChild(roundUi);
      scoreUi._round = roundUi;''')

rep('''        selfId = m.id;
        joining = false;
        closeLobby();
        enter(m);''','''        selfId = m.id;
        myTeam = m.team === 1 ? 1 : 0;
        joining = false;
        closeLobby();
        enter(m);''')

rep('''        hud.querySelector("[data-mp-room]").textContent = welcome.room || room;''','''        hud.querySelector("[data-mp-room]").textContent = welcome.room || room;
        var teamEl = hud.querySelector("[data-mp-team]");
        if (teamEl) { teamEl.textContent = myTeam ? "红队" : "蓝队"; teamEl.className = myTeam ? "team1" : "team0"; }''')

rep('''        var me = m.players.find(function (q) { return q.id === selfId; });
        if (me) { myKills = me.kills; myDeaths = me.deaths; }
        if (scoreVisible) renderScore();''','''        var me = m.players.find(function (q) { return q.id === selfId; });
        if (me) { myKills = me.kills; myDeaths = me.deaths; }
        var sc = hud.querySelector("[data-mp-score]");
        if (sc && m.teams) sc.textContent = m.teams[0] + " : " + m.teams[1];
        if (scoreVisible) renderScore();''')

rep('''      if (m.t === "roundEnd") {
        try { G.hud.message("回合结束 · " + (m.winner ? m.winner.name : "无胜者"), 6); } catch (e) {}
      }''','''      if (m.t === "roundEnd") {
        var ru = scoreUi && scoreUi._round;
        if (ru) {
          ru.querySelector("[data-mp-round-t]").textContent = (m.winnerTeam === 0 ? "蓝队胜利" : "红队胜利");
          ru.querySelector(".s").textContent = (m.teams ? m.teams[0] + " : " + m.teams[1] : "") + " · 下一回合即将开始";
          ru.classList.add("on");
        }
        try { G.hud.message("回合结束", 5); } catch (e) {}
      }
      if (m.t === "roundStart") {
        var ru2 = scoreUi && scoreUi._round;
        if (ru2) ru2.classList.remove("on");
        scoreData = null;
        try { G.hud.message("新回合开始", 3); } catch (e) {}
      }''')

rep('''        var grp = new T.Group();
        grp.name = "mp-player";
        var col = colorFor(p.id);''','''        var grp = new T.Group();
        grp.name = "mp-player";
        var col = new T.Color(p.team === 1 ? 0xff6a55 : 0x4fa8ff);''')

rep('''        return "<tr><td>" + (p.id === selfId ? "▶ " : "") + p.name + "</td><td class='k'>" + p.kills + "</td><td>" + p.deaths + "</td></tr>";''','''        return "<tr><td>" + (p.id === selfId ? "▶ " : "") + p.name + "</td><td class='" + (p.team === 1 ? "team1" : "team0") + "'>" + (p.team === 1 ? "红" : "蓝") + "</td><td class='k'>" + p.kills + "</td><td>" + p.deaths + "</td></tr>";''')

rep('''        return { active: active, selfId: selfId, room: room, url: url, players: remotes.size + (selfId ? 1 : 0), ping: pingMs };''','''        return { active: active, selfId: selfId, room: room, url: url, team: myTeam, players: remotes.size + (selfId ? 1 : 0), ping: pingMs };''')
io.open(p,'w',encoding='utf-8').write(s)
print('client TDM patched')
