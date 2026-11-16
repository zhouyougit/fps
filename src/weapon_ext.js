
  /* =====================================================================
     扩展：军械库（第二把武器：几猫·破门锤 12 号霰弹枪）
     说明：本段在武器模块作用域内定义，因此可直接复用 Rt / Cn / Ii / sm /
     ot 等几何原语与材质槽约定。Rt 的 z 参数为“向前距离”（内部 translate -z），
     Cn 的剖面 y 也被映射为 -z，因此本文件里所有 z 都用正数表示“向前”。
     ===================================================================== */

  var SHOTGUN = {
    id: "breaker12",
    name: "几猫·破门锤 12 号霰弹枪",
    short: "破门锤",
    muzzle: [0, 0.024, -0.605],
    eject: [0.033, 0.012, -0.015],
    sightY: 0.088,
    lensF: 0.075,
    window: [
      [-0.0135, 0.077],
      [0.0135, 0.077],
      [0.0135, 0.094],
      [0.009, 0.099],
      [-0.009, 0.099],
      [-0.0135, 0.094],
    ],
    magPos: [0, -0.062, -0.028],
    boltTravel: 0.07,
    grip: [0, -0.104, 0.098],
    handguard: [0, -0.026, -0.302],
    handguardR: 0.028,
    handlePos: [-0.03, -0.02, -0.30],
    squeeze: 1,
    magSize: 8,
    reserve: 48,
    rpm: 78,
    damage: 11,
    pellets: 9,
    pelletSpread: 1.35,
    range: 90,
    reloadT: 2.85,
    reloadEmptyT: 3.4,
    recoil: 2.35,
    scale: 0.82,
    hipPos: [0.112, -0.108, -0.30],
    hipRot: [0.014, 0.07, -0.016],
  };

  function buildShotgun(cfg) {
    var r = [], a = [], l = [], f = [], c = [], u = [], h = [];
    var ANO = [1, 1, 1],
      GUN = [0.62, 0.65, 0.7],
      TAN = [0.29, 0.225, 0.15],
      POLY = [0.75, 0.75, 0.76],
      BRASS = [1, 0.84, 0.55],
      SHELL = [0.62, 0.14, 0.08],
      SIGHT = [2.6, 2.0, 1.1];

    function box(arr, w, hh, d, bev, x, y, z, col, jit, eul) {
      arr.push(Rt(w, hh, d, bev, x, y, z, col, jit == null ? 9 : jit, eul || null));
    }
    // 沿 -Z 的旋转体：z0/z1 为“向前距离”
    function tube(arr, r0, z0, z1, col, seg, x, y, jit) {
      arr.push(Cn([[0, z0], [r0, z0], [r0, z1], [0, z1]], seg || 14, col, jit || 0, x || 0, y || 0));
    }

    /* ---- 机匣 ---- */
    box(r, 0.062, 0.08, 0.235, 0.0065, 0, 0.004, 0.004, ANO);
    box(r, 0.05, 0.018, 0.235, 0.004, 0, 0.048, 0.0, ANO);       // 顶部平台
    for (var i = 0; i < 15; i++)
      box(r, 0.032, 0.0045, 0.0075, 0.001, 0, 0.0575, -0.104 + i * 0.0148, ANO, 9);
    box(r, 0.0075, 0.052, 0.175, 0.003, 0.0322, 0.0, 0.0, ANO);   // 侧板
    box(r, 0.0075, 0.052, 0.175, 0.003, -0.0322, 0.0, 0.0, ANO);
    box(l, 0.0028, 0.03, 0.062, 0.001, 0.0358, 0.01, 0.012, [0.4, 0.4, 0.4], 9);  // 抛壳口内衬
    box(r, 0.044, 0.03, 0.075, 0.004, 0, -0.041, -0.055, ANO);    // 前方护木底座
    box(r, 0.04, 0.032, 0.1, 0.0045, 0, -0.04, -0.075, ANO);      // 扳机组
    box(r, 0.008, 0.006, 0.062, 0.002, 0, -0.07, -0.07, ANO);     // 护圈底
    box(r, 0.008, 0.026, 0.006, 0.002, 0, -0.057, -0.04, ANO);    // 护圈前

    /* ---- 枪管组 ---- */
    tube(a, 0.0185, 0.1, 0.16, GUN, 16, 0, 0.024);                 // 弹膛
    tube(a, 0.0135, 0.158, 0.598, GUN, 16, 0, 0.024);              // 枪管
    tube(a, 0.0166, 0.575, 0.604, GUN, 14, 0, 0.024);              // 口部
    tube(a, 0.0108, 0.118, 0.442, GUN, 12, 0, -0.008);             // 弹仓管
    tube(a, 0.0122, 0.438, 0.452, GUN, 12, 0, -0.008);             // 弹仓帽
    box(a, 0.052, 0.05, 0.012, 0.003, 0, 0.008, 0.455, GUN);       // 枪管箍
    for (var j = 0; j < 5; j++)                                    // 散热罩分段
      tube(a, 0.0196, 0.192 + j * 0.056, 0.228 + j * 0.056, ANO, 14, 0, 0.024);
    box(a, 0.011, 0.028, 0.016, 0.002, 0, 0.045, 0.57, GUN);       // 准星座
    box(f, 0.0065, 0.0065, 0.0065, 0.002, 0, 0.062, 0.572, SIGHT, 0); // 光纤准星

    /* ---- 枪托 / 握把 ---- */
    box(l, 0.038, 0.108, 0.046, 0.008, 0, -0.098, -0.092, POLY, 9, [-0.34, 0, 0]); // 握把
    box(l, 0.048, 0.052, 0.075, 0.006, 0, 0.0, -0.135, TAN);       // 托颈
    // 骨架式枪托：上下两根梁 + 尾板，中间留空
    box(l, 0.034, 0.026, 0.20, 0.006, 0, 0.022, -0.245, TAN, 9, [0.02, 0, 0]);   // 上梁
    box(l, 0.034, 0.02, 0.20, 0.006, 0, -0.043, -0.245, TAN, 9, [-0.02, 0, 0]);  // 下梁
    box(l, 0.048, 0.10, 0.022, 0.007, 0, -0.012, -0.352, POLY, 9, [0.05, 0, 0]); // 托底板
    box(l, 0.03, 0.014, 0.11, 0.005, 0, 0.038, -0.232, TAN);       // 贴腮
    box(l, 0.03, 0.05, 0.02, 0.005, 0, -0.012, -0.34, TAN);        // 尾板连接
    box(a, 0.006, 0.006, 0.03, 0.001, 0, -0.03, -0.16, GUN);       // 托梁销

    /* ---- 泵柄 ---- */
    box(l, 0.058, 0.058, 0.148, 0.015, 0, -0.024, 0.302, TAN);
    for (var m = 0; m < 5; m++)
      box(l, 0.06, 0.0075, 0.009, 0.002, 0, -0.024, 0.246 + m * 0.028, TAN);
    box(c, 0.016, 0.016, 0.05, 0.003, -0.031, -0.016, 0.302, GUN); // 泵臂

    /* ---- 枪机（随射击往复） ---- */
    box(c, 0.03, 0.017, 0.055, 0.003, 0.024, -0.008, 0.02, GUN);
    box(c, 0.01, 0.024, 0.02, 0.002, 0.038, 0.002, 0.02, GUN);

    /* ---- 光学瞄具 ---- */
    box(r, 0.03, 0.03, 0.06, 0.003, 0, 0.064, 0.072, ANO);
    box(r, 0.006, 0.034, 0.072, 0.002, -0.0195, 0.088, 0.075, ANO);
    box(r, 0.006, 0.034, 0.072, 0.002, 0.0195, 0.088, 0.075, ANO);
    box(r, 0.037, 0.006, 0.072, 0.002, 0, 0.101, 0.075, ANO);
    box(r, 0.037, 0.006, 0.072, 0.002, 0, 0.073, 0.075, ANO);

    /* ---- 弹匣组（换弹时抛出的备弹） ---- */
    tube(u, 0.0125, -0.032, 0.028, SHELL, 12, 0, 0, 4);
    tube(u, 0.0136, 0.026, 0.04, BRASS, 12, 0, 0, 4);
    tube(u, 0.0148, 0.038, 0.043, BRASS, 12, 0, 0, 4);
    /* ---- 待发弹 ---- */
    tube(h, 0.011, -0.028, 0.02, SHELL, 10, 0, 0, 4);

    var ie = {
      ano: Ii(r),
      gun: Ii(a),
      poly: Ii(l),
      plain: Ii(f),
      bolt: Ii(c),
      mag: Ii(u),
      round: Ii(h),
    };
    for (var key in ie) ie[key].computeBoundingSphere();
    return ie;
  }


  /* ===================== 几猫·长眼 精确射手步枪 ===================== */
  var DMR = {
    id: "dmr",
    name: "几猫·长眼 精确射手步枪",
    short: "长眼",
    muzzle: [0, 0.026, -0.79],
    eject: [0.031, 0.012, -0.01],
    sightY: 0.108,
    lensF: 0.1,
    window: [
      [-0.019, 0.108], [-0.0134, 0.0946], [0, 0.089],
      [0.0134, 0.0946], [0.019, 0.108], [0.0134, 0.1214],
      [0, 0.127], [-0.0134, 0.1214]
    ],
    magPos: [0, -0.062, -0.028],
    boltTravel: 0.055,
    grip: [0, -0.106, 0.1],
    handguard: [0, -0.004, -0.36],
    handguardR: 0.024,
    handlePos: [-0.03, 0.014, -0.06],
    squeeze: 1,
    magSize: 10,
    reserve: 90,
    rpm: 240,
    damage: 62,
    range: 320,
    reloadT: 2.6,
    reloadEmptyT: 3.15,
    recoil: 1.7,
    semi: true,
    scope: true,
    adsFov: 30,
    spreadScale: 0.45,
    scale: 0.93,
    hipPos: [0.135, -0.118, -0.3],
    hipRot: [0.02, 0.072, -0.02]
  };

  function buildDMR(cfg) {
    var r = [], a = [], l = [], f = [], c = [], u = [], h = [];
    var ANO = [1, 1, 1],
      GUN = [0.6, 0.63, 0.68],
      TAN = [0.28, 0.22, 0.15],
      POLY = [0.72, 0.72, 0.73],
      SHELL = [0.62, 0.14, 0.08];

    function box(arr, w, hh, d, bev, x, y, z, col, jit, eul) {
      arr.push(Rt(w, hh, d, bev, x, y, z, col, jit == null ? 9 : jit, eul || null));
    }
    function tube(arr, r0, z0, z1, col, seg, x, y, jit, open) {
      var prof = open ? [[r0, z0], [r0, z1]] : [[0, z0], [r0, z0], [r0, z1], [0, z1]];
      arr.push(Cn(prof, seg || 14, col, jit || 0, x || 0, y || 0));
    }

    box(r, 0.058, 0.074, 0.26, 0.006, 0, 0.006, 0.0, ANO);
    box(r, 0.05, 0.016, 0.26, 0.004, 0, 0.046, 0.0, ANO);
    box(r, 0.054, 0.008, 0.12, 0.003, 0, 0.036, 0.06, ANO);
    for (var i = 0; i < 18; i++)
      box(r, 0.03, 0.0042, 0.0072, 0.001, 0, 0.0555, -0.115 + i * 0.0138, ANO, 9);
    box(r, 0.0075, 0.05, 0.2, 0.003, 0.032, 0.004, 0.0, ANO);
    box(r, 0.0075, 0.05, 0.2, 0.003, -0.032, 0.004, 0.0, ANO);
    box(l, 0.0028, 0.028, 0.06, 0.001, 0.0355, 0.012, 0.01, [0.38, 0.38, 0.38], 9);
    box(r, 0.044, 0.03, 0.09, 0.004, 0, -0.042, -0.06, ANO);
    box(r, 0.008, 0.006, 0.06, 0.002, 0, -0.07, -0.075, ANO);
    box(r, 0.008, 0.026, 0.006, 0.002, 0, -0.057, -0.045, ANO);
    for (var pin = 0; pin < 3; pin++)
      box(a, 0.006, 0.006, 0.006, 0.0015, 0.035, 0.015, 0.02 + pin * 0.032, GUN);
    box(a, 0.005, 0.012, 0.02, 0.001, 0.035, -0.033, 0.06, GUN);

    box(r, 0.052, 0.052, 0.42, 0.008, 0, 0.008, 0.34, ANO);
    for (var s = 0; s < 7; s++) {
      box(l, 0.004, 0.022, 0.03, 0.002, 0.0275, 0.008, 0.19 + s * 0.05, [0.2, 0.2, 0.2], 9);
      box(l, 0.004, 0.022, 0.03, 0.002, -0.0275, 0.008, 0.19 + s * 0.05, [0.2, 0.2, 0.2], 9);
    }
    box(r, 0.05, 0.008, 0.42, 0.003, 0, 0.035, 0.34, ANO);
    box(r, 0.012, 0.008, 0.30, 0.002, 0, 0.042, 0.30, ANO);
    tube(a, 0.0125, 0.54, 0.75, GUN, 14, 0, 0.024, 7);
    tube(a, 0.0155, 0.745, 0.788, GUN, 12, 0, 0.024, 7);
    box(a, 0.032, 0.034, 0.012, 0.003, 0, 0.022, 0.462, GUN);
    box(a, 0.011, 0.03, 0.016, 0.002, 0, 0.048, 0.72, GUN);

    box(l, 0.038, 0.108, 0.046, 0.008, 0, -0.1, -0.092, POLY, 9, [-0.34, 0, 0]);
    box(l, 0.046, 0.05, 0.08, 0.006, 0, 0.0, -0.14, TAN);
    box(l, 0.034, 0.024, 0.2, 0.006, 0, 0.024, -0.25, TAN, 9, [0.02, 0, 0]);
    box(l, 0.034, 0.02, 0.2, 0.006, 0, -0.045, -0.25, TAN, 9, [-0.02, 0, 0]);
    box(l, 0.048, 0.11, 0.022, 0.007, 0, -0.012, -0.356, POLY, 9, [0.05, 0, 0]);
    box(l, 0.03, 0.03, 0.06, 0.005, 0, 0.036, -0.17, TAN);
    box(l, 0.05, 0.012, 0.09, 0.004, 0, -0.06, -0.2, TAN, 9, [0.06, 0, 0]);

    box(u, 0.042, 0.075, 0.075, 0.006, 0, -0.055, 0.0, TAN, 9, [0.12, 0, 0]);
    box(u, 0.04, 0.02, 0.085, 0.004, 0, -0.095, -0.005, TAN, 9, [0.16, 0, 0]);
    box(u, 0.028, 0.07, 0.06, 0.004, 0, -0.032, -0.045, SHELL, 9, [0.12, 0, 0]);

    box(c, 0.03, 0.018, 0.06, 0.003, 0.024, 0.006, 0.01, GUN);
    box(c, 0.012, 0.022, 0.02, 0.002, 0.038, 0.016, 0.01, GUN);

    tube(r, 0.026, 0.03, 0.13, ANO, 16, 0, 0.108, 9, true);
    tube(r, 0.031, 0.13, 0.165, ANO, 16, 0, 0.108, 9, true);
    tube(r, 0.03, -0.012, 0.03, ANO, 16, 0, 0.108, 9, true);
    box(r, 0.036, 0.05, 0.03, 0.004, 0, 0.075, 0.05, ANO);
    box(r, 0.036, 0.05, 0.03, 0.004, 0, 0.075, 0.125, ANO);
    box(r, 0.03, 0.024, 0.03, 0.003, 0, 0.052, 0.06, ANO);
    box(r, 0.03, 0.024, 0.03, 0.003, 0, 0.052, 0.13, ANO);
    box(a, 0.014, 0.014, 0.014, 0.002, 0, 0.13, 0.085, GUN);
    box(a, 0.012, 0.014, 0.012, 0.002, -0.03, 0.108, 0.09, GUN);

    box(a, 0.008, 0.008, 0.16, 0.002, 0.02, -0.038, 0.45, GUN, 9, [0.1, 0, 0]);
    box(a, 0.008, 0.008, 0.16, 0.002, -0.02, -0.038, 0.45, GUN, 9, [0.1, 0, 0]);
    box(a, 0.03, 0.012, 0.02, 0.002, 0, -0.042, 0.37, GUN);
    box(f, 0.006, 0.006, 0.008, 0.001, 0, 0.046, 0.742, [2.4, 2.0, 1.2], 0);
    tube(h, 0.0062, -0.022, 0.022, [1, 0.84, 0.55], 8, 0, 0, 3);

    var ie = {
      ano: Ii(r), gun: Ii(a), poly: Ii(l), plain: Ii(f),
      bolt: Ii(c), mag: Ii(u), round: Ii(h)
    };
    for (var key in ie) ie[key].computeBoundingSphere();
    return ie;
  }


  /* =====================================================================
     V33 · 军械扩充：三把新武器（短哨 / 重锚 / 侧牙）
     三把枪都复用 Rt / Cn / Ii 几何原语与既有材质槽（ano/gun/poly/plain/
     bolt/mag/round），但轮廓各自独立：短哨是折叠托 + 直弹匣 + 粗消音器，
     重锚是提把 + 弹箱 + 两脚架，侧牙是「套筒即枪机」的小手枪。
     ===================================================================== */

  var PAC9_CFG = Object.assign({}, mi, {
    id: "pac9", name: "几猫九式突击步枪", short: "九式",
    magSize: 30, reserve: 150, rpm: 720, damage: 26, range: 300,
    reloadT: 2.1, reloadEmptyT: 2.72,
    hipPos: [0.118, -0.122, -0.275], hipRot: [0.034, 0.085, -0.03],
    adsFov: 52, spreadScale: 1, semi: false,
    falloff: { start: 35, end: 80, minMul: 0.65 },
    penetration: 0.5, penetrationMul: 0.75,
    headMul: 2.0, limbMul: 0.8, swapT: 0.34
  });

  var SMG_CFG = {
    id: "smg", name: "几猫·短哨 冲锋枪", short: "短哨",
    muzzle: [0, 0.022, -0.318], eject: [0.030, 0.010, -0.012],
    sightY: 0.081, lensF: 0.060,
    window: [
      [-0.014, 0.081], [-0.0099, 0.0711], [0, 0.0674], [0.0099, 0.0711],
      [0.014, 0.081], [0.0099, 0.0909], [0, 0.0946], [-0.0099, 0.0909]
    ],
    magPos: [0, -0.030, -0.040], boltTravel: 0.055,
    grip: [0, -0.098, 0.052], handguard: [0, -0.028, -0.200], handguardR: 0.026,
    handlePos: [-0.026, 0.012, -0.070], squeeze: 0.8,
    magSize: 32, reserve: 192, rpm: 900, damage: 18, range: 120,
    reloadT: 1.9, reloadEmptyT: 2.3, recoil: 0.5, scale: 0.88,
    hipPos: [0.105, -0.112, -0.250], hipRot: [0.030, 0.075, -0.028],
    adsFov: 58, spreadScale: 1.25, semi: false, suppressor: true,
    falloff: { start: 15, end: 40, minMul: 0.5 },
    penetration: 0.25, penetrationMul: 0.7,
    headMul: 1.6, limbMul: 0.8, moveMul: 1.05, swapT: 0.24
  };

  var LMG_CFG = {
    id: "lmg", name: "几猫·重锚 轻机枪", short: "重锚",
    muzzle: [0, 0.030, -0.720], eject: [0.037, 0.014, -0.005],
    sightY: 0.100, lensF: 0.070,
    window: [
      [-0.016, 0.100], [-0.0113, 0.0887], [0, 0.0850], [0.0113, 0.0887],
      [0.016, 0.100], [0.0113, 0.1113], [0, 0.1150], [-0.0113, 0.1113]
    ],
    magPos: [0, -0.060, -0.030], boltTravel: 0.070,
    grip: [0, -0.104, 0.070], handguard: [0, -0.008, -0.340], handguardR: 0.030,
    handlePos: [-0.034, 0.018, -0.060], squeeze: 1.0,
    magSize: 80, reserve: 240, rpm: 520, damage: 34, range: 200,
    reloadT: 4.2, reloadEmptyT: 5.0, recoil: 2.0, scale: 1.0,
    hipPos: [0.130, -0.140, -0.320], hipRot: [0.030, 0.080, -0.030],
    adsFov: 50, spreadScale: 1.10, semi: false,
    falloff: { start: 40, end: 100, minMul: 0.7 },
    penetration: 0.7, penetrationMul: 0.78,
    headMul: 1.8, limbMul: 0.8, moveMul: 0.85, swapT: 0.56
  };

  var SIDEARM_CFG = {
    id: "sidearm", name: "几猫·侧牙 手枪", short: "侧牙",
    muzzle: [0, 0.014, -0.235], eject: [0.018, 0.020, -0.030],
    sightY: 0.045, lensF: 0.020,
    window: [
      [-0.008, 0.045], [-0.0057, 0.0383], [0, 0.035], [0.0057, 0.0383],
      [0.008, 0.045], [0.0057, 0.0517], [0, 0.055], [-0.0057, 0.0517]
    ],
    magPos: [0, -0.075, 0.045], boltTravel: 0.045,
    grip: [0, -0.078, 0.035], handguard: [0, -0.058, 0.020], handguardR: 0.020,
    handlePos: [0.022, 0.030, -0.020], squeeze: 0.7,
    magSize: 12, reserve: 60, rpm: 420, damage: 38, range: 90,
    reloadT: 1.4, reloadEmptyT: 1.75, recoil: 0.9, scale: 0.95,
    hipPos: [0.085, -0.095, -0.180], hipRot: [0.020, 0.060, -0.020],
    adsFov: 60, spreadScale: 0.70, semi: true, swapT: 0.18,
    falloff: { start: 18, end: 45, minMul: 0.55 },
    penetration: 0.2, penetrationMul: 0.65,
    headMul: 2.0, limbMul: 0.8, moveMul: 1.0
  };

  /* ------------------------------- 几猫·短哨 冲锋枪 ------------------------------- */
  function buildSMG(cfg) {
    var r = [], a = [], l = [], f = [], c = [], u = [], h = [];
    var ANO = [1, 1, 1],
      GUN = [0.62, 0.65, 0.7],
      POLY = [0.74, 0.74, 0.75],
      ACC = [0.92, 0.42, 0.22],
      SIGHT = [2.6, 1.85, 0.95],
      BRASS = [1, 0.84, 0.55];

    function box(arr, w, hh, d, bev, x, y, z, col, jit, eul) {
      arr.push(Rt(w, hh, d, bev, x, y, z, col, jit == null ? 9 : jit, eul || null));
    }
    function tube(arr, r0, z0, z1, col, seg, x, y, jit, open) {
      var prof = open ? [[r0, z0], [r0, z1]] : [[0, z0], [r0, z0], [r0, z1], [0, z1]];
      arr.push(Cn(prof, seg || 14, col, jit || 0, x || 0, y || 0));
    }

    /* 机匣 */
    box(r, 0.050, 0.066, 0.205, 0.006, 0, 0.004, 0.005, ANO);
    box(r, 0.044, 0.014, 0.205, 0.003, 0, 0.044, 0.005, ANO);
    for (var i = 0; i < 13; i++)
      box(r, 0.026, 0.004, 0.006, 0.001, 0, 0.0525, -0.090 + i * 0.0138, ANO, 9);
    box(r, 0.006, 0.044, 0.165, 0.0025, 0.0285, 0.004, 0.005, ANO);
    box(r, 0.006, 0.044, 0.165, 0.0025, -0.0285, 0.004, 0.005, ANO);
    box(l, 0.0025, 0.022, 0.052, 0.001, 0.0345, 0.012, 0.030, [0.35, 0.35, 0.35], 9);
    box(r, 0.040, 0.030, 0.078, 0.004, 0, -0.040, -0.052, ANO);
    box(r, 0.006, 0.024, 0.006, 0.0015, 0, -0.060, -0.018, ANO);
    box(r, 0.006, 0.006, 0.050, 0.0015, 0, -0.076, -0.042, ANO);
    box(r, 0.032, 0.012, 0.030, 0.003, 0, -0.058, 0.030, ANO);
    box(l, 0.004, 0.008, 0.088, 0.001, 0.030, -0.012, -0.020, ACC, 9, [0, 0, -0.2]);

    /* 枪管 + 消音器 */
    tube(a, 0.0150, 0.100, 0.190, GUN, 16, 0, 0.022);
    tube(a, 0.0208, 0.182, 0.300, ANO, 16, 0, 0.022);
    for (var s = 0; s < 4; s++)
      tube(a, 0.0222, 0.196 + s * 0.026, 0.206 + s * 0.026, [0.35, 0.35, 0.36], 14, 0, 0.022);
    tube(a, 0.0165, 0.298, 0.312, GUN, 14, 0, 0.022);
    box(a, 0.030, 0.028, 0.014, 0.003, 0, 0.008, 0.242, GUN);
    box(a, 0.009, 0.020, 0.014, 0.002, 0, 0.050, 0.244, GUN);
    box(f, 0.0055, 0.0055, 0.0055, 0.0015, 0, 0.062, 0.245, SIGHT, 0);
    box(r, 0.004, 0.010, 0.120, 0.0015, 0.027, -0.014, 0.150, ANO);
    box(r, 0.004, 0.010, 0.120, 0.0015, -0.027, -0.014, 0.150, ANO);

    /* 折叠托 */
    box(l, 0.006, 0.011, 0.205, 0.002, 0.026, 0.008, -0.205, POLY, 9, [0.02, 0, 0]);
    box(l, 0.006, 0.011, 0.205, 0.002, -0.026, 0.008, -0.205, POLY, 9, [0.02, 0, 0]);
    box(l, 0.048, 0.062, 0.020, 0.005, 0, -0.012, -0.312, POLY, 9, [0.06, 0, 0]);
    box(l, 0.030, 0.012, 0.090, 0.004, 0, 0.040, -0.250, POLY);
    box(a, 0.010, 0.018, 0.016, 0.002, 0.030, 0.006, -0.118, GUN);

    /* 握把 */
    box(l, 0.034, 0.100, 0.044, 0.008, 0, -0.098, 0.052, POLY, 9, [-0.32, 0, 0]);
    for (var g = 0; g < 4; g++)
      box(l, 0.036, 0.004, 0.006, 0.001, 0, -0.070 - g * 0.020, 0.062, POLY);

    /* 直弹匣（u 组，基准点由 cfg.magPos 决定） */
    box(u, 0.036, 0.150, 0.050, 0.005, 0, -0.082, 0.004, POLY, 9, [0.10, 0, 0]);
    box(u, 0.040, 0.014, 0.056, 0.003, 0, -0.162, 0.020, POLY, 9, [0.10, 0, 0]);
    box(u, 0.008, 0.100, 0.006, 0.001, 0.019, -0.094, 0.026, ACC);
    box(u, 0.030, 0.012, 0.044, 0.002, 0, -0.004, 0.000, ANO);

    /* 枪机 / 拉机柄 */
    box(c, 0.026, 0.014, 0.048, 0.003, 0.019, 0.001, 0.038, GUN);
    box(c, 0.010, 0.018, 0.016, 0.002, 0.036, 0.012, 0.038, GUN);

    /* 红点镜 */
    box(r, 0.030, 0.022, 0.046, 0.003, 0, 0.066, 0.056, ANO);
    tube(r, 0.0185, 0.034, 0.112, ANO, 16, 0, 0.081, 9, true);
    tube(r, 0.0215, 0.030, 0.040, ANO, 16, 0, 0.081, 9, true);
    tube(r, 0.0215, 0.104, 0.114, ANO, 16, 0, 0.081, 9, true);
    box(a, 0.014, 0.012, 0.014, 0.002, 0, 0.070, 0.086, GUN);

    /* 待发弹 */
    tube(h, 0.006, -0.020, 0.020, BRASS, 8, 0, 0, 3);

    var ie = {
      ano: Ii(r), gun: Ii(a), poly: Ii(l), plain: Ii(f),
      bolt: Ii(c), mag: Ii(u), round: Ii(h),
    };
    for (var key in ie) ie[key].computeBoundingSphere();
    return ie;
  }

  /* ------------------------------- 几猫·重锚 轻机枪 ------------------------------- */
  function buildLMG(cfg) {
    var r = [], a = [], l = [], f = [], c = [], u = [], h = [];
    var ANO = [1, 1, 1],
      GUN = [0.6, 0.63, 0.68],
      POLY = [0.72, 0.72, 0.73],
      TAN = [0.30, 0.24, 0.17],
      SIGHT = [2.6, 1.9, 1.0],
      BRASS = [1, 0.84, 0.55];

    function box(arr, w, hh, d, bev, x, y, z, col, jit, eul) {
      arr.push(Rt(w, hh, d, bev, x, y, z, col, jit == null ? 9 : jit, eul || null));
    }
    function tube(arr, r0, z0, z1, col, seg, x, y, jit, open) {
      var prof = open ? [[r0, z0], [r0, z1]] : [[0, z0], [r0, z0], [r0, z1], [0, z1]];
      arr.push(Cn(prof, seg || 14, col, jit || 0, x || 0, y || 0));
    }

    /* 机匣 */
    box(r, 0.070, 0.086, 0.300, 0.007, 0, 0.006, 0.0, ANO);
    box(r, 0.062, 0.020, 0.285, 0.004, 0, 0.054, 0.0, ANO);
    box(r, 0.058, 0.010, 0.100, 0.003, 0, 0.066, 0.080, ANO);
    box(r, 0.0075, 0.056, 0.220, 0.003, 0.036, 0.004, 0.0, ANO);
    box(r, 0.0075, 0.056, 0.220, 0.003, -0.036, 0.004, 0.0, ANO);
    box(l, 0.003, 0.030, 0.070, 0.001, 0.0398, 0.014, 0.030, [0.35, 0.35, 0.35], 9);
    box(r, 0.050, 0.034, 0.090, 0.004, 0, -0.046, -0.060, ANO);
    box(r, 0.008, 0.028, 0.008, 0.002, 0, -0.066, -0.020, ANO);
    box(r, 0.008, 0.007, 0.060, 0.002, 0, -0.084, -0.050, ANO);

    /* 提把 */
    box(r, 0.016, 0.026, 0.020, 0.003, 0, 0.080, 0.070, ANO);
    box(r, 0.016, 0.026, 0.020, 0.003, 0, 0.080, -0.030, ANO);
    box(r, 0.014, 0.014, 0.120, 0.003, 0, 0.100, 0.020, ANO);

    /* 枪管 / 护罩 / 制退器 */
    tube(a, 0.020, 0.150, 0.690, GUN, 18, 0, 0.024);
    box(a, 0.052, 0.052, 0.050, 0.006, 0, 0.020, 0.170, GUN);
    tube(a, 0.030, 0.196, 0.420, ANO, 18, 0, 0.024);
    for (var s = 0; s < 6; s++)
      tube(a, 0.032, 0.206 + s * 0.034, 0.220 + s * 0.034, [0.32, 0.32, 0.34], 16, 0, 0.024);
    box(a, 0.048, 0.048, 0.030, 0.005, 0, 0.024, 0.430, GUN);
    box(a, 0.050, 0.050, 0.034, 0.005, 0, 0.024, 0.700, GUN);
    box(a, 0.056, 0.012, 0.030, 0.003, 0, 0.024, 0.716, ANO);
    box(a, 0.010, 0.030, 0.018, 0.002, 0, 0.058, 0.660, GUN);
    box(f, 0.006, 0.006, 0.006, 0.0015, 0, 0.072, 0.661, SIGHT, 0);

    /* 两脚架 */
    box(a, 0.008, 0.008, 0.190, 0.002, 0.026, -0.020, 0.420, GUN, 9, [0.12, 0, 0.10]);
    box(a, 0.008, 0.008, 0.190, 0.002, -0.026, -0.020, 0.420, GUN, 9, [0.12, 0, -0.10]);
    box(a, 0.012, 0.010, 0.026, 0.002, 0.034, -0.100, 0.520, GUN);
    box(a, 0.012, 0.010, 0.026, 0.002, -0.034, -0.100, 0.520, GUN);

    /* 枪托 / 握把 */
    box(l, 0.044, 0.070, 0.075, 0.007, 0, 0.0, -0.170, TAN);
    box(l, 0.046, 0.052, 0.160, 0.006, 0, -0.012, -0.270, TAN, 9, [0.02, 0, 0]);
    box(l, 0.052, 0.086, 0.024, 0.007, 0, -0.002, -0.360, POLY, 9, [0.05, 0, 0]);
    box(l, 0.030, 0.014, 0.110, 0.004, 0, 0.030, -0.250, TAN);
    box(l, 0.036, 0.108, 0.046, 0.008, 0, -0.104, 0.070, POLY, 9, [-0.34, 0, 0]);
    box(l, 0.040, 0.010, 0.050, 0.003, 0, -0.152, 0.082, POLY);

    /* 弹箱（u 组） */
    box(u, 0.086, 0.120, 0.130, 0.008, 0, -0.120, 0.0, POLY);
    box(u, 0.090, 0.016, 0.136, 0.004, 0, -0.182, 0.0, ANO);
    box(u, 0.070, 0.014, 0.110, 0.004, 0, -0.056, 0.0, ANO);
    box(u, 0.010, 0.030, 0.100, 0.002, 0.045, -0.090, 0.0, BRASS);

    /* 枪机 / 拉机柄 */
    box(c, 0.040, 0.020, 0.070, 0.004, 0.022, 0.010, 0.010, GUN);
    box(c, 0.014, 0.026, 0.022, 0.003, 0.042, 0.022, 0.010, GUN);

    /* 光学瞄具 */
    box(r, 0.030, 0.026, 0.060, 0.003, 0, 0.084, 0.040, ANO);
    tube(r, 0.023, 0.012, 0.128, ANO, 18, 0, 0.100, 9, true);
    tube(r, 0.026, 0.008, 0.020, ANO, 18, 0, 0.100, 9, true);
    tube(r, 0.026, 0.120, 0.132, ANO, 18, 0, 0.100, 9, true);
    box(a, 0.016, 0.014, 0.016, 0.002, 0, 0.090, 0.070, GUN);

    /* 待发弹 */
    tube(h, 0.007, -0.022, 0.022, BRASS, 8, 0, 0, 3);

    var ie = {
      ano: Ii(r), gun: Ii(a), poly: Ii(l), plain: Ii(f),
      bolt: Ii(c), mag: Ii(u), round: Ii(h),
    };
    for (var key in ie) ie[key].computeBoundingSphere();
    return ie;
  }

  /* ------------------------------- 几猫·侧牙 手枪 ------------------------------- */
  function buildSidearm(cfg) {
    var r = [], a = [], l = [], f = [], c = [], u = [], h = [];
    var ANO = [1, 1, 1],
      GUN = [0.62, 0.64, 0.68],
      POLY = [0.7, 0.7, 0.71],
      SIGHT = [2.6, 1.9, 1.0],
      BRASS = [1, 0.84, 0.55];

    function box(arr, w, hh, d, bev, x, y, z, col, jit, eul) {
      arr.push(Rt(w, hh, d, bev, x, y, z, col, jit == null ? 9 : jit, eul || null));
    }
    function tube(arr, r0, z0, z1, col, seg, x, y, jit, open) {
      var prof = open ? [[r0, z0], [r0, z1]] : [[0, z0], [r0, z0], [r0, z1], [0, z1]];
      arr.push(Cn(prof, seg || 14, col, jit || 0, x || 0, y || 0));
    }

    /* 套筒充当「枪机」：射击时整体后退，是侧牙最可辨识的动作 */
    box(c, 0.032, 0.034, 0.200, 0.005, 0, 0.020, 0.030, GUN);
    box(c, 0.026, 0.010, 0.196, 0.003, 0, 0.040, 0.030, GUN);
    for (var s = 0; s < 6; s++) {
      box(c, 0.002, 0.024, 0.005, 0.0008, 0.0165, 0.020, -0.045 - s * 0.008, GUN);
      box(c, 0.002, 0.024, 0.005, 0.0008, -0.0165, 0.020, -0.045 - s * 0.008, GUN);
    }
    box(l, 0.0025, 0.016, 0.036, 0.001, 0.0170, 0.024, 0.020, [0.35, 0.35, 0.35], 9);
    box(c, 0.008, 0.010, 0.012, 0.002, 0, 0.038, 0.130, GUN);
    box(f, 0.004, 0.005, 0.005, 0.001, 0, 0.045, 0.130, SIGHT, 0);
    box(c, 0.022, 0.008, 0.010, 0.002, 0, 0.041, -0.060, GUN);
    box(f, 0.004, 0.005, 0.004, 0.001, 0.008, 0.046, -0.060, SIGHT, 0);
    box(f, 0.004, 0.005, 0.004, 0.001, -0.008, 0.046, -0.060, SIGHT, 0);

    /* 枪管 */
    tube(a, 0.0095, 0.125, 0.215, GUN, 14, 0, 0.018);
    tube(a, 0.0110, 0.212, 0.228, GUN, 14, 0, 0.018);
    box(a, 0.020, 0.018, 0.030, 0.003, 0, 0.006, 0.150, GUN);
    box(a, 0.010, 0.014, 0.010, 0.002, 0, 0.026, -0.078, GUN);   // 击锤
    box(r, 0.004, 0.010, 0.028, 0.001, 0.017, 0.002, 0.020, ANO); // 套筒卡榫
    box(r, 0.010, 0.010, 0.014, 0.002, 0, 0.008, 0.176, ANO);    // 复进簧导杆

    /* 套筒座 / 护圈 */
    box(l, 0.028, 0.024, 0.150, 0.004, 0, -0.006, 0.020, POLY);
    box(l, 0.026, 0.014, 0.060, 0.003, 0, -0.016, -0.050, POLY);
    box(l, 0.006, 0.026, 0.006, 0.0015, 0, -0.040, 0.020, POLY);
    box(l, 0.006, 0.006, 0.052, 0.0015, 0, -0.052, 0.000, POLY);
    box(l, 0.030, 0.006, 0.090, 0.002, 0, -0.020, 0.060, POLY);

    /* 握把 */
    box(l, 0.030, 0.096, 0.048, 0.007, 0, -0.070, 0.068, POLY, 9, [-0.26, 0, 0]);
    for (var g = 0; g < 5; g++)
      box(l, 0.032, 0.0035, 0.004, 0.001, 0, -0.045 - g * 0.014, 0.080, POLY);

    /* 弹匣（u 组，藏在握把内） */
    box(u, 0.022, 0.092, 0.034, 0.003, 0, -0.078, 0.068, POLY, 9, [-0.26, 0, 0]);
    box(u, 0.026, 0.010, 0.040, 0.002, 0, -0.124, 0.080, POLY, 9, [-0.26, 0, 0]);
    box(u, 0.006, 0.060, 0.004, 0.001, 0.012, -0.085, 0.084, BRASS);

    /* 待发弹 */
    tube(h, 0.0055, -0.018, 0.018, BRASS, 8, 0, 0, 3);

    var ie = {
      ano: Ii(r), gun: Ii(a), poly: Ii(l), plain: Ii(f),
      bolt: Ii(c), mag: Ii(u), round: Ii(h),
    };
    for (var key in ie) ie[key].computeBoundingSphere();
    return ie;
  }

  /* --------------------------------------------------------------- 军械库 */
  async function inventory(i, defs) {
    var list = [];
    for (var d = 0; d < defs.length; d++) {
      var w = await dm(i, defs[d].cfg, defs[d].build || w_);
      w.short = defs[d].short || defs[d].cfg.short || "";
      w.slot = d;
      w.setVisible(false);
      list.push(w);
    }
    var cur = 0,
      switchT = 0,
      switchDur = 0.34;
    var active = function () { return list[cur]; };

    var inv = {
      isInventory: true,
      list: list,
      slots: [],
      activeIndex: 0,
      update: function (dt) {
        var inp = i.input;
        if (inp.pressed("slot1")) select(0);
        if (inp.pressed("slot2")) select(1);
        if (inp.pressed("slot3")) select(2);
        var w = active();
        if (switchT > 0) {
          switchT = Math.max(0, switchT - dt);
          var fire = inp.fire, ads = inp.ads;
          inp.fire = false;
          inp.ads = false;
          try { w.update(dt); } finally { inp.fire = fire; inp.ads = ads; }
          var k = switchT / switchDur;
          w.root.position.y -= k * 0.2;
          w.root.rotation.x += k * 0.42;
          w.root.rotation.z += k * 0.1;
        } else {
          w.update(dt);
        }
        for (var n = 0; n < list.length; n++) {
          var s = inv.slots[n];
          if (!s) s = inv.slots[n] = {};
          s.short = list[n].short;
          s.ammo = list[n].ammo;
          s.magSize = list[n].magSize;
          s.reserve = list[n].reserve;
          s.name = list[n].name;
        }
      },
      select: function (n) { return select(n); },
      cycle: function () { return select((cur + 1) % list.length); },
      reset: function () {
        for (var n = 0; n < list.length; n++) {
          list[n].reset();
          list[n].setVisible(false);
        }
        cur = 0;
        inv.activeIndex = 0;
        switchT = 0;
        list[0].setVisible(true);
        list[0].snap && list[0].snap();
      },
      setVisible: function (v) { active().setVisible(v); },
      setWetness: function (v) { for (var n = 0; n < list.length; n++) list[n].setWetness(v); },
      addAmmo: function (n) { active().addAmmo(n); },
      addAmmoAll: function (frac) {
        var any = false;
        for (var n = 0; n < list.length; n++) {
          var w2_ = list[n], add = Math.round(w2_.magSize * 2.4 * (frac || 0.5));
          if (add > 0) { w2_.addAmmo(add); any = true; }
        }
        return any;
      },
      addAmmoIndex: function (n, add) {
        if (list[n] && add > 0) { list[n].addAmmo(add); return true; }
        return false;
      },
      reloadNow: function () { return active().reloadNow(); },
      muzzleWorld: function (v) { return active().muzzleWorld(v); },
      snap: function () { active().snap && active().snap(); },
    };

    function select(n) {
      n = ((n % list.length) + list.length) % list.length;
      if (n === cur) return false;
      list[cur].setVisible(false);
      cur = n;
      inv.activeIndex = n;
      list[cur].setVisible(true);
      list[cur].snap && list[cur].snap();
      switchDur = (list[cur].cfg && list[cur].cfg.swapT) || 0.34;
      switchT = switchDur;
      try { i.events.emit("weapon:switch", { index: n, name: list[cur].name }); } catch (e) {}
      return true;
    }

    Object.defineProperties(inv, {
      name: { get: function () { return active().name; } },
      ammo: { get: function () { return active().ammo; }, set: function (v) { active().ammo = v; } },
      magSize: { get: function () { return active().magSize; } },
      reserve: { get: function () { return active().reserve; }, set: function (v) { active().reserve = v; } },
      state: { get: function () { return switchT > 0 ? "switching" : active().state; } },
      ads: { get: function () { return switchT > 0 ? 0 : active().ads; } },
      spread: { get: function () { return active().spread; } },
      adsFov: { get: function () { return active().adsFov || 0; } },
      scope: { get: function () { return !!active().scope; } },
      damage: { get: function () { return active().damage; } },
      rpm: { get: function () { return active().rpm; } },
      root: { get: function () { return active().root; } },
      debug: { get: function () { return active().debug; } },
      info: { get: function () { return active().info; } },
      short: { get: function () { return active().short; } },
    });

    list[0].setVisible(true);
    return inv;
  }


  /* ------------------- 六把武器数据表（与 packages/data/weapons/*.json 同源） ------------------- */
  // V42：数据来自 packages/data/weapons/*.json（构建时注入 __SX_WEAPON_DATA_SOURCE）
  var SX_WEAPON_DATA = window.__SX_WEAPON_DATA_SOURCE || {};
  // cfg 指向真实构建配置，保持运行时与 packages/data/weapons/*.json 同源
  SX_WEAPON_DATA.pac9.cfg = PAC9_CFG;
  SX_WEAPON_DATA.breaker12.cfg = SHOTGUN;
  SX_WEAPON_DATA.dmr.cfg = DMR;
  SX_WEAPON_DATA.smg.cfg = SMG_CFG;
  SX_WEAPON_DATA.lmg.cfg = LMG_CFG;
  SX_WEAPON_DATA.sidearm.cfg = SIDEARM_CFG;
  window.__SX_WEAPON_DATA = SX_WEAPON_DATA;
  window.__SX_WEAPON_EXT = {
    version: "v33-weapons",
    create: dm,
    defs: [
      { cfg: SMG_CFG, build: buildSMG, short: "短哨" },
      { cfg: LMG_CFG, build: buildLMG, short: "重锚" },
      { cfg: SIDEARM_CFG, build: buildSidearm, short: "侧牙" },
    ],
    data: SX_WEAPON_DATA,
  };

