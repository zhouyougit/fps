
import io
p='src/access.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

rep('''  var CROSS_COLORS = { bone: "#e8e4da", amber: "#ffb347", cyan: "#8fd8ff" };''','''  var CROSS_COLORS = { bone: "#e8e4da", amber: "#ffb347", cyan: "#8fd8ff", lime: "#9cff6a", crimson: "#ff5a5a", gold: "#ffd166" };
  var CROSS_NEED = { bone: 0, amber: 0, cyan: 0, lime: 3, crimson: 6, gold: 9 };
  function crossUnlocked(k) {
    var need = CROSS_NEED[k] || 0;
    return need === 0 || (typeof challengeCount === "function" && challengeCount() >= need);
  }''')

rep('''      '<div class="row"><label>准星颜色</label><div class="seg" data-x-seg="cross">' +
        '<button data-v="bone">白</button><button data-v="amber">琥珀</button><button data-v="cyan">青</button></div></div>' +''','''      '<div class="row"><label>准星颜色</label><div class="seg" data-x-seg="cross">' +
        '<button data-v="bone">白</button><button data-v="amber">琥珀</button><button data-v="cyan">青</button>' +
        '<button data-v="lime" data-need="3">绿 · 3</button><button data-v="crimson" data-need="6">红 · 6</button><button data-v="gold" data-need="9">金 · 9</button></div></div>' +''')

rep('''      for (var k = 0; k < btns.length; k++)
        btns[k].setAttribute("aria-pressed", btns[k].dataset.v === val ? "true" : "false");''','''      for (var k = 0; k < btns.length; k++) {
        var b = btns[k];
        var need = parseInt(b.dataset.need || "0", 10);
        var locked = need > 0 && (!(typeof challengeCount === "function") || challengeCount() < need);
        b.disabled = locked;
        b.classList.toggle("locked", locked);
        b.title = locked ? "完成 " + need + " 个挑战解锁" : "";
        b.setAttribute("aria-pressed", b.dataset.v === val ? "true" : "false");
      }''')

rep('''    var d = DIFFICULTY[access.difficulty] || DIFFICULTY.normal;''','''    if (!crossUnlocked(access.cross)) access.cross = "bone";
    var d = DIFFICULTY[access.difficulty] || DIFFICULTY.normal;''')
io.open(p,'w',encoding='utf-8').write(s)
print('access gating patched')
