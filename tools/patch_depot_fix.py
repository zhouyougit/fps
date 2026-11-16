
import io
p='src/map_depot.js'
s=io.open(p,encoding='utf-8').read()
s=s.replace('K.prop("container20", 0, -15, 0.38, 0);','K.prop("container20", -8, -15.1, 0.38, 0);',1)
s=s.replace('extraction: { pos: new T.Vector3(0, 0.03, -15.4), radius: 2.6 },','extraction: { pos: new T.Vector3(0, 0.03, -14.2), radius: 2.6 },',1)
s=s.replace('ex.rotation.x = -Math.PI / 2; ex.position.set(0, 0.03, -15.4);','ex.rotation.x = -Math.PI / 2; ex.position.set(0, 0.03, -14.2);',1)
io.open(p,'w',encoding='utf-8').write(s)
print('depot extraction patched')

p2='src/campaign.js'
s2=io.open(p2,encoding='utf-8').read()
old='''    if (m.map && typeof MapKit !== "undefined" && MapKit.current() !== m.map) {
      MapKit.load(m.map);
    }'''
new='''    var mapId = m.map || "harbor";
    if (typeof MapKit !== "undefined" && MapKit.current() !== mapId) {
      MapKit.load(mapId);
    }'''
assert s2.count(old)==1
s2=s2.replace(old,new,1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('applyMission default harbor patched')
