
import io
p='tools/build.cjs'
s=io.open(p,encoding='utf-8').read()
s=s.replace("const mapDepot = fs.readFileSync(path.join(root,'src','map_depot.js'),'utf8');","const mapDepot = fs.readFileSync(path.join(root,'src','map_depot.js'),'utf8');\nconst mapShip = fs.readFileSync(path.join(root,'src','map_ship.js'),'utf8');",1)
s=s.replace("ext = ext.replace('/*__MAPKIT__*/', mapkit + '\\n' + mapDepot);","ext = ext.replace('/*__MAPKIT__*/', mapkit + '\\n' + mapDepot + '\\n' + mapShip);",1)
io.open(p,'w',encoding='utf-8').write(s)
print('build ship patched')

p2='src/mapkit.js'
s2=io.open(p2,encoding='utf-8').read()
old='''      L2.interiorBoxes = [{ min: def.interior.min.clone(), max: def.interior.max.clone() }];'''
new='''      L2.interiorBoxes = def.interior ? [{ min: def.interior.min.clone(), max: def.interior.max.clone() }] : [];'''
assert s2.count(old)==1
s2=s2.replace(old,new,1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('mapkit interior optional')

p3='src/campaign.js'
s3=io.open(p3,encoding='utf-8').read()
old2='''    if (m.map === "depot") {
      var dr = MapKit.relays("depot") || {};'''
new2='''    if (m.map && m.map !== "harbor") {
      var dr = MapKit.relays(m.map) || {};'''
assert s3.count(old2)==1
s3=s3.replace(old2,new2,1)
s3=s3.replace('''return { id: "relay_" + r.id, label: r.label || d.label, zone: "depot", pos: d.pos, object: d.object };''','''return { id: "relay_" + r.id, label: r.label || d.label, zone: m.map, pos: d.pos, object: d.object };''',1)
io.open(p3,'w',encoding='utf-8').write(s3)
print('campaign custom maps patched')
