
import io
p='src/ext.js'
s=io.open(p,encoding='utf-8').read()
old='''      state: function () { return { armor: G.player.armor, hp: G.player.health, grenades: S.grenades, pickups: S.pickups.filter(function (p) { return !p.taken; }).length, cp: !!S.checkpoint, fps: window.__stats ? window.__stats().fps : 0 }; }'''
new='''      state: function () { return { armor: G.player.armor, hp: G.player.health, grenades: S.grenades, pickups: S.pickups.filter(function (p) { return !p.taken; }).length, cp: !!S.checkpoint, fps: window.__stats ? window.__stats().fps : 0 }; },
      campaign: function () {
        return {
          unlocked: camp.unlocked, current: camp.current, best: camp.best,
          mission: G.game.currentMission && G.game.currentMission.id,
          objectives: (G.level.objectives || []).map(function (o) { return o.label; }),
          extraction: G.level.extraction.pos.toArray(),
          evac: G.game.run && G.game.run.evacT
        };
      },
      unlockAll: function () { camp.unlocked = MISSIONS.length; saveCamp(); renderMissionCards(); },
      launch: function (i) { camp.unlocked = Math.max(camp.unlocked, i + 1); launchMission(i); },
      cutAll: function () { for (var i = 0; i < 8; i++) { try { G.game.debugCut(); } catch (e) {} } },
      openMissions: function () { openMissionScreen(); }'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('debug api added')
