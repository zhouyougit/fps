
import io
p='src/mp.js'
s=io.open(p,encoding='utf-8').read()
s=s.replace('tag.sprite.position.y = 1.92; grp.add(tag.sprite);','tag.sprite.position.y = 2.34; grp.add(tag.sprite);',1)
io.open(p,'w',encoding='utf-8').write(s)
print('nametag raised')
