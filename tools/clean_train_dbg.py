
import io
p='src/training.js'
s=io.open(p,encoding='utf-8').read()
s=s.replace('    window.__TRAIN_LAUNCH = (window.__TRAIN_LAUNCH || 0) + 1;\n','',1)
s=s.replace('      window.__TRAIN_AGAIN_CLICK = (window.__TRAIN_AGAIN_CLICK || 0) + 1;\n','',1)
io.open(p,'w',encoding='utf-8').write(s)
print('debug counters removed')
