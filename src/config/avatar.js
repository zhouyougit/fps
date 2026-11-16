/* =====================================================================
   SALTLINE · src/config/avatar.js — V47 联机士兵外观/比例配置
   ---------------------------------------------------------------------
   只放“看起来怎么样”的参数，几何/动画逻辑仍在 src/mp_avatar.js。
   改这里即可调整队服色、材质色、头部比例、蹲伏高度、落地阴影。
   ===================================================================== */
(function (root) {
  "use strict";
  var AVATAR = {
    version: "V47.1",
    team: {
      1: { fabric: 0x8c7452, accent: 0xff6a55 },
      0: { fabric: 0x5f7480, accent: 0x4fa8ff }
    },
    materials: {
      kit: 0x4a555c,
      glass: 0x1a1d20,
      glassEmissive: 0.02,
      normalScale: 0.55
    },
    proportions: {
      headScale: 0.88,
      standHip: 0.92,
      crouchHip: 0.70
    },
    blob: {
      size: 1.15,
      opacity: 0.34
    },
    lod: {
      far: 55,
      interval: 0.25
    }
  };
  root.SX_AVATAR_CONFIG = AVATAR;
})(typeof window !== "undefined" ? window : globalThis);
