
import io
p='src/mapkit.js'
s=io.open(p,encoding='utf-8').read()
old='''    return {
      init: init,
      register: register,'''
new='''    function captureHarbor() {
      if (!harbor) return;
      harbor.boxes = P.boxes.slice();
      harbor.playerStart = cloneStart(G.level.playerStart);
      harbor.enemySpawns = (G.level.enemySpawns || []).slice();
      harbor.coverPoints = (G.level.coverPoints || []).slice();
      harbor.interiorBoxes = (G.level.interiorBoxes || []).slice();
    }

    return {
      init: init,
      captureHarbor: captureHarbor,
      register: register,'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('mapkit capture added')

p2='src/campaign.js'
s2=io.open(p2,encoding='utf-8').read()
s2=s2.replace("      extraction: { x: 0, z: -15.4, radius: 2.6 },","      extraction: { x: 0, z: -14.2, radius: 2.6 },",1)
# call capture at end of initCampaign: find a stable anchor
old2='''    buildCampaignUI();
    buildBriefingUI();'''
new2='''    buildCampaignUI();
    buildBriefingUI();
    try { if (typeof MapKit !== "undefined") MapKit.captureHarbor(); } catch (e) {}'''
assert s2.count(old2)==1
s2=s2.replace(old2,new2,1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('campaign capture + extraction patched')
