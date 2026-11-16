/* SALTLINE · game part 2/6 — 渲染管线
   SALTLINE 天空/软阴影/后处理/HDR/自适应分辨率与 showcase 渲染。
   片段：由 tools/build.cjs 按 src/game/manifest.json 顺序拼接，不单独执行。 */
  }
  var H6 = `
// SALTLINE_SKY
precision highp float;
varying vec3 vDir;
uniform float uTime, uEnv, uFlash;
uniform vec3 uFlashDir;
${Ug}
${Ng}

void main(){
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.0);
  float mu = dot(d, uSunDir);
  float s = max(mu, 0.0);
  float ts = skyToSun(d);

  // ---- clear sky behind / below the deck ----
  vec3 hc = horizonColor(d);
  vec3 midC = mix(vec3(0.15, 0.24, 0.36), vec3(0.72, 0.50, 0.34), pow(ts, 3.0));   // pale band above the fire
  vec3 clearC = mix(hc, midC, smoothstep(0.0, 0.17, h));
  clearC = mix(clearC, vec3(0.085, 0.145, 0.24), smoothstep(0.10, 0.5, h));
  // aureole (mie glow round the sun)
  clearC += uSunCol * vec3(1.0, 0.86, 0.68) * (pow(s, 8.0) * 0.14 + pow(s, 64.0) * 0.55 + pow(s, 600.0) * 2.2 + pow(s, 6000.0) * 14.0);

  // ---- cloud deck ----
  vec2 cuv = d.xz / (h + 0.10) * vec2(0.62, 0.95);          // rolls of cloud run roughly east-west
  vec2 wind = vec2(-0.012, 0.004) * uTime;
  vec2 q = cuv + wind;
  float warp = fbm3(q * 0.45 + 7.1);
  vec2 qq = q + (warp - 0.5) * 1.3;
  float dens = fbm5(qq);
  // rippled underside (ridged detail), fading with distance so the horizon does not alias
  float ridg = 1.0 - abs(2.0 * fbm3(qq * 3.1 + 5.0) - 1.0);
  dens = dens * 0.86 + (ridg - 0.6) * 0.16 * smoothstep(0.03, 0.25, h);
  float big = n2(q * 0.19 + 3.7);
  float body = dens * 0.74 + big * 0.36;
  float cov = smoothstep(0.31, 0.50, body);
  // the deck ends above the eastern horizon: clear, burning gap toward the sun; almost down to the sea elsewhere
  float edge = mix(0.030, 0.285, pow(ts, 1.7));
  float rag = (n2(q * 0.9 + 11.0) - 0.5) * 0.16 + (dens - 0.5) * 0.10;
  float deck = smoothstep(edge - 0.035, edge + 0.11, h + rag * (0.35 + ts));
  cov *= deck;
  // the sun always burns through a ragged hole in the gap, never sits behind solid cloud
  float hole = smoothstep(0.972, 0.9985, mu + (dens - 0.5) * 0.012);
  cov *= 1.0 - 0.93 * hole;
  // thin scud drifting in the gap (veils the sun a little, catches fire)
  float scud = smoothstep(0.55, 0.85, fbm3(q * vec2(0.55, 1.9) + 31.0)) * (1.0 - deck) * smoothstep(0.02, 0.10, h) * 0.55 * (1.0 - 0.8 * hole);

  // lighting: density gradient toward the sun = self shadowing of the underside relief
  vec2 sd = normalize(uSunDir.xz);
  float densS = fbm5(qq + sd * 0.22);
  float relief = clamp((dens - densS) * 4.5 + 0.5, 0.0, 1.0);
  float thick = smoothstep(0.40, 0.72, body);
  vec3 cool = mix(vec3(0.155, 0.195, 0.255), vec3(0.030, 0.042, 0.064), thick);       // slate, darker where the deck is thick
  cool *= 0.55 + 0.9 * relief * relief;
  cool += vec3(0.07, 0.10, 0.15) * pow(1.0 - thick, 3.0);                             // thin spots let cold light through
  // warm light raking the underside from the gap: strongest near the sun and near the deck edge
  float nearSun = pow(ts, 5.0) * exp(-max(h - edge, 0.0) * 4.5) * 0.9 + pow(s, 7.0) * 0.9;
  vec3 warm = (uHor * vec3(1.30, 0.66, 0.40)) * nearSun * (0.05 + 2.2 * relief * relief * relief) * 1.15;
  // burning rim where cloud thins at the edge of the gap
  float rim = cov * (1.0 - cov) * 4.0;
  warm += uSunCol * rim * pow(ts, 4.0) * (0.5 + 1.6 * pow(s, 6.0)) * (1.0 - 0.85 * hole);
  vec3 cloudC = cool + warm;
  // sheet lightning inside the deck
  float fl = uFlash * pow(max(dot(d, uFlashDir), 0.0), 5.0);
  cloudC += vec3(0.55, 0.68, 1.0) * fl * (0.4 + 2.2 * dens * dens);
  // aerial perspective: far cloud melts into the horizon colour
  cloudC = mix(cloudC, hc * 0.55 + cloudC * 0.45, exp(-h * 11.0));

  vec3 col = mix(clearC, cloudC, cov * 0.985);
  vec3 scudC = mix(vec3(0.10, 0.11, 0.14), uHor * 1.5, pow(ts, 3.0)) + uSunCol * pow(s, 24.0) * 2.0;
  col = mix(col, scudC, scud);

  // sun disk (not in the environment capture: the directional light is the sun there)
  float veil = (1.0 - cov * 0.92) * (1.0 - scud * 0.7);
  float disk = smoothstep(0.999905, 0.999955, mu);
  col += vec3(1.0, 0.80, 0.52) * disk * 110.0 * veil * (1.0 - uEnv);

  // below the horizon: sea haze / ground bounce (mostly hidden by geometry)
  if (d.y < 0.0) {
    float t = clamp(-d.y * 5.0, 0.0, 1.0);
    vec3 low = mix(uHorAway * 0.42, vec3(0.060, 0.064, 0.070), uEnv);
    low += uHor * 0.55 * pow(ts, 6.0) * exp(d.y * 7.0);
    col = mix(hc + uSunCol * pow(s, 48.0) * 1.5, low, smoothstep(0.0, 1.0, t));
  }
  // keep the PMREM free of fireflies
  col = mix(col, min(col, vec3(6.0)), uEnv);
  gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
}`,
    V6 = `
varying vec3 vDir;
void main(){ vDir = position; vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0); gl_Position = p.xyww; }`;
  function W6(i) {
    return {
      tNoise: { value: i },
      uTime: { value: 0 },
      uEnv: { value: 0 },
      uFlash: { value: 0 },
      uFlashDir: { value: new W(-0.5, 0.5, -0.7).normalize() },
      uSunDir: { value: Mn.dir.clone() },
      uZen: { value: en.zenith.clone() },
      uHor: { value: en.horizon.clone() },
      uHorAway: { value: en.horizonAway.clone() },
      uSunCol: { value: Mn.color.clone() },
    };
  }
  function Hy(i) {
    let e = new zn({
        name: "saltline-sky",
        side: Ki,
        depthWrite: !1,
        depthTest: !0,
        fog: !1,
        toneMapped: !1,
        uniforms: W6(i),
        vertexShader: V6,
        fragmentShader: H6,
      }),
      t = new un(2, 2, 2),
      n = new Qe(t, e);
    return (
      (n.name = "sky"),
      (n.frustumCulled = !1),
      (n.renderOrder = -1e3),
      (n.castShadow = !1),
      (n.receiveShadow = !1),
      (n.matrixAutoUpdate = !1),
      { mesh: n, material: e, geometry: t }
    );
  }
  function Vy(i, e) {
    let t = new ia(i),
      n = e.material.clone();
    (n.uniforms.tNoise.value = e.material.uniforms.tNoise.value),
      (n.uniforms.uEnv.value = 1);
    let s = new ir(),
      o = new Qe(e.geometry, n);
    (o.frustumCulled = !1), s.add(o);
    let r = t.fromScene(s, 0, 0.1, 100);
    return n.dispose(), t.dispose(), r;
  }
  var Wy = "// SALTLINE_SHADOW",
    xf = null;
  function Gy(i, e, t, n, s) {
    let o = Mn.dir.clone().normalize(),
      r = e.clone().add(t).multiplyScalar(0.5);
    i.target.position.copy(r),
      i.position.copy(r).addScaledVector(o, 200),
      i.updateMatrixWorld(!0),
      i.target.updateMatrixWorld(!0);
    let a = new Ye().lookAt(i.position, r, new W(0, 1, 0));
    a.setPosition(i.position), a.invert();
    let l = new W(),
      c = 1 / 0,
      u = -1 / 0,
      h = 1 / 0,
      f = -1 / 0,
      p = 1 / 0,
      d = -1 / 0,
      v = (y, b, m) => {
        for (let A = 0; A < 8; A++)
          l
            .set(A & 1 ? b.x : y.x, A & 2 ? b.y : y.y, A & 4 ? b.z : y.z)
            .applyMatrix4(a),
            m(l);
      };
    v(e, t, (y) => {
      (c = Math.min(c, y.x)),
        (u = Math.max(u, y.x)),
        (h = Math.min(h, y.y)),
        (f = Math.max(f, y.y)),
        (p = Math.min(p, -y.z)),
        (d = Math.max(d, -y.z));
    }),
      v(n, s, (y) => {
        p = Math.min(p, -y.z);
      });
    let g = i.shadow.camera,
      x = 1;
    return (
      (g.left = c - x),
      (g.right = u + x),
      (g.bottom = h - x),
      (g.top = f + x),
      (g.near = Math.max(1, p - 4)),
      (g.far = d + 4),
      g.updateProjectionMatrix(),
      {
        width: g.right - g.left,
        height: g.top - g.bottom,
        depth: g.far - g.near,
      }
    );
  }
  function qy(i, { taps: e = 16, searchTaps: t = 8 } = {}) {
    let n = It.shadowmap_pars_fragment;
    xf === null && (xf = n);
    let s = xf,
      o = s.indexOf("float getShadow("),
      r = s.indexOf("vec2 cubeToUV"),
      a = s.lastIndexOf("// cubeToUV()", r);
    if ((a < o && (a = r), o < 0 || r < 0 || r < o))
      return (
        console.warn(
          "[render] soft shadows: unexpected Three shader chunk layout, keeping stock PCF",
        ),
        !1
      );
    let l = `
	${Wy}
	const vec2 SL_FRUSTUM = vec2( ${i.width.toFixed(3)}, ${i.height.toFixed(3)} );   // metres across the shadow map
	const float SL_DEPTH = ${i.depth.toFixed(3)};                                       // metres across the depth range
	float slIGN( vec2 p ) { return fract( 52.9829189 * fract( dot( p, vec2( 0.06711056, 0.00583715 ) ) ) ); }
	vec2 slVogel( int i, int n, float phi ) {
		float r = sqrt( ( float( i ) + 0.5 ) / float( n ) );
		float th = float( i ) * 2.39996323 + phi;
		return r * vec2( cos( th ), sin( th ) );
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		shadowCoord.xyz /= shadowCoord.w;
		vec3 sc = shadowCoord.xyz;
		vec3 dx = dFdx( sc ), dy = dFdy( sc );
		bool inFrustum = sc.x >= 0.0 && sc.x <= 1.0 && sc.y >= 0.0 && sc.y <= 1.0;
		if ( ! ( inFrustum && sc.z <= 1.0 ) ) return 1.0;
		// receiver plane depth bias: depth gradient of the receiver in shadow-map uv space
		float det = dx.x * dy.y - dx.y * dy.x;
		vec2 dz = vec2( 0.0 );
		if ( abs( det ) > 1e-12 ) dz = vec2( dy.y * dx.z - dx.y * dy.z, dx.x * dy.z - dy.x * dx.z ) / det;
		vec2 texel = 1.0 / shadowMapSize;
		float maxSlope = 0.0030 / max( texel.x, texel.y );      // never bias more than ~0.6 m per kernel
		dz = clamp( dz, vec2( - maxSlope ), vec2( maxSlope ) );
		float zr = sc.z + shadowBias - ( abs( dz.x ) * texel.x + abs( dz.y ) * texel.y ) * 0.35;
		float phi = slIGN( gl_FragCoord.xy ) * 6.2831853;
		// --- blocker search ---
		vec2 searchR = ( 0.55 * shadowRadius ) / SL_FRUSTUM;     // metres -> uv
		float blk = 0.0, nb = 0.0;
		for ( int i = 0; i < ${t}; i ++ ) {
			vec2 o = slVogel( i, ${t}, phi ) * searchR;
			float d = unpackRGBAToDepth( texture2D( shadowMap, sc.xy + o ) );
			float z = zr + dot( o, dz );
			if ( d < z ) { blk += d; nb += 1.0; }
		}
		if ( nb < 0.5 ) return 1.0;
		float avg = blk / nb;
		// --- penumbra: grows with blocker distance (sun half-angle scaled up for look) ---
		float distM = max( zr - avg, 0.0 ) * SL_DEPTH;
		float penM = clamp( distM * 0.022 * shadowRadius, 0.012 * shadowRadius, 0.60 * shadowRadius );
		vec2 filtR = max( vec2( penM ) / SL_FRUSTUM, texel * 1.25 );
		float lit = 0.0;
		for ( int i = 0; i < ${e}; i ++ ) {
			vec2 o = slVogel( i, ${e}, phi + 1.7 ) * filtR;
			float d = unpackRGBAToDepth( texture2D( shadowMap, sc.xy + o ) );
			lit += step( zr + dot( o, dz ), d );
		}
		lit /= float( ${e} );
		// fade to lit at the very edge of the map so the frustum border never shows
		vec2 e = min( sc.xy, 1.0 - sc.xy );
		lit = mix( 1.0, lit, smoothstep( 0.0, 0.02, min( e.x, e.y ) ) );
		return mix( 1.0, lit, shadowIntensity );
	}

	`;
    return (It.shadowmap_pars_fragment = s.slice(0, o) + l + s.slice(a)), !0;
  }
  function Xy() {
    xf !== null && (It.shadowmap_pars_fragment = xf);
  }
  var Yy = Wy;
  var Bg = "// SALTLINE_POST",
    n1 = "0.05",
    Zy = "0.05",
    G6 =
      "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    Js = `
varying vec2 vUv;
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
`,
    Og = `
uniform sampler2D tAdapt; uniform float uExposure, uKey, uMinE, uMaxE, uAuto;
float slExposure(){ float a = texture2D(tAdapt, vec2(0.5)).r; return uExposure * mix(1.0, clamp(pow(uKey / max(a, 1e-4), 0.85), uMinE, uMaxE), uAuto); }
`,
    q6 = `${Js}
uniform sampler2D tDepth;
void main(){ gl_FragDepth = texture2D(tDepth, vUv).r; gl_FragColor = vec4(0.0); }`,
    X6 = `${Js}
uniform sampler2D tDepth; uniform float uNear, uFar;
void main(){
  // exact texel fetch: sampling at a texel corner would pick rows unpredictably and band the AO on grazing floors
  ivec2 p = min(ivec2(gl_FragCoord.xy) * 2, textureSize(tDepth, 0) - 1);
  float d = texelFetch(tDepth, p, 0).r;
  float z = d < ${n1} ? 0.01 : (uNear * uFar) / (uFar - d * (uFar - uNear));
  gl_FragColor = vec4(z, 0.0, 0.0, 1.0);
}`,
    Y6 = `${Js}
uniform sampler2D tDepthHalf; uniform vec2 uTanHalf, uTexel; uniform float uRadius, uIntensity, uAspect;
vec3 vpos(vec2 uv, float z){ return vec3((uv * 2.0 - 1.0) * uTanHalf * z, -z); }
void main(){
  float z0 = texture2D(tDepthHalf, vUv).r;
  if (z0 < ${Zy} || z0 > 140.0) { gl_FragColor = vec4(1.0); return; }
  vec3 P = vpos(vUv, z0);
  vec2 ox = vec2(uTexel.x, 0.0), oy = vec2(0.0, uTexel.y);
  float zl = texture2D(tDepthHalf, vUv - ox).r, zr = texture2D(tDepthHalf, vUv + ox).r;
  float zd = texture2D(tDepthHalf, vUv - oy).r, zu = texture2D(tDepthHalf, vUv + oy).r;
  vec3 dx = abs(zl - z0) < abs(zr - z0) ? P - vpos(vUv - ox, zl) : vpos(vUv + ox, zr) - P;
  vec3 dy = abs(zd - z0) < abs(zu - z0) ? P - vpos(vUv - oy, zd) : vpos(vUv + oy, zu) - P;
  vec3 n = normalize(cross(dx, dy));
  float R = uRadius * (0.6 + 0.4 * clamp(z0 / 12.0, 0.0, 1.0));
  float rUv = clamp(R / (2.0 * z0 * uTanHalf.y), 3.0 * uTexel.y, 0.14);
  float R2 = R * R;
  float rot = ign(gl_FragCoord.xy) * 6.2831853;
  float sum = 0.0;
  for (int i = 0; i < AO_TAPS; i++) {
    float a = (float(i) + 0.5) / float(AO_TAPS);
    float th = a * 6.2831853 * 3.0 + rot;
    vec2 o = vec2(cos(th), sin(th)) * a * rUv; o.x /= uAspect;
    vec2 uv2 = vUv + o;
    float z2 = texture2D(tDepthHalf, uv2).r;
    vec3 v = vpos(uv2, z2) - P;
    float vv = dot(v, v), vn = dot(v, n);
    float f = max(R2 - vv, 0.0);
    sum += f * f * f * max((vn - (0.015 + 0.004 * z0)) / (vv + 0.004), 0.0);
  }
  float ao = max(0.0, 1.0 - uIntensity * sum * 5.0 / (R2 * R2 * R2 * float(AO_TAPS)));
  ao = mix(ao, 1.0, smoothstep(70.0, 140.0, z0));
  gl_FragColor = vec4(ao, ao, ao, 1.0);
}`,
    $6 = `${Js}
