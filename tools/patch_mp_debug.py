
import io
p='src/mp.js'
s=io.open(p,encoding='utf-8').read()
old='''        var tag = makeTag(p.name || "几猫"); tag.position.y = 2.0; grp.add(tag);
        G.scene.add(grp);'''
new='''        var tag = makeTag(p.name || "几猫"); tag.position.y = 2.0; grp.add(tag);
        grp.position.set(p.x || 0, p.y || 0, p.z || 0);
        G.scene.add(grp);'''
assert s.count(old)==1
s=s.replace(old,new,1)
old2='''      if (m.t === "snap") {
        applySnap(m);
        return;
      }'''
new2='''      if (m.t === "snap") {
        window.__MPSNAP = m.players;
        applySnap(m);
        return;
      }'''
assert s.count(old2)==1
s=s.replace(old2,new2,1)
old3='''      remotes: function () { return Array.from(remotes.keys()); }'''
new3='''      remotes: function () { return Array.from(remotes.keys()); },
      debug: function () {
        return {
          active: active, selfId: selfId, serverSelf: serverSelf,
          hist: Array.from(remotes.entries()).map(function (e) {
            return { id: e[0], pos: e[1].grp.position.toArray().map(function (v) { return +v.toFixed(2); }), h: e[1].hist.slice(-3) };
          }),
          snap: window.__MPSNAP || null
        };
      }'''
assert s.count(old3)==1
s=s.replace(old3,new3,1)
io.open(p,'w',encoding='utf-8').write(s)
print('mp debug patched')
