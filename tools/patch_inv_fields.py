
import io
p='src/weapon_ext.js'
s=io.open(p,encoding='utf-8').read()
old='''      spread: { get: function () { return active().spread; } },'''
new='''      spread: { get: function () { return active().spread; } },
      adsFov: { get: function () { return active().adsFov || 0; } },
      scope: { get: function () { return !!active().scope; } },'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('inventory forwards adsFov/scope')
