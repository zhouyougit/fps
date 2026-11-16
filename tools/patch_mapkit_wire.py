
import io
p='src/mapkit.js'
s=io.open(p,encoding='utf-8').read()
old='''      var b = makeBuilder();
      def.build(b);
      def.merged = mergeRoot(b.root);'''
new='''      var b = makeBuilder();
      var meta = def.build(b) || {};
      def.playerStart = meta.playerStart || { pos: new T.Vector3(0, 0, 0), yaw: 0 };
      def.extraction = meta.extraction || { pos: new T.Vector3(0, 0, 0), radius: 2.6 };
      def.enemySpawns = meta.enemySpawns || [];
      def.interior = meta.interior || { min: new T.Vector3(-30, 0, -20), max: new T.Vector3(30, 8, 20) };
      def.env = meta.env || null;
      def.merged = mergeRoot(b.root);'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('mapkit meta patched')

p2='tools/build.cjs'
s2=io.open(p2,encoding='utf-8').read()
s2=s2.replace("const access = fs.readFileSync(path.join(root,'src','access.js'),'utf8');","const access = fs.readFileSync(path.join(root,'src','access.js'),'utf8');\nconst mapkit = fs.readFileSync(path.join(root,'src','mapkit.js'),'utf8');\nconst mapDepot = fs.readFileSync(path.join(root,'src','map_depot.js'),'utf8');",1)
s2=s2.replace("ext = ext.replace('/*__CAMPAIGN__*/', campaign);","ext = ext.replace('/*__MAPKIT__*/', mapkit + '\\n' + mapDepot);\n  if (!ext.includes('var MapKit')) throw new Error('mapkit marker missing');\n  ext = ext.replace('/*__CAMPAIGN__*/', campaign);",1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('build mapkit patched')

p3='src/ext.js'
s3=io.open(p3,encoding='utf-8').read()
old3='''  /*__CAMPAIGN__*/'''
new3='''  /*__MAPKIT__*/

  /*__CAMPAIGN__*/'''
assert s3.count(old3)==1
s3=s3.replace(old3,new3,1)
old4='''    try { initCampaign(); } catch (e) { console.error("[ext] campaign init", e); }'''
new4='''    try { MapKit.init(G); } catch (e) { console.error("[ext] mapkit init", e); }
    try { initCampaign(); } catch (e) { console.error("[ext] campaign init", e); }'''
assert s3.count(old4)==1
s3=s3.replace(old4,new4,1)
io.open(p3,'w',encoding='utf-8').write(s3)
print('ext mapkit wiring patched')
