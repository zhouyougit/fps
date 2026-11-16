
import io
p='src/audio_ext.js'
s=io.open(p,encoding='utf-8').read()
s=s.replace('''      init: init, update: update, begin: begin,''','''      init: init, update: update, begin: begin, setMode: setMode,''',1)
io.open(p,'w',encoding='utf-8').write(s)
print('audio setMode exposed')

p2='src/mp.js'
s2=io.open(p2,encoding='utf-8').read()
s2=s2.replace('''        active = true;
        prevUpdate = G.game.update;''','''        active = true;
        try { if (typeof AudioExt !== "undefined") AudioExt.setMode("mp"); } catch (e) {}
        prevUpdate = G.game.update;''',1)
s2=s2.replace('''      active = false;
      if (prevUpdate) { G.game.update = prevUpdate; prevUpdate = null; }''','''      active = false;
      try { if (typeof AudioExt !== "undefined") AudioExt.setMode("ambient"); } catch (e) {}
      if (prevUpdate) { G.game.update = prevUpdate; prevUpdate = null; }''',1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('mp audio mode calls added')
