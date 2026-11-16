
import io
p='src/ext.js'
s=io.open(p,encoding='utf-8').read()
old='''      cutAll: function () { for (var i = 0; i < 8; i++) { try { G.game.debugCut(); } catch (e) {} } },'''
new='''      cutAll: function () { for (var i = 0; i < 8; i++) { try { G.game.debugCut(); } catch (e) {} } },
      scan: function () { return triggerScan(); },
      aim: function () { return beginGrenadeAim(); },
      release: function () { releaseGrenade(); },
      marks: function () { return S.scanMarks.length; },
      arc: function () { return !!(S.arc && S.arc.pts.visible); },
      scanCd: function () { return S.scanCd; },'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)

p2='src/game.js'
s=io.open(p2,encoding='utf-8').read()
old2='''    <div><dt>投掷手雷</dt><dd><kbd>G</kbd></dd></div>'''
new2='''    <div><dt>投掷手雷</dt><dd>按住 <kbd>G</kbd> 预览弹道，松开投掷</dd></div>
    <div><dt>战术扫描</dt><dd><kbd>Q</kbd></dd></div>'''
assert s.count(old2)==1
s=s.replace(old2,new2,1)
old3='''<div><span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> 换枪</span><span><kbd>G</kbd> 手雷</span><span><kbd>V</kbd> 近战</span><span><kbd>右键</kbd> 瞄准</span></div>'''
new3='''<div><span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> 换枪</span><span>按住 <kbd>G</kbd> 手雷弹道</span><span><kbd>Q</kbd> 战术扫描</span><span><kbd>V</kbd> 近战</span></div>'''
assert s.count(old3)==1
s=s.replace(old3,new3,1)
io.open(p2,'w',encoding='utf-8').write(s)
print('debug api + controls patched')
