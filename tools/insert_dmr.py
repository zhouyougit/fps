
import io
p='src/weapon_ext.js'
s=io.open(p,encoding='utf-8').read()
dmr=io.open('src/dmr.js',encoding='utf-8').read()
marker='  /* --------------------------------------------------------------- 军械库 */'
assert s.count(marker)==1
s=s.replace(marker, dmr+'\n'+marker,1)
io.open(p,'w',encoding='utf-8').write(s)
print('dmr inserted')
