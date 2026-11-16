
import io
p='src/game.js'
s=io.open(p,encoding='utf-8').read()
old='      KeyQ: "alt",'
new='      KeyQ: "scan",'
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)

p2='src/ext.js'
s=io.open(p2,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:60])
    s=s.replace(old,new,1)

# state fields
rep('''    damageScale: 1,
    hpScale: 1
  };''','''    damageScale: 1,
    hpScale: 1,
    scanCd: 0,
    scanMarks: [],
    grenadeAim: false,
    grenadeTouch: false,
    arc: null,
    killTimes: [],
    lastStreak: 0,
    alertTipShown: false
  };''')

# HUD elements
rep('''    var scope = el("div", "x-scope", '<i class="x-scope-dot"></i><b class="x-scope-h"></b><b class="x-scope-v"></b>');
    root.appendChild(armor);''','''    var scope = el("div", "x-scope", '<i class="x-scope-dot"></i><b class="x-scope-h"></b><b class="x-scope-v"></b>');
    var scanChip = el("div", "x-scan", '<b>Q</b><span>战术扫描</span><i class="x-scan-cd"></i>');
    var scanMarks = el("div", "x-scan-marks");
    var scanPulse = el("div", "x-scan-pulse");
    root.appendChild(armor);''')
rep('''    root.appendChild(scope);
    HUD = {
      scopeEl: scope,
      scopeOn: false,''','''    root.appendChild(scope);
    root.appendChild(scanMarks);
    root.appendChild(scanPulse);
    root.appendChild(scanChip);
    HUD = {
      scopeEl: scope,
      scopeOn: false,
      scanEl: scanChip,
      scanCdEl: scanChip.querySelector(".x-scan-cd"),
      marksEl: scanMarks,
      pulseEl: scanPulse,''')

# CSS
rep('''      ".hud.scoped .h-cross{opacity:0 !important;}",''','''      ".hud.scoped .h-cross{opacity:0 !important;}",
      "/* ---- v6 tactics ---- */",
      ".x-scan{position:absolute;right:var(--gr);bottom:calc(196px + var(--sab));display:flex;align-items:center;gap:7px;padding:5px 9px;border:1px solid rgba(232,228,218,.18);background:rgba(11,13,15,.42);font:600 10px/1 var(--f-label);letter-spacing:.14em;color:rgba(232,228,218,.75);text-shadow:var(--shadow);}",
      ".x-scan b{width:15px;height:15px;line-height:14px;text-align:center;border:1px solid rgba(232,228,218,.45);color:var(--bone);}",
      ".x-scan.cd{opacity:.55;}",
      ".x-scan.cd b{border-color:rgba(232,228,218,.2);color:rgba(232,228,218,.4);}",
      ".x-scan-cd{font:500 9px/1 var(--f-mono);color:var(--signal);min-width:1.1em;text-align:right;}",
      ".x-scan-marks{position:absolute;inset:0;pointer-events:none;}",
      ".x-sm{position:absolute;left:0;top:0;width:0;height:0;color:#8fd8ff;will-change:transform;text-shadow:var(--shadow);}",
      ".x-sm i{position:absolute;left:-6px;top:-6px;width:12px;height:12px;border:1.5px solid currentColor;transform:rotate(45deg);background:rgba(8,14,18,.35);}",
      ".x-sm b{position:absolute;left:-40px;width:80px;top:10px;text-align:center;font:600 10px/1 var(--f-mono);color:#c8ecff;}",
      ".x-sm.near i{background:rgba(143,216,255,.3);}",
      ".x-scan-pulse{position:absolute;left:50%;top:50%;width:22vmin;height:22vmin;margin:-11vmin;border:2px solid rgba(143,216,255,.55);border-radius:50%;opacity:0;pointer-events:none;}",
      ".x-scan-pulse.on{animation:scanring .75s ease-out;}",
      "@keyframes scanring{0%{opacity:.8;transform:scale(.15);}100%{opacity:0;transform:scale(4.2);}}",
      "@media (max-width:760px){.x-scan{display:none;}}",''')

# tactics marker
rep('''  /* ------------------------------------------------------- per-frame */
  function update(dt) {''','''  /*__TACTICS__*/

  /* ------------------------------------------------------- per-frame */
  function update(dt) {''')

# update loop
rep('''    updatePickups(dt);
    updateGrenades(dt);
    HUD.tick(dt);

    var inp = G.input;
    if (P.alive && P.enabled) {
      if (inp.pressed("grenade")) throwGrenade();
      if (inp.pressed("melee")) meleeAttack();
    }''','''    updatePickups(dt);
    updateGrenades(dt);
    updateScan(dt);
    updateCombatFeedback();
    HUD.tick(dt);

    var inp = G.input;
    if (P.alive && P.enabled) {
      if (inp.pressed("scan")) triggerScan();
      if (inp.pressed("grenade")) beginGrenadeAim();
      else if (S.grenadeAim && !S.grenadeTouch && !inp.down("grenade")) releaseGrenade();
      if (S.grenadeAim) {
        if (P.enabled) updateGrenadeAim();
        else cancelGrenadeAim();
      }
      if (inp.pressed("melee")) meleeAttack();
    } else if (S.grenadeAim) cancelGrenadeAim();''')

# init feedback on boot
rep('''    try { initCampaign(); } catch (e) { console.error("[ext] campaign init", e); }''','''    try { initCampaign(); } catch (e) { console.error("[ext] campaign init", e); }
    initCombatFeedback();''')

# touch grenade hold + scan button
rep('''        var gb = el("button", "t-btn", "手雷");
        gb.style.cssText = "width:56px;height:56px;right:calc(20px + var(--sar));bottom:calc(258px + var(--sab));";
        gb.addEventListener("pointerdown", function (e) { e.preventDefault(); throwGrenade(); });
        ui.appendChild(gb);''','''        var gb = el("button", "t-btn", "手雷");
        gb.style.cssText = "width:56px;height:56px;right:calc(20px + var(--sar));bottom:calc(258px + var(--sab));";
        gb.addEventListener("pointerdown", function (e) { e.preventDefault(); S.grenadeTouch = true; beginGrenadeAim(); });
        gb.addEventListener("pointerup", function (e) { e.preventDefault(); S.grenadeTouch = false; releaseGrenade(); });
        gb.addEventListener("pointercancel", function () { S.grenadeTouch = false; cancelGrenadeAim(); });
        ui.appendChild(gb);
        var scb = el("button", "t-btn", "扫描");
        scb.style.cssText = "width:56px;height:56px;right:calc(156px + var(--sar));bottom:calc(258px + var(--sab));";
        scb.addEventListener("pointerdown", function (e) { e.preventDefault(); triggerScan(); });
        ui.appendChild(scb);''')
io.open(p2,'w',encoding='utf-8').write(s)
print('ext v6 patched')
