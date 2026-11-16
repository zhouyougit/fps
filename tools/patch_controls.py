
import io
p='src/game.js'
s=io.open(p,encoding='utf-8').read()

old='''    <div><dt>近战</dt><dd><kbd>F</kbd></dd></div>
    <div><dt>暂停</dt><dd><kbd>Esc</kbd> 或 <kbd>P</kbd></dd></div>'''
new='''    <div><dt>近战</dt><dd><kbd>F</kbd> 或 <kbd>V</kbd></dd></div>
    <div><dt>切换武器</dt><dd><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd></dd></div>
    <div><dt>投掷手雷</dt><dd><kbd>G</kbd></dd></div>
    <div><dt>暂停</dt><dd><kbd>Esc</kbd> 或 <kbd>P</kbd></dd></div>'''
assert s.count(old)==1
s=s.replace(old,new,1)

old2='''<div><span><kbd>E</kbd> 切断中继</span><span><kbd>Space</kbd> 跳跃</span><span><kbd>Shift</kbd> 冲刺</span><span><kbd>C</kbd> 蹲伏</span><span><kbd>Esc</kbd> 暂停</span></div>'''
new2='''<div><span><kbd>E</kbd> 切断中继</span><span><kbd>Space</kbd> 跳跃</span><span><kbd>Shift</kbd> 冲刺</span><span><kbd>C</kbd> 蹲伏</span><span><kbd>Esc</kbd> 暂停</span></div>
        <div><span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> 换枪</span><span><kbd>G</kbd> 手雷</span><span><kbd>V</kbd> 近战</span><span><kbd>右键</kbd> 瞄准</span></div>'''
assert s.count(old2)==1
s=s.replace(old2,new2,1)
io.open(p,'w',encoding='utf-8').write(s)
print('controls patched')
