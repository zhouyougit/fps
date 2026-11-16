
import io
p='src/mp.js'
s=io.open(p,encoding='utf-8').read()
s=s.replace('''      remotes.clear();
      serverSelf = null;''','''      remotes.clear();
      serverSelf = null;
      selfId = null;''',1)
s=s.replace('''        G.hud.setObjective("多人 · 港区混战");''','''        G.hud.setObjective("多人 · 港区混战");
        var rel = document.querySelector(".h-relays");
        if (rel) rel.style.display = "none";''',1)
s=s.replace('''      try { G.player.enabled = false; } catch (e) {}''','''      try { G.player.enabled = false; } catch (e) {}
      try { var rel2 = document.querySelector(".h-relays"); if (rel2) rel2.style.display = ""; } catch (e) {}''',1)
s=s.replace('''        ".x-mp-hud{position:absolute;left:50%;top:calc(10px + var(--sat));''','''        ".x-mp-hud{position:absolute;left:50%;top:calc(78px + var(--sat));''',1)
io.open(p,'w',encoding='utf-8').write(s)
print('mp fixes patched')
