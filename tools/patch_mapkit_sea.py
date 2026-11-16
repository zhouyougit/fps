
import io
p='src/mapkit.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

# harbor snapshot extras
rep('''        skyVisible: g.render.sky.visible,
        groundVisible: g.ground.root.visible,''','''        skyVisible: g.render.sky.visible,
        groundVisible: g.ground.root.visible,
        apron: g.ground.root.getObjectByName("apron"),
        quaySkirt: g.ground.root.getObjectByName("quaySkirt"),''')

# hideHarbor mode
rep('''    function hideHarbor() {
      harbor.root.visible = false;
      if (G.level.backdrop) G.level.backdrop.visible = false;
      G.ground.root.visible = false;
      G.render.sky.visible = false;
      G.render.sun.intensity = 0.25;
      for (var i = 0; i < harbor.pointLights.length; i++) harbor.pointLights[i].l.intensity = 0;
    }''','''    function hideHarbor(seaOnly) {
      harbor.root.visible = false;
      if (G.level.backdrop) G.level.backdrop.visible = false;
      if (seaOnly) {
        G.ground.root.visible = true;
        if (harbor.apron) harbor.apron.visible = false;
        if (harbor.quaySkirt) harbor.quaySkirt.visible = false;
        G.render.sky.visible = true;
        G.render.sun.intensity = 1.2;
      } else {
        G.ground.root.visible = false;
        G.render.sky.visible = false;
        G.render.sun.intensity = 0.25;
      }
      for (var i = 0; i < harbor.pointLights.length; i++) harbor.pointLights[i].l.intensity = 0;
    }''')

rep('''      G.ground.root.visible = harbor.groundVisible;
      G.render.sky.visible = harbor.skyVisible;''','''      G.ground.root.visible = harbor.groundVisible;
      if (harbor.apron) harbor.apron.visible = true;
      if (harbor.quaySkirt) harbor.quaySkirt.visible = true;
      G.render.sky.visible = harbor.skyVisible;''')

# def seaOnly/fog meta
rep('''      def.env = meta.env || null;
      def.merged = mergeRoot(b.root);''','''      def.env = meta.env || null;
      def.seaOnly = !!meta.seaOnly;
      def.fog = meta.fog || null;
      def.merged = mergeRoot(b.root);''')

# load hide with seaOnly and fog
rep('''      if (current === "harbor") hideHarbor();''','''      if (current === "harbor") hideHarbor(!!def.seaOnly);''')
rep('''      G.scene.fog = new T.FogExp2(0x090c10, 0.026);''','''      G.scene.fog = new T.FogExp2(def.fog ? def.fog.color : 0x090c10, def.fog ? def.fog.density : 0.026);''')
io.open(p,'w',encoding='utf-8').write(s)
print('mapkit sea support patched')
