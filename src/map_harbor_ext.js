  /* =====================================================================
     Map: 四号泊位追加层（harbor extras）
     港区主体烘焙在 src/game.js 内；这里通过 MapKit.extend("harbor") 追加
     视觉细节与碰撞，不改动原场景。所有新增几何必须落在港区可玩区域内，
     并在 packages/data/maps/harbor.authored.json 的 bounds 内。
     ===================================================================== */
  (function () {
    function build(K) {
      var T = K.T;
      var bx = K.box, pr = K.prop, lt = K.light, lb = K.label;

      /* 地面标线/警示漆：薄片，不遮挡视线，也不参与寻路阻挡 */
      function paint(x, z, w, d, mat) {
        bx(x, 0.011, z, w, 0.022, d, mat || "hazard_stripes", {
          castShadow: false, surface: "concrete"
        });
      }
      /* 贴墙牌：钢板背板 + 文字面，yaw 为牌面朝向（0=+z, PI/2=+x） */
      function sign(text, x, y, z, yaw, w, h) {
        var s = Math.sin(yaw || 0), c = Math.cos(yaw || 0);
        bx(x - s * 0.05, y, z - c * 0.05,
          Math.abs(c) > 0.5 ? w + 0.14 : 0.06, h + 0.14,
          Math.abs(c) > 0.5 ? 0.06 : w + 0.14, "steel_dark", { castShadow: false });
        lb(text, x, y, z, yaw || 0, w, h);
      }

      /* ── R1-A 西门维修角：工具棚 + 气瓶架 + 轮胎/油桶/手推车 ──
         位置 x -32..-26 / z -9..-4：原为空旷内场，避开出生点(-32,6)、
         大门通道(z 2..8)与堆场主通道(x -24)。 */
      var sx = -29, sz = -7.4;
      bx(sx, 1.35, -8.9, 6.6, 2.7, 0.16, "corrugated_roof");        // 背墙
      bx(-32.2, 1.2, sz, 0.16, 2.4, 2.9, "corrugated_roof");        // 侧墙
      bx(-25.8, 1.2, sz, 0.16, 2.4, 2.9, "corrugated_roof");
      bx(sx, 2.66, sz, 6.9, 0.12, 3.1, "corrugated_roof");          // 顶棚
      bx(sx, 2.56, -5.94, 6.9, 0.18, 0.07, "steel_rust");           // 檐口压条
      for (var i = 0; i < 2; i++)                                    // 两侧立柱
        for (var j = 0; j < 2; j++)
          bx(-32.16 + i * 6.36, 1.2, -8.82 + j * 2.86, 0.14, 2.4, 0.14, "steel_dark");
      bx(-30.4, 0.42, -8.12, 2.3, 0.84, 0.62, "steel_worn");        // 工作台
      bx(-30.4, 0.87, -8.12, 2.4, 0.07, 0.68, "steel_bare");
      bx(-30.4, 1.52, -8.66, 2.2, 1.05, 0.05, "paint_grey");        // 工具板
      bx(-31.15, 1.0, -8.05, 0.32, 0.24, 0.3, "steel_dark");        // 台钳
      bx(-27.6, 0.62, -8.5, 1.5, 0.04, 0.34, "steel_galv");         // 壁挂置物板
      bx(-27.6, 0.28, -8.5, 0.05, 0.62, 0.3, "steel_galv");
      paint(sx, -4.72, 5.8, 1.5);                                    // 门前警示漆
      bx(-31.4, 0.03, -3.55, 0.46, 0.06, 0.46, "steel_rust");        // 地锁锚板
      bx(-26.6, 0.03, -3.55, 0.46, 0.06, 0.46, "steel_rust");
      pr("gas_cylinders", -26.55, -8.05, 0.1, 0);                    // 气瓶架
      pr("barrel", -27.15, -7.35, 0, 0, { noCover: true });          // 油桶
      pr("barrel", -26.65, -6.85, 0.65, 0, { noCover: true });
      pr("toolbox_cart", -31.5, -6.35, 0.3, 0);                      // 工具手推车
      pr("tire_stack", -25.1, -4.9, 0, 0, { noCover: true });        // 轮胎堆
      pr("cable_reel", -32.75, -4.55, 0.35, 0, { noCover: true });   // 电缆盘
      pr("traffic_cone", -32.9, -3.7, 0);
      pr("traffic_cone", -25.3, -3.5, 0);
      sign("西门维修角", sx, 2.02, -5.9, 0, 3.8, 0.78);
      sign("维修区", -25.66, 1.82, -7.4, Math.PI / 2, 2.3, 0.58);      // 朝堆场侧墙牌
      var lamp = new T.MeshStandardMaterial({                          // 棚下日光灯管
        color: 0xfff1cf, emissive: 0xffcf87, emissiveIntensity: 2.2, roughness: 0.5
      });
      bx(-30.1, 2.44, -7.6, 1.5, 0.07, 0.16, lamp, { castShadow: false });
      lt(sx, 2.15, -6.5, 0xffc58a, 22, 11);                           // 棚下暖光
      /* 门前地面：油渍、轮胎印、排水篦子、限速牌 */
      bx(-30.6, 0.006, -3.2, 2.6, 0.012, 1.8, "concrete_dirty", { castShadow: false });
      bx(-27.3, 0.006, -2.7, 1.6, 0.012, 1.1, "concrete_dirty", { castShadow: false });
      bx(-30.4, 0.008, 1.4, 0.3, 0.016, 6.4, "rubber", { castShadow: false });
      bx(-28.8, 0.008, 1.8, 0.3, 0.016, 6.0, "rubber", { castShadow: false });
      bx(-30.2, 0.02, 3.4, 1.4, 0.04, 0.5, "steel_dark", { castShadow: false });
      sign("限速 5", -37.84, 1.68, 10.4, Math.PI / 2, 1.8, 0.5);

      /* ── R1-B 南侧背巷：托盘/篷布货堆 + 通道牌 + 地脚锁 ──
         堆场最后一排集装箱(z 21..24)背后的空巷，补生活痕迹并留出
         z 25.3..26.4 的通行缝；不碰南侧既有货堆(z 26.9)。 */
      paint(-17.6, 24.2, 9.2, 0.16, "paint_yellow");                 // 巷内黄色通道线
      pr("pallet_stack", -19.2, 24.35, 0.06, 0);
      pr("tarp_cargo", -16.6, 24.55, 0.02, 0);
      pr("barrel", -20.45, 24.5, 0, 0, { noCover: true });
      pr("cable_reel", -13.7, 24.3, 0.2, 0, { noCover: true });
      bx(-18.2, 0.03, 25.9, 0.5, 0.06, 0.5, "steel_rust", { castShadow: false });
      bx(-15.2, 0.03, 25.9, 0.5, 0.06, 0.5, "steel_rust", { castShadow: false });
      sign("B-3 堆场背巷", -14.6, 2.5, 23.94, 0, 3.4, 0.62);
      /* ── R2-A 码头临水带：系缆绞盘、消防箱、缆桩、救生站、警示牌 ──
         沿 x 28.8..29.8 的护岸边走，避开中继 C(23,0) 与撤离点(29,20)。 */
      function cleat(x, z) {
        bx(x, 0.03, z, 0.3, 0.06, 0.3, "steel_dark", { castShadow: false });
        bx(x, 0.1, z - 0.1, 0.06, 0.14, 0.06, "steel_dark");
        bx(x, 0.1, z + 0.1, 0.06, 0.14, 0.06, "steel_dark");
        bx(x, 0.17, z, 0.34, 0.07, 0.07, "steel_dark");
        paint(x, z, 0.7, 0.7);
      }
      for (var q = 0; q < 4; q++) cleat(29.0, [-20.5, -5.5, 6.5, 21.8][q]);
      function hoseCab(z) {                                    // 消防箱（带腿）
        bx(29.55, 0.62, z, 0.34, 1.0, 0.72, "paint_red");
        bx(29.36, 0.62, z, 0.02, 0.8, 0.5, "paint_white", { castShadow: false });
        bx(29.55, 0.16, z - 0.24, 0.06, 0.32, 0.06, "steel_galv");
        bx(29.55, 0.16, z + 0.24, 0.06, 0.32, 0.06, "steel_galv");
      }
      hoseCab(-18.5); hoseCab(3.5); hoseCab(24.0);
      pr("generator", 29.3, -13.6, -Math.PI / 2, 0);           // 系缆绞盘
      pr("generator", 29.3, 7.6, -Math.PI / 2, 0);
      bx(29.05, 0.05, -12.55, 0.6, 0.035, 0.09, "rubber", { castShadow: false });
      bx(29.05, 0.05, 8.55, 0.6, 0.035, 0.09, "rubber", { castShadow: false });
      bx(29.45, 1.15, 16.8, 0.1, 2.3, 0.1, "paint_yellow");    // 救生站
      bx(29.4, 1.65, 16.8, 0.16, 0.86, 0.8, "paint_orange");
      bx(29.31, 1.92, 16.8, 0.02, 0.12, 0.56, "paint_white", { castShadow: false });
      bx(29.31, 1.38, 16.8, 0.02, 0.12, 0.56, "paint_white", { castShadow: false });
      bx(29.31, 1.65, 16.54, 0.02, 0.55, 0.12, "paint_white", { castShadow: false });
      bx(29.31, 1.65, 17.06, 0.02, 0.55, 0.12, "paint_white", { castShadow: false });
      sign("系缆区", 29.42, 1.38, -3.5, -Math.PI / 2, 1.6, 0.5);
      bx(29.47, 0.68, -3.5, 0.08, 1.4, 0.08, "steel_galv");
      sign("注意落水", 29.42, 1.38, 13.2, -Math.PI / 2, 1.8, 0.5);
      bx(29.47, 0.68, 13.2, 0.08, 1.4, 0.08, "steel_galv");
      bx(29.3, 0.008, 5.2, 1.1, 0.016, 4.2, "water_dark", { castShadow: false });
      bx(29.35, 0.008, -16.4, 0.9, 0.016, 3.0, "water_dark", { castShadow: false });

      /* ── R2-B 南堆场东段：托盘/篷布货堆 + 分区牌 + 穿越线 + 护栏 ── */
      paint(8.7, 24.35, 3.5, 1.7);
      pr("pallet_stack", 12.2, 25.2, 0.05, 0);
      pr("tarp_cargo", 14.8, 25.35, 0.02, 0);
      pr("barrel", 10.6, 25.9, 0, 0, { noCover: true });
      pr("cable_reel", 16.1, 25.2, 0.2, 0, { noCover: true });
      bx(9.4, 0.03, 26.4, 0.5, 0.06, 0.5, "steel_rust", { castShadow: false });
      sign("B-4 南堆场", 11.4, 2.4, 23.94, 0, 3.0, 0.56);
      for (var g = 0; g < 3; g++)
        bx(17.15, 0.5, 24.5 + g * 0.9, 0.07, 1.0, 0.07, "steel_galv");
      bx(17.15, 0.95, 25.4, 0.05, 0.06, 1.9, "steel_galv");
      bx(17.15, 0.55, 25.4, 0.05, 0.05, 1.9, "steel_galv");
      /* ── R3-A 二号仓库西墙：落水管/线管/壁灯/配电箱/门牌 ──
         外墙 x=-16，西门 z -22..-17；外为 5.4m 宽检修巷，沿墙布置不挡路。 */
      for (var d = 0; d < 2; d++) {
        var dz = [-27.6, -11.4][d];
        bx(-16.12, 3.2, dz, 0.14, 6.4, 0.14, "steel_dark");
        for (var k = 0; k < 3; k++)
          bx(-16.05, 1.5 + k * 2.0, dz, 0.2, 0.06, 0.3, "steel_galv", { castShadow: false });
        bx(-16.12, 0.1, dz + 0.25, 0.14, 0.2, 0.36, "steel_dark", { castShadow: false });
      }
      bx(-16.06, 3.35, -24.85, 0.06, 0.06, 5.3, "steel_galv", { castShadow: false });
      bx(-16.06, 3.35, -14.15, 0.06, 0.06, 5.3, "steel_galv", { castShadow: false });
      bx(-16.18, 3.35, -24.4, 0.16, 0.4, 0.3, "steel_galv", { castShadow: false });
      bx(-16.18, 3.35, -14.6, 0.16, 0.4, 0.3, "steel_galv", { castShadow: false });
      bx(-16.2, 3.9, -22.7, 0.22, 0.14, 0.7, "steel_dark", { castShadow: false });
      bx(-16.2, 3.9, -16.3, 0.22, 0.14, 0.7, "steel_dark", { castShadow: false });
      bx(-16.16, 3.72, -22.7, 0.16, 0.1, 0.5, lamp, { castShadow: false });
      bx(-16.16, 3.72, -16.3, 0.16, 0.1, 0.5, lamp, { castShadow: false });
      lt(-17.0, 3.3, -19.5, 0xffc58a, 17, 10);
      bx(-16.16, 0.9, -23.3, 0.36, 1.2, 0.78, "steel_galv");       // 配电箱
      bx(-16.35, 0.9, -23.3, 0.02, 0.94, 0.58, "steel_worn", { castShadow: false });
      bx(-16.16, 1.15, -15.55, 0.28, 0.62, 0.26, "paint_red");     // 灭火器箱
      bx(-16.16, 5.05, -24.9, 0.1, 0.1, 0.1, "steel_galv", { castShadow: false });
      bx(-16.14, 5.35, -19.5, 0.06, 0.62, 4.4, "steel_dark", { castShadow: false });
      sign("2 号仓库 · 维修车间", -16.24, 5.42, -19.5, -Math.PI / 2, 4.2, 0.56);
      sign("配电重地", -16.39, 1.68, -23.3, -Math.PI / 2, 1.4, 0.4);
      bx(-16.34, 0.011, -19.5, 3.2, 0.022, 2.2, "hazard_stripes", { castShadow: false });
      pr("toolbox_cart", -17.7, -16.4, 0.5, 0);
      pr("crate_wood", -18.4, -24.7, 0.2, 0);
      pr("tire_stack", -16.9, -26.6, 0, 0, { noCover: true });
      pr("cable_reel", -18.5, -23.2, 0.3, 0, { noCover: true });
      pr("cardboard_boxes", -18.9, -25.9, 0.4, 0);

      /* ── R3-B 龙门吊基座/轨道：止挡、止轮器、检修牌、工具车 ── */
      bx(18.5, 0.26, 26.2, 0.5, 0.52, 0.42, "paint_yellow");
      bx(28.5, 0.26, 26.2, 0.5, 0.52, 0.42, "paint_yellow");
      bx(28.5, 0.26, -28.4, 0.5, 0.52, 0.42, "paint_yellow");
      bx(27.4, 0.11, -8.55, 0.5, 0.22, 0.3, "steel_dark", { castShadow: false });
      bx(27.6, 0.11, 8.55, 0.5, 0.22, 0.3, "steel_dark", { castShadow: false });
      sign("04 号吊 · 检修", 27.94, 1.02, -5.4, -Math.PI / 2, 2.6, 0.5);
      bx(27.84, 2.72, -5.4, 0.16, 0.14, 0.16, "paint_yellow", { castShadow: false });
      var beacon = new T.MeshStandardMaterial({
        color: 0xff5533, emissive: 0xff2200, emissiveIntensity: 2.4, roughness: 0.5
      });
      bx(27.76, 2.88, -5.4, 0.12, 0.12, 0.12, beacon, { castShadow: false });
      bx(27.2, 0.011, -5.0, 2.6, 0.022, 1.9, "concrete_dirty", { castShadow: false });
      pr("toolbox_cart", 27.4, -3.2, -0.4, 0);
      pr("jerry_can", 27.9, -3.9, 0.4, 0);
      pr("jerry_can", 27.95, -3.7, 1.1, 0);
      lt(27.3, 3.3, -5.6, 0xcfe4ff, 16, 10);
      /* ── R4 二号仓库南墙主立面：装卸雨棚/挡车块/月台牌/壁灯/落水收口 ──
         南墙 z=-11，月台门 x -6..-1；雨棚立柱落在门两侧，不挡月台正面。 */
      bx(-3.5, 5.5, -9.9, 6.4, 0.16, 2.4, "corrugated_roof");        // 雨棚
      bx(-3.5, 5.36, -8.72, 6.5, 0.16, 0.1, "steel_rust");           // 檐口
      for (var p = 0; p < 2; p++) {
        var px = [-7.1, 0.1][p];
        bx(px, 2.65, -9.1, 0.16, 5.3, 0.16, "steel_dark");            // 雨棚立柱
        bx(px, 0.01, -9.1, 0.5, 0.02, 0.5, "steel_rust", { castShadow: false });
        bx(px, 5.37, -10.4, 0.12, 0.12, 1.6, "steel_dark");           // 雨棚贴墙横梁
      }
      for (var b = 0; b < 4; b++) {
        var bxp = [-6.2, -0.8, 3.6, 7.2][b];
        bx(bxp, 0.62, -10.8, 0.6, 0.55, 0.24, "rubber");              // 挡车橡胶块
        bx(bxp, 0.32, -10.82, 0.7, 0.08, 0.18, "steel_dark", { castShadow: false });
      }
      bx(-3.5, 0.02, -10.2, 5.6, 0.04, 1.7, "diamond_plate");         // 门前进料钢板
      bx(-3.5, 0.28, -9.36, 5.6, 0.06, 0.14, "hazard_stripes", { castShadow: false });
      bx(-8.4, 3.25, -10.94, 0.06, 0.06, 7.6, "steel_galv", { castShadow: false });
      bx(-8.4, 3.25, -7.4, 0.16, 0.4, 0.3, "steel_galv", { castShadow: false });
      bx(8.6, 3.45, -10.94, 0.06, 0.06, 4.6, "steel_galv", { castShadow: false });
      bx(8.6, 3.45, -8.8, 0.16, 0.4, 0.3, "steel_galv", { castShadow: false });
      bx(-15.6, 3.2, -10.86, 0.14, 6.4, 0.14, "steel_dark");          // 南墙两端落水管
      bx(11.6, 3.2, -10.86, 0.14, 6.4, 0.14, "steel_dark");
      for (var k2 = 0; k2 < 2; k2++) {
        bx(-15.55 + k2 * 27.15, 1.4, -10.86, 0.2, 0.06, 0.3, "steel_galv", { castShadow: false });
        bx(-15.55 + k2 * 27.15, 4.6, -10.86, 0.2, 0.06, 0.3, "steel_galv", { castShadow: false });
      }
      bx(-14.9, 6.3, -10.86, 1.4, 0.14, 0.14, "steel_dark");          // 转角横管
      bx(-9.4, 4.95, -10.92, 0.8, 0.12, 0.5, "steel_dark", { castShadow: false });
      bx(-9.4, 4.9, -10.87, 0.55, 0.08, 0.1, lamp, { castShadow: false });
      bx(1.4, 4.95, -10.92, 0.8, 0.12, 0.5, "steel_dark", { castShadow: false });
      bx(1.4, 4.9, -10.87, 0.55, 0.08, 0.1, lamp, { castShadow: false });
      lt(-3.5, 4.5, -9.4, 0xffc58a, 26, 12);                          // 月台暖光
      bx(-3.5, 0.011, -9.9, 6.0, 0.022, 0.14, "paint_yellow", { castShadow: false });
      bx(-12.6, 0.006, -9.4, 2.2, 0.012, 1.4, "concrete_dirty", { castShadow: false });
      sign("月台 2", -10.6, 3.35, -10.96, 0, 2.2, 0.46);
      pr("pallet_stack", -12.0, -10.1, 0.06, 0);
      pr("crate_wood", 5.6, -10.05, 0.2, 0);
      /* ── R5 码头北段 + 龙门吊轨道北端：压板、缓冲挡警示灯、灯柱检修梯、枕木、油渍 ── */
      for (var rc = 0; rc < 5; rc++) {
        var rz = -28.0 + rc * 1.3;
        bx(18.5, 0.012, rz, 0.34, 0.024, 0.2, "steel_dark", { castShadow: false });
        bx(28.5, 0.012, rz, 0.34, 0.024, 0.2, "steel_dark", { castShadow: false });
      }
      bx(18.5, 1.06, -29.15, 0.16, 0.16, 0.16, beacon, { castShadow: false });
      bx(28.5, 1.06, -29.15, 0.16, 0.16, 0.16, beacon, { castShadow: false });
      bx(21.6, 0.011, -23.6, 4.2, 0.022, 1.6, "concrete_dirty", { castShadow: false });
      bx(24.6, 0.011, -22.9, 2.4, 0.022, 1.2, "concrete_dirty", { castShadow: false });
      for (var lr = 0; lr < 2; lr++)                                  // 灯柱检修梯
        bx(26.1 + lr * 0.3, 2.6, -28.7, 0.05, 4.6, 0.05, "steel_galv");
      for (var lq = 0; lq < 7; lq++)
        bx(26.25, 0.7 + lq * 0.62, -28.7, 0.34, 0.04, 0.04, "steel_galv", { castShadow: false });
      bx(26.2, 5.05, -28.7, 0.66, 0.06, 0.66, "steel_galv", { castShadow: false });
      bx(26.2, 5.35, -28.7, 0.66, 0.5, 0.05, "steel_galv", { castShadow: false });
      pr("cable_reel", 17.4, -26.2, 0.3, 0, { noCover: true });
      bx(17.9, 0.14, -24.2, 1.6, 0.28, 0.5, "wood_dark", { castShadow: false });
      bx(17.9, 0.44, -24.05, 1.6, 0.24, 0.4, "wood_dark", { castShadow: false });
      sign("北区 · 轨道尽头", 22.4, 2.45, -24.66, 0, 3.0, 0.5);
      lt(26.2, 4.6, -28.2, 0xffc58a, 14, 9);                       // 北端作业照明




      bx(-14.6, 3.02, 23.98, 0.5, 0.1, 0.16, lamp, { castShadow: false }); // 巷内壁灯
      bx(-16.4, 2.78, 23.97, 3.6, 0.05, 0.05, "steel_dark", { castShadow: false });
    }
    if (typeof MapKit !== "undefined" && MapKit.onInit) {
      MapKit.onInit(function () {
        var K = null;
        MapKit.extend("harbor", function (b) { K = b; build(b); });
        /* 追加层只做细节，不进入太阳阴影 pass：港区 draw call 省一整轮 */
        if (K && K.G && K.G.level && K.G.level.root) {
          var g = K.G.level.root.getObjectByName("sx_harbor_extras");
          if (g) g.traverse(function (o) { if (o.isMesh) o.castShadow = false; });
        }
      });
    }
  })();