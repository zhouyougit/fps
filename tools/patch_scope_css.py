
import io
p='src/ext.js'
s=io.open(p,encoding='utf-8').read()
old='''      ".x-scope::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 0 25.5vmin, rgba(3,5,7,.72) 26vmin, #04060a 33vmin);}",
      ".x-scope::after{content:'';position:absolute;left:50%;top:50%;width:52vmin;height:52vmin;transform:translate(-50%,-50%);border-radius:50%;box-shadow:inset 0 0 0 1.5px rgba(0,0,0,.85), inset 0 0 70px rgba(0,0,0,.75);}",'''
new='''      ".x-scope::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 0 30vmin, rgba(4,6,9,.82) 33vmin, rgba(4,6,9,.96) 48vmin);}",
      ".x-scope::after{content:'';position:absolute;left:50%;top:50%;width:62vmin;height:62vmin;transform:translate(-50%,-50%);border-radius:50%;box-shadow:inset 0 0 0 2px rgba(0,0,0,.9), inset 0 0 44px rgba(0,0,0,.5);}",'''
assert s.count(old)==1
s=s.replace(old,new,1)
s=s.replace('''      ".x-scope-h{width:36vmin;height:1px;transform:translate(-50%,-0.5px);}",''','''      ".x-scope-h{width:44vmin;height:1px;transform:translate(-50%,-0.5px);}",''')
s=s.replace('''      ".x-scope-v{width:1px;height:30vmin;transform:translate(-0.5px,-50%);}",''','''      ".x-scope-v{width:1px;height:38vmin;transform:translate(-0.5px,-50%);}",''')
io.open(p,'w',encoding='utf-8').write(s)
print('scope css tuned')
