
import io
p='tools/build.cjs'
s=io.open(p,encoding='utf-8').read()
s=s.replace("const mapShip = fs.readFileSync(path.join(root,'src','map_ship.js'),'utf8');","const mapShip = fs.readFileSync(path.join(root,'src','map_ship.js'),'utf8');\nconst mapCore = fs.readFileSync(path.join(root,'src','map_core.js'),'utf8');",1)
s=s.replace("ext = ext.replace('/*__MAPKIT__*/', mapkit + '\\n' + mapDepot + '\\n' + mapShip);","ext = ext.replace('/*__MAPKIT__*/', mapkit + '\\n' + mapDepot + '\\n' + mapShip + '\\n' + mapCore);",1)
io.open(p,'w',encoding='utf-8').write(s)
print('build core wired')

p2='src/mp.js'
s2=io.open(p2,encoding='utf-8').read()
s2=s2.replace('''<option value="ship">外锚地 · 货轮甲板</option></select>''','''<option value="ship">外锚地 · 货轮甲板</option><option value="core">核心舱 · 反应堆</option></select>''',1)
s2=s2.replace('''      mapId = (map === "depot" || map === "ship") ? map : "harbor";''','''      mapId = (map === "depot" || map === "ship" || map === "core") ? map : "harbor";''',1)
s2=s2.replace('''      mapId = welcome.mapId === "depot" || welcome.mapId === "ship" ? welcome.mapId : "harbor";''','''      mapId = welcome.mapId === "depot" || welcome.mapId === "ship" || welcome.mapId === "core" ? welcome.mapId : "harbor";''',1)
s2=s2.replace('''          if (mapId === "ship" || mapId === "depot") G.player.yaw = 0;''','''          if (mapId === "ship" || mapId === "depot" || mapId === "core") G.player.yaw = 0;''',1)
s2=s2.replace('''      return mapId === "depot" ? "冷库" : mapId === "ship" ? "货轮" : "港区";''','''      return mapId === "depot" ? "冷库" : mapId === "ship" ? "货轮" : mapId === "core" ? "核心" : "港区";''',1)
s2=s2.replace('''      return id === "depot" ? "冷链仓库" : id === "ship" ? "外锚地" : "四号泊位";''','''      return id === "depot" ? "冷链仓库" : id === "ship" ? "外锚地" : id === "core" ? "核心舱" : "四号泊位";''',1)
s2=s2.replace('''      if (id !== "depot" && id !== "ship") id = "harbor";''','''      if (id !== "depot" && id !== "ship" && id !== "core") id = "harbor";''',1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('client core wired')

p3='server/export_maps.mjs'
s3=io.open(p3,encoding='utf-8').read()
s3=s3.replace('''  {id:'ship', idx:4, bases:[{x:0,z:5.2,yaw:0},{x:0,z:-8.4,yaw:Math.PI}]}''','''  {id:'ship', idx:4, bases:[{x:0,z:5.2,yaw:0},{x:0,z:-8.4,yaw:Math.PI}]},
  {id:'core', mode:'map', bases:[{x:-12,z:0,yaw:-1.57},{x:12,z:0,yaw:1.57}]}''',1)
s3=s3.replace('''    window.__SX.applyMission(idx);
    G.game.start({skipIntro:true});''','''    if (mode === 'map') { window.__SX.switchMap(id); G.game.start({skipIntro:true}); }
    else { window.__SX.applyMission(idx); G.game.start({skipIntro:true}); }''',1)
s3=s3.replace('''  }, {idx:m.idx});''','''  }, {idx:m.idx, id:m.id, mode:m.mode});''',1)
s3=s3.replace('''  const data = await page.evaluate(({idx})=>{''','''  const data = await page.evaluate(({idx, id, mode})=>{''',1)
io.open(p3,'w',encoding='utf-8').write(s3)
print('export core wired')
