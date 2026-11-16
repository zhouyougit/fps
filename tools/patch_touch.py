
import io
p='src/ext.js'
s=io.open(p,encoding='utf-8').read()
old='''    // 敌人 HP 缩放（战役难度）'''
new='''    // 触屏：手雷 / 换枪
    if (G.input && G.input.touch) {
      try {
        var ui = document.getElementById("ui");
        var gb = el("button", "t-btn", "手雷");
        gb.style.cssText = "width:56px;height:56px;right:calc(20px + var(--sar));bottom:calc(258px + var(--sab));";
        gb.addEventListener("pointerdown", function (e) { e.preventDefault(); throwGrenade(); });
        ui.appendChild(gb);
        var sb = el("button", "t-btn", "换枪");
        sb.style.cssText = "width:56px;height:56px;right:calc(88px + var(--sar));bottom:calc(196px + var(--sab));";
        sb.addEventListener("pointerdown", function (e) {
          e.preventDefault();
          if (G.weapon && G.weapon.cycle) G.weapon.cycle();
        });
        ui.appendChild(sb);
      } catch (e) {}
    }

    // 敌人 HP 缩放（战役难度）'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('touch buttons added')
