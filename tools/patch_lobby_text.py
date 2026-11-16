
import io
p='src/mp.js'
s=io.open(p,encoding='utf-8').read()
s=s.replace('''<div class="m-k">几猫 · 联机对战</div><h2>港区混战</h2>''','''<div class="m-k">几猫 · 联机对战</div><h2>多人对战</h2>''',1)
s=s.replace('''<p class="x-mp-note">V16：移动/视角同步。射击、伤害、比分将在下一轮接入。</p>''','''<p class="x-mp-note">V21：港区 / 冷库 / 货轮三图轮换；移动、射击、护甲、比分、回合已接入。</p>''',1)
io.open(p,'w',encoding='utf-8').write(s)
print('lobby text polished')
