
import io
p='src/campaign.js'
s=io.open(p,encoding='utf-8').read()
old='''    try { G.input.exitLock && G.input.exitLock(); } catch (e) {}
    G.game.start({ skipIntro: false });
  }'''
new='''    try { G.input.exitLock && G.input.exitLock(); } catch (e) {}
    G.game.start({ skipIntro: false });
    try {
      G.input.requestLock && G.input.requestLock();
    } catch (e) {}
  }'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('requestLock on campaign launch')
