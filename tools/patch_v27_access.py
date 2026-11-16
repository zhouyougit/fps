
import io
p='src/access.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

rep('''  var access = { difficulty: "normal", cross: "bone", shake: "std", reduceMotion: false };''','''  var access = { difficulty: "normal", cross: "bone", shake: "std", reduceMotion: false, hudScale: "100", subSize: "M", contrast: false };''')
rep('''        access.reduceMotion = !!raw.reduceMotion;''','''        access.reduceMotion = !!raw.reduceMotion;
        if (raw.hudScale === "90" || raw.hudScale === "100" || raw.hudScale === "115") access.hudScale = raw.hudScale;
        if (raw.subSize === "S" || raw.subSize === "M" || raw.subSize === "L") access.subSize = raw.subSize;
        access.contrast = !!raw.contrast;''')
rep('''    S.shakeScale = access.reduceMotion ? 0.18 : access.shake === "low" ? 0.45 : access.shake === "high" ? 1.6 : 1;
    try { document.body.classList.toggle("reduce-motion", !!access.reduceMotion); } catch (e) {}''','''    S.shakeScale = access.reduceMotion ? 0.18 : access.shake === "low" ? 0.45 : access.shake === "high" ? 1.6 : 1;
    try { document.body.classList.toggle("reduce-motion", !!access.reduceMotion); } catch (e) {}
    try {
      document.documentElement.style.setProperty("--hud-scale", (parseInt(access.hudScale, 10) || 100) / 100);
      document.documentElement.style.setProperty("--sub-scale", access.subSize === "S" ? 0.85 : access.subSize === "L" ? 1.22 : 1);
      document.body.classList.toggle("hc", !!access.contrast);
    } catch (e) {}''')
rep('''      var val = access[key === "cross" ? "cross" : key === "shake" ? "shake" : "difficulty"];
      if (key === "reduce") {''','''      var val = access[key];
      if (key === "contrast") {
        var cbtn = rows[i].querySelector("[data-x-contrast]");
        if (cbtn) {
          cbtn.setAttribute("aria-pressed", access.contrast ? "true" : "false");
          var clab = cbtn.querySelector("span");
          if (clab) clab.textContent = access.contrast ? "开启" : "关闭";
        }
        continue;
      }
      if (key === "reduce") {''')
rep('''      '<div class="row"><label>减少动态</label><button class="toggle" data-x-reduce aria-pressed="false"><i></i><span>关闭</span></button></div>';''','''      '<div class="row"><label>减少动态</label><button class="toggle" data-x-reduce aria-pressed="false"><i></i><span>关闭</span></button></div>' +
      '<div class="row"><label>HUD 缩放</label><div class="seg" data-x-seg="hudScale"><button data-v="90">90%</button><button data-v="100">100%</button><button data-v="115">115%</button></div></div>' +
      '<div class="row"><label>字幕大小</label><div class="seg" data-x-seg="subSize"><button data-v="S">小</button><button data-v="M">中</button><button data-v="L">大</button></div></div>' +
      '<div class="row"><label>高对比</label><button class="toggle" data-x-contrast aria-pressed="false"><i></i><span>关闭</span></button></div>';''')
rep('''    var reduce = pane.querySelector("[data-x-reduce]");''','''    var contrast = pane.querySelector("[data-x-contrast]");
    if (contrast)
      contrast.addEventListener("click", function () {
        access.contrast = !access.contrast;
        saveAccess();
        applyAccess();
        G.events.emit("ui:click", {});
      });
    var reduce = pane.querySelector("[data-x-reduce]");''')
io.open(p,'w',encoding='utf-8').write(s)
print('access a11y patched')
