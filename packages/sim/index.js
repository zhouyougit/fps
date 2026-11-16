/* packages/sim/index.js — SALT_SIM 统一入口
 * 浏览器：前面 7 个 <script> 顺序加载后可直接用 SALT_SIM.create({...})
 * Node：const Sim = require('./packages/sim'); const sim = Sim.create({map});
 * UMD 链：Node require('./command.js') 得到完整命名空间。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./command.js'));
  else root.SALT_SIM = factory(root.SALT_SIM || {});
})(typeof globalThis !== 'undefined' ? globalThis : this, function (S) {
  'use strict';
  S = S || {};

  var VERSION = '0.32.0';

  /**
   * @param {object} options {map: 单图 spec | 地图 id, maps?: {id: spec} | {maps:{id:spec}},
   *   mapData?: 同上, spawn?, seed?, tuning?, player?: false}
   */
  function create(options) {
    options = options || {};
    var map = options.map !== undefined ? options.map : options.mapId;
    if (typeof map === 'string') {
      var src = options.maps || options.mapData || null;
      var collection = src && src.maps ? src.maps : src;
      var spec = collection ? collection[map] : null;
      if (!spec) {
        var ids = collection ? Object.keys(collection).join(', ') : '(未提供 maps)';
        throw new Error('SALT_SIM.create: 未知地图 "' + map + '"，可用: ' + ids);
      }
      map = spec;
    }
    if (!map || typeof map !== 'object') {
      throw new Error('SALT_SIM.create: 需要 options.map（单图 spec 或地图 id）');
    }
    var world = S.world.createWorld(map, options.world || null);
    var spawn = options.spawn !== undefined ? options.spawn : map.playerStart;
    var player = options.player === false ? null : S.movement.createPlayerState(world, spawn, options.tuning);
    var streams = S.rng.createStreams(options.seed === undefined ? 1 : options.seed);
    var damage = S.damage.createDamagePipeline(options.damage);
    var api = {
      version: VERSION,
      map: map,
      world: world,
      player: player,
      rng: streams,
      math: S.math,
      command: S.command,
      weapons: S.weapons,
      movement: S.movement,
      damage: damage,
      step: function (cmd, h) {
        return S.movement.stepPlayer(player, cmd, world, h, options.tuning);
      },
    };
    return api;
  }

  S.version = VERSION;
  S.create = create;
  S.createWorld = S.world.createWorld;
  S.createPlayerState = S.movement.createPlayerState;
  S.stepPlayer = S.movement.stepPlayer;
  return S;
});
