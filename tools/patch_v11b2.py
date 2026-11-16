
import io
p='src/ext.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

rep('''    G.events.on("objective:done", function () { saveCheckpoint(); });''','''    G.events.on("objective:done", function () { saveCheckpoint(); });
    G.events.on("objective:all", function () {
      saveCheckpoint();
      setTimeout(function () {
        if (G.game.state === "playing") {
          G.hud.message("接驳准备中 · 坚守撤离点", 3.5);
          G.events.emit("sx:hold-start", {});
        }
      }, 600);
    });''')

rep('''  /* ------------------------------------------------- V10 enemy feedback */''','''  function setSpeaker(name) {
    var el = document.querySelector(".comms-who");
    if (el) el.textContent = name || "指挥中心";
  }

  /* ------------------------------------------------- V10 enemy feedback */''')

rep('''      ".x-camp-veil{background:rgba(6,8,10,.96);}",''','''      ".x-camp-veil{background:rgba(6,8,10,.96);}",
      "/* ---- V11 briefing ---- */",
      ".x-brief{position:absolute;inset:0;z-index:76;display:none;pointer-events:auto;color:var(--bone);}",
      ".x-brief.on{display:block;}",
      ".x-br-veil{position:absolute;inset:0;background:rgba(5,7,9,.94);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px);}",
      ".x-br-panel{position:relative;max-width:660px;margin:0 auto;top:50%;transform:translateY(-50%);padding:30px 34px 26px;border:1px solid rgba(232,228,218,.18);background:rgba(11,13,15,.86);}",
      ".x-br-h{font:900 42px/1.05 var(--f-display);letter-spacing:.12em;margin:6px 0 4px;}",
      ".x-br-sub{font:500 12px/1.5 var(--f-mono);letter-spacing:.12em;color:var(--steel);}",
      ".x-br-meta{display:grid;grid-template-columns:1fr 1fr;gap:7px 22px;margin:16px 0 14px;padding:12px 0;border-top:1px solid rgba(232,228,218,.12);border-bottom:1px solid rgba(232,228,218,.12);}",
      ".x-br-meta div{display:flex;justify-content:space-between;gap:12px;}",
      ".x-br-meta span{font:500 10px/1.4 var(--f-mono);letter-spacing:.12em;color:var(--steel);}",
      ".x-br-meta b{font:600 12px/1.4 var(--f-label);color:var(--bone);text-align:right;}",
      ".x-br-list{margin:0 0 20px;padding-left:18px;font:500 13px/1.9 var(--f-label);color:var(--bone-dim);}",
      ".x-br-list li::marker{color:var(--signal);}",
      ".x-br-actions{display:flex;gap:10px;}",
      "@media(max-width:620px){.x-br-panel{padding:22px;}.x-br-h{font-size:30px;}.x-br-meta{grid-template-columns:1fr;}}",''')

rep('''      armoryStats: function (wid) { var w = armoryWeapon(wid); return w ? armoryStat(w) : null; },''','''      armoryStats: function (wid) { var w = armoryWeapon(wid); return w ? armoryStat(w) : null; },
      speaker: function (n) { setSpeaker(n); },''')
io.open(p,'w',encoding='utf-8').write(s)
print('ext v11 patches applied')
