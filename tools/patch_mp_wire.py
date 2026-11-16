
import io
p='tools/build.cjs'
s=io.open(p,encoding='utf-8').read()
s=s.replace("const mapDepot = fs.readFileSync(path.join(root,'src','map_depot.js'),'utf8');","const mapDepot = fs.readFileSync(path.join(root,'src','map_depot.js'),'utf8');\nconst mp = fs.readFileSync(path.join(root,'src','mp.js'),'utf8');",1)
s=s.replace("ext = ext.replace('/*__CAMPAIGN__*/', campaign);","ext = ext.replace('/*__CAMPAIGN__*/', campaign);\n  ext = ext.replace('/*__MP__*/', mp);\n  if (!ext.includes('V16 · 联机对战客户端')) throw new Error('mp marker missing');",1)
io.open(p,'w',encoding='utf-8').write(s)
print('build mp patched')

p2='src/ext.js'
s2=io.open(p2,encoding='utf-8').read()
old='''  /*__CAMPAIGN__*/'''
new='''  /*__CAMPAIGN__*/

  /*__MP__*/'''
assert s2.count(old)==1
s2=s2.replace(old,new,1)
old2='''    try { initCampaign(); } catch (e) { console.error("[ext] campaign init", e); }'''
new2='''    try { initCampaign(); } catch (e) { console.error("[ext] campaign init", e); }
    try { MP.init(G, MapKit); window.__MP = MP; } catch (e) { console.error("[ext] mp init", e); }'''
assert s2.count(old2)==1
s2=s2.replace(old2,new2,1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('ext mp wired')
