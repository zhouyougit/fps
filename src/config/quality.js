/* =====================================================================
   SALTLINE · src/config/quality.js — 画质档位（V42 配置层）
   ---------------------------------------------------------------------
   这是唯一的画质参数源：game.js 的渲染器与 ext_visual.js 的画面层都从
   这里读取。改这里即可调整 pixel budget / MSAA / 阴影贴图 / 体积光步数 /
   bloom / 动态模糊 / 雨量，不需要再改两个文件里的重复表。
   ===================================================================== */
(function (root) {
  "use strict";
  var PRESETS = {
    test: {
      name: "test", scale: 1, msaa: 0, shadow: 1024, tex: 256,
      volSteps: 10, ao: true, planar: 0.5, bloom: true,
      motionBlur: false, rain: 0.4
    },
    low: {
      name: "low", scale: 0.7, msaa: 0, shadow: 2048, tex: 512,
      volSteps: 12, ao: false, planar: 0, bloom: true,
      motionBlur: false, rain: 0.5
    },
    medium: {
      name: "medium", scale: 0.85, msaa: 2, shadow: 2048, tex: 1024,
      volSteps: 16, ao: true, planar: 0.5, bloom: true,
      motionBlur: false, rain: 0.8
    },
    high: {
      // V41：high 默认 MSAA 2（已有 TAA）；ultra 才用 4。
      name: "high", scale: 1, msaa: 2, shadow: 4096, tex: 1024,
      volSteps: 24, ao: true, planar: 0.5, bloom: true,
      motionBlur: true, rain: 1
    },
    ultra: {
      name: "ultra", scale: 1, msaa: 4, shadow: 4096, tex: 2048,
      volSteps: 40, ao: true, planar: 1, bloom: true,
      motionBlur: true, rain: 1
    }
  };
  root.SX_QUALITY_PRESETS = PRESETS;
  root.SX_QUALITY_ORDER = ["low", "medium", "high", "ultra"];
  root.SX_QUALITY_PIXEL_BUDGET = { low: 1000000, medium: 1500000, high: 2300000, ultra: 3700000 };
})(typeof window !== "undefined" ? window : globalThis);
