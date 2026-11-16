
import io
p='src/mp.js'
s=io.open(p,encoding='utf-8').read()
s=s.replace('''        G.hud.setObjective("多人 · 港区混战");
        var rel = document.querySelector(".h-relays");
        if (rel) rel.style.display = "none";''','''        G.hud.setObjective("多人 · 港区混战");
        var hk = document.querySelector(".h-k"); if (hk) hk.textContent = "联机对战";
        var rel = document.querySelector(".h-relays");
        if (rel) rel.style.setProperty("display", "none", "important");''',1)
s=s.replace('''      try { var rel2 = document.querySelector(".h-relays"); if (rel2) rel2.style.display = ""; } catch (e) {}''','''      try { var rel2 = document.querySelector(".h-relays"); if (rel2) rel2.style.display = ""; var hk2 = document.querySelector(".h-k"); if (hk2) hk2.textContent = "任务目标"; } catch (e) {}''',1)
s=s.replace('''        var grp = new T.Group();
        var col = colorFor(p.id);''','''        var grp = new T.Group();
        grp.name = "mp-player";
        var col = colorFor(p.id);''',1)
io.open(p,'w',encoding='utf-8').write(s)
print('mp polish patched')
