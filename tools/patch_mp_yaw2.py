
import io
p='src/mp.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)
rep('''        try { if (welcome.map && welcome.map.spawn && typeof welcome.map.spawn.yaw === "number") G.player.yaw = welcome.map.spawn.yaw; } catch (e) {}''','''        try {
          if (welcome.map && welcome.map.spawn && typeof welcome.map.spawn.yaw === "number") G.player.yaw = welcome.map.spawn.yaw;
          if (mapId === "ship" || mapId === "depot") G.player.yaw = 0;
        } catch (e) {}''')
rep('''      try { MapKit.load(mapId); } catch (e) {}
      try { G.enemies.clear(); G.hud.setMarkers([]); } catch (e) {}
      refreshMapHud();
      readyMap();''','''      try { MapKit.load(mapId); } catch (e) {}
      try { G.enemies.clear(); G.hud.setMarkers([]); G.player.yaw = 0; } catch (e) {}
      refreshMapHud();
      readyMap();''')
io.open(p,'w',encoding='utf-8').write(s)
print('mp yaw fixed')
