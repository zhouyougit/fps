
import io
p='src/campaign.js'
s=io.open(p,encoding='utf-8').read()
old='''  function initCampaign() {
    loadCamp();
    initRelayPool();
    buildCampaignUI();'''
new='''  function initCampaign() {
    loadCamp();
    initRelayPool();
    var profile = (typeof window !== "undefined" && window.__SX_PROFILE) || "v4";
    if (profile === "v3") {
      var m3 = MISSIONS[2];
      m3.boss = false;
      m3.evac = 40;
      m3.waves = m3.waves.map(function (w) { return { gull: w.gull, hound: w.hound }; });
      m3.locSub = "几猫突击小队 · 撤离窗口 40 秒";
      m3.all = "四处中继全部断开！撤离窗口开始计时，守住阵地！";
      m3.intro = "最后一班接驳即将到港。切断四处中继，然后守住撤离点。";
    }
    if (profile === "v2") {
      applyMission(0);
      return;
    }
    buildCampaignUI();'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('profiles patched')
