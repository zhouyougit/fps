
import io
p='src/ext.js'
s=io.open(p,encoding='utf-8').read()
old='''      mapRelays: function (id) { return MapKit.relays(id); },'''
new='''      mapRelays: function (id) { return MapKit.relays(id); },
      mapInfo: function (id) {
        var d = MapKit.def(id || MapKit.current());
        return d ? { id: d.id, built: !!d.built, merged: !!(d.merged && d.merged.visible), lights: !!(d.lights && d.lights.visible), boxes: (d.boxes || []).length } : null;
      },'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('mapInfo added')
