
import io
p='src/ext.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

rep('''  function initEnemyFeedback() {''','''  function initEnemyFeedback() {
    G.events.on("player:hitEnemy", function (ev) {
      if (ev && ev.weak && ev.killed) S.runHeadshots = (S.runHeadshots || 0) + 1;
    });''')

rep('''      applyMission: function (i) { applyMission(i); },''','''      applyMission: function (i) { applyMission(i); },
      challenges: function () { return { count: challengeCount(), map: camp.challenges }; },
      challengeCheck: function (st) { return challengeCheck(st); },
      challengeGrant: function (mid, obj) {
        camp.challenges[mid] = Object.assign({}, camp.challenges[mid], obj);
        saveCamp();
        if (typeof updateAccessButtons === "function") updateAccessButtons();
      },''')

rep('''      "@media(max-width:620px){.x-br-panel{padding:22px;}.x-br-h{font-size:30px;}.x-br-meta{grid-template-columns:1fr;}}",''','''      "@media(max-width:620px){.x-br-panel{padding:22px;}.x-br-h{font-size:30px;}.x-br-meta{grid-template-columns:1fr;}}",
      "/* ---- V13 challenges ---- */",
      ".x-mcard .x-mchal{position:absolute;right:12px;bottom:10px;font:600 9px/1 var(--f-mono);letter-spacing:.12em;color:var(--signal);opacity:.85;}",
      ".x-chal{margin:14px 0 0;padding:10px 12px;border-left:2px solid var(--signal);background:rgba(255,179,71,.06);font:500 11px/1.6 var(--f-label);color:var(--bone-dim);}",
      ".x-chal b{display:block;color:var(--signal);font:600 10px/1.4 var(--f-mono);letter-spacing:.12em;margin-bottom:4px;}",
      ".x-chal i{display:inline-block;margin-right:10px;font-style:normal;color:var(--steel);}",
      ".x-chal i.ok{color:#9cff6a;}",
      ".x-chal em{display:block;margin-top:6px;font-style:normal;color:var(--bone);}",
      ".x-chal em.unlock{color:var(--signal);}",
      ".x-br-chal-wrap{margin:-6px 0 18px;}",
      ".x-br-chal-wrap>b{font:600 10px/1.4 var(--f-mono);letter-spacing:.12em;color:var(--steel);}",
      ".x-br-chal{display:flex;flex-wrap:wrap;gap:8px 18px;list-style:none;margin:8px 0 0;padding:0;font:500 11px/1.4 var(--f-label);color:var(--steel);}",
      ".x-br-chal li.ok{color:#9cff6a;}",
      ".seg button.locked{opacity:.32;cursor:not-allowed;}",''')
io.open(p,'w',encoding='utf-8').write(s)
print('ext v13 patched')

p2='src/access.js'
s2=io.open(p2,encoding='utf-8').read()
def rep2(old,new):
    global s2
    assert s2.count(old)==1, (s2.count(old), old[:80])
    s2=s2.replace(old,new,1)

rep2('''  var CROSS_COLORS = { bone: "#e8e4da", amber: "#ffb347", cyan: "#8fd8ff" };''','''  var CROSS_COLORS = { bone: "#e8e4da", amber: "#ffb347", cyan: "#8fd8ff", lime: "#9cff6a", crimson: "#ff5a5a", gold: "#ffd166" };
  var CROSS_NEED = { bone: 0, amber: 0, cyan: 0, lime: 3, crimson: 6, gold: 9 };
  function crossUnlocked(k) {
    var need = CROSS_NEED[k] || 0;
    return need === 0 || (typeof challengeCount === "function" && challengeCount() >= need);
  }''')

rep2('''      '<div class="row"><label>准星颜色</label><div class="seg" data-x-seg="cross">' +
        '<button data-v="bone">白</button><button data-v="amber">琥珀</button><button data-v="cyan">青</button></div></div>';''','''      '<div class="row"><label>准星颜色</label><div class="seg" data-x-seg="cross">' +
        '<button data-v="bone">白</button><button data-v="amber">琥珀</button><button data-v="cyan">青</button>' +
        '<button data-v="lime" data-need="3">绿 · 3</button><button data-v="crimson" data-need="6">红 · 6</button><button data-v="gold" data-need="9">金 · 9</button></div></div>';''')

rep2('''      for (var k = 0; k < btns.length; k++)
        btns[k].setAttribute("aria-pressed", btns[k].dataset.v === val ? "true" : "false");''','''      for (var k = 0; k < btns.length; k++) {
        var b = btns[k];
        var need = parseInt(b.dataset.need || "0", 10);
        var locked = need > 0 && (!(typeof challengeCount === "function") || challengeCount() < need);
        b.disabled = locked;
        b.classList.toggle("locked", locked);
        b.title = locked ? "完成 " + need + " 个挑战解锁" : "";
        b.setAttribute("aria-pressed", b.dataset.v === val ? "true" : "false");
      }''')

rep2('''    var d = DIFFICULTY[access.difficulty] || DIFFICULTY.normal;''','''    if (!crossUnlocked(access.cross)) access.cross = "bone";
    var d = DIFFICULTY[access.difficulty] || DIFFICULTY.normal;''')
io.open(p2,'w',encoding='utf-8').write(s2)
print('access gating patched')