uniform sampler2D tDepthHalf, tShadow;
uniform mat4 uShadowMatrix, uCamWorld;
uniform vec3 uCamPos, uSunRad, uAmb;
uniform vec2 uTanHalf;
uniform float uHasShadow, uMaxDist, uSigma, uFarZ, uFarHaze, uFlicker, uBoxDust;
uniform vec3 uBoxMin, uBoxMax;
${Ng}
float shape(float h){ return 0.30 + 0.70 * exp(-max(h, 0.0) / 5.5); }
float hg(float mu, float g){ float g2 = g * g; return (1.0 - g2) / (12.566371 * pow(max(1.0 + g2 - 2.0 * g * mu, 1e-4), 1.5)); }
float sunVis(vec3 p){
  vec4 sc = uShadowMatrix * vec4(p, 1.0);
  if (sc.x < 0.0 || sc.x > 1.0 || sc.y < 0.0 || sc.y > 1.0 || sc.z > 1.0 || sc.z < 0.0) return 1.0;
  float d = dot(texture2D(tShadow, sc.xy), vec4(0.99609375, 0.99609375 / 256.0, 0.99609375 / 65536.0, 1.0 / 16777216.0));
  return step(sc.z - 0.0006, d);
}
void main(){
  float z = texture2D(tDepthHalf, vUv).r;
  if (z < ${Zy}) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec3 vd = vec3((vUv * 2.0 - 1.0) * uTanHalf, -1.0);
  float rl = length(vd);
  vec3 rd = normalize(mat3(uCamWorld) * vd);
  float dist = z * rl;
  bool isSky = z > uFarZ * 0.97;
  float maxD = min(dist, isSky ? uMaxDist * 0.55 : uMaxDist);
  float mu = dot(rd, uSunDir);
  // two-lobe phase: tight forward lobe for the gold glow toward the sun + a broad lobe so side-lit shafts stay visible
  float ph = min(hg(mu, 0.78) * 0.55 + hg(mu, 0.25) * 0.45, 1.15);
  float j = ign(gl_FragCoord.xy);
  vec3 acc = vec3(0.0); float T = 1.0; float tPrev = 0.0;
  for (int i = 0; i < VOL_STEPS; i++) {
    float f = (float(i) + 1.0) / float(VOL_STEPS);
    float t1 = maxD * f * (0.35 + 0.65 * f);              // denser sampling near the eye
    float ds = t1 - tPrev;
    vec3 p = uCamPos + rd * (tPrev + ds * j);
    float sh = uHasShadow > 0.5 ? sunVis(p) : 1.0;
    // dusty interior (the shed): thicker air so sun shafts through doors, louvres and roof holes read; less sky ambient
    vec3 bq = step(uBoxMin, p) * step(p, uBoxMax); float inb = bq.x * bq.y * bq.z;
    float ext = uSigma * shape(p.y) * (1.0 + uBoxDust * inb);
    float Ti = exp(-ext * ds);
    // art direction: beams near the eye read strongly (shafts between stacks), the far field stays a restrained veil
    float nearW = mix(2.3, 0.55, smoothstep(4.0, 85.0, tPrev + ds * j));
    vec3 src = uSunRad * (ph * sh * mix(nearW, 1.6, inb)) + uAmb * (0.40 + 0.60 * sh) * mix(1.0, 0.22, inb);
    acc += T * src * (1.0 - Ti);
    T *= Ti; tPrev = t1;
  }
  // analytic continuation for far geometry (ship, cranes, skyline): fades into the horizon colour of that direction
  if (!isSky && dist > uMaxDist) {
    float h1 = uCamPos.y + rd.y * uMaxDist, h2 = uCamPos.y + rd.y * dist;
    float tau = uSigma * uFarHaze * (dist - uMaxDist) * 0.5 * (shape(h1) + shape(h2));
    float Tf = exp(-tau);
    vec3 hc = horizonColor(rd) * 0.50 + uAmb * 0.6;
    acc += T * hc * (1.0 - Tf);
    T *= Tf;
  }
  gl_FragColor = vec4(acc, T);
}`,
    $y = `${Js}
uniform sampler2D tSrc, tDepthHalf; uniform vec2 uDir;
void main(){
  float z0 = texture2D(tDepthHalf, vUv).r;
  float zc = min(z0, 300.0);
  vec4 acc = vec4(0.0); float ws = 0.0;
  for (int i = -3; i <= 3; i++) {
    vec2 uv = vUv + uDir * float(i);
    float z = min(texture2D(tDepthHalf, uv).r, 300.0);
    float w = (1.0 - abs(float(i)) * 0.22) * max(0.0, 1.0 - abs(z - zc) / (BLUR_TOL * zc + 0.02));
    acc += texture2D(tSrc, uv) * w; ws += w;
  }
  gl_FragColor = ws > 1e-4 ? acc / ws : texture2D(tSrc, vUv);
}`,
    Z6 = `${Js}
uniform sampler2D tColor, tDepth, tDepthHalf, tAO, tVol;
uniform vec2 uHalfRes; uniform float uNear, uFar, uAoOn, uVolOn, uAoStrength;
${Og}
void main(){
  vec3 col = max(texture2D(tColor, vUv).rgb, vec3(0.0));
  float d = texture2D(tDepth, vUv).r;
  if (d >= ${n1}) {
    float z = (uNear * uFar) / (uFar - d * (uFar - uNear));
    // joint bilateral upsample of the half-res buffers
    vec2 hp = vUv * uHalfRes - 0.5; vec2 f = fract(hp); vec2 base = (floor(hp) + 0.5) / uHalfRes; vec2 tx = 1.0 / uHalfRes;
    float ao = 0.0; vec4 vol = vec4(0.0); float ws = 0.0;
    float zc = min(z, 300.0);
    for (int k = 0; k < 4; k++) {
      vec2 o = vec2(float(k & 1), float(k >> 1));
      vec2 uv = base + o * tx;
      float zh = min(texture2D(tDepthHalf, uv).r, 300.0);
      float w = (o.x > 0.5 ? f.x : 1.0 - f.x) * (o.y > 0.5 ? f.y : 1.0 - f.y);
      w *= 1.0 / (0.015 + abs(zh - zc) / zc) ;
      w = max(w, 1e-5);
      ao += texture2D(tAO, uv).r * w; vol += texture2D(tVol, uv) * w; ws += w;
    }
    ao /= ws; vol /= ws;
    if (uAoOn > 0.5 && d < 0.99999) {
      // occlusion belongs to ambient light: fade it out on brightly lit pixels so sunlit surfaces never get dirty halos
      float lit = smoothstep(0.16, 0.85, luma(col) * slExposure());
      float a = mix(1.0, ao, uAoStrength * (1.0 - 0.8 * lit));
      col *= mix(vec3(a), vec3(1.0), vec3(0.0, 0.03, 0.07));      // faintly cool occlusion
    }
    if (uVolOn > 0.5) col = col * vol.a + vol.rgb;
  }
  gl_FragColor = vec4(col, 1.0);
}`,
    j6 = `${Js}
uniform sampler2D tColor, tDepth; uniform mat4 uInvViewProj, uPrevViewProj; uniform float uShutter; uniform vec2 uRes;
void main(){
  vec4 c0 = texture2D(tColor, vUv);
  float d = texture2D(tDepth, vUv).r;
  if (d < ${n1}) { gl_FragColor = c0; return; }
  vec4 wp = uInvViewProj * vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); wp /= wp.w;
  vec4 pc = uPrevViewProj * wp;
  vec2 puv = pc.xy / max(pc.w, 1e-4) * 0.5 + 0.5;
  vec2 vel = (vUv - puv) * uShutter;
  float len = length(vel);
  if (pc.w <= 0.0 || len * uRes.y < 0.75) { gl_FragColor = c0; return; }
  vel *= min(1.0, 0.018 / len);
  float j = ign(gl_FragCoord.xy) - 0.5;
  vec3 acc = c0.rgb; float ws = 1.0;
  for (int i = 0; i < 9; i++) {
    vec2 uv = vUv + vel * ((float(i) + 0.5 + j) / 9.0 - 0.5);
    float w = texture2D(tDepth, uv).r < ${n1} ? 0.0 : 1.0;
    acc += texture2D(tColor, uv).rgb * w; ws += w;
  }
  gl_FragColor = vec4(acc / ws, 1.0);
}`,
    J6 = `${Js}
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uFirst;
vec3 s(vec2 o){ return min(max(texture2D(tSrc, vUv + o * uTexel).rgb, vec3(0.0)), vec3(400.0)); }
float kw(vec3 c){ return 1.0 / (1.0 + luma(c) * 0.08); }
void main(){
  vec3 a = s(vec2(-2.0, 2.0)), b = s(vec2(0.0, 2.0)), c = s(vec2(2.0, 2.0));
  vec3 d = s(vec2(-2.0, 0.0)), e = s(vec2(0.0, 0.0)), f = s(vec2(2.0, 0.0));
  vec3 g = s(vec2(-2.0, -2.0)), h = s(vec2(0.0, -2.0)), i = s(vec2(2.0, -2.0));
  vec3 j = s(vec2(-1.0, 1.0)), k = s(vec2(1.0, 1.0)), l = s(vec2(-1.0, -1.0)), m = s(vec2(1.0, -1.0));
  vec3 col;
  if (uFirst > 0.5) {
    // partial Karis average on the first downsample: tames fireflies without killing the sun
    vec3 g0 = (a + b + d + e) * 0.25, g1 = (b + c + e + f) * 0.25, g2 = (d + e + g + h) * 0.25, g3 = (e + f + h + i) * 0.25, g4 = (j + k + l + m) * 0.25;
    float w0 = kw(g0) * 0.125, w1 = kw(g1) * 0.125, w2 = kw(g2) * 0.125, w3 = kw(g3) * 0.125, w4 = kw(g4) * 0.5;
    col = (g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) / (w0 + w1 + w2 + w3 + w4);
  } else {
    col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  }
  gl_FragColor = vec4(col, 1.0);
}`,
    K6 = `${Js}
uniform sampler2D tLow, tHigh; uniform vec2 uTexel; uniform float uMix;
void main(){
  vec2 o = uTexel;
  vec3 t = texture2D(tLow, vUv).rgb * 4.0;
  t += (texture2D(tLow, vUv + vec2(o.x, 0.0)).rgb + texture2D(tLow, vUv - vec2(o.x, 0.0)).rgb + texture2D(tLow, vUv + vec2(0.0, o.y)).rgb + texture2D(tLow, vUv - vec2(0.0, o.y)).rgb) * 2.0;
  t += texture2D(tLow, vUv + o).rgb + texture2D(tLow, vUv - o).rgb + texture2D(tLow, vUv + vec2(o.x, -o.y)).rgb + texture2D(tLow, vUv + vec2(-o.x, o.y)).rgb;
  t *= 1.0 / 16.0;
  gl_FragColor = vec4(mix(texture2D(tHigh, vUv).rgb, t, uMix), 1.0);
}`,
    Q6 = `${Js}
uniform sampler2D tSrc; uniform vec2 uDir; uniform float uThreshold;
${Og}
void main(){
  float thr = uThreshold / max(slExposure(), 0.2);
  vec3 acc = vec3(0.0); float ws = 0.0;
  for (int i = -7; i <= 7; i++) {
    float x = float(i); float w = exp(-x * x / 18.0);
    vec3 c = texture2D(tSrc, vUv + uDir * x).rgb;
    c = max(c - vec3(thr), vec3(0.0));
    acc += c * w; ws += w;
  }
  gl_FragColor = vec4(acc / ws, 1.0);
}`,
    eA = `${Js}
uniform sampler2D tPrev, tLum, tDepth; uniform vec2 uSunUv; uniform float uSunOn, uRate, uVisRate, uAspect;
void main(){
  float ls = 0.0, ws = 0.0;
  for (int y = 0; y < 5; y++) for (int x = 0; x < 7; x++) {
    vec2 uv = (vec2(float(x), float(y)) + 0.5) / vec2(7.0, 5.0);
    vec2 c = uv - 0.5;
    float w = 1.0 - 0.75 * smoothstep(0.1, 0.55, length(c));       // centre-weighted metering
    float l = luma(texture2D(tLum, uv).rgb);
    ls += log(max(l, 1e-4)) * w; ws += w;
  }
  float avg = clamp(exp(ls / ws), 0.002, 40.0);
  float vis = 0.0;
  for (int i = 0; i < 12; i++) {
    float r = sqrt((float(i) + 0.5) / 12.0) * 0.011; float th = float(i) * 2.39996323;
    vec2 uv = uSunUv + vec2(cos(th) / uAspect, sin(th)) * r;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) vis += 1.0;
    else vis += step(0.99999, texture2D(tDepth, uv).r);
  }
  vis = vis / 12.0 * uSunOn;
  vec4 prev = texture2D(tPrev, vec2(0.5));
  float a = mix(prev.r, avg, uRate);
  if (!(a > 0.0) || a > 1e4) a = avg;                                 // NaN / first-frame guard
  float v = mix(prev.g, vis, uVisRate);
  if (!(v >= 0.0)) v = vis;
  gl_FragColor = vec4(a, v, 0.0, 1.0);
}`,
    tA = `${Js}
${Ug}
uniform float uAspect;
void main(){
  vec2 p = vUv * vec2(uAspect, 1.0);
  float acc = 0.0;
  for (int i = 0; i < 70; i++) {
    float fi = float(i);
    vec2 c = vec2(hash12(vec2(fi, 1.7)), hash12(vec2(fi, 9.2))) * vec2(uAspect, 1.0);
    float sz = mix(0.012, 0.085, pow(hash12(vec2(fi, 4.4)), 3.0));
    float r = length(p - c) / sz;
    float disc = smoothstep(1.0, 0.86, r) * (0.35 + 0.65 * smoothstep(0.35, 0.98, r));
    acc += disc * mix(0.15, 0.7, hash12(vec2(fi, 6.1)));
  }
  float smudge = fbm5(vUv * vec2(5.0, 9.0) + 3.0) * fbm3(vUv * 2.3 + 9.0);
  float streaks = pow(n2(vec2(vUv.x * 90.0, vUv.y * 2.0)), 4.0) * 0.25;
  float v = acc * 0.55 + smudge * 0.9 + streaks;
  v *= 0.45 + 0.9 * smoothstep(0.15, 0.75, length(vUv - 0.5));
  gl_FragColor = vec4(vec3(v) * vec3(1.0, 0.96, 0.9), 1.0);
}`,
    nA = `${Js}
uniform sampler2D tScene, tBloom, tBlur, tStreak, tDirt;
${Og}
uniform vec3 uSunCol;
uniform vec2 uSunUv;
uniform float uTime, uAspect, uBloom, uDirt, uStreak, uFlare, uCA, uVignette;
uniform float uDamage, uLowHealth, uAds, uFlash, uFade, uSaturation, uSunOn, uThunder, uAgxMix;

// ---- AgX (Filament/Blender fit, as in three.js) ----
const mat3 SL_REC2020_TO_SRGB = mat3(vec3(1.6605, -0.1246, -0.0182), vec3(-0.5876, 1.1329, -0.1006), vec3(-0.0728, -0.0083, 1.1187));
const mat3 SL_SRGB_TO_REC2020 = mat3(vec3(0.6274, 0.0691, 0.0164), vec3(0.3293, 0.9195, 0.0880), vec3(0.0433, 0.0113, 0.8956));
vec3 slAgxContrast(vec3 x){ vec3 x2 = x * x; vec3 x4 = x2 * x2; return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232; }
vec3 slAgx(vec3 color){
  const mat3 inset = mat3(vec3(0.856627153315983, 0.137318972929847, 0.11189821299995), vec3(0.0951212405381588, 0.761241990602591, 0.0767994186031903), vec3(0.0482516061458583, 0.101439036467562, 0.811302368396859));
  const mat3 outset = mat3(vec3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826), vec3(-0.11060664309660323, 1.157823702216272, -0.11060664309660294), vec3(-0.016493938717834573, -0.016493938717834257, 1.2519364065950405));
  const float minEv = -12.47393, maxEv = 4.026069;
  color = inset * (SL_SRGB_TO_REC2020 * color);
  color = clamp((log2(max(color, 1e-10)) - minEv) / (maxEv - minEv), 0.0, 1.0);
  color = slAgxContrast(color);
  // "punchy"-style look: a little more contrast and chroma than the base AgX rendering
  float l = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = pow(max(color, vec3(0.0)), vec3(LOOK_POWER));
  color = l + (color - l) * LOOK_SAT;
  color = outset * color;
  color = pow(max(color, vec3(0.0)), vec3(2.2));
  return clamp(SL_REC2020_TO_SRGB * color, 0.0, 1.0);
}
vec3 slRRTODT(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
vec3 slAces(vec3 c){
  const mat3 inM = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 outM = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  return clamp(outM * slRRTODT(inM * (c * 1.3)), 0.0, 1.0);
}
vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }

vec3 flare(vec2 uv, vec2 sun, float vis){
  vec2 asp = vec2(uAspect, 1.0);
  vec2 p = (uv - 0.5) * asp, s = (sun - 0.5) * asp;
  vec2 dv = p - s; float r = length(dv);
  vec3 c = vec3(0.0);
  // veiling glare + a few soft diffraction spikes
  float ang = atan(dv.y, dv.x);
  float spikes = pow(abs(cos(ang * 3.0 + 0.4)), 24.0) + 0.6 * pow(abs(cos(ang * 4.0 - 1.1)), 40.0);
  c += uSunCol * (0.020 / (r * r * 9.0 + 0.010) + 0.10 * exp(-r * 3.2));
  c += uSunCol * spikes * 0.30 * exp(-r * 5.5);
  // ghosts along the sun -> centre axis
  vec3 g = vec3(0.0);
  float k0 = length(p + s * 0.38);  g += vec3(0.30, 0.75, 0.55) * smoothstep(0.085, 0.06, k0) * 0.050;
  float k1 = length(p + s * 0.82);  g += vec3(0.85, 0.45, 0.25) * smoothstep(0.045, 0.030, k1) * 0.075;
  float k2 = length(p + s * 1.35);  g += vec3(0.35, 0.50, 0.95) * smoothstep(0.17, 0.12, k2) * (0.4 + 0.6 * smoothstep(0.05, 0.16, k2)) * 0.040;
  float k3 = length(p - s * 0.45);  g += vec3(0.80, 0.70, 0.35) * smoothstep(0.030, 0.018, k3) * 0.060;
  // halo ring opposite the sun
  float hr = length(p + s * 0.15);
  g += vec3(0.45, 0.55, 0.85) * exp(-pow((hr - 0.52) * 16.0, 2.0)) * 0.035 * smoothstep(0.1, 0.5, length(s));
  c += g * uSunCol * 2.4;
  return c * vis;
}

