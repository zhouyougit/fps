/* =====================================================================
   SALTLINE · src/config/balance.js — 玩法/性能平衡参数（V42 配置层）
   ---------------------------------------------------------------------
   调参入口（只改这一个文件即可）：
     player   玩家眼高、碰撞半径、FOV
     mission  任务开场/中继切断/敌人波次/追击节奏
     enemies  四种特殊机体的血量、速度、伤害、信用点
     movement 滑铲/翻越/探身参数（ext_movement.js）
     lights   V41 固定灯池预算（地图灯/闪光/补光）
     render   动态分辨率、像素预算、自动画质的阈值
   window.SX_BALANCE 暴露运行时对象，方便控制台临时试验。
   ===================================================================== */
(function (root) {
  "use strict";
  var BALANCE = {
    version: "V42.1",

    player: {
      eye: 1.68,
      crouchEye: 1.05,
      radius: 0.32,
      height: 1.8,
      fov: 74,
      viewFov: 54
    },

    mission: {
      introSeconds: 3.5,
      retryIntroSeconds: 1.3,
      interactRange: 2.2,
      interactFacing: 0.45,
      cutSeconds: 2.4,
      patrol: { gull: 2, hound: 1 },
      waves: [
        { gull: 3, hound: 1 },
        { gull: 3, hound: 2 },
        { gull: 4, hound: 3 }
      ],
      maxAlive: 9,
      spawnStagger: 0.85,
      spawnFar: 18,
      pursuitEvery: 7,
      pursuitMinAlive: 4,
      pursuitExtra: 5,
      titleSpeed: 1.15,
      titleFov: 50
    },

    enemies: {
      // V44：自杀无人机（drone）自爆。玩家实际承伤 = explodeDamage * 0.5。
      // V55：第三关 BOSS 战反馈无人机过强；44→36（玩家 22→18），半径 4.4→4.0。
      suicideDrone: {
        explodeDamage: 36,
        explodeRadius: 4.0,
        speed: 10.5,
        triggerRadius: 1.9,
        triggerDistance: 1.5
      },
      variants: {
        scout: {
          base: "gull", hp: 40, hitScale: 0.85, hitRadiusSq: 1.2,
          lens: [1.8, 5.6, 7.8], speed: 11, credits: 6, threat: 0.6,
          label: "侦察蜂"
        },
        siege: {
          base: "hound", hp: 360, hitScale: 1.35, hitRadiusSq: 3.6,
          lens: [7.6, 3.2, 0.7], runSpeed: 1.55, rangeMin: 14, rangeMax: 34,
          burstCount: 2, shotDamage: 0, telegraph: 0.9, coolMul: 1.7,
          spreadMul: 0.6, credits: 55, threat: 3.0, label: "攻城蛛"
        },
        emp: {
          base: "hound", hp: 140, hitScale: 1.05, hitRadiusSq: 2.0,
          lens: [3.4, 2.2, 8.2], runSpeed: 4.2, rangeMin: 6, rangeMax: 16,
          shotDamage: 0, telegraph: 0.5, coolMul: 1.1,
          credits: 30, threat: 1.8, label: "电磁犬"
        },
        warden: {
          base: "gull", hp: 220, hitScale: 1.2, hitRadiusSq: 2.6,
          lens: [2.6, 5.0, 3.4], speed: 5, shield: 180,
          credits: 60, threat: 2.5, label: "盾墙无人机"
        }
      }
    },

    movement: {
      slide: {
        minSpeed: 5.2,
        startSpeed: 7.6,
        friction: 5.5,
        maxTime: 0.9,
        exitSpeed: 2.2,
        cooldown: 0.4,
        steer: 35 * Math.PI / 180,
        height: 1.15,
        eyeDip: 0.10,
        roll: 3 * Math.PI / 180,
        jumpBoost: 0
      },
      vault: {
        minRise: 0.45,
        maxRise: 1.3,
        reach: 1.15,
        lowRise: 1.1,
        lowTime: 0.28,
        highTime: 0.40,
        fwdSpeed: 2.2,
        radiusPad: 0.06
      },
      lean: {
        offset: 0.35,
        angle: 6 * Math.PI / 180,
        time: 0.14,
        clipPad: 0.12
      }
    },

    lights: {
      // 地图灯池固定 8 盏；闪光 2 盏；第一人称补光 1 盏；总预算 11。
      pool: 8,
      flash: 2,
      fill: 1,
      selectEvery: 0.1,
      fadeOut: 0.12,
      fadeIn: 0.18,
      reselectDistance: 2.0
    },

    render: {
      pixelBudget: { low: 1000000, medium: 1500000, high: 2300000, ultra: 3700000 },
      autoQuality: {
        dropAboveMs: 21.5,
        hardDropAboveMs: 45,
        riseBelowMs: 12.5,
        riseSamples: 3,
        riseCooldown: 20,
        scaleMin: 0.6,
        scaleMax: 1,
        settleSeconds: 3.5
      }
    }
  };
  root.SX_BALANCE = BALANCE;
})(typeof window !== "undefined" ? window : globalThis);
