/* packages/sim/command.js — 输入命令结构、按钮位掩码与校验
 * 命令里只放电平；边沿由 sim 用 prevButtons 推导（可回放）。
 * UMD 链：Node require('./damage.js')。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./damage.js'));
  else root.SALT_SIM = factory(root.SALT_SIM || {});
})(typeof globalThis !== 'undefined' ? globalThis : this, function (S) {
  'use strict';
  S = S || {};
  var M = S.math;

  var BTN = Object.freeze({
    FIRE: 1,
    ADS: 2,
    JUMP: 4,
    SPRINT: 8,
    CROUCH: 16,
    RELOAD: 32,
    MELEE: 64,
    GRENADE: 128,
    INTERACT: 256,
    SCAN: 512,
    LEAN_L: 1024,
    LEAN_R: 2048,
  });
  var ALL_BUTTONS = 0;
  for (var k in BTN) ALL_BUTTONS |= BTN[k];
  var PITCH_LIMIT = 1.55;

  function num(v, d) {
    return typeof v === 'number' && Number.isFinite(v) ? v : d;
  }

  /** 构造命令：轴归一化到单位圆内，按钮裁到位掩码，角度必须是有限数。 */
  function makeCommand(input) {
    input = input || {};
    var mx = num(input.mx, 0);
    var my = num(input.my, 0);
    var len2 = mx * mx + my * my;
    if (len2 > 1) {
      var inv = 1 / Math.sqrt(len2);
      mx *= inv;
      my *= inv;
    }
    return {
      tick: num(input.tick, 0) | 0,
      mx: mx,
      my: my,
      yaw: num(input.yaw, 0),
      pitch: M.clamp(num(input.pitch, 0), -PITCH_LIMIT, PITCH_LIMIT),
      buttons: num(input.buttons, 0) & ALL_BUTTONS,
      weaponSlot: num(input.weaponSlot, 0) | 0,
    };
  }

  /**
   * 校验并返回规范化后的命令。
   * @returns {{ok:boolean, errors:string[], command:object}}
   */
  function validateCommand(cmd) {
    var errors = [];
    if (!cmd || typeof cmd !== 'object') {
      return { ok: false, errors: ['command must be an object'], command: makeCommand({}) };
    }
    var keys = ['mx', 'my', 'yaw', 'pitch'];
    for (var i = 0; i < keys.length; i++) {
      var v = cmd[keys[i]];
      if (v !== undefined && (typeof v !== 'number' || !Number.isFinite(v))) errors.push(keys[i] + ' must be finite number');
    }
    if (cmd.buttons !== undefined && (typeof cmd.buttons !== 'number' || !Number.isFinite(cmd.buttons))) {
      errors.push('buttons must be finite number');
    }
    var mc = makeCommand(cmd);
    var rawLen = Math.sqrt(num(cmd.mx, 0) * num(cmd.mx, 0) + num(cmd.my, 0) * num(cmd.my, 0));
    var newLen = Math.sqrt(mc.mx * mc.mx + mc.my * mc.my);
    if (rawLen > 1 + 1e-9 && Math.abs(newLen - 1) > 1e-6) errors.push('axes must normalize into unit circle');
    return { ok: errors.length === 0, errors: errors, command: mc };
  }

  function has(cmd, bit) {
    return !!cmd && (cmd.buttons & bit) !== 0;
  }

  function pressed(prevButtons, cmd, bit) {
    return !!cmd && (cmd.buttons & bit) !== 0 && (prevButtons & bit) === 0;
  }

  S.command = {
    BTN: BTN,
    ALL_BUTTONS: ALL_BUTTONS,
    PITCH_LIMIT: PITCH_LIMIT,
    makeCommand: makeCommand,
    validateCommand: validateCommand,
    has: has,
    pressed: pressed,
  };
  return S;
});