void main(){
  vec2 c = vUv - 0.5;
  float r2 = dot(c * vec2(uAspect, 1.0), c * vec2(uAspect, 1.0)) / (0.25 * (uAspect * uAspect + 1.0));   // 0 centre .. 1 corner
  vec4 ad = texture2D(tAdapt, vec2(0.5));
  // radial chromatic aberration (tiny; grows a little when hurt)
  vec2 off = c * r2 * (uCA + uDamage * 0.006);
  vec3 col = vec3(texture2D(tScene, vUv + off).r, texture2D(tScene, vUv).g, texture2D(tScene, vUv - off).b);
  // ADS: soften the periphery
  vec3 soft = texture2D(tBlur, vUv).rgb;
  col = mix(col, soft, uAds * 0.75 * smoothstep(0.22, 0.85, r2));
  // bloom (energy conserving mix), lens dirt, anamorphic streak
  vec3 bloom = texture2D(tBloom, vUv).rgb;
  vec3 dirt = texture2D(tDirt, vUv).rgb;
  col = mix(col, bloom, uBloom);
  col += bloom * dirt * uDirt;
  col += texture2D(tStreak, vUv).rgb * vec3(0.45, 0.62, 1.0) * uStreak;
  // sun glare + flare (occlusion-tested)
  float vis = ad.g * uSunOn;
  if (vis > 0.002) { vec3 fl = flare(vUv, uSunUv, vis) * uFlare; col += fl * (1.0 + dirt * 1.5); }
  // exposure: manual * eye adaptation
  col *= slExposure();
  col += vec3(1.0, 0.97, 0.9) * uFlash * 2.5;
  // filmic curve: ACES (Hill fit) for punch and burning oranges, pulled toward AgX so highlights roll off to white
  col = mix(slAces(col), slAgx(col), uAgxMix);

  // ---- grade (display-linear) ----
  float l = luma(col);
  // split tone: teal shadows, warm highlights
  vec3 sh = vec3(0.80, 1.01, 1.13), hi = vec3(1.07, 1.0, 0.90);
  col *= mix(sh, hi, smoothstep(0.03, 0.55, l));
  // gentle S-curve
  col = mix(col, col * col * (3.0 - 2.0 * col), 0.22);
  // lifted, slightly teal blacks
  col = col * 0.988 + vec3(0.006, 0.0085, 0.011);
  // saturation (gameplay driven)
  float sat = uSaturation * (1.0 - 0.65 * uLowHealth) * (1.0 - 0.5 * uDamage);
  l = luma(col);
  col = mix(vec3(l), col, sat);
  // vignette: base + low health + ADS tightening
  float vig = uVignette + uLowHealth * 0.55 + uAds * 0.22;
  float vr = smoothstep(0.15 - uAds * 0.08, 1.05, r2);
  col *= 1.0 - vig * vr * vr * (3.0 - 2.0 * vr) ;
  // damage: red-edged pulse
  float edge = smoothstep(0.18, 1.0, r2);
  col = mix(col, vec3(0.55, 0.02, 0.01) * (0.35 + l), clamp(uDamage * edge * 0.85 + uLowHealth * edge * edge * 0.25 * (0.75 + 0.25 * sin(uTime * 5.0)), 0.0, 1.0));
  col *= 1.0 - uFade;
  col = toSRGB(clamp(col, 0.0, 1.0));
  gl_FragColor = vec4(col, dot(col, vec3(0.299, 0.587, 0.114)));
}`,
    iA = `${Js}
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uTime, uGrain, uSharpen, uFxaa;
void main(){
  vec4 M = texture2D(tSrc, vUv);
  vec3 col = M.rgb;
  vec4 NW = texture2D(tSrc, vUv + vec2(-1.0, -1.0) * uTexel), NE = texture2D(tSrc, vUv + vec2(1.0, -1.0) * uTexel);
  vec4 SW = texture2D(tSrc, vUv + vec2(-1.0, 1.0) * uTexel), SE = texture2D(tSrc, vUv + vec2(1.0, 1.0) * uTexel);
  float lMin = min(M.a, min(min(NW.a, NE.a), min(SW.a, SE.a)));
  float lMax = max(M.a, max(max(NW.a, NE.a), max(SW.a, SE.a)));
  float contrast = lMax - lMin;
  if (uFxaa > 0.5 && contrast > max(0.0312, lMax * 0.10)) {
    vec2 dir = vec2(-((NW.a + NE.a) - (SW.a + SE.a)), (NW.a + SW.a) - (NE.a + SE.a));
    float dirReduce = max((NW.a + NE.a + SW.a + SE.a) * 0.03125, 0.0078125);
    float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
    dir = clamp(dir * rcp, vec2(-8.0), vec2(8.0)) * uTexel;
    vec4 A = 0.5 * (texture2D(tSrc, vUv + dir * (1.0 / 3.0 - 0.5)) + texture2D(tSrc, vUv + dir * (2.0 / 3.0 - 0.5)));
    vec4 B = A * 0.5 + 0.25 * (texture2D(tSrc, vUv - dir * 0.5) + texture2D(tSrc, vUv + dir * 0.5));
    col = (B.a < lMin || B.a > lMax) ? A.rgb : B.rgb;
  }
  // light unsharp mask, backed off on strong edges (those belong to FXAA)
  vec3 blur = (NW.rgb + NE.rgb + SW.rgb + SE.rgb) * 0.25;
  col += (M.rgb - blur) * uSharpen * (1.0 - smoothstep(0.04, 0.22, contrast));
  // animated, luminance-weighted film grain
  vec2 seed = gl_FragCoord.xy + fract(uTime * vec2(7.31, 3.17)) * vec2(311.7, 173.3);
  float g = hash12(seed) + hash12(seed + 57.3) - 1.0;
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col += g * uGrain * mix(1.0, 0.30, smoothstep(0.25, 0.9, l)) * (0.35 + 0.65 * smoothstep(0.0, 0.08, l));
  // dither against banding in the sky gradients
  col += (hash12(gl_FragCoord.xy * 1.37 + 11.0) + hash12(gl_FragCoord.xy * 0.71 + 3.0) - 1.0) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`;
  function jy(i, e, { noiseTex: t }) {
    let n = new nt();
    n.setAttribute(
      "position",
      new et(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
    ),
      n.setAttribute("uv", new et(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    let s = new Qe(n, null);
    s.frustumCulled = !1;
    let o = new cr(-1, 1, 1, -1, 0, 1),
      r = [],
      a = (oe, fe, le, R = {}) => {
        let I = new zn({
          name: "post-" + oe,
          vertexShader: G6,
          fragmentShader: `${Bg} ${oe}
${fe}`,
          uniforms: le,
          depthTest: !1,
          depthWrite: !1,
          blending: ko,
          toneMapped: !1,
          ...R,
        });
        return r.push(I), I;
      };
    function l(oe, fe) {
      (s.material = oe), i.setRenderTarget(fe), i.render(s, o);
    }
    let c = js,
      u = yi,
      h = Zt,
      f = Gn,
      p = (oe = c, fe = h, le = {}) => {
        let R = new si(4, 4, {
          type: oe,
          format: _n,
          minFilter: fe,
          magFilter: fe,
          depthBuffer: !1,
          stencilBuffer: !1,
          generateMipmaps: !1,
          ...le,
        });
        return (R.texture.generateMipmaps = !1), R;
      },
      d = () => e.quality,
      v = () => ({
        uSunDir: { value: Mn.dir.clone() },
        uZen: { value: en.zenith.clone() },
        uHor: { value: en.horizon.clone() },
        uHorAway: { value: en.horizonAway.clone() },
        uSunCol: { value: Mn.color.clone() },
      }),
      g = {
        volSunScale: 0.85,
        volAmbient: 0.2,
        volSigma: 0.0034,
        volMaxDist: 170,
        volFarHaze: 0.42,
        volInteriorDust: 6,
        aoRadius: 0.9,
        aoIntensity: 1.6,
        aoStrength: 0.95,
        bloom: 0.065,
        bloomMix: 0.62,
        dirt: 0.1,
        streak: 0.03,
        streakThreshold: 2.2,
        flare: 0.16,
        key: 0.12,
        minExposure: 0.6,
        maxExposure: 2,
        adaptTau: 1.5,
        agxMix: 0.25,
        ca: 0.0013,
        vignette: 0.3,
        grain: 0.02,
        sharpen: 0.3,
        lookPower: 1.18,
        lookSat: 1.22,
      },
      x = !1;
    try {
      x = !!i.extensions.has("EXT_color_buffer_float");
    } catch {
      x = !1;
    }
    let y = {
        scene: p(c, h),
        motion: p(c, h),
        ldr: p(u, h),
        depthHalf: x ? p(as, f, { format: J0 }) : p(c, f),
        aoA: p(u, f),
        aoB: p(u, f),
        volA: p(c, f),
        volB: p(c, f),
        down: [],
        up: [],
        streakA: p(c, h),
        streakB: p(c, h),
        adapt: [p(c, f), p(c, f)],
        dirt: p(u, h),
        depthCopy: null,
      },
      b = 6;
    for (let oe = 0; oe < b; oe++) y.down.push(p(c, h));
    for (let oe = 0; oe < b - 1; oe++) y.up.push(p(c, h));
    y.adapt[0].setSize(1, 1),
      y.adapt[1].setSize(1, 1),
      y.dirt.setSize(512, 288);
    let m = 0,
      A = 0,
      _ = !1,
      M = { w: 4, h: 4, hw: 2, hh: 2 },
      E = {
        tAdapt: { value: null },
        uExposure: { value: 1 },
        uKey: { value: g.key },
        uMinE: { value: g.minExposure },
        uMaxE: { value: g.maxExposure },
        uAuto: { value: 1 },
      },
      w = a(
        "depthcopy",
        q6,
        { tDepth: { value: null } },
        { depthTest: !0, depthWrite: !0, depthFunc: q0, colorWrite: !1 },
      ),
      S = a("depthhalf", X6, {
        tDepth: { value: null },
        uNear: { value: 0.08 },
        uFar: { value: 900 },
      }),
      z = a(
        "ao",
        Y6,
        {
          tDepthHalf: { value: y.depthHalf.texture },
          uTanHalf: { value: new Ae() },
          uTexel: { value: new Ae() },
          uRadius: { value: g.aoRadius },
          uIntensity: { value: g.aoIntensity },
          uAspect: { value: 1 },
        },
        { defines: { AO_TAPS: 12 } },
      ),
      H = a(
        "vol",
        $6,
        {
          tDepthHalf: { value: y.depthHalf.texture },
          tShadow: { value: null },
          uShadowMatrix: { value: new Ye() },
          uCamWorld: { value: new Ye() },
          uCamPos: { value: new W() },
          uSunRad: { value: new W() },
          uAmb: { value: new W() },
          uTanHalf: { value: new Ae() },
          uHasShadow: { value: 0 },
          uMaxDist: { value: g.volMaxDist },
          uSigma: { value: g.volSigma },
          uFarZ: { value: 900 },
          uFarHaze: { value: g.volFarHaze },
          uFlicker: { value: 0 },
          uBoxDust: { value: 0 },
          uBoxMin: { value: new W(1e6, 1e6, 1e6) },
          uBoxMax: { value: new W(-1e6, -1e6, -1e6) },
          ...v(),
        },
        { defines: { VOL_STEPS: 16 } },
      ),
      O = a(
        "blur-ao",
        $y,
        {
          tSrc: { value: null },
          tDepthHalf: { value: y.depthHalf.texture },
          uDir: { value: new Ae() },
        },
        { defines: { BLUR_TOL: "0.04" } },
      ),
      q = a(
        "blur-vol",
        $y,
        {
          tSrc: { value: null },
          tDepthHalf: { value: y.depthHalf.texture },
          uDir: { value: new Ae() },
        },
        { defines: { BLUR_TOL: "0.30" } },
      ),
      U = a("composite", Z6, {
        tColor: { value: null },
        tDepth: { value: null },
        tDepthHalf: { value: y.depthHalf.texture },
        tAO: { value: y.aoA.texture },
        tVol: { value: y.volA.texture },
        uHalfRes: { value: new Ae() },
        uNear: { value: 0.08 },
        uFar: { value: 900 },
        uAoOn: { value: 1 },
        uVolOn: { value: 1 },
        uAoStrength: { value: g.aoStrength },
        ...E,
      }),
      T = a("motion", j6, {
        tColor: { value: y.scene.texture },
        tDepth: { value: null },
        uInvViewProj: { value: new Ye() },
        uPrevViewProj: { value: new Ye() },
        uShutter: { value: 0.5 },
        uRes: { value: new Ae() },
      }),
      D = a("down", J6, {
        tSrc: { value: null },
        uTexel: { value: new Ae() },
        uFirst: { value: 0 },
      }),
      C = a("up", K6, {
        tLow: { value: null },
        tHigh: { value: null },
        uTexel: { value: new Ae() },
        uMix: { value: g.bloomMix },
      }),
      G = a("streak", Q6, {
        tSrc: { value: null },
        uDir: { value: new Ae() },
        uThreshold: { value: 0 },
        ...E,
      }),
      j = a("adapt", eA, {
        tPrev: { value: null },
        tLum: { value: null },
        tDepth: { value: null },
        uSunUv: { value: new Ae(0.5, 0.5) },
        uSunOn: { value: 0 },
        uRate: { value: 1 },
        uVisRate: { value: 1 },
        uAspect: { value: 1 },
      }),
      N = a("dirt", tA, { tNoise: { value: t }, uAspect: { value: 16 / 9 } }),
      Q = a(
        "grade",
        nA,
        {
          tScene: { value: null },
          tBloom: { value: y.up[0].texture },
          tBlur: { value: y.down[1].texture },
          tStreak: { value: y.streakB.texture },
          tDirt: { value: y.dirt.texture },
          ...E,
          uSunCol: { value: Mn.color.clone() },
          uSunUv: { value: new Ae(0.5, 0.5) },
          uTime: { value: 0 },
          uAspect: { value: 1 },
          uBloom: { value: g.bloom },
          uDirt: { value: g.dirt },
          uStreak: { value: g.streak },
          uFlare: { value: g.flare },
          uCA: { value: g.ca },
          uVignette: { value: g.vignette },
          uDamage: { value: 0 },
          uLowHealth: { value: 0 },
          uAds: { value: 0 },
          uFlash: { value: 0 },
          uFade: { value: 0 },
          uSaturation: { value: 1 },
          uSunOn: { value: 0 },
          uThunder: { value: 0 },
          uAgxMix: { value: g.agxMix },
        },
        {
          defines: {
            LOOK_POWER: g.lookPower.toFixed(3),
            LOOK_SAT: g.lookSat.toFixed(3),
          },
        },
      ),
      K = a("final", iA, {
        tSrc: { value: y.ldr.texture },
        uTexel: { value: new Ae() },
        uTime: { value: 0 },
        uGrain: { value: g.grain },
        uSharpen: { value: g.sharpen },
        uFxaa: { value: 1 },
      }),
      ie = new Ye(),
      F = new Ye(),
      X = new Ye(),
      ne = new W(),
      re = new W(),
      $ = !1;
    function ue() {
      let oe = Math.max(6, d().volSteps | 0),
        fe =
          d().name === "test" || d().name === "low"
            ? 8
            : d().name === "ultra"
              ? 16
              : 12;
      H.defines.VOL_STEPS !== oe &&
        ((H.defines.VOL_STEPS = oe), (H.needsUpdate = !0)),
        z.defines.AO_TAPS !== fe &&
          ((z.defines.AO_TAPS = fe), (z.needsUpdate = !0));
    }
    function me(oe, fe) {
      if (
        ((oe = Math.max(8, oe | 0)),
        (fe = Math.max(8, fe | 0)),
        (M.w = oe),
        (M.h = fe),
        (M.hw = Math.max(4, Math.ceil(oe / 2))),
        (M.hh = Math.max(4, Math.ceil(fe / 2))),
        y.scene.setSize(oe, fe),
        y.motion.setSize(oe, fe),
        y.ldr.setSize(oe, fe),
        y.depthCopy)
      ) {
        y.depthCopy.setSize(oe, fe);
        let I = y.depthCopy.depthTexture.image;
        (I.width !== oe || I.height !== fe) &&
          ((I.width = oe),
          (I.height = fe),
          (y.depthCopy.depthTexture.needsUpdate = !0));
      }
      for (let I of [y.depthHalf, y.aoA, y.aoB, y.volA, y.volB])
        I.setSize(M.hw, M.hh);
      let le = M.hw,
        R = M.hh;
      for (let I = 0; I < b; I++)
        y.down[I].setSize(le, R),
          I < b - 1 && y.up[I].setSize(le, R),
          (le = Math.max(2, le >> 1)),
          (R = Math.max(2, R >> 1));
      y.streakA.setSize(y.down[2].width, y.down[2].height),
        y.streakB.setSize(y.down[2].width, y.down[2].height),
        ($ = !1),
        ue();
    }
    function ee() {
      if (!y.depthCopy) {
        let oe = new Tr(M.w, M.h);
        (oe.type = Zs),
          (oe.minFilter = oe.magFilter = f),
          (y.depthCopy = new si(M.w, M.h, {
            type: u,
            format: _n,
            minFilter: f,
            magFilter: f,
            depthBuffer: !0,
            stencilBuffer: !1,
            depthTexture: oe,
            generateMipmaps: !1,
          })),
          i.setRenderTarget(y.depthCopy),
          i.setClearColor(0, 1),
          i.clear(!0, !0, !1),
          i.setRenderTarget(null);
      }
      return y.depthCopy.depthTexture;
    }
    function B(oe) {
      y.depthCopy && ((w.uniforms.tDepth.value = oe), l(w, y.depthCopy));
    }
    function P({
      hdr: oe,
      camera: fe,
      sun: le,
      dt: R,
      post: I,
      exposure: se,
      time: ae,
      fast: k,
      thunder: ce,
    }) {
      let ve = d(),
        _e = fe.projectionMatrix.elements,
        Te = 1 / _e[0],
        Pe = 1 / _e[5],
        Re = Te / Pe,
        Fe = oe.depthTexture;
      (E.tAdapt.value = y.adapt[m].texture),
        (E.uExposure.value = se),
        (E.uAuto.value = J.autoExposure ? 1 : 0),
        (E.uKey.value = g.key),
        (E.uMinE.value = g.minExposure),
        (E.uMaxE.value = g.maxExposure),
        _ || ((N.uniforms.uAspect.value = 16 / 9), l(N, y.dirt), (_ = !0)),
        (S.uniforms.tDepth.value = Fe),
        (S.uniforms.uNear.value = fe.near),
        (S.uniforms.uFar.value = fe.far),
        l(S, y.depthHalf);
      let ze = 1 / M.hw,
        We = 1 / M.hh,
        Ne = !!ve.ao;
      Ne &&
        (z.uniforms.uTanHalf.value.set(Te, Pe),
        z.uniforms.uTexel.value.set(ze, We),
        (z.uniforms.uAspect.value = Re),
        l(z, y.aoA),
        (O.uniforms.tSrc.value = y.aoA.texture),
        O.uniforms.uDir.value.set(ze, 0),
        l(O, y.aoB),
        (O.uniforms.tSrc.value = y.aoB.texture),
        O.uniforms.uDir.value.set(0, We),
        l(O, y.aoA));
      let dt = (ve.volSteps | 0) > 0;
      if (dt) {
        let be = H.uniforms,
          Oe = e.level && e.level.interiorBoxes && e.level.interiorBoxes[0];
        Oe
          ? (be.uBoxMin.value.copy(Oe.min),
            be.uBoxMax.value.copy(Oe.max),
            (be.uBoxDust.value = g.volInteriorDust))
          : (be.uBoxDust.value = 0);
        let pt = le.shadow && le.shadow.map ? le.shadow.map.texture : null;
        (be.tShadow.value = pt),
          (be.uHasShadow.value = pt ? 1 : 0),
          pt && be.uShadowMatrix.value.copy(le.shadow.matrix),
          be.uCamWorld.value.copy(fe.matrixWorld),
          be.uCamPos.value.setFromMatrixPosition(fe.matrixWorld),
          be.uTanHalf.value.set(Te, Pe),
          (be.uFarZ.value = fe.far);
        let ut = le.intensity * g.volSunScale;
        be.uSunRad.value.set(le.color.r * ut, le.color.g * ut, le.color.b * ut);
        let nn = g.volAmbient * (1 + ce * 1.5);
        be.uAmb.value.set(en.fog.r * nn, en.fog.g * nn, en.fog.b * nn),
          l(H, y.volA),
          (q.uniforms.tSrc.value = y.volA.texture),
          q.uniforms.uDir.value.set(ze, 0),
          l(q, y.volB),
          (q.uniforms.tSrc.value = y.volB.texture),
          q.uniforms.uDir.value.set(0, We),
          l(q, y.volA);
      }
      {
        let be = U.uniforms;
        (be.tColor.value = oe.texture),
          (be.tDepth.value = Fe),
          be.uHalfRes.value.set(M.hw, M.hh),
          (be.uNear.value = fe.near),
          (be.uFar.value = fe.far),
          (be.uAoOn.value = Ne ? 1 : 0),
          (be.uVolOn.value = dt ? 1 : 0),
          l(U, y.scene);
      }
      let xe = y.scene.texture;
      if (
        (ie.multiplyMatrices(fe.projectionMatrix, fe.matrixWorldInverse),
        ve.motionBlur && $ && R > 0)
      ) {
        let be = T.uniforms;
        (be.tDepth.value = Fe),
          be.uInvViewProj.value.copy(X.copy(ie).invert()),
          be.uPrevViewProj.value.copy(F),
          (be.uShutter.value = Math.min(0.5, 1 / 190 / Math.max(R, 0.001))),
          be.uRes.value.set(M.w, M.h),
          l(T, y.motion),
          (xe = y.motion.texture);
      }
      if ((F.copy(ie), ($ = !0), ve.bloom)) {
        let be = xe,
          Oe = M.w,
          pt = M.h;
        for (let bt = 0; bt < b; bt++)
          (D.uniforms.tSrc.value = be),
            D.uniforms.uTexel.value.set(1 / Oe, 1 / pt),
            (D.uniforms.uFirst.value = bt === 0 ? 1 : 0),
            l(D, y.down[bt]),
            (be = y.down[bt].texture),
            (Oe = y.down[bt].width),
            (pt = y.down[bt].height);
        let ut = y.down[b - 1];
        for (let bt = b - 2; bt >= 0; bt--)
          (C.uniforms.tLow.value = ut.texture),
            (C.uniforms.tHigh.value = y.down[bt].texture),
            C.uniforms.uTexel.value.set(1 / ut.width, 1 / ut.height),
            l(C, y.up[bt]),
            (ut = y.up[bt]);
        let nn = 1 / y.streakA.width;
        (G.uniforms.tSrc.value = y.down[2].texture),
          G.uniforms.uDir.value.set(nn * 1.5, 0),
          (G.uniforms.uThreshold.value = g.streakThreshold),
          l(G, y.streakA),
          (G.uniforms.tSrc.value = y.streakA.texture),
          G.uniforms.uDir.value.set(nn * 5, 0),
          (G.uniforms.uThreshold.value = 0),
          l(G, y.streakB);
      }
      ne
        .copy(Mn.dir)
        .multiplyScalar(500)
        .add(re.setFromMatrixPosition(fe.matrixWorld))
        .project(fe),
        fe.getWorldDirection(re);
      let Ie = re.dot(Mn.dir) > 0.05,
        Be = Math.max(Math.abs(ne.x), Math.abs(ne.y)),
        Xe = Ie ? 1 - Math.min(1, Math.max(0, (Be - 1) / 0.3)) : 0,
        Me = ne.x * 0.5 + 0.5,
        we = ne.y * 0.5 + 0.5;
      {
        let be = j.uniforms,
          Oe = y.adapt[m],
          pt = y.adapt[1 - m];
        (be.tPrev.value = Oe.texture),
          (be.tLum.value = ve.bloom ? y.down[b - 1].texture : xe),
          (be.tDepth.value = Fe),
          be.uSunUv.value.set(Me, we),
          (be.uSunOn.value = Xe),
          (be.uAspect.value = Re);
        let ut = A < 2 || k;
        (be.uRate.value = ut
          ? A < 2
            ? 1
            : 0.6
          : 1 - Math.exp(-R / g.adaptTau)),
          (be.uVisRate.value = ut ? 1 : 1 - Math.exp(-R / 0.12)),
          l(j, pt),
          (m = 1 - m),
          A++;
      }
      {
        let be = Q.uniforms;
        (be.tScene.value = xe),
          (E.tAdapt.value = y.adapt[m].texture),
          be.uSunUv.value.set(Me, we),
          (be.uSunOn.value = Xe),
          (be.uAspect.value = Re),
          (be.uTime.value = ae),
          (be.uBloom.value = ve.bloom ? g.bloom : 0),
          (be.uDirt.value = ve.bloom ? g.dirt : 0),
          (be.uStreak.value = ve.bloom ? g.streak : 0),
          (be.uFlare.value = g.flare),
          (be.uAgxMix.value = g.agxMix),
          (be.uCA.value = g.ca),
          (be.uVignette.value = g.vignette),
          (be.uDamage.value = V(I.damage)),
          (be.uLowHealth.value = V(I.lowHealth)),
          (be.uAds.value = V(I.ads)),
          (be.uFlash.value = V(I.flash)),
          (be.uFade.value = V(I.fade)),
          (be.uSaturation.value = Number.isFinite(I.saturation)
            ? I.saturation
            : 1),
          l(Q, y.ldr);
      }
      {
        let be = K.uniforms;
        be.uTexel.value.set(1 / M.w, 1 / M.h),
          (be.uTime.value = ae),
          (be.uGrain.value = g.grain),
          (be.uSharpen.value = g.sharpen),
          l(K, null);
      }
    }
    let V = (oe) => (oe > 0 ? (oe < 1 ? oe : 1) : 0);
    function Y() {
      for (let fe of r) fe.dispose();
      let oe = [
        y.scene,
        y.motion,
        y.ldr,
        y.depthHalf,
        y.aoA,
        y.aoB,
        y.volA,
        y.volB,
        y.streakA,
        y.streakB,
        y.dirt,
        ...y.down,
        ...y.up,
        ...y.adapt,
      ];
      y.depthCopy && oe.push(y.depthCopy);
      for (let fe of oe) fe.dispose();
    }
    let L = new Uint16Array(4);
    function Z() {
      try {
        i.readRenderTargetPixels(y.adapt[m], 0, 0, 1, 1, L);
        let oe = P0.fromHalfFloat(L[0]),
          fe = Math.min(
            g.maxExposure,
            Math.max(g.minExposure, Math.pow(g.key / Math.max(oe, 1e-4), 0.85)),
          );
        return {
          lum: +oe.toFixed(4),
          auto: +fe.toFixed(3),
          sunVis: +P0.fromHalfFloat(L[1]).toFixed(2),
        };
      } catch {
        return null;
      }
    }
    let J = {
      readAdapt: Z,
      run: P,
      resize: me,
      copyDepth: B,
      ensureDepthCopy: ee,
      applyQuality: ue,
      dispose: Y,
      materials: r,
      rt: y,
      size: M,
      TUNE: g,
      autoExposure: !0,
      pass: l,
      quad: s,
      fsCam: o,
    };
    return J;
  }
  var Jy = 2,
    Ky = 1;
  async function Hg(i) {
    let e = i.params || {},
      t = document.getElementById("view"),
      n = new gf({
        canvas: t,
        antialias: !1,
        powerPreference: "high-performance",
        alpha: !1,
        depth: !0,
        stencil: !1,
      });
    (n.outputColorSpace = Vn),
      (n.toneMapping = ys),
      (n.toneMappingExposure = 1),
      (n.shadowMap.enabled = !0),
      (n.shadowMap.type = gc),
      (n.shadowMap.autoUpdate = !1),
      (n.autoClear = !1),
      (n.info.autoReset = !1),
      n.setClearColor(0, 1);
    let s = n.getContext(),
      o = { post: !1, shadow: !1, sky: !1, other: 0 };
    n.debug.onShaderError = (ie, F, X, ne) => {
      let re = "",
        $ = "";
      try {
        (re = ie.getShaderSource(ne) || ""),
          ($ =
            (ie.getShaderInfoLog(ne) || "") +
            " " +
            (ie.getShaderInfoLog(X) || "") +
            " " +
            (ie.getProgramInfoLog(F) || ""));
      } catch {}
      let ue = "material";
      re.includes(Bg)
        ? ((o.post = !0),
          (ue = "post pass " + (re.match(/SALTLINE_POST (\S+)/) || [])[1]))
        : re.includes("SALTLINE_SKY")
          ? ((o.sky = !0), (ue = "sky"))
          : re.includes(Yy)
            ? ((o.shadow = !0), (ue = "material (soft shadow chunk active)"))
            : o.other++,
        console.error(
          `[render] shader error in ${ue}: ${$.trim().slice(0, 700)}`,
        );
    };
    let r = new ir(),
      a = new Wn(Pi.fov, 16 / 9, 0.08, 900);
    a.layers.set(vf), (a.rotation.order = "YXZ"), r.add(a);
    let l = new Wn(Pi.viewFov, 16 / 9, 0.01, 10);
    l.layers.set(zc);
    let c = Oy(),
      u = Hy(c);
    r.add(u.mesh);
    let h = new W0(Mn.color, Mn.intensity);
    (h.name = "sun"), (h.castShadow = !0);
    let f = Gy(
        h,
        new W(-41, -0.2, -33),
        new W(37, 32, 31),
        new W(-41, -3, -64),
        new W(72, 36, 34),
      ),
      p = () =>
        Math.min(i.quality.shadow || 2048, n.capabilities.maxTextureSize);
    h.shadow.mapSize.set(p(), p()),
      (h.shadow.bias = -12e-5),
      (h.shadow.normalBias = 0.02),
      (h.shadow.radius = 1),
      (h.shadow.autoUpdate = !0),
      r.add(h, h.target);
    let d = !1;
    try {
      d = qy(f, { taps: i.quality.name === "low" ? 10 : 16, searchTaps: 8 });
    } catch (ie) {
      console.warn("[render] soft shadows unavailable: " + ie);
    }
    // V41：闪光池纳入固定灯池预算（默认 map 8 + flash 2 + fill 1）。
    // V42：数量从 src/config/balance.js 的 lights.flash 读取。
    let v =
        (window.SX_BALANCE &&
          window.SX_BALANCE.lights &&
          window.SX_BALANCE.lights.flash) ||
        2,
      g = [];
    for (let ie = 0; ie < v; ie++) {
      let F = new Qr(16777215, 0, 12, 2);
      (F.userData = { busy: !1, ttl: 0, dur: 0, peak: 0, persistent: !1 }),
        r.add(F),
        g.push(F);
    }
    let x = {
        flash(ie, F = 16763008, X = 30, ne = 10, re = 0.06) {
          let $ =
            g.find((ue) => !ue.userData.busy) ||
            g
              .filter((ue) => !ue.userData.persistent)
              .sort((ue, me) => ue.userData.ttl - me.userData.ttl)[0];
          $ &&
            ($.position.copy(ie),
            $.color.set(F),
            ($.distance = ne),
            ($.intensity = X),
            Object.assign($.userData, {
              busy: !0,
              ttl: re,
              dur: re,
              peak: X,
              persistent: !1,
            }));
        },
        acquire() {
          let ie = g.find((F) => !F.userData.busy);
          return ie
            ? ((ie.userData.busy = !0),
              (ie.userData.persistent = !0),
              (ie.intensity = 0),
              {
                light: ie,
                release() {
                  (ie.userData.busy = !1),
                    (ie.userData.persistent = !1),
                    (ie.intensity = 0);
                },
              })
            : null;
        },
        update(ie) {
          for (let F of g) {
            let X = F.userData;
            X.busy &&
              !X.persistent &&
              ((X.ttl -= ie),
              X.ttl <= 0
                ? ((X.busy = !1), (F.intensity = 0))
                : (F.intensity = X.peak * (X.ttl / X.dur)));
          }
        },
      },
      y = null;
    try {
      (y = Vy(n, u)),
        (r.environment = y.texture),
        (r.environmentIntensity = Jy);
    } catch (ie) {
      console.error(
        "[render] environment capture failed: " + ((ie && ie.stack) || ie),
      );
    }
    let b = new Tr(4, 4);
    (b.type = Zs), (b.minFilter = b.magFilter = Gn);
    let m = new si(4, 4, {
        type: js,
        format: _n,
        minFilter: Zt,
        magFilter: Zt,
        depthBuffer: !0,
        stencilBuffer: !1,
        depthTexture: b,
        samples: i.quality.msaa | 0,
        generateMipmaps: !1,
      }),
      A = null,
      _ = e.post !== "0";
    if (
      (e.ao === "0" && (i.quality.ao = !1),
      e.vol === "0" && (i.quality.volSteps = 0),
      e.bloom === "0" && (i.quality.bloom = !1),
      e.mb === "1" && (i.quality.motionBlur = !0),
      _)
    )
      try {
        A = jy(n, i, { noiseTex: c });
      } catch (ie) {
        (_ = !1),
          console.error(
            "[render] post chain failed to initialise, using forward fallback: " +
              ((ie && ie.stack) || ie),
          );
      }
    let M = !!(e.shot || e.show),
      E = !1,
      w = { t: 99, power: 0, value: 0 };
    i.events &&
      i.events.on &&
      i.events.on("thunder", (ie) => {
        (w.t = 0), (w.power = Math.min(1, (ie && ie.intensity) || 0.6));
        let F = Math.PI * (0.55 + Math.random() * 0.9);
        u.material.uniforms.uFlashDir.value
          .set(
            Math.cos(F),
            0.35 + Math.random() * 0.3,
            Math.sin(F) * (Math.random() < 0.5 ? -1 : 1),
          )
          .normalize();
      });
    let S = {
      scale: 1,
      enabled: !(e.shot || e.show || e.dynres === "0"),
      acc: 0,
      n: 0,
      settle: 3.5,
      upWait: 4,
      upDelay: 4,
    };
    function z(ie) {
      if (!S.enabled || !_ || ie > 1500) return;
      // V42：自适应阈值来自 src/config/balance.js 的 render.autoQuality
      let AQ =
        (window.SX_BALANCE &&
          window.SX_BALANCE.render &&
          window.SX_BALANCE.render.autoQuality) ||
        {};
      if (!S.min) S.min = AQ.scaleMin || 0.6;
      S.tierWait = Math.max(0, (S.tierWait || 0) - ie / 1e3);
      if (((S.settle -= ie / 1e3), (S.upWait -= ie / 1e3), S.settle > 0)) {
        (S.acc = 0), (S.n = 0);
        return;
      }
      if (((S.acc += ie), S.n++, S.n < 45 && S.acc < 900)) return;
      let F = S.acc / S.n;
      (S.acc = 0), (S.n = 0);
      let X = S.scale;
      // V41 P2-2：自动画质只降不升会永久停在 low。这里在“满分辨率且
      // 连续 3 个采样窗口都低于 12.5ms”时回升一档；降档后 20s 内不再回升。
      if (i.autoQuality && X >= 1 && F < (AQ.riseBelowMs || 12.5)) {
        S.lowSamples = (S.lowSamples || 0) + 1;
        let up = { low: "medium", medium: "high" }[i.quality.name];
        if (S.lowSamples >= (AQ.riseSamples || 3) && S.tierWait <= 0 && up && Pr[up]) {
          S.lowSamples = 0;
          S.tierWait = AQ.riseCooldown || 20;
          S.settle = 2;
          console.log("[render] frame time " + F.toFixed(1) + " ms with headroom: raising quality to " + up);
          try {
            N.setQuality({ ...Pr[up] });
            i.events.emit("quality:auto", { name: up, recovered: true });
          } catch {}
          return;
        }
      } else if (F >= 14 || X < 1) S.lowSamples = 0;
      if (
        (F > (AQ.dropAboveMs || 21.5) && X > S.min
          ? ((X = F > (AQ.hardDropAboveMs || 45) ? S.min : Math.max(S.min, X - (F > 30 ? 0.2 : 0.1))),
            (S.upDelay = Math.min(60, S.upDelay * 2)),
            (S.upWait = S.upDelay))
          : F < 17.4 && X < 1 && S.upWait <= 0
            ? ((X = Math.min(1, X + 0.1)), (S.upWait = 2))
            : F < 17.4 && X >= 1 && (S.upDelay = 4),
        (X = Math.round(X * 10) / 10),
        X <= S.min && F > 26)
      ) {
        S.floorHits = (S.floorHits || 0) + 1;
        let ne = { ultra: "high", high: "medium", medium: "low" }[
          i.quality.name
        ];
        if (S.floorHits >= 2 && ne && Pr[ne]) {
          (S.floorHits = 0),
            (S.scale = 0.8),
            (S.settle = 2),
            (S.upDelay = 4),
            (S.tierWait = AQ.riseCooldown || 20),
            (S.lowSamples = 0),
            console.log(
              "[render] frame time " +
                F.toFixed(0) +
                " ms at minimum scale: dropping quality to " +
                ne,
            );
          try {
            N.setQuality({ ...Pr[ne] }),
              i.events.emit("quality:auto", { name: ne });
          } catch {}
          return;
        }
      } else S.floorHits = 0;
      X !== S.scale && ((S.scale = X), (S.settle = 1), N.resize());
    }
    let H = [],
      O = {},
      q = (ie, F) => {
        O[ie] || ((O[ie] = 1), console.error(F));
      },
      U = { calls: 0, tris: 0 },
      T = 0,
      D = 0;
    function C() {
      a.updateMatrixWorld(!0),
        (l.matrixAutoUpdate = !1),
        (l.matrixWorldAutoUpdate = !1),
        l.matrixWorld.copy(a.matrixWorld),
        l.matrixWorldInverse.copy(l.matrixWorld).invert();
    }
    function G() {
      n.toneMapping !== xc && (n.toneMapping = xc),
        (n.toneMappingExposure =
          0.6 * N.exposure * (1 - Math.min(1, Math.max(0, N.post.fade)))),
        n.setRenderTarget(null),
        n.clear(),
        (n.shadowMap.needsUpdate = !0),
        n.render(r, a),
        n.clearDepth(),
        n.render(r, l);
    }
    function j(ie) {
      n.toneMapping !== ys && (n.toneMapping = ys),
        (n.toneMappingExposure = 1),
        n.setRenderTarget(m),
        n.clear(!0, !0, !1),
        (i.quality.name === "ultra" ||
          e.shot ||
          (T & 1) === 0 ||
          !h.shadow.map) &&
          (n.shadowMap.needsUpdate = !0),
        n.render(r, a),
        E && (A.copyDepth(b), n.setRenderTarget(m)),
        s.depthRange(0, 0.05);
      let F = r.environmentIntensity,
        X = r.environment,
        ne =
          N.interiorEnv &&
          i.level &&
          i.level.interiorBoxes &&
          i.level.interiorBoxes[0],
        re = !!(
          ne &&
          ne.min &&
          a.position.x > ne.min.x &&
          a.position.x < ne.max.x &&
          a.position.z > ne.min.z &&
          a.position.z < ne.max.z &&
          a.position.y < ne.max.y
        );
      re && (r.environment = N.interiorEnv),
        (r.environmentIntensity =
          F * (re ? Ky / Jy : 1) * (N.viewFill || 1.35));
      try {
        n.render(r, l);
      } finally {
        s.depthRange(0, 1), (r.environmentIntensity = F), (r.environment = X);
      }
      if (
        (A.run({
          hdr: m,
          camera: a,
          sun: h,
          dt: ie,
          post: N.post,
          exposure: N.exposure,
          time: i.time ? i.time.t : T / 60,
          fast: M,
          thunder: w.value,
        }),
        n.setRenderTarget(null),
        o.post)
      )
        throw new Error("a post shader failed to compile");
    }
    let N = {
        renderer: n,
        scene: r,
        camera: a,
        viewCamera: l,
        sun: h,
        sky: u.mesh,
        sunDir: Mn.dir.clone(),
        lightPool: x,
        // V41：暴露闪光池，供灯光预算模块识别/统计
        flashLights: g,
        // 暴露后处理材质表：扩展层（TAA/FXAA）需要拿到 post-final pass
        postModule: A,
        post: {
          damage: 0,
          lowHealth: 0,
          ads: 0,
          flash: 0,
          fade: 0,
          saturation: 1,
          focusDist: 0,
          shake: 0,
          wet: 1,
        },
        exposure: 1,
        env: y ? y.texture : null,
        interiorEnv: null,
        resolution: new Ae(4, 4),
        depthTextureIsLive: !1,
        tune: A ? A.TUNE : {},
        get advanced() {
          return _;
        },
        get autoExposure() {
          return A ? A.autoExposure : !1;
        },
        set autoExposure(ie) {
          A && (A.autoExposure = !!ie);
        },
        get depthTexture() {
          if (!A) return null;
          E = !0;
          try {
            return A.ensureDepthCopy();
          } catch {
            return null;
          }
        },
        addPrePass(ie) {
          H.push(ie);
        },
        renderWorld(ie, F) {
          let X = n.getRenderTarget(),
            ne = n.shadowMap.needsUpdate,
            re = n.toneMapping,
            $ = n.toneMappingExposure,
            ue = ie.layers.mask;
          ie.layers.disable(zc),
            (n.shadowMap.needsUpdate = !1),
            (n.toneMapping = ys),
            (n.toneMappingExposure = 1);
          try {
            n.setRenderTarget(F), n.clear(), n.render(r, ie);
          } finally {
            (ie.layers.mask = ue),
              n.setRenderTarget(X),
              (n.shadowMap.needsUpdate = ne),
              (n.toneMapping = re),
              (n.toneMappingExposure = $);
          }
        },
        async onLevelReady() {
          n.shadowMap.needsUpdate = !0;
          try {
            K();
          } catch (ie) {
            console.error(
              "[render] interior probe failed: " + ((ie && ie.stack) || ie),
            );
          }
          try {
            if (
              (_ && n.setRenderTarget(m),
              await n.compileAsync(r, a),
              N.interiorEnv)
            ) {
              let ie = r.environment;
              r.environment = N.interiorEnv;
              try {
                n.compile(r, l);
              } finally {
                r.environment = ie;
              }
            }
          } catch {}
          n.setRenderTarget(null), (S.settle = 3.5), (S.acc = 0), (S.n = 0);
        },
        setQuality(ie) {
          i.quality = ie;
          let F = p();
          h.shadow.mapSize.x !== F &&
            (h.shadow.mapSize.set(F, F),
            h.shadow.map && (h.shadow.map.dispose(), (h.shadow.map = null)));
          let X = ie.msaa | 0;
          m.samples !== X && ((m.samples = X), m.dispose()),
            A && A.applyQuality(),
            N.resize();
        },
        resize() {
          let ie = Math.max(2, t.clientWidth || window.innerWidth),
            F = Math.max(2, t.clientHeight || window.innerHeight),
            X = Math.min(window.devicePixelRatio || 1, 2),
            ne = i.quality.scale || 1;
          if (_) {
            n.setPixelRatio(X), n.setSize(ie, F, !1);
            // V41 P2-1：先用品质量 scale 套像素预算，再乘动态 scale。
            // 旧写法把动态 scale 也算进预算，导致高 DPR 屏上 1.0→0.6
            // 全程都被预算截成同一分辨率，动态分辨率形同虚设。
            let re = ne,
              $ =
                (window.SX_BALANCE &&
                  window.SX_BALANCE.render &&
                  window.SX_BALANCE.render.pixelBudget[i.quality.name]) ||
                23e5,
              ue = ie * X * F * X * re * re;
            ue > $ && (re *= Math.sqrt($ / ue));
            re *= S.scale;
            if (re > 1) re = 1;
            let me = Math.max(16, Math.round(ie * X * re)),
              ee = Math.max(16, Math.round(F * X * re));
            m.setSize(me, ee),
              (b.image.width !== me || b.image.height !== ee) &&
                ((b.image.width = me),
                (b.image.height = ee),
                (b.needsUpdate = !0)),
              A && A.resize(me, ee),
              N.resolution.set(me, ee);
          } else
            n.setPixelRatio(X * ne),
              n.setSize(ie, F, !1),
              N.resolution.set(Math.round(ie * X * ne), Math.round(F * X * ne));
          (a.aspect = l.aspect = ie / F),
            a.updateProjectionMatrix(),
            l.updateProjectionMatrix();
        },
        frame(ie) {
          let F = performance.now();
          D && z(F - D), (D = F), T++, n.info.reset(), x.update(ie);
          let X = i.time ? i.time.t : T / 60;
          (u.material.uniforms.uTime.value = X),
            (w.t += ie),
            (w.value =
              w.t < 0.9
                ? w.power *
                  Math.exp(-w.t * 5) *
                  (0.55 + 0.45 * Math.sin(w.t * 47) * Math.sin(w.t * 13 + 1)) *
                  0.35
                : 0),
            (u.material.uniforms.uFlash.value = Math.max(0, w.value)),
            C();
          for (let ne of H)
            try {
              ne(n, r, a);
            } catch (re) {
              q("pre", "[render] pre-pass threw: " + ((re && re.stack) || re));
            }
          if (_)
            try {
              j(ie);
            } catch (ne) {
              _ = !1;
              try {
                s.depthRange(0, 1), n.setRenderTarget(null);
              } catch {}
              console.error(
                "[render] advanced pipeline disabled, falling back to forward rendering: " +
                  ((ne && ne.stack) || ne),
              ),
                N.resize();
            }
          _ || G(),
            (U = { calls: n.info.render.calls, tris: n.info.render.triangles });
        },
        // V41：暴露自适应状态，供测试/调参验证动态分辨率确实生效
        adaptive: S,
        stats() {
          let ie = n.info;
          return {
            calls: U.calls,
            tris: U.tris,
            geos: ie.memory.geometries,
            tex: ie.memory.textures,
            programs: ie.programs ? ie.programs.length : 0,
            res: [N.resolution.x, N.resolution.y],
            scale: S.scale,
            advanced: _,
            softShadows: d,
            adapt: A && e.shot ? A.readAdapt() : void 0,
          };
        },
      },
      Q = null;
    function K() {
      let ie = i.level && i.level.interiorBoxes;
      if (!ie || !ie.length) return;
      let F = ie[0],
        X = (F.min.x + F.max.x) / 2,
        ne = (F.min.z + F.max.z) / 2,
        re = F.min.y + Math.min(2.4, (F.max.y - F.min.y) * 0.4);
      if (!Q) {
        let ee = new D0(128, { type: js, generateMipmaps: !1 });
        (Q = {
          cubeRT: ee,
          cam: new z0(0.15, 300, ee),
          pmrem: new ia(n),
          out: null,
        }),
          Q.cam.layers.set(vf);
      }
      Q.cam.position.set(X, re, ne), Q.cam.updateMatrixWorld(!0);
      let $ = n.toneMapping;
      (n.toneMapping = ys),
        (u.material.uniforms.uEnv.value = 1),
        (n.shadowMap.needsUpdate = !0);
      try {
        Q.cam.update(n, r);
      } finally {
        (u.material.uniforms.uEnv.value = 0),
          (n.toneMapping = $),
          n.setRenderTarget(null);
      }
      Q.out && Q.out.dispose(),
        (Q.out = Q.pmrem.fromCubemap(Q.cubeRT.texture)),
        (N.interiorEnv = Q.out.texture);
      let ue = 0,
        me = new Set();
      r.traverse((ee) => {
        let B = ee.material
          ? Array.isArray(ee.material)
            ? ee.material
            : [ee.material]
          : null;
        if (B)
          for (let P of B)
            !P ||
              me.has(P) ||
              !P.userData ||
              P.userData.interior !== !0 ||
              !("envMap" in P) ||
              (me.add(P),
              (P.envMap = N.interiorEnv),
              P.userData.keepEnvIntensity || (P.envMapIntensity = Ky),
              (P.needsUpdate = !0),
              ue++);
      }),
        ue &&
          console.log(`[render] interior probe assigned to ${ue} material(s)`);
    }
    (N.captureInteriorProbe = K),
      N.resize(),
      // V41 P2-3：切图后重置动态分辨率与降档计数，避免上一张图的状态带过来
      i.events && i.events.on && i.events.on("map:loaded", () => {
        S.scale = 1; S.settle = 2.5; S.acc = 0; S.n = 0;
        S.floorHits = 0; S.lowSamples = 0; S.tierWait = 8;
        N.resize();
      }),
      window.addEventListener("resize", () => N.resize());
    try {
      let ie = new Qt({ color: 8421504 }),
        F = new Qe(new un(1, 1, 1), ie);
      (F.castShadow = F.receiveShadow = !0),
        F.position.set(0, 0.5, -3),
        r.add(F);
      let X = () => {
        C(), _ ? j(0.016) : G();
      };
      try {
        X();
      } catch (ne) {
        _ &&
          ((_ = !1),
          console.error(
            "[render] advanced pipeline failed its self test, using forward fallback: " +
              ((ne && ne.message) || ne),
          ));
      }
      if (o.shadow && d) {
        Xy(),
          (d = !1),
          (o.shadow = !1),
          (n.shadowMap.type = Eh),
          (h.shadow.radius = 2),
          ie.dispose(),
          (F.material = new Qt({ color: 8421505 })),
          console.warn(
            "[render] soft shadow chunk rejected by the driver, using stock PCF",
          );
        try {
          X();
        } catch {
          _ = !1;
        }
      }
      if (
        (o.sky && console.error("[render] sky shader failed to compile"),
        r.remove(F),
        F.geometry.dispose(),
        ie.dispose(),
        F.material.dispose(),
        !_)
      ) {
        try {
          s.depthRange(0, 1), n.setRenderTarget(null);
        } catch {}
        N.resize();
      }
      T = 0;
    } catch (ie) {
      console.error("[render] self test threw: " + ((ie && ie.stack) || ie));
    }
    return N;
  }
  function sA(i) {
    let e = new wt();
    e.name = "render-showcase";
    let t = (h) => (e.add(h), h),
      n = new ls(0.42, 48, 24);
    for (let h = 0; h < 2; h++)
      for (let f = 0; f < 7; f++) {
        let p = new Qt({
            color: h ? 12170408 : 8006172,
            roughness: 0.06 + f * 0.15,
            metalness: h ? 1 : 0,
          }),
          d = new Qe(n, p);
        d.position.set(-3.6 + f * 1.2, 0.42 + h * 1.05, h * -1.1),
          (d.castShadow = d.receiveShadow = !0),
          t(d);
      }
    let s = [
      ["paint_orange", -5.2, 1.4, 1.3, 1.2, 2.2],
      ["steel_worn", 4.6, 1, 0.9, 1, 1.6],
      ["paint_teal", 5.6, 0.6, 2.4, 0.9, 3.6],
      ["concrete", -2.2, 0.5, 0.5, 2.6, 3.2],
    ];
    for (let [h, f, p, d, v, g] of s) {
      let x = Qi(Wi(p, d, v, 0.03, "bottom"), i.mats.get(h));
      x.position.set(f, 0, g), (x.rotation.y = f * 0.2), t(x);
    }
    for (let h = 0; h < 5; h++) {
      let f = Qi(Wi(0.5, 0.5, 0.5, 0.02, "bottom"), i.mats.get("wood_pallet"));
      f.position.set(0.5 + h * 0.52, 0, 3.4 + (h % 2) * 0.04), t(f);
    }
    {
      let h = Qi(Wi(0.5, 0.5, 0.5, 0.02, "bottom"), i.mats.get("wood_pallet"));
      h.position.set(1.3, 0.5, 3.42), (h.rotation.y = 0.3), t(h);
    }
    let o = i.mats.get("concrete_dirty"),
      r = 9,
      a = 7.5,
      l = [
        [-14, -5.2],
        [-4.7, -1.6],
        [-1.1, 1.9],
        [2.4, 5.6],
        [6.3, 14],
      ];
    for (let [h, f] of l) {
      let p = Qi($e(0.4, a, f - h, "bottom"), o);
      p.position.set(r, 0, (h + f) / 2), t(p);
    }
    {
      let h = Qi($e(0.4, 1.2, 28, "bottom"), o);
      h.position.set(r, a, 0), t(h);
    }
    let c = [
      [-12, 0, -9, 6, 4, 0.3],
      [-12, 0, -3, 6, 4, 0.3],
      [-15, 0, -6, 0.3, 4, 6.3],
      [-12, 4, -6, 6.6, 0.3, 6.6],
    ];
    for (let [h, f, p, d, v, g] of c) {
      let x = Qi($e(d, v, g, "bottom"), i.mats.get("steel_dark"));
      x.position.set(h, f, p), t(x);
    }
    {
      let h = new Qe($e(2.4, 0.06, 0.06), i.mats.emissive(16756832, 14));
      h.position.set(-12, 3.6, -6), t(h);
    }
    {
      let h = new Qe(new ls(0.06, 12, 8), i.mats.emissive(16726560, 30));
      h.position.set(4.6, 1.02, 1.6), t(h);
    }
    return (
      i.scene.add(e),
      {
        cam: [-8.5, 1.7, 4.2],
        target: [3, 1.5, 0.4],
        update: () => {
          let h = i.render.post,
            f = Math.round(i.camera.position.y * 1e3) % 10;
          (h.damage = f === 1 ? 0.8 : 0),
            (h.lowHealth = f === 2 ? 0.85 : 0),
            (h.ads = f === 3 ? 1 : 0),
            (h.flash = f === 4 ? 0.35 : 0),
            (h.fade = f === 5 ? 0.5 : 0);
        },
      }
    );
  }
  var qg = {};
  br(qg, { applyPatch: () => h3, create: () => Gg, showcase: () => wA });
  var Qy = `
in vec3 position; out vec2 vUv;
void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    e3 = `
precision highp float; precision highp int;
uniform vec4 uP; uniform float uSeed; uniform float uTexel;
in vec2 vUv;
layout(location=0) out vec4 o0; layout(location=1) out vec4 o1; layout(location=2) out vec4 o2;
#define TAU 6.28318530718
#define sat(x) clamp(x, 0.0, 1.0)
#define OV(D, k) { float k_ = sat(k); nt = mix(nt, D, k_); ta = mix(ta, 0.0, k_); }
vec3 L(float r, float g, float b){ return pow(vec3(r, g, b), vec3(2.2)); }
uvec3 pcg3(uvec3 v){ v = v * 1664525u + 1013904223u; v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y; v ^= v >> 16u; v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y; return v; }
vec3 h3(vec2 c, vec2 per, float s){ c = mod(c, per); return vec3(pcg3(uvec3(uint(c.x + 0.5), uint(c.y + 0.5), uint(s + uSeed)))) * (1.0 / 4294967296.0); }
float gn(vec2 p, vec2 per, float s){
  vec2 i = floor(p), f = p - i; vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(h3(i, per, s).xy * 2.0 - 1.0, f);
  float b = dot(h3(i + vec2(1.0, 0.0), per, s).xy * 2.0 - 1.0, f - vec2(1.0, 0.0));
  float c = dot(h3(i + vec2(0.0, 1.0), per, s).xy * 2.0 - 1.0, f - vec2(0.0, 1.0));
  float d = dot(h3(i + vec2(1.0, 1.0), per, s).xy * 2.0 - 1.0, f - vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// fractal noise, ~0..1 centred on 0.5 (std ~0.18)
float fbm(vec2 uv, vec2 f, int oct, float s){
  float a = 0.5, v = 0.0, t = 0.0;
  for (int i = 0; i < oct; i++){ v += a * gn(uv * f, f, s + float(i) * 7.0); t += a; a *= 0.5; f *= 2.0; }
  return sat(v / t * 1.8 + 0.5);
}
// voronoi: x = F1, y = F2, z = cell random, w = second cell random
vec4 vor(vec2 p, vec2 per, float s){
  vec2 i = floor(p), f = p - i; float d1 = 9.0, d2 = 9.0; vec2 id = vec2(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
    vec2 o = vec2(float(x), float(y)); vec3 r = h3(i + o, per, s); vec2 d = o + r.xy - f; float dd = dot(d, d);
    if (dd < d1){ d2 = d1; d1 = dd; id = vec2(r.z, fract(r.z * 37.0 + r.x * 11.0)); } else if (dd < d2) d2 = dd;
  }
  return vec4(sqrt(d1), sqrt(d2), id);
}
// scattered straight scratches: f cells per tile, w half-width (cells), base angle + spread, density 0..1
float scr(vec2 uv, float f, float s, float w, float ang, float spread, float dens){
  vec2 p = uv * f; vec2 i = floor(p); vec2 fr = p - i; float m = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
    vec2 o = vec2(float(x), float(y)); vec3 r = h3(i + o, vec2(f), s); vec3 r2 = h3(i + o, vec2(f), s + 31.0);
    vec2 c = o + r.xy - fr; float a = ang + (r.z - 0.5) * spread; vec2 dir = vec2(cos(a), sin(a));
    float al = dot(c, dir), ac = dot(c, vec2(-dir.y, dir.x)); float len = 0.15 + r2.x * 0.8;
    m = max(m, smoothstep(w, w * 0.3, abs(ac)) * smoothstep(len, len * 0.7, abs(al)) * step(r2.y, dens) * (0.35 + 0.65 * r2.z));
  }
  return m;
}
void emit(vec3 c, float a, float h, float ao, float r, float m){
  o0 = vec4(sqrt(clamp(c, 0.0, 1.0)), sat(a));
  o1 = vec4(sat(ao), clamp(r, 0.03, 1.0), sat(m), 1.0);
  float hh = sat(h) * 255.0; float fl = floor(hh); o2 = vec4(fl / 255.0, hh - fl, 0.0, 1.0);
}
// soft, grainy rust patch mask: f = patch frequency, th = threshold (higher = rarer)
float rustMask(vec2 uv, vec2 f, float th, float s){
  float n = fbm(uv, f, 5, s), g = fbm(uv, f * 14.0, 3, s + 50.0);
  return smoothstep(th, th + 0.14, n + (g - 0.5) * 0.3) * (0.5 + 0.5 * g);
}
// ---- shared paint damage model ----
float chipsF(vec2 uv, vec2 f, float s, float dens, float rmax){
  vec4 v = vor(uv * f, f, s); float e = fbm(uv, f * 3.0, 3, s + 3.0) - 0.5; float r = rmax * (0.25 + 0.75 * v.w);
  return step(v.z, dens) * smoothstep(r, r * 0.55, v.x + e * 0.6);
}
// chip: 0 = intact paint .. 1 = through to substrate; stain: thin oxide halo; run: rust run below damage (-V is down)
void paintDmg(vec2 uv, float amt, out float chip, out float stain, out float run){
  float wearN = fbm(uv, vec2(3.0), 6, 21.0);
  float zone = smoothstep(0.58, 0.82, fbm(uv, vec2(2.0), 3, 22.0));      // damage clusters; most of the panel is clean
  float dn = (0.012 + 0.085 * zone) * (0.5 + amt);
  float c1 = chipsF(uv, vec2(20.0, 11.0), 23.0, dn, 0.24);                // vertically stretched flakes
  float c2 = chipsF(uv, vec2(64.0, 40.0), 24.0, dn * 1.6, 0.34);
  float th = 0.925 - 0.06 * amt;
  float c3 = smoothstep(th, th + 0.03, wearN + (fbm(uv, vec2(40.0), 3, 25.0) - 0.5) * 0.12);
  float s1 = scr(uv, 5.0, 26.0, 0.0035, 0.0, 0.4, 0.2 + 0.25 * amt);
  float s2 = scr(uv, 16.0, 27.0, 0.009, 1.57, 0.5, 0.12 + 0.2 * amt);
  float sbreak = smoothstep(0.4, 0.65, fbm(uv, vec2(50.0), 2, 28.0));
  chip = sat(max(max(c1, c2), max(c3, max(s1, s2) * sbreak)));
  vec4 v = vor(uv * vec2(20.0, 11.0), vec2(20.0, 11.0), 23.0);
  float b1 = step(v.z, dn) * smoothstep(0.42, 0.14, v.x) * (0.3 + 0.7 * v.w);
  float bn = fbm(uv, vec2(36.0), 4, 29.0);
  stain = sat(max(b1 * smoothstep(0.4, 0.7, bn) * 0.8, smoothstep(th - 0.03, th + 0.02, wearN) * smoothstep(0.4, 0.7, bn) * 0.7));
  float streak = fbm(uv, vec2(120.0, 1.0), 3, 30.0);
  float rr = 0.0;
  for (int i = 1; i <= 4; i++){
    vec2 q = uv + vec2(0.0, float(i) * 0.034);
    float src = max(chipsF(q, vec2(20.0, 11.0), 23.0, dn, 0.24), smoothstep(th, th + 0.03, fbm(q, vec2(3.0), 6, 21.0)));
    rr = max(rr, src * (1.0 - float(i) / 5.0));
  }
  run = rr * smoothstep(0.5, 0.78, streak);
}
`,
    t3 = `
void main(){ surf(vUv); }`,
    Tn = {};
  Tn.asphalt = `
void surf(vec2 uv){
  vec4 a = vor(uv * 110.0, vec2(110.0), 1.0);
  vec4 b = vor(uv * 230.0 + 3.0, vec2(230.0), 2.0);
  float big = fbm(uv, vec2(3.0), 4, 5.0), mid = fbm(uv, vec2(24.0), 4, 6.0), fine = fbm(uv, vec2(300.0), 2, 7.0);
  float jag = fbm(uv, vec2(420.0), 2, 8.0) - 0.5;
  float sa = smoothstep(0.46, 0.3, a.x + jag * 0.3 - (a.y - a.x) * 0.2 + (1.0 - a.w) * 0.12) * step(a.z, 0.62);
  float sb = smoothstep(0.46, 0.3, b.x + jag * 0.2 + (1.0 - b.w) * 0.15) * step(b.z, 0.85);
  float h = max(sa * (0.45 + 0.55 * a.w), sb * 0.5 * (0.5 + 0.5 * b.w));
  h = h * 0.6 + fine * 0.3 + mid * 0.1;
  float wearK = smoothstep(0.3, 0.7, big);
  float stone = sat(max(sa, sb * 0.8));
  vec3 stA = mix(L(0.28, 0.28, 0.29), L(0.45, 0.43, 0.41), a.w); stA = mix(stA, L(0.42, 0.35, 0.28), step(0.9, a.z * 0.5 + a.w * 0.6));
  vec3 stB = mix(L(0.26, 0.26, 0.28), L(0.44, 0.43, 0.42), b.w);
  vec3 col = L(0.13, 0.13, 0.135) * (0.8 + 0.4 * mid);
  col = mix(col, stB, sb * 0.7 * (0.45 + 0.55 * wearK));
  col = mix(col, stA, sa * (0.5 + 0.45 * wearK));
  col *= 0.8 + 0.4 * big;
  float cn = fbm(uv + vec2(0.13, 0.4), vec2(2.0), 3, 9.0);
  float band = smoothstep(0.016, 0.009, abs(cn - 0.5) + (fbm(uv, vec2(70.0), 2, 13.0) - 0.5) * 0.008) * smoothstep(0.4, 0.6, fbm(uv, vec2(2.0), 2, 12.0));
  col = mix(col, L(0.075, 0.075, 0.08), band * 0.93);
  h = mix(h, 0.74 + fine * 0.05 + sa * 0.04, band * 0.88);
  float r = mix(0.93, 0.74, stone * (0.4 + 0.6 * wearK)); r = mix(r, 0.36, band);
  float oil = smoothstep(0.72, 0.86, fbm(uv + 0.5, vec2(5.0), 4, 14.0)); col *= 1.0 - oil * 0.45; r = mix(r, 0.5, oil * 0.6);
  emit(col, 1.0, h, mix(0.55, 1.0, smoothstep(0.0, 0.6, h)), r, 0.0);
}`;
  Tn.concrete = `
void surf(vec2 uv){
  float big = fbm(uv, vec2(2.0), 5, 1.0), mid = fbm(uv, vec2(12.0), 5, 2.0), fine = fbm(uv, vec2(180.0), 3, 3.0);
  float form = fbm(uv, vec2(2.0, 7.0), 5, 4.0);
  vec4 po = vor(uv * 70.0, vec2(70.0), 5.0); float pore = step(po.z, 0.35) * smoothstep(0.16 * po.w + 0.03, 0.02, po.x);
  vec4 po2 = vor(uv * 260.0, vec2(260.0), 6.0); float pore2 = step(po2.z, 0.5) * smoothstep(0.3 * po2.w, 0.05, po2.x);
  vec2 wu = uv + (vec2(fbm(uv, vec2(6.0), 3, 7.0), fbm(uv, vec2(6.0), 3, 8.0)) - 0.5) * 0.12 + (vec2(fbm(uv, vec2(48.0), 3, 17.0), fbm(uv, vec2(48.0), 3, 18.0)) - 0.5) * 0.022;
  vec4 cr = vor(wu * 3.0, vec2(3.0), 9.0);
  float crack = smoothstep(0.0045, 0.0012, cr.y - cr.x) * smoothstep(0.45, 0.6, fbm(uv, vec2(3.0), 2, 10.0));
  float chip = smoothstep(0.83, 0.87, fbm(uv, vec2(7.0), 4, 11.0) + (fine - 0.5) * 0.08 + (mid - 0.5) * 0.06);
  vec4 ag = vor(uv * 140.0, vec2(140.0), 12.0); float stone = smoothstep(0.5, 0.3, ag.x) * step(ag.z, 0.6);
  vec2 dj = min(uv, 1.0 - uv); float jd = min(dj.x, dj.y);
  float joint = smoothstep(0.0022, 0.0012, jd), jstain = smoothstep(0.07, 0.0, jd + (mid - 0.5) * 0.04);
  float h = 0.6 + (mid - 0.5) * 0.25 + (fine - 0.5) * 0.12 + (form - 0.5) * 0.06;
  h -= pore * 0.35 + pore2 * 0.08 + crack * 0.2; h = mix(h, 0.42 + stone * 0.12 + fine * 0.08, chip); h = mix(h, 0.05, joint);
  vec3 col = L(0.53, 0.52, 0.49) * (0.72 + 0.4 * big + 0.22 * (mid - 0.5) + 0.08 * (form - 0.5));
  col *= mix(vec3(1.04, 1.0, 0.94), vec3(0.95, 1.0, 1.05), fbm(uv, vec2(3.0), 3, 13.0));
  float st = smoothstep(0.55, 0.8, fbm(uv, vec2(4.0), 5, 14.0)); col *= 1.0 - st * 0.3;
  float ef = smoothstep(0.66, 0.85, fbm(uv, vec2(5.0), 4, 15.0)) * sat(fine * 1.6 - 0.2); col = mix(col, L(0.68, 0.67, 0.64), ef * 0.22);
  col *= 1.0 - pore * 0.5 - pore2 * 0.2 - crack * 0.6;
  vec3 agc = mix(L(0.38, 0.37, 0.35), L(0.54, 0.52, 0.47), ag.w); agc = mix(agc, L(0.46, 0.41, 0.34), step(0.45, ag.z));
  col = mix(col, mix(L(0.4, 0.39, 0.37) * (0.8 + 0.4 * fine), agc, stone * 0.8), chip);
  col *= 1.0 - jstain * 0.25; col = mix(col, L(0.1, 0.1, 0.1), joint);
  float r = 0.82 + (mid - 0.5) * 0.2 - (form - 0.5) * 0.15; r = mix(r, 0.95, chip); r = mix(r, 0.62, st * 0.3);
  float ao = 1.0 - pore * 0.5 - crack * 0.5 - joint * 0.6 - chip * 0.15;
  float pa = smoothstep(0.40, 0.47, fbm(uv, vec2(9.0), 5, 16.0) + (mid - 0.5) * 0.2) * (1.0 - chip) * (1.0 - crack) * (1.0 - pore);
  emit(col, pa, h, ao, r, 0.0);
}`;
  Tn.brick = `
void surf(vec2 uv){
  float rows = 24.0, cols = 8.0; float y = uv.y * rows; float row = floor(y); float x = uv.x * cols + 0.5 * mod(row, 2.0); float cl = floor(x);
  vec2 f = vec2(fract(x), fract(y)); vec3 id = h3(vec2(cl, row), vec2(cols, rows), 1.0);
  float ed = fbm(uv, vec2(60.0), 3, 2.0);
  vec2 d = min(f, 1.0 - f) * vec2(225.0, 75.0);
  float mort = 5.0 + (ed - 0.5) * 5.0; float dm = min(d.x, d.y); float brick = smoothstep(mort, mort + 3.0, dm);
  float fine = fbm(uv, vec2(200.0), 3, 3.0), mid = fbm(uv, vec2(30.0), 4, 4.0);
  vec3 c = mix(L(0.52, 0.27, 0.2), L(0.42, 0.2, 0.15), id.x); c = mix(c, L(0.3, 0.17, 0.15), smoothstep(0.75, 1.0, id.y)); c = mix(c, L(0.58, 0.38, 0.26), smoothstep(0.85, 1.0, id.z));
  c *= (0.8 + 0.4 * mid) * (0.9 + 0.2 * fine);
  float pit = smoothstep(0.7, 0.8, fbm(uv, vec2(90.0), 3, 5.0)); c *= 1.0 - pit * 0.35;
  vec3 mc = L(0.5, 0.48, 0.44) * (0.75 + 0.5 * fine);
  float soot = smoothstep(0.5, 0.8, fbm(uv, vec2(3.0), 4, 6.0));
  vec3 col = mix(mc, c, brick) * (1.0 - soot * 0.35);
  float ef = smoothstep(0.7, 0.85, fbm(uv, vec2(5.0), 4, 7.0)) * brick; col = mix(col, L(0.7, 0.68, 0.64), ef * 0.3);
  float h = mix(0.25 + fine * 0.1, 0.7 + (mid - 0.5) * 0.15 + (fine - 0.5) * 0.1 - pit * 0.2 + (id.x - 0.5) * 0.12, brick);
  emit(col, 1.0, h, mix(0.6, 1.0, brick) * (1.0 - pit * 0.3), mix(0.95, 0.86 + (mid - 0.5) * 0.15, brick), 0.0);
}`;
  Tn.epoxy = `
void surf(vec2 uv){
  float big = fbm(uv, vec2(3.0), 5, 1.0), mid = fbm(uv, vec2(20.0), 4, 2.0), fine = fbm(uv, vec2(250.0), 2, 3.0), mott = fbm(uv, vec2(9.0), 5, 11.0);
  vec3 col = L(0.41, 0.445, 0.435) * (0.78 + 0.3 * big + 0.22 * (mott - 0.5));
  col *= mix(vec3(1.03, 1.0, 0.97), vec3(0.95, 1.0, 1.03), fbm(uv, vec2(2.0), 3, 19.0));
  vec4 ag = vor(uv * 180.0, vec2(180.0), 12.0); col *= 1.0 + (ag.w - 0.5) * 0.14 * smoothstep(0.5, 0.2, ag.x);
  float gloss = smoothstep(0.35, 0.62, fbm(uv, vec2(5.0), 5, 4.0));          // sealer still intact
  float lane = smoothstep(0.35, 0.65, fbm(uv, vec2(1.0, 3.0), 3, 13.0));     // traffic lanes worn matt
  float worn = sat(1.0 - gloss * 0.85 + lane * 0.45 - 0.15);
  float sc1 = scr(uv, 14.0, 5.0, 0.012, 0.5, 6.3, 0.7), sc2 = scr(uv, 40.0, 6.0, 0.02, 0.0, 6.3, 0.5);
  float t1 = abs(uv.y - 0.31 - 0.06 * sin(uv.x * TAU)), t2 = abs(uv.x - 0.62 - 0.09 * sin(uv.y * TAU + 1.0));
  float t3 = abs(uv.y - 0.74 - 0.1 * sin(uv.x * TAU * 2.0 + 2.0)), t4 = abs(uv.x - 0.2 - 0.05 * sin(uv.y * TAU + 4.0));
  float tread = 0.6 + 0.4 * sin((uv.x + uv.y) * TAU * 90.0);
  float tm = smoothstep(0.022, 0.016, t1) * smoothstep(0.35, 0.6, fbm(uv, vec2(8.0), 3, 7.0)) + smoothstep(0.02, 0.014, t2) * smoothstep(0.4, 0.65, fbm(uv, vec2(6.0), 3, 8.0))
           + smoothstep(0.026, 0.018, t3) * smoothstep(0.45, 0.7, fbm(uv, vec2(5.0), 3, 14.0)) + smoothstep(0.018, 0.012, t4) * smoothstep(0.4, 0.65, fbm(uv, vec2(7.0), 3, 15.0));
  tm = sat(tm * tread);
  col = mix(col, L(0.1, 0.1, 0.105), tm * 0.75);
  col *= 1.0 - worn * 0.1; col = mix(col, col * 1.25, sc1 * 0.4);
  float dirt = smoothstep(0.55, 0.85, fbm(uv, vec2(2.0), 4, 9.0)); col = mix(col, L(0.3, 0.29, 0.26), dirt * 0.3);
  float r = mix(0.1, 0.52, worn) + sc1 * 0.2 + sc2 * 0.15 + tm * 0.3 + dirt * 0.2 + (mid - 0.5) * 0.12 + (mott - 0.5) * 0.1;
  float h = 0.5 + (fine - 0.5) * 0.05 + (mid - 0.5) * 0.06 - sc1 * 0.2 - sc2 * 0.08 + tm * 0.05 + (gloss - 0.5) * 0.03;
  float chip = smoothstep(0.87, 0.9, fbm(uv, vec2(14.0), 5, 10.0) + (fine - 0.5) * 0.06); col = mix(col, L(0.44, 0.44, 0.43) * (0.75 + 0.5 * fine), chip); h -= chip * 0.3; r = mix(r, 0.85, chip);
  emit(col, 1.0, h, 1.0 - chip * 0.2, r, 0.0);
}`;
  var n3 = `
  float fine = fbm(uv, vec2(260.0), 2, 1.0), mid = fbm(uv, vec2(16.0), 4, 2.0), big = fbm(uv, vec2(2.0), 4, 3.0);
  float chalk = smoothstep(0.3, 0.8, fbm(uv, vec2(1.0, 2.0), 4, 4.0));
  float dirt = smoothstep(0.42, 0.85, fbm(uv, vec2(3.0, 2.0), 5, 5.0));
  float vs1 = fbm(uv, vec2(70.0, 1.0), 3, 6.0), vs2 = fbm(uv, vec2(22.0, 1.0), 3, 16.0), vs3 = fbm(uv, vec2(9.0, 2.0), 3, 17.0);
  float steel = smoothstep(0.55, 0.8, chip);
  float primer = smoothstep(0.15, 0.4, chip) * (1.0 - steel);
  float rustN = fbm(uv, vec2(60.0), 4, 7.0);
  float fresh = steel * smoothstep(0.78, 0.86, fbm(uv, vec2(25.0), 3, 8.0));
  vec3 rustC = mix(L(0.2, 0.135, 0.105), L(0.36, 0.23, 0.15), rustN);
  rustC = mix(rustC, L(0.5, 0.33, 0.18), smoothstep(0.7, 0.95, fbm(uv, vec2(120.0), 2, 9.0)) * 0.5);
  vec3 nt = vec3(0.0); float ta = shade * (0.9 + 0.2 * (mid - 0.5) + 0.2 * (big - 0.5));
  // dirt film: broad grime + fine and broad vertical wash streaks
  float df = sat(dirt * 0.3 + smoothstep(0.55, 0.85, vs1) * 0.3 * (0.4 + dirt) + smoothstep(0.55, 0.8, vs2) * 0.38 * (0.3 + dirt) + smoothstep(0.5, 0.8, vs3) * 0.2);
  float clean = smoothstep(0.6, 0.85, 1.0 - vs2) * 0.5;            // rain-washed lighter streaks
  float rs = sat(stain * 0.7 + run * 0.85);
  ta *= 1.0 + clean * 0.08 - chalk * 0.06;
  OV(vec3(0.72), chalk * 0.075 + clean * 0.02);
  OV(L(0.24, 0.22, 0.19), df * 0.42);
  OV(mix(L(0.3, 0.2, 0.14), L(0.44, 0.28, 0.16), rustN), rs * 0.5);
  OV(mix(L(0.5, 0.25, 0.2), L(0.55, 0.54, 0.5), 0.35), primer);
  OV(rustC, steel);
  OV(L(0.55, 0.55, 0.57), fresh);
  float h = 0.62 + (fine - 0.5) * 0.05 + (mid - 0.5) * 0.04;
  h = mix(h, 0.5, primer); h = mix(h, 0.36 + rustN * 0.14, steel); h += rs * 0.02 * rustN;
  float r = baseR + chalk * 0.26 + df * 0.3 - clean * 0.06 + (mid - 0.5) * 0.14 + (big - 0.5) * 0.1; r = mix(r, 0.75, primer); r = mix(r, 0.92, steel); r = mix(r, 0.35, fresh); r = mix(r, 0.72, rs * 0.6);
  float m = fresh * 0.95 + (steel - fresh) * 0.15;
  float ao = 1.0 - steel * 0.25 - primer * 0.1;
`;
  Tn.paint = `
void surf(vec2 uv){
  float chip, stain, run; paintDmg(uv, uP.x, chip, stain, run);
  float shade = 0.8, baseR = 0.40;
  ${n3}
  emit(nt, ta, h, ao, r, m);
}`;
  Tn.hazard = `
void surf(vec2 uv){
  float chip, stain, run; paintDmg(uv, 1.4, chip, stain, run);
  float shade = 1.0, baseR = 0.5;
  ${n3}
  float s = fract((uv.x + uv.y) * 5.0);
  float yel = smoothstep(0.244, 0.256, abs(s - 0.5) + (fbm(uv, vec2(80.0), 2, 41.0) - 0.5) * 0.02);
  vec3 pc = mix(L(0.1, 0.1, 0.11), L(0.86, 0.66, 0.1), yel);
  emit(nt + pc * ta, 1.0, h, ao, r, m);
}`;
  Tn.hull = `
void surf(vec2 uv){
  float ry = uv.y * 2.0; float row = floor(ry); float fy = fract(ry); float sx = fract(uv.x + 0.5 * mod(row, 2.0));
  float dh = min(fy, 1.0 - fy) * 2.0, dv = min(sx, 1.0 - sx) * 4.0; float dseam = min(dh, dv);
  float wn = fbm(uv, vec2(200.0), 2, 1.0);
  float bead = smoothstep(0.012, 0.004, dseam + (wn - 0.5) * 0.004);
  float ripple = 0.75 + 0.25 * sin((uv.x + uv.y) * TAU * 400.0);
  float dish = cos(uv.x * TAU * 8.0) * 0.5 + 0.5;
  float big = fbm(uv, vec2(2.0), 4, 2.0), mid = fbm(uv, vec2(14.0), 4, 3.0), fine = fbm(uv, vec2(220.0), 2, 4.0);
  float roller = fbm(uv, vec2(120.0, 30.0), 3, 5.0);
  float seamK = smoothstep(0.12, 0.0, dseam);
  float pit = fbm(uv, vec2(70.0), 4, 7.0);
  float rust = smoothstep(0.72, 0.79, fbm(uv, vec2(10.0), 5, 6.0) + seamK * 0.2);
  rust *= smoothstep(0.3, 0.5, pit + rust * 0.3);
  float streak = fbm(uv, vec2(110.0, 1.0), 3, 8.0);
  float wp = 0.0;
  for (int i = 1; i <= 4; i++){
    vec2 q = uv + vec2(0.0, float(i) * 0.03); float qy = fract(q.y * 2.0);
    float qs = smoothstep(0.02, 0.0, min(qy, 1.0 - qy) * 2.0); float qr = smoothstep(0.72, 0.79, fbm(q, vec2(10.0), 5, 6.0));
    wp = max(wp, max(qs * 0.7, qr) * (1.0 - float(i) / 5.0));
  }
  float weep = wp * smoothstep(0.4, 0.75, streak);
  float salt = smoothstep(0.6, 0.85, fbm(uv, vec2(3.0, 9.0), 4, 9.0));
  vec3 nt = vec3(0.0); float ta = 0.82 * (0.88 + 0.2 * (big - 0.5) + 0.14 * (mid - 0.5) + 0.08 * (roller - 0.5));
  OV(vec3(0.6), salt * 0.025 * (0.5 + roller));
  OV(L(0.45, 0.27, 0.14), weep * 0.7);
  OV(mix(L(0.25, 0.16, 0.11), L(0.5, 0.31, 0.17), pit), rust);
  float h = 0.5 + (roller - 0.5) * 0.05 + (fine - 0.5) * 0.03 + bead * 0.35 * ripple + (dish - 0.5) * 0.1 - rust * 0.08 * (1.0 - pit);
  float r = 0.5 + (mid - 0.5) * 0.15 + salt * 0.2; r = mix(r, 0.9, rust); r = mix(r, 0.7, weep * 0.5);
  emit(nt, ta, h, 1.0 - rust * 0.2 - smoothstep(0.03, 0.012, dseam) * (1.0 - bead) * 0.3, r, rust * 0.1);
}`;
  Tn.galv = `
void surf(vec2 uv){
  vec2 wu = uv + (vec2(fbm(uv, vec2(8.0), 2, 1.0), fbm(uv, vec2(8.0), 2, 2.0)) - 0.5) * 0.03;
  vec4 a = vor(wu * 22.0, vec2(22.0), 3.0); vec4 b = vor(wu * 50.0 + 1.5, vec2(50.0), 4.0);
  float sp = mix(a.w, b.w, 0.35);
  float edge = smoothstep(0.0, 0.08, a.y - a.x);
  float big = fbm(uv, vec2(2.0), 4, 5.0), fine = fbm(uv, vec2(200.0), 2, 6.0), mid = fbm(uv, vec2(20.0), 4, 7.0);
  vec3 col = vec3(0.56, 0.58, 0.6) * (0.72 + 0.4 * sp) * (0.92 + 0.16 * big);
  float wr = smoothstep(0.55, 0.85, fbm(uv, vec2(6.0), 5, 8.0)) * (0.4 + 0.6 * fbm(uv, vec2(90.0), 3, 10.0));
  col = mix(col, L(0.74, 0.74, 0.72), wr * 0.4);
  float rs = rustMask(uv, vec2(9.0), 0.8, 9.0);
  col = mix(col, L(0.42, 0.27, 0.16) * (0.7 + 0.6 * fine), rs);
  float r = 0.3 + 0.28 * sp + (mid - 0.5) * 0.15 + wr * 0.3; r = mix(r, 0.9, rs);
  float h = 0.5 + (sp - 0.5) * 0.08 * edge + (fine - 0.5) * 0.04 + wr * 0.05 * fine - (1.0 - edge) * 0.03;
  emit(col, 1.0, h, 1.0, r, 1.0 - wr * 0.45 - rs * 0.9);
}`;
  Tn.metal = `
void surf(vec2 uv){
  float big = fbm(uv, vec2(2.0), 5, 1.0), mid = fbm(uv, vec2(18.0), 4, 2.0), fine = fbm(uv, vec2(240.0), 2, 3.0);
  float smudge = fbm(uv, vec2(5.0, 7.0), 5, 4.0);
  float s1 = scr(uv, 9.0, 5.0, 0.006, 0.2, 6.3, 0.6), s2 = scr(uv, 30.0, 6.0, 0.012, 1.0, 6.3, 0.5), s3 = scr(uv, 70.0, 7.0, 0.03, 2.0, 6.3, 0.4);
  float sc = sat(max(s1, max(s2 * 0.8, s3 * 0.5)));
  float rust = rustMask(uv, vec2(12.0), 0.74, 8.0) * uP.x;
  float scale_ = smoothstep(0.4, 0.7, fbm(uv, vec2(7.0), 4, 10.0));
  vec3 nt = vec3(0.0); float ta = 0.95 * (0.85 + 0.2 * (big - 0.5) + 0.16 * (mid - 0.5)) * (1.0 - scale_ * 0.18);
  OV(vec3(0.55, 0.56, 0.58), sc * 0.3);
  OV(mix(L(0.27, 0.17, 0.12), L(0.5, 0.31, 0.17), fbm(uv, vec2(90.0), 3, 11.0)), rust);
  float r = 0.42 + (smudge - 0.5) * 0.3 + (mid - 0.5) * 0.1 - sc * 0.15 + scale_ * 0.08; r = mix(r, 0.9, rust);
  float h = 0.5 + (fine - 0.5) * 0.04 + (mid - 0.5) * 0.04 - sc * 0.12 + rust * 0.08 * fine;
  emit(nt, ta, h, 1.0 - rust * 0.2, r, 1.0 - rust * 0.85);
}`;
  Tn.brushed = `
void surf(vec2 uv){
  float l1 = fbm(uv, vec2(2.0, 300.0), 3, 1.0), l2 = fbm(uv, vec2(6.0, 120.0), 3, 2.0), l3 = fbm(uv, vec2(1.0, 500.0), 2, 12.0);
  float big = fbm(uv, vec2(3.0), 4, 3.0), smudge = fbm(uv, vec2(6.0), 5, 4.0);
  float sc = scr(uv, 12.0, 5.0, 0.008, 0.6, 6.3, 0.4);
  float tar = smoothstep(0.45, 0.9, fbm(uv, vec2(5.0), 5, 6.0));
  vec3 nt = vec3(0.0); float ta = 0.95 * (0.82 + 0.16 * (l1 - 0.5) + 0.14 * (l2 - 0.5) + 0.1 * (big - 0.5)) * (1.0 - tar * 0.13);
  OV(vec3(0.7), sc * 0.2);
  float r = 0.3 + (l1 - 0.5) * 0.2 + (smudge - 0.5) * 0.2 + tar * 0.18 - sc * 0.08;
  float h = 0.5 + (l1 - 0.5) * 0.2 + (l3 - 0.5) * 0.2 + (l2 - 0.5) * 0.1 - sc * 0.2;
  emit(nt, ta, h, 1.0, r, 1.0);
}`;
  Tn.rust = `
void surf(vec2 uv){
  vec2 wu = uv + (vec2(fbm(uv, vec2(5.0), 3, 1.0), fbm(uv, vec2(5.0), 3, 2.0)) - 0.5) * 0.08;
  float n = fbm(wu, vec2(6.0), 7, 3.0);
  float fl = fbm(wu, vec2(11.0), 6, 4.0);
  float tf = fract(fl * 4.0); float layer = floor(fl * 4.0) / 4.0 + smoothstep(0.0, 0.45, tf) * 0.25;
  float flakeEdge = smoothstep(0.1, 0.0, tf) * smoothstep(0.4, 0.6, fbm(uv, vec2(9.0), 3, 14.0));
  vec4 pv = vor(uv * 70.0, vec2(70.0), 5.0); float pit = step(pv.z, 0.5) * smoothstep(0.35 * pv.w + 0.05, 0.03, pv.x);
  vec4 pv2 = vor(uv * 190.0, vec2(190.0), 15.0); float speck = smoothstep(0.35, 0.1, pv2.x) * step(pv2.z, 0.4);
  float grain = fbm(uv, vec2(220.0), 3, 6.0);
  float scaleI = smoothstep(0.75, 0.8, fbm(wu, vec2(4.0), 5, 7.0) + (grain - 0.5) * 0.1);
  float h = 0.25 + layer * 0.4 + (n - 0.5) * 0.3 + (grain - 0.5) * 0.14 - pit * 0.2 + speck * 0.04;
  h = mix(h, 0.8 + (grain - 0.5) * 0.04, scaleI);
  float t = sat(layer * 0.5 + n * 0.55 + (grain - 0.5) * 0.35);
  vec3 c = mix(L(0.26, 0.17, 0.13), L(0.4, 0.25, 0.16), smoothstep(0.25, 0.6, t));
  float bloom = smoothstep(0.55, 0.85, fbm(uv, vec2(7.0), 5, 8.0));
  c = mix(c, L(0.55, 0.34, 0.17), bloom * (0.35 + 0.65 * smoothstep(0.4, 0.7, t)));
  c = mix(c, L(0.62, 0.45, 0.25), smoothstep(0.7, 0.95, fbm(uv, vec2(34.0), 4, 18.0)) * 0.4);
  c = mix(c, L(0.2, 0.14, 0.12), sat(flakeEdge * 0.6 + pit * 0.7));
  c *= (0.8 + 0.4 * grain) * (0.9 + 0.2 * speck);
  float streak = fbm(uv, vec2(60.0, 2.0), 3, 9.0); c = mix(c, L(0.5, 0.31, 0.17), smoothstep(0.55, 0.8, streak) * 0.2);
  c = mix(c, L(0.3, 0.3, 0.33) * (0.8 + 0.4 * grain), scaleI);
  float r = 0.9 + (grain - 0.5) * 0.15 - bloom * 0.06; r = mix(r, 0.55, scaleI);
  emit(c, 1.0, h, 1.0 - pit * 0.4 - flakeEdge * 0.25, r, scaleI * 0.35);
}`;
  Tn.diamond = `
void surf(vec2 uv){
  vec2 p = uv * 12.0; vec2 i = floor(p); vec2 q = fract(p) - 0.5; float par = mod(i.x + i.y, 2.0);
  vec2 d = (par < 0.5 ? vec2(q.x + q.y, q.x - q.y) : vec2(q.x - q.y, q.x + q.y)) * 0.7071;
  float e = length(d * vec2(1.0 / 0.46, 1.0 / 0.13));
  float loz = smoothstep(1.0, 0.55, e), top = smoothstep(0.75, 0.4, e);
  float big = fbm(uv, vec2(2.0), 4, 1.0), mid = fbm(uv, vec2(16.0), 4, 2.0), fine = fbm(uv, vec2(200.0), 2, 3.0);
  float wear = smoothstep(0.3, 0.7, big);
  float grime = (1.0 - loz) * smoothstep(0.3, 0.65, fbm(uv, vec2(8.0), 4, 4.0));
  float sc = scr(uv, 20.0, 5.0, 0.02, 0.0, 6.3, 0.5);
  vec3 col = vec3(0.42, 0.43, 0.45) * (0.85 + 0.3 * (mid - 0.5));
  col = mix(col, vec3(0.68, 0.69, 0.7), top * (0.4 + 0.6 * wear));
  col = mix(col, L(0.22, 0.19, 0.16), grime * 0.8);
  float rust = smoothstep(0.7, 0.86, fbm(uv, vec2(10.0), 5, 6.0) + (fine - 0.5) * 0.12) * (1.0 - top) * (0.6 + 0.4 * fine); col = mix(col, L(0.42, 0.27, 0.16) * (0.7 + 0.6 * fine), rust);
  float r = 0.5 + (mid - 0.5) * 0.15; r = mix(r, 0.22, top * (0.4 + 0.6 * wear)); r = mix(r, 0.85, grime); r = mix(r, 0.9, rust); r -= sc * 0.1;
  float h = 0.2 + loz * 0.7 + (fine - 0.5) * 0.03 - sc * 0.03 * top;
  emit(col, 1.0, h, mix(1.0, 0.6, smoothstep(1.5, 1.0, e) * (1.0 - loz)), r, 1.0 - grime * 0.8 - rust * 0.9);
}`;
  Tn.corrugated = `
void surf(vec2 uv){
  float w = uv.x * 10.0; float cz = 0.5 + 0.5 * cos(w * TAU);
  float big = fbm(uv, vec2(2.0), 4, 1.0), fine = fbm(uv, vec2(160.0, 480.0), 2, 3.0);
  float streak = fbm(uv, vec2(40.0, 1.0), 3, 6.0), streak2 = fbm(uv, vec2(10.0, 1.0), 3, 16.0);
  float lapV = smoothstep(0.004, 0.0015, abs(uv.y - 0.012) * 2.286);
  float lapZone = smoothstep(0.32, 0.0, (uv.y - 0.012) * 2.286) * step(0.012, uv.y);       // drip end of the upper sheet
  float fi = floor(w + 0.5); float onC = step(mod(fi, 5.0), 0.5);
  float fd = length(vec2((w - fi) / 10.0 * 0.762, (uv.y - 0.5) * 2.286));
  float fast = onC * smoothstep(0.008, 0.006, fd), washer = onC * smoothstep(0.014, 0.011, fd) * (1.0 - fast);
  float rg = fbm(uv, vec2(90.0, 270.0), 3, 15.0);
  float which = smoothstep(0.45, 0.7, fbm(uv, vec2(3.0, 1.0), 3, 5.0));
  float rust = smoothstep(0.5, 0.95, lapZone * which * (0.55 + 0.9 * streak) + (rg - 0.5) * 0.22) * (0.5 + 0.5 * rg);
  vec3 col = vec3(0.43, 0.47, 0.52) * (0.9 + 0.2 * (big - 0.5)) * (0.95 + 0.1 * (streak2 - 0.5));
  col = mix(col, vec3(0.6, 0.62, 0.64), smoothstep(0.6, 0.9, streak) * 0.12);
  float dirtV = (1.0 - cz) * smoothstep(0.4, 0.75, fbm(uv, vec2(3.0, 2.0), 4, 7.0)) * 0.5;
  col = mix(col, L(0.25, 0.24, 0.22), dirtV * 0.6);
  col = mix(col, mix(L(0.24, 0.16, 0.12), L(0.42, 0.28, 0.17), rg), rust);
  col = mix(col, vec3(0.5, 0.52, 0.54), fast); col *= 1.0 - washer * 0.4;
  col *= 1.0 - lapV * 0.5;
  float h = cz * 0.9 + (fine - 0.5) * 0.008 + fast * 0.05 - lapV * 0.03;
  float r = 0.5 + (streak2 - 0.5) * 0.14 + (big - 0.5) * 0.12; r = mix(r, 0.8, dirtV); r = mix(r, 0.92, rust);
  emit(col, 1.0, h, mix(0.72, 1.0, smoothstep(0.0, 0.6, cz)) * (1.0 - lapV * 0.4), r, 0.72 * (1.0 - rust * 0.9) * (1.0 - dirtV * 0.6));
}`;
  Tn.chainlink = `
void surf(vec2 uv){
  float n = 7.0; float a = (uv.x + uv.y) * n, b = (uv.x - uv.y) * n;
  float da = abs(fract(a) - 0.5), db = abs(fract(b) - 0.5);
  float rw = 0.044;
  float over = mod(floor(a) + floor(b), 2.0) < 0.5 ? 1.0 : -1.0;
  float pa = sqrt(max(0.0, 1.0 - (da / rw) * (da / rw))), pb = sqrt(max(0.0, 1.0 - (db / rw) * (db / rw)));
  float za = over * cos((fract(b) - 0.5) * 3.14159), zb = -over * cos((fract(a) - 0.5) * 3.14159);
  float ha = da < rw ? 0.45 + 0.2 * za + 0.3 * pa : 0.0, hb = db < rw ? 0.45 + 0.2 * zb + 0.3 * pb : 0.0;
  float px = uTexel * n * 1.41421;
  float alpha = max(smoothstep(rw + px * 0.5, rw - px * 0.5, da), smoothstep(rw + px * 0.5, rw - px * 0.5, db));
  float fine = fbm(uv, vec2(120.0), 3, 1.0);
  vec3 col = vec3(0.6, 0.62, 0.64) * (0.8 + 0.3 * fine);
  float rust = smoothstep(0.62, 0.75, fbm(uv, vec2(9.0), 4, 3.0)); col = mix(col, L(0.42, 0.26, 0.15), rust * 0.8);
  emit(col, alpha, max(ha, hb), 1.0, mix(0.4 + 0.2 * fine, 0.9, rust), 1.0 - rust * 0.9);
}`;
  Tn.gunmetal = `
void surf(vec2 uv){
  float fine = fbm(uv, vec2(160.0), 3, 1.0), mid = fbm(uv, vec2(12.0), 4, 2.0), big = fbm(uv, vec2(2.0), 4, 3.0);
  vec4 g = vor(uv * 200.0, vec2(200.0), 4.0);
  float wear = smoothstep(0.66, 0.92, fbm(uv, vec2(4.0), 5, 5.0) + (fine - 0.5) * 0.1) * uP.x;
  float s1 = scr(uv, 8.0, 6.0, 0.005, 0.3, 6.3, 0.3), s2 = scr(uv, 24.0, 7.0, 0.011, 1.2, 6.3, 0.32), s3 = scr(uv, 60.0, 8.0, 0.03, 0.0, 6.3, 0.3);
  float sc = sat(max(s1 * uP.x, max(s2 * 0.8, s3 * 0.6)));
  float bright = sat(wear * 0.22 + sc * (0.3 + 0.4 * uP.x));
  float oil = smoothstep(0.4, 0.75, fbm(uv, vec2(3.0, 5.0), 4, 9.0));
  vec3 nt = vec3(0.0); float ta = 0.9 * (0.8 + 0.25 * (mid - 0.5) + 0.2 * (g.w - 0.5) + 0.15 * (big - 0.5));
  OV(vec3(0.42, 0.42, 0.44), bright * 0.6);
  float r = 0.58 + (g.w - 0.5) * 0.12 + (mid - 0.5) * 0.1 - oil * 0.14 - wear * 0.14; r = mix(r, 0.3, bright * 0.8);
  float h = 0.5 + (g.x - 0.5) * 0.12 + (fine - 0.5) * 0.1 - sc * 0.25 - wear * 0.05;
  emit(nt, ta, h, 1.0 - sc * 0.1, r, mix(0.75, 1.0, bright));
}`;
  Tn.polymer = `
void surf(vec2 uv){
  vec4 g = vor(uv * 40.0, vec2(40.0), 1.0); vec4 g2 = vor(uv * 90.0 + 0.5, vec2(90.0), 2.0);
  float fine = fbm(uv, vec2(120.0), 2, 3.0), big = fbm(uv, vec2(3.0), 4, 4.0);
  float stip = smoothstep(0.6, 0.1, g.x) * (0.5 + 0.5 * g.w) * 0.7 + smoothstep(0.6, 0.1, g2.x) * 0.3;
  float scuff = smoothstep(0.62, 0.8, fbm(uv, vec2(4.0), 5, 5.0));
  float sc = scr(uv, 10.0, 6.0, 0.01, 0.5, 6.3, 0.4);
  vec3 nt = vec3(0.0); float ta = 0.92 * (0.9 + 0.12 * (big - 0.5) + 0.08 * (fine - 0.5));
  OV(vec3(0.45), sc * 0.25 + scuff * 0.06);
  float h = 0.3 + stip * 0.6 * (1.0 - scuff * 0.6) + (fine - 0.5) * 0.05 - sc * 0.2;
  float r = 0.62 + (stip - 0.5) * 0.1 + (big - 0.5) * 0.1 - scuff * 0.22 + sc * 0.1;
  emit(nt, ta, h, 0.8 + 0.2 * stip, r, 0.0);
}`;
  Tn.carbon = `
void surf(vec2 uv){
  vec2 p = uv * 12.0; vec2 i = floor(p), q = fract(p);
  float warpTop = step(mod(i.x - i.y + 400.0, 4.0), 1.5);
  float prof = warpTop > 0.5 ? sin(q.x * 3.14159) : sin(q.y * 3.14159);
  float fib = warpTop > 0.5 ? fbm(uv, vec2(240.0, 12.0), 2, 1.0) : fbm(uv, vec2(12.0, 240.0), 2, 5.0);
  float h = 0.35 + 0.5 * pow(prof, 0.6) + (fib - 0.5) * 0.12;
  vec3 col = vec3(0.035, 0.036, 0.04) * (0.7 + 0.6 * fib) * (warpTop > 0.5 ? 1.0 : 0.8);
  float big = fbm(uv, vec2(2.0), 3, 2.0);
  emit(col, 1.0, h, 0.6 + 0.4 * prof, 0.32 + (fib - 0.5) * 0.2 + (big - 0.5) * 0.1, 0.0);
}`;
  Tn.fabric = `
void surf(vec2 uv){
  float f = 36.0; vec2 p = uv * f; vec2 i = floor(p), q = fract(p);
  float top = mod(i.x + i.y, 2.0);
  float pw = sin(q.x * 3.14159), pf = sin(q.y * 3.14159);
  float h = top > 0.5 ? pw * (0.6 + 0.4 * pf) : pf * (0.6 + 0.4 * pw) * 0.85;
  float fz = fbm(uv, vec2(150.0), 3, 1.0), big = fbm(uv, vec2(2.0), 4, 2.0);
  float thr = h3(vec2(top > 0.5 ? i.x : i.y, top), vec2(f), 3.0).x;
  float ta = 0.9 * (0.55 + 0.45 * h) * (0.85 + 0.2 * (thr - 0.5) + 0.2 * (fz - 0.5) + 0.2 * (big - 0.5));
  emit(vec3(0.0), ta, 0.2 + h * 0.7 + (fz - 0.5) * 0.15, 0.5 + 0.5 * h, 0.92, 0.0);
}`;
  Tn.armor = `
void surf(vec2 uv){
  float chip, stain, run; paintDmg(uv, 0.5, chip, stain, run);
  float fine = fbm(uv, vec2(200.0), 2, 1.0), mid = fbm(uv, vec2(14.0), 4, 2.0), big = fbm(uv, vec2(2.0), 4, 3.0);
  float grime = smoothstep(0.45, 0.8, fbm(uv, vec2(3.0, 4.0), 5, 4.0)); float sc = scr(uv, 14.0, 5.0, 0.008, 0.4, 6.3, 0.5);
  float sub = smoothstep(0.5, 0.75, chip), prim = smoothstep(0.15, 0.4, chip) * (1.0 - sub);
  vec3 nt = vec3(0.0); float ta = 0.85 * (0.92 + 0.14 * (mid - 0.5) + 0.1 * (big - 0.5));
  OV(L(0.2, 0.18, 0.15), grime * 0.07 * (0.5 + fine));
  OV(vec3(0.55), sc * 0.3);
  OV(L(0.5, 0.5, 0.47), prim);
  float wv = fbm(uv, vec2(160.0, 8.0), 2, 6.0);
  OV(L(0.4, 0.38, 0.33) * (0.6 + 0.8 * wv), sub);
  float h = 0.6 + (fine - 0.5) * 0.04 + (mid - 0.5) * 0.03 - prim * 0.1 - sub * 0.25 - sc * 0.08;
  float r = 0.36 + (mid - 0.5) * 0.1 + grime * 0.1 + sc * 0.15; r = mix(r, 0.6, prim); r = mix(r, 0.75, sub);
  emit(nt, ta, h, 1.0 - sub * 0.2, r, 0.0);
}`;
  Tn.wood = `
void surf(vec2 uv){
  vec4 kv = vor(uv * vec2(2.0, 4.0), vec2(2.0, 4.0), 1.0); float isK = step(kv.z, 0.3);
  float knot = isK * smoothstep(0.2, 0.0, length((kv.x) * vec2(1.0))), core = isK * smoothstep(0.05, 0.03, kv.x);
  float wob = fbm(uv, vec2(1.0, 3.0), 3, 2.0);
  float ring = fract(uv.y * 44.0 + (wob - 0.5) * 2.4 + knot * knot * 4.0 + (fbm(uv, vec2(4.0, 30.0), 2, 12.0) - 0.5) * 0.35);
  float late = smoothstep(0.5, 0.92, ring) * (1.0 - smoothstep(0.92, 1.0, ring));
  float fib = fbm(uv, vec2(3.0, 260.0), 3, 3.0), fib2 = fbm(uv, vec2(8.0, 90.0), 3, 4.0);
  float saw = 0.5 + 0.5 * sin((uv.x + 0.02 * sin(uv.y * TAU * 2.0)) * TAU * 240.0);
  float sawK = smoothstep(0.35, 0.7, fbm(uv, vec2(3.0), 3, 5.0));
  float grey = smoothstep(0.2, 0.68, fbm(uv, vec2(2.0, 3.0), 5, 6.0));
  float crack = smoothstep(0.84, 0.87, fbm(uv, vec2(2.0, 110.0), 3, 7.0)) * smoothstep(0.45, 0.65, fbm(uv, vec2(5.0, 3.0), 3, 8.0));
  vec3 early = L(0.58, 0.49, 0.38), lateC = L(0.36, 0.28, 0.2);
  float bigv = fbm(uv, vec2(1.0, 2.0), 3, 21.0);
  vec3 col = mix(early, lateC, late * 0.9) * (0.85 + 0.6 * (fib - 0.5) + 0.4 * (fib2 - 0.5)) * (0.78 + 0.44 * bigv);
  col = mix(col, lateC * 0.8, knot * 0.5); col = mix(col, L(0.28, 0.17, 0.09), core);
  col = mix(col, L(0.47, 0.465, 0.45) * (0.7 + 0.6 * fib) * (1.0 - late * 0.3), grey * 0.82);
  float dirt = smoothstep(0.55, 0.85, fbm(uv, vec2(4.0), 5, 9.0)); col *= 1.0 - dirt * 0.35;
  col *= 1.0 - crack * 0.55;
  float h = 0.5 + (fib - 0.5) * 0.4 + (late - 0.5) * 0.2 - (saw - 0.5) * 0.12 * sawK + (fib2 - 0.5) * 0.15 - crack * 0.3 + core * 0.05;
  emit(col, 1.0, h, 1.0 - crack * 0.5, 0.82 + (fib - 0.5) * 0.15 + grey * 0.08 - core * 0.15, 0.0);
}`;
  Tn.plastic = `
void surf(vec2 uv){
  float fine = fbm(uv, vec2(220.0), 3, 1.0), mid = fbm(uv, vec2(14.0), 4, 2.0), big = fbm(uv, vec2(2.0), 4, 3.0);
  float scuff = smoothstep(0.55, 0.75, fbm(uv, vec2(5.0, 8.0), 5, 4.0));
  float s1 = scr(uv, 7.0, 5.0, 0.005, 0.2, 6.3, 0.35), s2 = scr(uv, 22.0, 6.0, 0.012, 1.0, 6.3, 0.3), s3 = scr(uv, 50.0, 7.0, 0.03, 2.0, 6.3, 0.25);
  float sc = sat(max(s1, max(s2 * 0.8, s3 * 0.5)));
  float dirt = smoothstep(0.5, 0.85, fbm(uv, vec2(3.0), 5, 8.0));
  vec3 nt = vec3(0.0); float ta = 0.9 * (0.92 + 0.1 * (mid - 0.5) + 0.1 * (big - 0.5));
  OV(vec3(0.6), sc * 0.22 + scuff * 0.03 * fine);
  OV(L(0.25, 0.22, 0.18), dirt * 0.4);
  float h = 0.5 + (fine - 0.5) * 0.12 + (mid - 0.5) * 0.04 - sc * 0.25;
  emit(nt, ta, h, 1.0, 0.42 + (fine - 0.5) * 0.08 + scuff * 0.2 + sc * 0.2 + dirt * 0.2, 0.0);
}`;
  Tn.tarp = `
void surf(vec2 uv){
  vec2 wu = uv + (vec2(fbm(uv, vec2(2.0), 3, 1.0), fbm(uv, vec2(2.0), 3, 2.0)) - 0.5) * 0.12;
  float f1 = 1.0 - abs(gn(wu * vec2(2.0, 7.0), vec2(2.0, 7.0), 3.0)) * 2.4;        // long drape folds
  float f2 = 1.0 - abs(gn(wu * vec2(5.0, 13.0) + 2.0, vec2(5.0, 13.0), 4.0)) * 2.4; // finer wrinkles
  f1 = smoothstep(0.0, 1.0, sat(f1)); f2 = smoothstep(0.2, 1.0, sat(f2));
  float bill = fbm(wu, vec2(2.0, 3.0), 3, 5.0);
  float scrim = max(smoothstep(0.42, 0.5, abs(fract(uv.x * 200.0) - 0.5)), smoothstep(0.42, 0.5, abs(fract(uv.y * 200.0) - 0.5)));
  float fine = fbm(uv, vec2(240.0), 2, 6.0), mid = fbm(uv, vec2(14.0), 4, 7.0);
  float h = 0.25 + bill * 0.35 + f1 * 0.22 + f2 * 0.07 + scrim * 0.02 + (fine - 0.5) * 0.012;
  float dirt = smoothstep(0.5, 0.85, fbm(uv, vec2(4.0), 5, 8.0) + (0.5 - f1) * 0.08);
  vec3 nt = vec3(0.0); float ta = 0.9 * (0.88 + 0.14 * (mid - 0.5)) * (1.0 - scrim * 0.06);
  OV(vec3(0.5), smoothstep(0.85, 1.0, f1) * 0.03);
  OV(L(0.3, 0.27, 0.22), dirt * 0.3);
  emit(nt, ta, h, 0.9 + 0.1 * smoothstep(0.1, 0.7, f1), 0.48 + (mid - 0.5) * 0.15 + dirt * 0.25, 0.0);
}`;
  Tn.cardboard = `
void surf(vec2 uv){
  float fl = 0.5 + 0.5 * cos(uv.y * TAU * 140.0);
  float fib = fbm(uv, vec2(40.0, 160.0), 3, 1.0), fine = fbm(uv, vec2(250.0), 2, 2.0), big = fbm(uv, vec2(2.0), 4, 3.0);
  float sn = fbm(uv, vec2(3.0), 5, 4.0); float damp = smoothstep(0.62, 0.72, sn); float tide = smoothstep(0.61, 0.64, sn) * (1.0 - smoothstep(0.64, 0.7, sn));
  float crease = smoothstep(0.012, 0.004, abs(fbm(uv, vec2(2.0), 2, 5.0) - 0.5)) * smoothstep(0.5, 0.7, fbm(uv, vec2(3.0), 2, 6.0));
  vec3 col = L(0.66, 0.52, 0.36) * (0.85 + 0.2 * (fib - 0.5) + 0.12 * (fine - 0.5) + 0.2 * (big - 0.5)) * (0.97 + 0.06 * fl);
  col *= (1.0 - damp * 0.3) * (1.0 - tide * 0.18); col = mix(col, col * 1.25, crease * 0.5);
  col *= 1.0 - smoothstep(0.8, 0.9, fbm(uv, vec2(120.0), 2, 7.0)) * 0.2;
  float h = 0.5 + (fl - 0.5) * 0.12 + (fib - 0.5) * 0.15 + (fine - 0.5) * 0.08 - crease * 0.3 + damp * 0.2 * (fbm(uv, vec2(20.0), 3, 8.0) - 0.5);
  emit(col, 1.0, h, 1.0 - crease * 0.3, 0.9 - damp * 0.2 + (fib - 0.5) * 0.1, 0.0);
}`;
  Tn.rope = `
void surf(vec2 uv){
  float a = (uv.x + uv.y) * 4.0; float prof = sin(fract(a) * 3.14159);
  float fib = fbm(uv, vec2(60.0), 3, 1.0);
  float yarn = 0.5 + 0.5 * sin((uv.x - uv.y) * 4.0 * TAU * 5.0 + 2.0 * sin(a * TAU));
  float h = pow(prof, 0.7) * 0.8 + yarn * 0.1 + (fib - 0.5) * 0.15;
  vec3 col = L(0.66, 0.6, 0.46) * (0.6 + 0.4 * prof) * (0.85 + 0.3 * (fib - 0.5)) * (0.92 + 0.16 * yarn);
  float dirt = smoothstep(0.4, 0.8, fbm(uv, vec2(3.0), 4, 2.0)); col = mix(col, L(0.25, 0.22, 0.18), dirt * 0.5 * (1.0 - prof * 0.5));
  emit(col, 1.0, h, 0.45 + 0.55 * prof, 0.95, 0.0);
}`;
  Tn.tire = `
void surf(vec2 uv){
  float sv = fract(uv.y + 0.5) - 0.5; float v = abs(sv) * 2.0; float u = uv.x;
  float zig = 0.03 * abs(fract(u * 10.0) - 0.5) * 2.0;
  float g1 = smoothstep(0.035, 0.02, abs(v - 0.36 - zig)), g0 = smoothstep(0.03, 0.018, abs(v - zig * 0.5));
  float lat = smoothstep(0.06, 0.03, abs(fract(u * 10.0 + v * 1.2 * sign(sv)) - 0.5)) * step(0.4, v) * step(v, 0.8);
  float sipe = smoothstep(0.012, 0.005, abs(fract(u * 20.0 + v * 0.8) - 0.5)) * step(0.05, v) * step(v, 0.33);
  float groove = sat(max(max(g0, g1), max(lat, sipe * 0.6)));
  float side = smoothstep(0.84, 0.9, v);
  float rib = (0.5 + 0.5 * cos(v * TAU * 14.0)) * side;
  float fine = fbm(uv, vec2(200.0, 120.0), 3, 1.0), mid = fbm(uv, vec2(10.0, 6.0), 4, 2.0);
  float h = (1.0 - groove) * (1.0 - side) * 0.8 + side * (0.35 + rib * 0.1) + (fine - 0.5) * 0.04;
  float dust = smoothstep(0.4, 0.75, fbm(uv, vec2(4.0, 3.0), 5, 3.0));
  vec3 col = vec3(0.022) * (0.8 + 0.5 * (mid - 0.5)); col = mix(col, L(0.22, 0.2, 0.17), dust * 0.25 + groove * (1.0 - side) * 0.2);
  emit(col, 1.0, h, 1.0 - groove * 0.5 * (1.0 - side), 0.85 + (fine - 0.5) * 0.1 - side * 0.1, 0.0);
}`;
  Tn.glass = `
void surf(vec2 uv){
  float d = uP.x;
  float big = fbm(uv, vec2(2.0), 5, 1.0), mid = fbm(uv, vec2(12.0), 4, 2.0), fine = fbm(uv, vec2(200.0), 2, 3.0);
  float dust = sat(smoothstep(0.75 - 0.45 * d, 0.95 - 0.3 * d, big * 0.7 + mid * 0.3) + fine * 0.15 * d);
  float st2 = fbm(uv, vec2(120.0, 3.0), 2, 5.0);
  float trail = smoothstep(0.62, 0.72, fbm(uv, vec2(50.0, 1.0), 2, 4.0)) * smoothstep(0.3, 0.6, fbm(uv, vec2(50.0, 2.0), 2, 6.0));
  vec4 dv = vor(uv * 60.0, vec2(60.0), 7.0); float drop = step(dv.z, 0.45) * smoothstep(0.32 * dv.w + 0.06, 0.0, dv.x);
  vec4 dv2 = vor(uv * 150.0, vec2(150.0), 8.0); float drop2 = step(dv2.z, 0.5) * smoothstep(0.3 * dv2.w + 0.05, 0.0, dv2.x);
  dust *= 1.0 - trail * 0.7;
  vec3 col = mix(L(0.5, 0.6, 0.62) * 0.25, L(0.5, 0.47, 0.4), dust);
  float alpha = mix(0.16, 0.55 + 0.35 * d, dust) + drop * 0.08 + (st2 - 0.5) * 0.05 * d;
  float h = 0.3 + drop * 0.5 + drop2 * 0.15 + trail * 0.06 * st2;
  float r = mix(0.03, 0.55, dust); r = mix(r, 0.03, sat(drop * 2.0));
  emit(col, alpha, h, 1.0, r, 0.0);
}`;
  Tn.water = `
void surf(vec2 uv){
  float a = fbm(uv, vec2(6.0, 10.0), 4, 1.0), b = fbm(uv + 0.3, vec2(20.0, 30.0), 3, 2.0);
  emit(L(0.1, 0.16, 0.18) * 0.5, 1.0, 0.5 + (a - 0.5) * 0.6 + (b - 0.5) * 0.2, 1.0, 0.06, 0.0);
}`;
  var i3 = `
precision highp float;
uniform sampler2D tH; uniform vec2 uK; uniform float uTexel; in vec2 vUv; out vec4 o;
float H(vec2 uv){ vec4 t = texture(tH, uv); return t.r + t.g / 255.0; }
void main(){
  vec2 e = vec2(uTexel, 0.0);
  float l = H(vUv - e.xy), r = H(vUv + e.xy), d = H(vUv - e.yx), u = H(vUv + e.yx);
  float ld = H(vUv - e.xx), rd = H(vUv + vec2(e.x, -e.x)), lu = H(vUv + vec2(-e.x, e.x)), ru = H(vUv + e.xx);
  float gx = (r - l) * 0.5 + (ru + rd - lu - ld) * 0.25, gy = (u - d) * 0.5 + (ru + lu - rd - ld) * 0.25;
  vec3 n = normalize(vec3(-gx * uK.x, -gy * uK.y, 1.0));
  o = vec4(n * 0.5 + 0.5, 1.0);
}`,
    s3 = `
precision highp float;
uniform sampler2D tA; uniform float uSq; in vec2 vUv; out vec4 o;
void main(){ vec4 t = texture(tA, vUv); o = uSq > 0.5 ? vec4(t.rgb * t.rgb, t.a) : t; }`;
  var o3 =
      '"PingFang SC", "PingFang SC", "PingFang SC", Impact, "PingFang SC", Arial, sans-serif',
    r3 = '"PingFang SC", "PingFang SC", "PingFang SC", Arial, sans-serif',
    oA = '"PingFang SC", "PingFang SC", Menlo, Consolas, monospace',
    Ut = {
      white: [226, 223, 213],
      black: [24, 24, 26],
      yellow: [222, 172, 30],
      red: [168, 36, 28],
      navy: [24, 38, 58],
      orange: [206, 100, 30],
    },
    An = (i, e = 1) => `rgba(${i[0]},${i[1]},${i[2]},${e})`,
    rA = new Set(["I", "1", " ", "-", ".", "/", ":", ",", "'", "!", "\xB7"]);
