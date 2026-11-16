
const N=require('../packages/net/protocol.js');
const cmd=N.encodeInput({seq:42,tick:100,buttons:N.BTN.FIRE|N.BTN.ADS,mx:0.5,my:-0.7,yaw:1.23,pitch:-0.2,slot:3});
console.log('input len',cmd.byteLength, JSON.stringify(N.decodeInput(cmd)));
const players=[{id:1,x:1.234,y:0.5,z:-3.21,yaw:2.2,hp:100,armor:50,team:0,alive:true},{id:2,x:10,y:0.5,z:5,yaw:0,hp:0,armor:0,team:1,alive:false,crouch:true}];
const snap=N.encodeSnapshot(1200,900,players,{});
console.log('snap len',snap.byteLength,JSON.stringify(N.decodeSnapshot(snap)));
const delta=N.encodeSnapshot(1201,1200,players,{2:players[1]});
console.log('delta len',delta.byteLength,'players',N.decodeSnapshot(delta).players.length);
