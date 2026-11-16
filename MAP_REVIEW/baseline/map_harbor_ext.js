  /* =====================================================================
     Map: 四号泊位追加层（harbor extras）
     港区主体烘焙在 src/game.js 内；这里通过 MapKit.extend("harbor") 追加
     视觉细节与碰撞，不改动原场景。所有新增几何必须落在港区可玩区域内，
     并在 packages/data/maps/harbor.authored.json 的 bounds 内。
     ===================================================================== */
  (function () {
    function build(K) {
      var T = K.T;
      /* 由地图优化 Agent 持续填充：
         K.box(x,y,z,w,h,d,mat,opts)    追加带碰撞的体块
         K.prop("crate_stack",x,z,yaw,y) 追加道具（自带 collider）
         K.light(x,y,z,color,intensity,dist) 追加点光
         K.label(text,x,y,z,yaw,w,h)    追加标牌
         坐标与港区一致：x -40..40, z -30..30。 */
    }
    if (typeof MapKit !== "undefined" && MapKit.onInit) {
      MapKit.onInit(function () { MapKit.extend("harbor", build); });
    }
  })();
