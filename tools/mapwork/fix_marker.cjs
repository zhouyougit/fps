
const fs=require('fs');
let s=fs.readFileSync('src/game/30_gameplay.js','utf8');
if(s.indexOf('  /*__WEAPON_EXT__*/')<0){
  const i=s.indexOf('/*__WEAPON_EXT__*/');
  if(i<0) throw new Error('marker missing');
  s=s.slice(0,i)+'  /*__WEAPON_EXT__*/'+s.slice(i+'/*__WEAPON_EXT__*/'.length);
  fs.writeFileSync('src/game/30_gameplay.js',s);
}
console.log('marker ok', s.indexOf('  /*__WEAPON_EXT__*/'));