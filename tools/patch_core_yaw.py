
import io
p='src/mp.js'
s=io.open(p,encoding='utf-8').read()
s=s.replace('''          if (mapId === "ship" || mapId === "depot" || mapId === "core") G.player.yaw = 0;''','''          if (mapId === "ship" || mapId === "depot") G.player.yaw = 0;''',1)
s=s.replace('''      try { MapKit.load(mapId); } catch (e) {}
      try { G.enemies.clear(); G.hud.setMarkers([]); G.player.yaw = 0; } catch (e) {}''','''      try { MapKit.load(mapId); } catch (e) {}
      try { G.enemies.clear(); G.hud.setMarkers([]); G.player.yaw = mapId === "core" ? (myTeam === 1 ? 1.57 : -1.57) : 0; } catch (e) {}''',1)
io.open(p,'w',encoding='utf-8').write(s)
print('core yaw fixed')
