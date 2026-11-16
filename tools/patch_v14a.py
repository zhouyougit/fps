
import io
p='src/access.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

rep('''  var access = { difficulty: "normal", cross: "bone", shake: "std" };''','''  var access = { difficulty: "normal", cross: "bone", shake: "std", reduceMotion: false };''')
rep('''        if (raw.shake === "low" || raw.shake === "std" || raw.shake === "high") access.shake = raw.shake;''','''        if (raw.shake === "low" || raw.shake === "std" || raw.shake === "high") access.shake = raw.shake;
        access.reduceMotion = !!raw.reduceMotion;''')

rep('''    S.shakeScale = access.shake === "low" ? 0.45 : access.shake === "high" ? 1.6 : 1;''','''    S.shakeScale = access.reduceMotion ? 0.18 : access.shake === "low" ? 0.45 : access.shake === "high" ? 1.6 : 1;
    try { document.body.classList.toggle("reduce-motion", !!access.reduceMotion); } catch (e) {}''')

rep('''      var val = access[key === "cross" ? "cross" : key === "shake" ? "shake" : "difficulty"];''','''      var val = access[key === "cross" ? "cross" : key === "shake" ? "shake" : "difficulty"];
      if (key === "reduce") {
        var tbtn = rows[i].querySelector("[data-x-reduce]");
        if (tbtn) {
          tbtn.setAttribute("aria-pressed", access.reduceMotion ? "true" : "false");
          var lab = tbtn.querySelector("span");
          if (lab) lab.textContent = access.reduceMotion ? "开启" : "关闭";
        }
        continue;
      }''')

rep('''      '<div class="row"><label>镜头晃动</label><div class="seg" data-x-seg="shake">' +
        '<button data-v="low">低</button><button data-v="std">标准</button><button data-v="high">高</button></div></div>';''','''      '<div class="row"><label>镜头晃动</label><div class="seg" data-x-seg="shake">' +
        '<button data-v="low">低</button><button data-v="std">标准</button><button data-v="high">高</button></div></div>' +
      '<div class="row"><label>减少动态</label><button class="toggle" data-x-reduce aria-pressed="false"><i></i><span>关闭</span></button></div>';''')

rep('''    var note = pane.querySelector(".panel-note");''','''    if (!pane.querySelector("h3")) {
      var first = pane.querySelector(".row");
      if (first) first.insertAdjacentHTML("beforebegin", "<h3>画面与音频</h3>");
      var sens = pane.querySelector("#s-sens");
      var sensRow = sens && sens.closest(".row");
      if (sensRow) sensRow.insertAdjacentHTML("beforebegin", "<h3>操控</h3>");
    }
    var note = pane.querySelector(".panel-note");''')

rep('''    while (box.firstChild) pane.insertBefore(box.firstChild, note || null);''','''    box.insertAdjacentHTML("afterbegin", "<h3>游戏性</h3>");
    while (box.firstChild) pane.insertBefore(box.firstChild, note || null);''')

rep('''        var key = this.dataset.xSeg;
        access[key] = b.dataset.v;''','''        var key = this.dataset.xSeg;
        access[key] = b.dataset.v;''')

# toggle handler + heading for 辅助
rep('''    var segs = pane.querySelectorAll("[data-x-seg]");''','''    var reduce = pane.querySelector("[data-x-reduce]");
    if (reduce)
      reduce.addEventListener("click", function () {
        access.reduceMotion = !access.reduceMotion;
        saveAccess();
        applyAccess();
        G.events.emit("ui:click", {});
      });
    var segs = pane.querySelectorAll("[data-x-seg]");''')

# heading 辅助 before cross row
rep('''    var box = document.createElement("div");''','''    var box = document.createElement("div");
    var crossRow = null;''')
io.open(p,'w',encoding='utf-8').write(s)
print('access v14 patched')

p2='src/ext.js'
s2=io.open(p2,encoding='utf-8').read()
old='''      ".seg button.locked{opacity:.32;cursor:not-allowed;}",'''
new='''      ".seg button.locked{opacity:.32;cursor:not-allowed;}",
      "/* ---- V14 accessibility ---- */",
      "body.reduce-motion *{animation-duration:.001s!important;animation-iteration-count:1!important;transition-duration:.001s!important;}",
      ".panel-b h3{margin:18px 0 8px;font:600 10px/1.4 var(--f-mono);letter-spacing:.16em;color:var(--signal);text-transform:uppercase;}",
      ".panel-b h3:first-child{margin-top:0;}",'''
assert s2.count(old)==1
s2=s2.replace(old,new,1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('ext v14 css patched')
