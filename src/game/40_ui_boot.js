/* SALTLINE · game part 6/6 — 菜单与启动
   设置/菜单、固定步循环、启动 QC 与测试入口。
   片段：由 tools/build.cjs 按 src/game/manifest.json 顺序拼接，不单独执行。 */
  var fM = "saltline.settings.v1",
    XC = { quality: "auto", sens: 1, invertY: !1, volume: 0.8, fov: Pi.fov },
    dM = ["auto", "low", "medium", "high", "ultra"];
  function YC() {
    let i = { ...XC };
    try {
      let e = JSON.parse(localStorage.getItem(fM) || "null");
      e &&
        typeof e == "object" &&
        ((e.quality === "auto" || dM.includes(e.quality)) &&
          (i.quality = e.quality),
        Number.isFinite(e.sens) &&
          (i.sens = Math.min(3, Math.max(0.2, e.sens))),
        (i.invertY = !!e.invertY),
        Number.isFinite(e.volume) &&
          (i.volume = Math.min(1, Math.max(0, e.volume))),
        Number.isFinite(e.fov) && (i.fov = Math.min(95, Math.max(60, e.fov))));
    } catch {}
    return i;
  }
  function Wf(i) {
    try {
      localStorage.setItem(fM, JSON.stringify(i));
    } catch {}
  }
  var $C = `
  <dl class="keys">
    <div><dt>移动</dt><dd><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></dd></div>
    <div><dt>视角</dt><dd>鼠标</dd></div>
    <div><dt>开火</dt><dd>鼠标左键</dd></div>
    <div><dt>瞄准</dt><dd>鼠标右键</dd></div>
    <div><dt>换弹</dt><dd><kbd>R</kbd></dd></div>
    <div><dt>切断中继</dt><dd>按住 <kbd>E</kbd></dd></div>
    <div><dt>跳跃</dt><dd><kbd>Space</kbd></dd></div>
    <div><dt>冲刺</dt><dd><kbd>Shift</kbd></dd></div>
    <div><dt>蹲伏</dt><dd><kbd>C</kbd> 或 <kbd>Ctrl</kbd></dd></div>
    <div><dt>近战</dt><dd><kbd>F</kbd> 或 <kbd>V</kbd></dd></div>
    <div><dt>切换武器</dt><dd><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd></dd></div>
    <div><dt>投掷手雷</dt><dd>按住 <kbd>G</kbd> 预览弹道，松开投掷</dd></div>
    <div><dt>战术扫描</dt><dd><kbd>Q</kbd></dd></div>
    <div><dt>暂停</dt><dd><kbd>Esc</kbd> 或 <kbd>P</kbd></dd></div>
  </dl>`,
    ZC = `
  <dl class="keys">
    <div><dt>移动</dt><dd>左手拇指在左侧任意位置滑动</dd></div>
    <div><dt>视角</dt><dd>在屏幕右侧拖动</dd></div>
    <div><dt>开火</dt><dd>按住“开火”，拖动跟踪目标</dd></div>
    <div><dt>瞄准</dt><dd>点击“瞄准”切换瞄准状态</dd></div>
    <div><dt>换弹</dt><dd>换弹</dd></div>
    <div><dt>跳跃</dt><dd>跳跃</dd></div>
    <div><dt>切断中继</dt><dd>靠近中继并按住“交互”</dd></div>
    <div><dt>冲刺</dt><dd>将摇杆推到最前方</dd></div>
  </dl>`;
  function pM(i, e) {
    let t = document.getElementById("ui"),
      n = YC(),
      s = document.createElement("div");
    (s.className = "menu"),
      (s.dataset.screen = "none"),
      (s.innerHTML = `
    <div class="m-veil"></div>
    <div class="m-bars"><i></i><i></i></div>

    <section class="m-screen m-title" data-s="title" aria-label="几猫">
      <div class="m-title-main">
        <div class="m-eyebrow"><span class="m-tag">B4</span><span>几猫突击小队</span><span class="m-dim">几猫港区 · 05:42</span></div>
        <h1 class="m-word">几猫<span class="m-subtitle">3A大作</span></h1>
        <p class="m-premise">港区防御系统失控。切断三处中继，突破封锁，登船撤离。</p>
        <div class="m-actions">
          <button class="btn primary" data-act="deploy">开始行动</button>
          <button class="btn" data-act="settings">设置</button>
          <button class="btn" data-act="about">项目介绍</button>
          <button class="btn m-only-narrow" data-act="controls">操作说明</button>
        </div>
        <p class="m-note">使用 Fable5.2 自主研发 · 国产第一人称射击游戏 · 开发体验版</p>
      </div>
      <aside class="m-legend" aria-label="操作速览">
        <div><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 移动</span><span><kbd>鼠标</kbd> 视角</span><span><kbd>左键</kbd> 开火</span><span><kbd>右键</kbd> 瞄准</span><span><kbd>R</kbd> 换弹</span></div>
        <div><span><kbd>E</kbd> 切断中继</span><span><kbd>Space</kbd> 跳跃</span><span><kbd>Shift</kbd> 冲刺</span><span><kbd>C</kbd> 蹲伏</span><span><kbd>Esc</kbd> 暂停</span></div>
        <div><span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> 换枪</span><span>按住 <kbd>G</kbd> 手雷弹道</span><span><kbd>Q</kbd> 战术扫描</span><span><kbd>V</kbd> 近战</span></div>
        <div class="lg-touch"><em>触屏操作</em><span>左手拇指移动</span><span>右手拇指转动视角</span><span>屏幕按钮：开火 · 瞄准 · 换弹 · 跳跃</span></div>
      </aside>
    </section>

    <section class="m-screen m-card" data-s="paused" aria-label="已暂停">
      <div class="m-k">行动暂时中止</div>
      <h2 class="m-h">已暂停</h2>
      <p class="m-line" data-f="lookmode"></p>
      <div class="m-actions col">
        <button class="btn primary" data-act="resume">继续游戏</button>
        <button class="btn" data-act="settings">设置</button>
        <button class="btn" data-act="controls">操作说明</button>
        <button class="btn" data-act="restart">重新开始任务</button>
      </div>
    </section>

    <section class="m-screen m-card m-dead" data-s="dead" aria-label="信号中断">
      <div class="m-k">突击队员倒下</div>
      <h2 class="m-h">信号中断</h2>
      <dl class="m-stats"><div><dt>生存时间</dt><dd data-f="dead-time">00:00</dd></div><div><dt>已切断中继</dt><dd data-f="dead-relays">0/3</dd></div></dl>
      <div class="m-actions col"><button class="btn primary" data-act="retry">重试</button></div>
    </section>

    <section class="m-screen m-card m-debrief" data-s="complete" aria-label="行动简报">
      <div class="m-k">四号泊位 · 行动简报</div>
      <h2 class="m-h">几猫港区已解除封锁</h2>
      <div class="m-rating"><span>行动评级</span><b data-f="rating">干净利落</b></div>
      <dl class="m-stats">
        <div><dt>用时</dt><dd data-f="time">00:00</dd></div>
        <div><dt>命中率</dt><dd data-f="acc">0%</dd></div>
        <div><dt>摧毁机械</dt><dd data-f="kills">0</dd></div>
        <div><dt>重试次数</dt><dd data-f="retries">0</dd></div>
      </dl>
      <div class="m-actions col"><button class="btn primary" data-act="redeploy">再次出击</button></div>
    </section>

    <div class="panel" role="dialog" aria-modal="true" aria-label="设置与操作" tabindex="-1" hidden>
      <header class="panel-h">
        <div class="tabs" role="tablist">
          <button class="tab" role="tab" data-tab="settings" aria-selected="true">设置</button>
          <button class="tab" role="tab" data-tab="controls" aria-selected="false">操作说明</button>
        <button class="tab" role="tab" data-tab="about" aria-selected="false">项目介绍</button>
        </div>
        <button class="btn small" data-act="close-panel">关闭</button>
      </header>
      <div class="panel-b about-copy" data-pane="about" hidden>
        <h3>几猫3A大作</h3>
        <p>各位老师、同学好！宣传一下我们最近使用 Fable5.2 自主研发的一款国产 3A FPS 大作——<strong>《几猫》</strong>！🎮</p>
        <p>我们致力于打造具有中国特色的高品质第一人称射击游戏，融合沉浸式战斗体验、创新玩法与次世代视觉表现，探索国产 FPS 游戏的更多可能性。</p>
        <p>目前项目仍在持续开发与优化中，距离国际顶尖 3A 水准还有一定差距。</p>
        <p>非常欢迎各位老师、同学关注、体验并提出宝贵建议，期待与游戏开发、图形学及 AI 方向的朋友深入交流！🐱🔥</p>
      </div>
      <div class="panel-b" data-pane="settings">
        <div class="row"><label id="l-q">画面质量</label>
          <div class="seg" role="group" aria-labelledby="l-q">${dM.map((U) => `<button data-q="${U}" aria-pressed="false">${{ auto: "自动", low: "低", medium: "中", high: "高", ultra: "极高" }[U]}</button>`).join("")}</div></div>
        <div class="row"><label for="s-sens">鼠标灵敏度</label><div class="slider"><input id="s-sens" type="range" min="0.2" max="3" step="0.05"><output data-o="sens"></output></div></div>
        <div class="row"><label id="l-inv">反转垂直视角</label><button class="toggle" data-act="invert" aria-labelledby="l-inv" aria-pressed="false"><i></i><span>关闭</span></button></div>
        <div class="row"><label for="s-vol">主音量</label><div class="slider"><input id="s-vol" type="range" min="0" max="100" step="1"><output data-o="vol"></output></div></div>
        <div class="row"><label for="s-fov">视野范围</label><div class="slider"><input id="s-fov" type="range" min="60" max="95" step="1"><output data-o="fov"></output></div></div>
        <div class="row" data-row="fs"><label id="l-fs">显示模式</label><button class="btn small" data-act="fullscreen" aria-labelledby="l-fs fs-t"><span id="fs-t">进入全屏</span></button></div>
        <p class="panel-note" data-f="qnote"></p>
      </div>
      <div class="panel-b" data-pane="controls" hidden>
        <h3>键盘 · 鼠标</h3>${$C}
        <p class="panel-note">若浏览器无法捕获鼠标，按住鼠标按钮并拖动以调整视角（左键同时开火，右键同时瞄准）。方向键或 <kbd>I</kbd><kbd>J</kbd><kbd>K</kbd><kbd>L</kbd> 转向，<kbd>Enter</kbd> 开火。</p>
        <h3>触屏操作</h3>${ZC}
        <h3>手柄</h3>
        <p class="panel-note">摇杆移动与转动视角 · RT 开火 · LT 瞄准 · A 跳跃 · B 蹲伏 · X 换弹 · Y 切断中继 · L3 冲刺 · Start 暂停。</p>
      </div>
    </div>

    <div class="loc-card" aria-hidden="true"><i></i><b>几猫港区 · 四号泊位 · 05:42</b><span>几猫突击小队 · 单兵行动，无人支援</span></div>
  `),
      t.appendChild(s);
    let o = (U) => s.querySelector(U),
      r = (U) => [...s.querySelectorAll(U)],
      a = o(".panel"),
      l = o(".loc-card"),
      c = (U) => s.querySelector(`[data-f="${U}"]`),
      u = o("#s-sens"),
      h = o("#s-vol"),
      f = o("#s-fov"),
      p = "none",
      d = null;
    function v(U) {
      // V41 P2-2：只有“自动”画质才允许渲染器自动升/降档；手动档与
      // ?q= / ?shot 测试参数必须保持确定性。
      i.autoQuality =
        n.quality === "auto" &&
        !i.params.q &&
        !i.params.shot &&
        i.params.dynres !== "0";
      if (
        ((!U || U === "sens") && (i.input.sensitivity = n.sens),
        (!U || U === "invertY") && (i.input.invertY = n.invertY),
        !U || U === "volume")
      )
        try {
          i.audio && i.audio.setVolume && i.audio.setVolume(n.volume);
        } catch (T) {
          console.error(T);
        }
      if (
        ((!U || U === "fov") &&
          i.player &&
          i.player.setFov &&
          i.player.setFov(n.fov),
        U === "quality" ||
          (!U &&
            n.quality !== "auto" &&
            !i.params.shot &&
            !i.params.q &&
            n.quality !== (i.quality && i.quality.name)))
      ) {
        // V50：允许在设置里重新选回“自动”；自动档按当前设备重新探测
        let T = n.quality === "auto" ? zy("") : Pr[n.quality];
        if (T)
          try {
            i.render && i.render.setQuality
              ? i.render.setQuality({ ...T })
              : (i.quality = { ...T });
          } catch (D) {
            console.error("[game] setQuality failed", D);
          }
      }
    }
    function g() {
      let U = n.quality;
      for (let D of r(".seg button"))
        D.setAttribute("aria-pressed", String(D.dataset.q === U));
      (u.value = n.sens),
        (h.value = Math.round(n.volume * 100)),
        (f.value = n.fov),
        (o('[data-o="sens"]').textContent = n.sens.toFixed(2) + "\xD7"),
        (o('[data-o="vol"]').textContent = Math.round(n.volume * 100) + "%"),
        (o('[data-o="fov"]').textContent = Math.round(n.fov) + "\xB0");
      let T = o('[data-act="invert"]');
      T.setAttribute("aria-pressed", String(n.invertY)),
        (T.querySelector("span").textContent = n.invertY ? "开启" : "关闭"),
        (c("qnote").textContent =
          n.quality === "auto"
            ? `已根据设备自动选择画质（${{ low: "低", medium: "中", high: "高", ultra: "极高" }[i.quality && i.quality.name] || "默认"}），运行不流畅时可降低画质。`
            : "画质设置立即生效；阴影和反射需要片刻重新生成。");
    }
    u.addEventListener("input", () => {
      (n.sens = +u.value), v("sens"), g(), Wf(n);
    }),
      h.addEventListener("input", () => {
        (n.volume = +h.value / 100), v("volume"), g(), Wf(n);
      }),
      f.addEventListener("input", () => {
        (n.fov = +f.value), v("fov"), g(), Wf(n);
      });
    let x = o('[data-row="fs"]'),
      y = o("#fs-t"),
      b = () =>
        document.fullscreenElement || document.webkitFullscreenElement || null,
      m = document.getElementById("app") || document.documentElement;
    (m &&
      (m.requestFullscreen || m.webkitRequestFullscreen) &&
      document.fullscreenEnabled !== !1 &&
      document.webkitFullscreenEnabled !== !1) ||
      (x.hidden = !0);
    function _() {
      y.textContent = "当前环境不支持全屏";
    }
    function M() {
      try {
        if (b()) {
          (document.exitFullscreen || document.webkitExitFullscreen).call(
            document,
          );
          return;
        }
        let U = (m.requestFullscreen || m.webkitRequestFullscreen).call(m);
        U && U.catch && U.catch(_);
      } catch {
        _();
      }
    }
    let E = () => {
      y.textContent = b() ? "退出全屏" : "进入全屏";
    };
    document.addEventListener("fullscreenchange", E),
      document.addEventListener("webkitfullscreenchange", E);
    function w(U) {
      (d = document.activeElement),
        (a.hidden = !1),
        s.classList.add("panel-open"),
        z(U || "settings");
      try {
        a.focus({ preventScroll: !0 });
      } catch {}
    }
    function S() {
      return a.hidden
        ? !1
        : ((a.hidden = !0),
          s.classList.remove("panel-open"),
          d && d.focus && s.contains(d) ? d.focus() : H(),
          !0);
    }
    function z(U) {
      for (let T of r(".tab"))
        T.setAttribute("aria-selected", String(T.dataset.tab === U));
      for (let T of r(".panel-b")) T.hidden = T.dataset.pane !== U;
    }
    function H() {
      let U = s.querySelector(`.m-screen[data-s="${p}"] .btn.primary`);
      if (U)
        try {
          U.focus({ preventScroll: !0 });
        } catch {}
    }
    s.addEventListener("click", (U) => {
      let T = U.target.closest("button");
      if (!T || !s.contains(T)) return;
      if ((i.events.emit("ui:click", {}), T.dataset.q)) {
        (n.quality = T.dataset.q), v("quality"), g(), Wf(n);
        return;
      }
      if (T.dataset.tab) {
        z(T.dataset.tab);
        return;
      }
      let D = T.dataset.act;
      D === "about"
        ? w("about")
        : D === "settings"
          ? w("settings")
          : D === "controls"
            ? w("controls")
            : D === "close-panel"
              ? S()
              : D === "invert"
                ? ((n.invertY = !n.invertY), v("invertY"), g(), Wf(n))
                : D === "fullscreen"
                  ? M()
                  : D && e[D] && e[D](U);
    }),
      s.addEventListener("mouseover", (U) => {
        let T = U.target.closest("button");
        T &&
          U.relatedTarget &&
          !T.contains(U.relatedTarget) &&
          i.events.emit("ui:hover", {});
      }),
      s.addEventListener("keydown", (U) => {
        if (
          (U.code === "Escape" &&
            !a.hidden &&
            (S(), U.stopPropagation(), U.preventDefault()),
          U.code === "Tab" && !a.hidden)
        ) {
          let T = [...a.querySelectorAll("button, input")].filter(
            (G) => G.offsetParent !== null,
          );
          if (!T.length) return;
          let D = T[0],
            C = T[T.length - 1];
          U.shiftKey && document.activeElement === D
            ? (C.focus(), U.preventDefault())
            : !U.shiftKey &&
              document.activeElement === C &&
              (D.focus(), U.preventDefault());
        }
      });
    let O = (U) => (
        (U = Math.max(0, Math.floor(U))),
        String(Math.floor(U / 60)).padStart(2, "0") +
          ":" +
          String(U % 60).padStart(2, "0")
      ),
      q = {
        root: s,
        settings: n,
        fmtTime: O,
        get screen() {
          return p;
        },
        get panelOpen() {
          return !a.hidden;
        },
        closePanel: S,
        show(U) {
          U !== p &&
            ((p = U),
            (s.dataset.screen = U),
            S(),
            s.classList.toggle("open", U !== "none"),
            U !== "none"
              ? (g(), setTimeout(H, 30))
              : document.activeElement &&
                s.contains(document.activeElement) &&
                document.activeElement.blur());
        },
        locationCard(U) {
          l.classList.toggle("on", !!U);
        },
        setLookMode(U) {
          c("lookmode").textContent = U || "";
        },
        setDead({ time: U, relays: T, total: D }) {
          (c("dead-time").textContent = O(U)),
            (c("dead-relays").textContent = `${T}/${D}`);
        },
        setDebrief({ time: U, accuracy: T, kills: D, retries: C, rating: G }) {
          (c("time").textContent = O(U)),
            (c("acc").textContent =
              T == null ? "\u2014" : Math.round(T * 100) + "%"),
            (c("kills").textContent = String(D)),
            (c("retries").textContent = String(C)),
            (c("rating").textContent = G);
        },
        applySettings: v,
      };
    return g(), q;
  }
  // V42：任务节奏/波次/追击参数来自 src/config/balance.js
  var Yi = window.SX_BALANCE.mission,
    jC = [
      "北方",
      "东北方",
      "东方",
      "东南方",
      "南方",
      "西南方",
      "西方",
      "西北方",
    ],
    _l = {
      intro:
        "几猫队员，这里是指挥中心。港区主控已封锁泊位。切断堆场、仓库、码头的三处中继。",
      contact: "你已被发现！空中有机械飞鸥，地面有机械猎犬。消灭它们。",
      cut: [
        "第一处中继已断开。敌方已察觉，机械守卫正在赶来。",
        "第二处中继已断开。敌方正全力围攻，小心应对。",
      ],
      all: "三处中继全部断开！撤离艇在码头南端的舷梯旁，快撤！",
      low: "伤势严重！找掩体躲避，稍作恢复。",
      done: "几猫队员已登船，港区封锁解除。干得漂亮！",
    };
  function mM(i) {
    let e = (i.render && i.render.post) || {},
      t = typeof e.saturation == "number" ? e.saturation : 1,
      n = i.player,
      s = i.level,
      o = i.hud,
      r = i.input,
      a = (P, V, ...Y) => {
        try {
          if (P && typeof P[V] == "function") return P[V](...Y);
        } catch (L) {
          console.error(`[game] ${V} threw`, L);
        }
      },
      l = pM(i, {
        deploy() {
          a(i.audio, "resume"), r.requestLock(), U({});
        },
        resume() {
          j(!0);
        },
        restart() {
          a(i.audio, "resume"),
            r.requestLock(),
            c.retries++,
            U({ quick: !0, keepRetries: !0 });
        },
        retry() {
          a(i.audio, "resume"),
            r.requestLock(),
            c.retries++,
            U({ quick: !0, keepRetries: !0 });
        },
        redeploy() {
          a(i.audio, "resume"), r.requestLock(), U({ quick: !0 });
        },
      });
    l.applySettings();
    let c = {
        time: 0,
        retries: 0,
        relays: [],
        cut: 0,
        allCut: !1,
        queue: [],
        waveHot: 0,
        alertT: 0,
        pursuitT: 0,
        pursuitLeft: 0,
        contactSaid: !1,
        lowSaid: !1,
        extractHint: 0,
        evacT: 0,
        bossAlive: !1,
        intensity: 0.15,
        used: new Map(),
      },
      u = 0,
      h = Yi.introSeconds,
      f = !1,
      p = !1,
      d = 0,
      v = 0,
      g = !1,
      x = "",
      y = 0.8,
      b = new W(),
      m = new W(),
      A = () => (s && s.objectives) || [],
      _ = {
        state: "title",
        flow: Yi,
        run: c,
        menus: l,
        start(P = {}) {
          U({ skipIntro: !!P.skipIntro, quick: !!P.quick });
        },
        pause() {
          G();
        },
        resume() {
          j(!1);
        },
        update: B,
        debugCut() {
          let P = c.relays.find((V) => !V.cut);
          P && me(P);
        },
      };
    function M(P) {
      let V = _.state;
      P !== V &&
        ((_.state = P),
        (u = 0),
        i.events.emit("game:state", { state: P, prev: V }));
    }
    let E = { pos: [], look: [], len: 1, t: 0 };
    function w() {
      let P = (s && s.cinematicPath) || [];
      if (
        ((E.pos = P.map((Y) => new W(...Y.pos))),
        (E.look = P.map((Y) => new W(...Y.look))),
        E.pos.length < 2)
      ) {
        let Y = (s && s.playerStart && s.playerStart.pos) || new W();
        (E.pos = [new W(Y.x, 2.2, Y.z), new W(Y.x + 8, 2, Y.z)]),
          (E.look = [
            new W(Y.x + 30, 2.5, Y.z - 2),
            new W(Y.x + 40, 3, Y.z - 2),
          ]);
      }
      let V = 0;
      for (let Y = 1; Y < E.pos.length; Y++)
        V += E.pos[Y].distanceTo(E.pos[Y - 1]);
      E.len = Math.max(V, 4);
    }
    function S(P, V, Y) {
      let L = P.length - 1,
        Z = Zn(V, 0, 1) * L,
        J = Math.min(L - 1, Math.floor(Z)),
        oe = Z - J,
        fe = P[Math.max(0, J - 1)],
        le = P[J],
        R = P[J + 1],
        I = P[Math.min(L, J + 2)],
        se = oe * oe,
        ae = se * oe,
        k = (ce, ve, _e, Te) =>
          0.5 *
          (2 * ve +
            (-ce + _e) * oe +
            (2 * ce - 5 * ve + 4 * _e - Te) * se +
            (-ce + 3 * ve - 3 * _e + Te) * ae);
      return Y.set(
        k(fe.x, le.x, R.x, I.x),
        k(fe.y, le.y, R.y, I.y),
        k(fe.z, le.z, R.z, I.z),
      );
    }
    function z(P) {
      let V = Math.max(26, E.len / Yi.titleSpeed);
      (E.t += P), E.t >= V && (E.t = 0);
      let Y = E.t / V,
        L = Y * Y * (3 - 2 * Y) * 0.25 + Y * 0.75,
        Z = i.camera,
        J = i.time.t;
      S(E.pos, L, b),
        S(E.look, L, m),
        (b.x += Math.sin(J * 0.31) * 0.05),
        (b.y += Math.sin(J * 0.43 + 1.7) * 0.035),
        (b.z += Math.sin(J * 0.27 + 0.6) * 0.05),
        (m.y += Math.sin(J * 0.19) * 0.12),
        (m.x += Math.sin(J * 0.13 + 2) * 0.2),
        Z.position.copy(b),
        Z.lookAt(m),
        (Z.rotation.z += Math.sin(J * 0.21) * 0.006),
        !i.params.fov &&
          Math.abs(Z.fov - Yi.titleFov) > 0.01 &&
          ((Z.fov = Yi.titleFov), Z.updateProjectionMatrix()),
        (e.fade = Math.max(1 - sl(0, 1.8, E.t), sl(V - 1.6, V, E.t)));
    }
    function H() {
      a(i.enemies, "clear"),
        a(i.fx, "clear"),
        a(i.combat, "reset"),
        a(i.weapon, "reset"),
        (c.time = 0),
        (c.cut = 0),
        (c.allCut = !1),
        (c.queue.length = 0),
        (c.waveHot = 0),
        (c.alertT = 0),
        (c.pursuitT = 0),
        (c.pursuitLeft = 0),
        (c.contactSaid = !1),
        (c.lowSaid = !1),
        (c.extractHint = 0),
        (c.evacT = 0),
        (c.bossAlive = !1),
        c.used.clear(),
        (c.relays = A().map((P, V) => {
          let Y = (/([a-z0-9])$/i.exec(String(P.id || "")) || [
            0,
            String.fromCharCode(65 + V),
          ])[1].toUpperCase();
          return (
            O(P, "live"),
            {
              o: P,
              id: P.id || "relay_" + V,
              short: Y,
              t: 0,
              cut: !1,
              cutting: !1,
            }
          );
        })),
        n.reset(s.playerStart),
        o.reset && o.reset(),
        (e.saturation = t),
        (e.flash = 0),
        q(),
        o.setRelays && o.setRelays(0, c.relays.length),
        ie();
    }
    function O(P, V) {
      try {
        let Y = P && P.object && P.object.userData;
        Y && typeof Y.setState == "function" && Y.setState(V);
      } catch (Y) {
        console.error("[game] relay setState threw", Y);
      }
    }
    function q() {
      if (!o.setMarkers) return;
      let P = c.relays
        .filter((V) => !V.cut)
        .map((V) => ({
          id: V.id,
          short: V.short,
          label: V.o.label || "中继 " + V.short,
          pos: V.o.pos,
          kind: "relay",
        }));
      c.allCut &&
        c.evacT <= 0 &&
        s.extraction &&
        P.push({
          id: "extract",
          short: "撤离",
          label: "撤离艇",
          pos: s.extraction.pos,
          kind: "extract",
        }),
        o.setMarkers(P);
    }
    function U({ skipIntro: P = !1, quick: V = !1, keepRetries: Y = !1 } = {}) {
      if (
        (Y || (c.retries = 0),
        l.show("none"),
        l.locationCard(!1),
        a(i.audio, "setPaused", !1),
        H(),
        a(i.weapon, "setVisible", !0),
        (g = !1),
        P)
      ) {
        (e.fade = 0), T();
        return;
      }
      (h = V ? Yi.retryIntroSeconds : Yi.introSeconds),
        (f = V),
        (p = V),
        (n.enabled = !1),
        r.setGameplay && r.setGameplay(!1),
        o.show(!1),
        (e.fade = 1),
        a(i.audio, "setIntensity", 0.15),
        M("intro");
    }
    function T() {
      (n.enabled = !0),
        o.show(!0),
        r.setGameplay && r.setGameplay(!0),
        o.setObjective(D()),
        M("playing"),
        C(!0);
    }
    function D() {
      let mission = _.currentMission || {};
      if (c.bossAlive) return "摧毁港区主控核心";
      if (c.allCut)
        return c.evacT > 0
          ? "坚守撤离窗口 · " + Math.ceil(c.evacT) + " 秒"
          : mission.extractText || "前往撤离艇";
      let P = c.relays.length - c.cut;
      return c.cut === 0
        ? mission.goal || "切断三处上行中继"
        : P === 1
          ? "切断最后一处中继"
          : `切断剩余 ${P} 处中继`;
    }
    function C(P) {
      let V = r.describeMode ? r.describeMode() : "";
      l.setLookMode(V),
        !(!P && V === x) &&
          ((x = V),
          _.state === "playing" &&
          (r.mode === "drag" ||
            (r.mode === "lock" &&
              !r.locked &&
              !i.params.shot &&
              !i.params.autostart))
            ? o.message(V, r.mode === "drag" ? 7 : 4)
            : _.state === "playing" && r.locked && o.message("", 0));
    }
    r.onModeChange && r.onModeChange(() => C(!1)),
      i.events.on("input:lock", (P) => {
        if (P.locked) {
          (g = !0), C(!1);
          return;
        }
        _.state === "playing" && g && G(), (g = !1);
      }),
      document.addEventListener("visibilitychange", () => {
        document.hidden && _.state === "playing" && G();
      }),
      addEventListener("keydown", (P) => {
        _.state !== "title" ||
          l.panelOpen ||
          (P.code !== "Enter" && P.code !== "NumpadEnter") ||
          (P.target && P.target.tagName === "BUTTON") ||
          (a(i.audio, "resume"), r.requestLock(), U({}));
      });
    function G() {
      _.state === "playing" &&
        (r.setGameplay && r.setGameplay(!1),
        r.exitLock(),
        a(i.audio, "setPaused", !0),
        l.setLookMode(
          r.mode === "drag"
            ? r.describeMode()
            : r.touch
              ? ""
              : "继续游戏后将重新捕获鼠标。",
        ),
        o.show(!1),
        l.show("paused"),
        (d = 0.35),
        M("paused"));
    }
    function j(P) {
      _.state === "paused" &&
        (l.show("none"),
        a(i.audio, "setPaused", !1),
        o.show(!0),
        r.setGameplay && r.setGameplay(!0),
        (g = !1),
        r.requestLock(),
        M("playing"),
        setTimeout(() => C(!0), 700));
    }
    function N(P) {
      let V = P === "gull" || P === "drone" ? "air" : "ground",
        Y = (s && s.enemySpawns) || [],
        L = Y.filter((Z) => Z.type === V);
      return L.length ? L : Y;
    }
    function Q(
      P,
      { minDist: V = Yi.spawnFar, from: Y = n.pos, preferHidden: L = !0 } = {},
    ) {
      let Z = N(P),
        J = null,
        oe = -1e9;
      for (let le of Z) {
        let R = Math.hypot(le.pos.x - Y.x, le.pos.z - Y.z),
          I = i.rng() * 1.5;
        if (
          ((I += R >= V ? 2 + Math.min(1, (R - V) / 30) * 0.5 : -(V - R) / 4),
          L)
        ) {
          b.copy(le.pos), (b.y += P === "gull" ? 0 : 1);
          let ae = !0;
          try {
            ae = i.physics.lineOfSight(b, n.eye);
          } catch {}
          ae || (I += 2.5);
        }
        let se = c.used.get(le);
        se !== void 0 && c.time - se < 6 && (I -= 3),
          I > oe && ((oe = I), (J = le));
      }
      let fe = new W();
      if (J) {
        c.used.set(J, c.time), fe.copy(J.pos);
        let le = (i.rng() - 0.5) * 2.4,
          R = (i.rng() - 0.5) * 2.4,
          I = P === "gull";
        try {
          I || (I = i.physics.nav.isWalkable(fe.x + le, fe.z + R));
        } catch {
          I = !1;
        }
        I && ((fe.x += le), (fe.z += R));
      } else {
        let le = i.rng() * Math.PI * 2;
        fe.set(
          Zn(Y.x + Math.cos(le) * 26, -34, 26),
          0,
          Zn(Y.z + Math.sin(le) * 26, -26, 24),
        );
      }
      return (P === "gull" || P === "drone") && fe.y < 2.5 && (fe.y = 6 + i.rng() * 3), fe;
    }
    function K(P, V, Y) {
      let L = null;
      try {
        L = i.enemies.spawn(P, V, Y);
      } catch (Z) {
        console.error("[game] enemies.spawn threw", Z);
      }
      return L;
    }
    function ie() {
      let P = (s.playerStart && s.playerStart.pos) || n.pos;
      for (let V of ["gull", "hound"])
        for (let Y = 0; Y < Yi.patrol[V]; Y++)
          K(V, Q(V, { minDist: 32, from: P, preferHidden: !0 }), {
            state: "patrol",
          });
    }
    function F(P) {
      let V = Yi.waves[Math.min(P, Yi.waves.length - 1)],
        Y = [];
      for (let oe = 0; oe < V.gull; oe++) Y.push("gull");
      for (let oe = 0; oe < (V.drone || 0); oe++)
        Y.splice(Math.min(Y.length, 1 + oe * 3), 0, "drone");
      for (let oe = 0; oe < (V.elite || 0); oe++)
        Y.splice(Math.min(Y.length, 1 + oe * 2), 0, "elite");
      for (let oe = 0; oe < (V.marksman || 0); oe++)
        Y.splice(Math.min(Y.length, 2 + oe * 3), 0, "marksman");
      for (let oe = 0; oe < (V.heavy || 0); oe++)
        Y.splice(Math.min(Y.length, 1 + oe * 4), 0, "heavy");
      for (let oe = 0; oe < (V.turret || 0); oe++)
        Y.splice(Math.min(Y.length, 2 + oe * 4), 0, "turret");
      for (let oe = 0; oe < V.hound; oe++)
        Y.splice(Math.min(Y.length, 1 + oe * 2), 0, "hound");
      let L = 0,
        Z = 0;
      Y.forEach((oe, fe) => {
        let le = Q(oe);
        (L += le.x - n.pos.x),
          (Z += le.z - n.pos.z),
          c.queue.push({
            type: oe,
            pos: le,
            at: c.time + 1.6 + fe * Yi.spawnStagger,
          });
      }),
        (c.waveHot = 30);
      let J = ((Math.atan2(L, -Z) * 180) / Math.PI + 360) % 360;
      o.warn && o.warn("发现敌情 · " + jC[Math.round(J / 45) % 8], 3.4);
    }
    function X(P) {
      let V = ne();
      for (let Y = 0; Y < c.queue.length; Y++) {
        let L = c.queue[Y];
        if (c.time < L.at) continue;
        if (V >= Yi.maxAlive) {
          L.at = c.time + 1;
          continue;
        }
        if (
          !K(L.type, L.pos, { state: "alert", target: n.pos }) &&
          !i.enemies.stub &&
          (L.tries = (L.tries || 0) + 1) < 6
        ) {
          L.at = c.time + 1.5;
          continue;
        }
        c.queue.splice(Y, 1), a(i.enemies, "alert", n.pos, 60);
        break;
      }
      if (c.allCut) {
        if (
          ((c.pursuitT -= P),
          c.pursuitT <= 0 &&
            c.pursuitLeft > 0 &&
            !c.queue.length &&
            V < Yi.pursuitMinAlive)
        ) {
          (c.pursuitT = Yi.pursuitEvery), c.pursuitLeft--;
          let Y = i.rng() < 0.6 ? "gull" : "hound";
          c.queue.push({ type: Y, pos: Q(Y), at: c.time + 0.5 });
        }
        c.pursuitT <= 0 && ((c.pursuitT = 4), a(i.enemies, "alert", n.pos, 90));
      }
    }
    function ne() {
      try {
        return i.enemies.aliveCount
          ? i.enemies.aliveCount()
          : i.enemies.list.filter((P) => P.alive).length;
      } catch {
        return 0;
      }
    }
    function re(P) {
      let V = (i.enemies && i.enemies.list) || [];
      for (let Y = 0; Y < V.length; Y++) {
        let L = V[Y];
        if (
          L &&
          L.alive &&
          L.pos &&
          Math.hypot(L.pos.x - n.pos.x, L.pos.z - n.pos.z) < P
        )
          return !0;
      }
      return !1;
    }
    i.events.on("enemy:alert", () => {
      (c.alertT = 10),
        _.state === "playing" &&
          !c.contactSaid &&
          ((c.contactSaid = !0), o.radio && o.radio(_l.contact, 3.2));
    }),
      i.events.on("player:hit", () => {
        c.alertT = Math.max(c.alertT, 8);
      }),
      i.events.on("player:rescued", () => {
        _.state === "playing" && o.message("已从水中获救", 2.5);
      });
    function $() {
      let P = null,
        V = Yi.interactRange;
      for (let Y of c.relays) {
        if (Y.cut) continue;
        let L = Y.o.pos.x - n.pos.x,
          Z = Y.o.pos.z - n.pos.z,
          J = Math.hypot(L, Z);
        J > V ||
          Math.abs((Y.o.pos.y || 0) - n.pos.y) > 2.5 ||
          (J > 0.9 &&
            (L * n.forward.x + Z * n.forward.z) /
              (J * Math.max(0.2, Math.hypot(n.forward.x, n.forward.z))) <
              Yi.interactFacing) ||
          ((P = Y), (V = J));
      }
      return P;
    }
    function ue(P) {
      let V = n.alive ? $() : null;
      for (let L of c.relays)
        L.cut ||
          (L === V && r.down("interact")
            ? (L.cutting || ((L.cutting = !0), O(L.o, "cutting")),
              (L.t += P / Yi.cutSeconds),
              i.events.emit("objective:progress", {
                id: L.id,
                t: Math.min(1, L.t),
              }),
              L.t >= 1 && me(L))
            : L.t > 0 &&
              ((L.t = Math.max(0, L.t - P * 1.6)),
              L.cutting &&
                ((L.cutting = !1),
                O(L.o, "live"),
                i.events.emit("objective:progress", { id: L.id, t: 0 }))));
      V && !V.cut
        ? o.setPrompt && o.setPrompt("切断中继 " + V.short, Fo(V.t))
        : o.setPrompt && o.setPrompt(null);
      let Y = s.extraction;
      if (Y && Y.pos) {
        let L = Math.hypot(Y.pos.x - n.pos.x, Y.pos.z - n.pos.z),
          Z = L < (Y.radius || 2.5) && Math.abs(Y.pos.y - n.pos.y) < 3.5;
        Z && c.allCut && n.alive && c.evacT <= 0 && !c.bossAlive
          ? ee()
          : Z &&
            c.allCut &&
            c.evacT > 0 &&
            c.extractHint <= 0
            ? ((c.extractHint = 5),
              o.message("撤离窗口尚未打开，坚守阵地", 3))
            : Z &&
              !c.allCut &&
              c.extractHint <= 0 &&
              ((c.extractHint = 8),
              o.message("中继尚未断开，撤离艇无法在火力下接应", 3.5)),
          (c.extractHint = Math.max(0, c.extractHint - P));
      }
    }
    function me(P) {
      (P.cut = !0), (P.cutting = !1), (P.t = 1), c.cut++, O(P.o, "cut");
      let V = c.relays.length;
      i.events.emit("objective:done", { id: P.id, index: c.cut, total: V }),
        o.setRelays && o.setRelays(c.cut, V),
        o.setPrompt && o.setPrompt(null),
        n.addShake(0.18),
        F(c.cut - 1),
        c.cut >= V
          ? ((c.allCut = !0),
            (c.evacT = (_.currentMission && +_.currentMission.evac) || 0),
            (c.pursuitLeft = Yi.pursuitExtra),
            (c.pursuitT = 12),
            i.events.emit("objective:all", {}),
            o.radio &&
              o.radio((_.currentMission && _.currentMission.all) || _l.all, 4.5))
          : o.radio &&
            o.radio(_l.cut[Math.min(c.cut - 1, _l.cut.length - 1)], 3.6),
        o.setObjective(D()),
        q();
    }
    i.events.on("player:dead", () => {
      (_.state !== "playing" && _.state !== "paused") ||
        (r.setGameplay && r.setGameplay(!1),
        r.exitLock(),
        o.setPrompt && o.setPrompt(null),
        o.show(!1),
        o.clearRadio && o.clearRadio(),
        l.setDead({ time: c.time, relays: c.cut, total: c.relays.length }),
        M("dead"));
    });
    function ee() {
      (n.invulnerable = !0),
        (n.enabled = !1),
        r.setGameplay && r.setGameplay(!1),
        r.exitLock(),
        o.setPrompt && o.setPrompt(null),
        o.show(!1),
        i.events.emit("extraction:reached", {}),
        o.clearRadio && o.clearRadio(),
        o.radio && o.radio(_l.done, 2.2);
      let P = (i.combat && i.combat.stats) || { shots: 0, hits: 0, kills: 0 },
        V = P.shots > 0 ? Zn(P.hits / P.shots, 0, 1) : null,
        Y =
          (c.time < 270 ? 2 : c.time < 400 ? 1 : 0) +
          (V >= 0.5 ? 2 : V >= 0.3 ? 1 : 0) +
          (c.retries === 0 ? 1 : 0),
        L = [
          "险象环生",
          "火力全开",
          "稳扎稳打",
          "干净利落",
          "精准果断",
          "完美突击",
        ][Y];
      l.setDebrief({
        time: c.time,
        accuracy: V,
        kills: P.kills || 0,
        retries: c.retries,
        rating: L,
      }),
        M("complete");
    }
    function B(P) {
      switch (((u += P), _.state)) {
        case "title":
          return z(P), !1;
        case "intro":
          return (
            (e.fade = 1 - sl(0.25, Math.min(h, 2.6), u)),
            !f && u > 0.5 && ((f = !0), l.locationCard(!0)),
            !p && u > 1.3 && ((p = !0), o.radio && o.radio(_l.intro, 4.2)),
            u > h - 0.6 &&
              !o.root?.classList.contains("on") &&
              (o.show(!0), o.setObjective(D())),
            u >= h && (l.locationCard(!1), (e.fade = 0), T()),
            !0
          );
        case "playing": {
          if (
            ((c.time += P),
            (e.fade = kn(e.fade || 0, 0, 6, P)),
            d > 0 && (d -= P),
            r.pressed("pause"))
          )
            return G(), !1;
          if ((ue(P), _.state !== "playing")) return !0;
          if (c.evacT > 0) {
            let prevSec = Math.ceil(c.evacT);
            c.evacT = Math.max(0, c.evacT - P);
            if (Math.ceil(c.evacT) !== prevSec || c.evacT <= 0) {
              if (c.evacT <= 0) {
                q();
                o.radio && o.radio("撤离窗口已打开！登船撤离！", 4);
                o.warn && o.warn("撤离窗口已打开", 3);
              }
              o.setObjective && o.setObjective(D());
            }
          }
          X(P),
            (c.alertT = Math.max(0, c.alertT - P)),
            (c.waveHot = Math.max(0, c.waveHot - P));
          let V = ne();
          c.waveHot > 0 &&
            V === 0 &&
            !c.queue.length &&
            c.waveHot < 24 &&
            (c.waveHot = 0);
          let Y =
            c.allCut || c.queue.length || (c.waveHot > 0 && V > 0)
              ? 1
              : c.alertT > 0 || (V > 0 && re(26))
                ? 0.6
                : 0.15;
          return (
            Y !== c.intensity &&
              ((c.intensity = Y), a(i.audio, "setIntensity", Y)),
            r.mode === "lock" &&
            !r.locked &&
            !r.touch &&
            !i.params.shot &&
            !i.params.autostart
              ? ((y -= P),
                y <= 0 && ((y = 2), o.message(r.describeMode(), 2.6)))
              : (y = 0.8),
            !c.lowSaid &&
              n.alive &&
              n.health < 30 &&
              ((c.lowSaid = !0), o.radio && o.radio(_l.low, 3)),
            !0
          );
        }
        case "paused":
          return (
            d > 0 ? (d -= P) : r.pressed("pause") && (l.closePanel() || j(!1)),
            !1
          );
        case "dead":
          return (
            (e.saturation = kn(e.saturation ?? 1, 0.12, 2.2, P)),
            (e.fade = kn(e.fade || 0, 0.55, 1.4, P)),
            u > 1.5 &&
              l.screen !== "dead" &&
              (l.show("dead"), a(i.audio, "setIntensity", 0.15)),
            !0
          );
        case "complete":
          return (
            (e.fade = kn(e.fade || 0, 0.72, 0.9, P)),
            (e.saturation = kn(e.saturation ?? 1, t * 0.7, 1, P)),
            u > 3.3 &&
              l.screen !== "complete" &&
              (l.show("complete"), a(i.audio, "setIntensity", 0.15)),
            !0
          );
      }
      return !1;
    }
    return (
      w(),
      (n.enabled = !1),
      o.show(!1),
      a(i.weapon, "setVisible", !1),
      r.setGameplay && r.setGameplay(!1),
      a(i.audio, "setIntensity", 0.15),
      i.params.shot || i.params.autostart || l.show("title"),
      _
    );
  }
  var gM = {
    mats: qg,
    level: cv,
    backdrop: mv,
    ground: vv,
    fx: Sv,
    weapon: Xv,
    enemies: ex,
    props: $g,
    render: Vg,
  };
  window.__frames = 0;
  window.__ready = !1;
  window.__fatal = null;
  window.__errors = [];
  var vM = document.getElementById("boot"),
    xM = document.getElementById("boot-msg"),
    yM = document.getElementById("boot-fill");
  function bM(i) {
    (window.__fatal = String(i)), console.error("[fatal] " + i);
    let e = document.getElementById("fatal");
    e ||
      ((e = document.createElement("div")),
      (e.id = "fatal"),
      document.getElementById("app").appendChild(e)),
      (e.textContent = "几猫启动失败：" + i);
  }
  window.addEventListener("error", (i) => {
    window.__errors.push(String(i.message));
  });
  {
    let i = console.error.bind(console);
    console.error = (...e) => {
      try {
        window.__errors.push(
          e
            .map((t) => (t && t.stack) || String(t))
            .join(" ")
            .slice(0, 400),
        );
      } catch {}
      i(...e);
    };
  }
  var KC = () => new Promise((i) => setTimeout(i, 0));
  async function Nr(i, e) {
    xM && (xM.textContent = i),
      yM && (yM.style.width = Math.round(e * 100) + "%"),
      await KC();
  }
  async function QC() {
    let i = Object.fromEntries(new URLSearchParams(location.search)),
      e = !!i.bench || location.hash === "#bench";
    e && ((i.noaudio = "1"), (i.autostart = "1"));
    let t = {
      THREE: lt,
      params: i,
      events: Dy(),
      rng: il(+(i.seed || 4207)),
      time: { t: 0, dt: 0, frame: 0, real: 0 },
      quality: zy(i.q || (i.shot ? "test" : "")),
    };
    window.__G = t;
    let n = i.show && gM[i.show] ? i.show : null;
    t.showcase = n;
    let s = null;
    function o(h) {
      if (h.cam) {
        let f = String(h.cam).split(",").map(Number);
        s = {
          pos: new W(f[0], f[1], f[2]),
          look: new W(f[3] ?? 0, f[4] ?? 1, f[5] ?? 0),
        };
      }
      h.cam === "" && (s = null),
        h.fov && ((t.camera.fov = +h.fov), t.camera.updateProjectionMatrix()),
        h.exposure && (t.render.exposure = +h.exposure);
    }
    window.__setShot = o;
    async function r(h, f, p, d = !1) {
      let v = performance.now();
      try {
        t[h] = await p();
      } catch (x) {
        if (
          (console.error(`[boot] module "${h}" failed: ${(x && x.stack) || x}`),
          d || !dr[h])
        )
          throw x;
        t[h] = dr[h]();
      }
      let g = performance.now() - v;
      g > 150 && console.log(`[boot] ${h} ${g.toFixed(0)}ms`);
    }
    if (
      (await Nr("正在启动渲染器", 0.04),
      await r("render", "render", () => Hg(t), !0),
      (t.renderer = t.render.renderer),
      (t.scene = t.render.scene),
      (t.camera = t.render.camera),
      (t.viewCamera = t.render.viewCamera),
      await Nr("正在生成涂装、锈迹与雨水", 0.12),
      await r("mats", "materials", () => Gg(t)),
      (t.physics = d3(t)),
      (t.props = Yg(t)),
      (t.input = n ? tP() : v_(t)),
      n)
    ) {
      let h = Qi(new rn(80, 80).rotateX(-Math.PI / 2), t.mats.get("concrete"), {
        cast: !1,
      });
      if (
        (t.scene.add(h),
        (t.level = {
          stub: !0,
          playerStart: { pos: new W(0, 0, 4), yaw: 0 },
          objectives: [],
          enemySpawns: [],
          zones: [],
          interiorBoxes: [],
          cinematicPath: [],
          extraction: { pos: new W(), radius: 2 },
          groundSurfaceAt: () => "concrete",
          update() {},
        }),
        (t.backdrop = dr.backdrop()),
        (t.ground = dr.ground()),
        t.physics.build(),
        n === "fx")
      )
        await r("fx", "fx", () => Cf(t));
      else
        try {
          t.fx = await Cf(t);
        } catch {
          t.fx = dr.fx();
        }
      (t.audio = dr.audio()),
        (t.hud = dr.hud()),
        (t.player = nP(t)),
        (t.combat = zv(t)),
        (t.weapon = dr.weapon()),
        (t.enemies = dr.enemies()),
        (t.game = { state: "showcase", update: () => !1, start() {} });
      let f = null;
      try {
        f = await gM[n].showcase(t);
      } catch (p) {
        bM(`showcase "${n}" threw: ${(p && p.stack) || p}`);
      }
      (t.showcaseInfo = f || {}),
        f &&
          f.cam &&
          o({ cam: [...f.cam, ...(f.target || [0, 1, 0])].join(",") });
    } else {
      if (
        (await Nr("正在布置集装箱", 0.34),
        await r("level", "level", () => C1(t), !0),
        await Nr("正在架设起重机", 0.5),
        await r("backdrop", "backdrop", () => pv(t)),
        await Nr("正在生成港区地面", 0.58),
        await r("ground", "ground", () => O1(t)),
        t.ground.stub)
      ) {
        let h = Qi(
          new rn(400, 400).rotateX(-Math.PI / 2),
          t.mats.get("asphalt"),
          { cast: !1 },
        );
        t.scene.add(h);
      }
      t.physics.build(),
        await Nr("正在加载弹道与烟雾", 0.66),
        await r("fx", "fx", () => Cf(t)),
        await r("audio", "audio", () => (i.noaudio ? dr.audio() : c_(t))),
        (t.player = x_(t)),
        (t.combat = zv(t)),
        await Nr("正在检查几猫制式步枪", 0.74),
        await r("weapon", "weapon", () => {
          let defs = [
            { cfg: { ...mi, id: "pac9", short: "九式" }, build: w_ },
            { cfg: SHOTGUN, build: buildShotgun, short: "破门锤" },
          ];
          let prof = window.__SX_PROFILE || "v5";
          prof !== "v2" && prof !== "v3" && prof !== "v4"
            ? defs.push({ cfg: DMR, build: buildDMR, short: "长眼" })
            : 0;
          // V37 · 版本复现：weapon_ext.js 虽然始终被拼接，但三把新武器
          // （短哨 / 重锚 / 侧牙）只在 v33+（v33-v38 及 dev）注入；v32 必须保持 3 把。
          const WX_ON =
            prof === "v33" || prof === "v34" || prof === "v35" || prof === "v36" ||
            prof === "v37" || prof === "v38" || prof === "dev";
          if (WX_ON) {
            try {
              const WX = window.__SX_WEAPON_EXT;
              if (WX && WX.defs) for (const d of WX.defs) defs.push(d);
            } catch (e) {}
          }
          return inventory(t, defs);
        }),
        await Nr("正在启动港区主控", 0.82),
        await r("enemies", "enemies", () => Em(t)),
        await r("hud", "hud", () => hM(t)),
        (t.game = mM(t));
    }
    await Nr("正在准备首帧画面", 0.92);
    try {
      await t.render.onLevelReady();
    } catch (h) {
      console.error(
        "[boot] render.onLevelReady failed: " + ((h && h.stack) || h),
      );
    }
    let a = 0;
    if (
      ((window.__stats = () => ({
        ...(t.render.stats ? t.render.stats() : {}),
        fps: a ? +(1 / a).toFixed(1) : 0,
        state: t.game && t.game.state,
      })),
      i.cam && o(i),
      i.fov && o({ fov: i.fov }),
      !n && (i.shot || i.autostart))
    )
      try {
        t.game.start({ skipIntro: !0 });
      } catch (h) {
        console.error("[boot] game.start failed", h);
      }
    i.noweapon && t.weapon.setVisible && t.weapon.setVisible(!1),
      e && eP(t),
      await Nr("准备就绪", 1),
      vM.classList.add("done"),
      setTimeout(() => {
        vM.hidden = !0;
      }, 700);
    let l = performance.now(),
      c = 1,
      u = (h, f) => {
        let p = t[h];
        if (p && p.update)
          try {
            p.update(f);
          } catch (d) {
            u.err[h] ||
              ((u.err[h] = 1),
              console.error(
                `[loop] ${h}.update threw: ${(d && d.stack) || d}`,
              ));
          }
      };
    (u.err = {}),
      t.renderer.setAnimationLoop(() => {
        let h = performance.now(),
          f = (h - l) / 1e3;
        (l = h), (a = a ? a * 0.95 + f * 0.05 : f);
        let p = Math.min(f, 0.05);
        i.dt && (p = +i.dt),
          (t.time.dt = p),
          (t.time.t += p),
          (t.time.real = h / 1e3),
          t.time.frame++,
          u("input", p);
        let d = !1;
        try {
          d =
            t.game.update(p) !== !1 &&
            t.game.state !== "title" &&
            t.game.state !== "paused";
        } catch (v) {
          u.err.game ||
            ((u.err.game = 1),
            console.error(
              "[loop] game.update threw: " + ((v && v.stack) || v),
            ));
        }
        if (n) {
          if (t.showcaseInfo.update)
            try {
              t.showcaseInfo.update(p);
            } catch (v) {
              u.err.sc ||
                ((u.err.sc = 1),
                console.error(
                  "[loop] showcase update threw: " + ((v && v.stack) || v),
                ));
            }
        } else d && (u("player", p), u("weapon", p), u("enemies", p));
        if (
          t.weapon &&
          t.weapon.setWetness &&
          t.level &&
          t.level.interiorBoxes &&
          t.level.interiorBoxes[0]
        ) {
          let v = t.level.interiorBoxes[0],
            g = t.camera.position,
            x =
              g.x > v.min.x &&
              g.x < v.max.x &&
              g.z > v.min.z &&
              g.z < v.max.z &&
              g.y < v.max.y;
          c += ((x ? 0.3 : 1) - c) * Math.min(1, p * (x ? 0.25 : 0.6));
          try {
            t.weapon.setWetness(c);
          } catch {}
        }
        t.game.state !== "paused" &&
          (u("fx", p),
          u("ground", p),
          u("level", p),
          u("backdrop", p),
          u("mats", p)),
          u("audio", p),
          u("hud", p),
          s && (t.camera.position.copy(s.pos), t.camera.lookAt(s.look)),
          t.bench && t.bench.frame(f);
        try {
          t.render.frame(p);
        } catch (v) {
          u.err.render ||
            ((u.err.render = 1),
            console.error(
              "[loop] render.frame threw: " + ((v && v.stack) || v),
            ));
        }
        t.input.endFrame && t.input.endFrame(),
          window.__frames++,
          window.__frames === 2 && (window.__ready = !0);
      });
  }
  function eP(i) {
    let e = document.createElement("pre");
    (e.id = "bench"),
      (e.style.cssText =
        'position:absolute;left:12px;top:12px;z-index:90;margin:0;padding:10px 12px;font:12px/1.45 "PingFang SC",ui-monospace,monospace;color:#d8f0d0;background:rgba(0,0,0,.72);white-space:pre-wrap;max-width:min(560px,90vw);pointer-events:none'),
      document.getElementById("app").appendChild(e);
    let t = "unknown";
    try {
      let f = i.renderer.getContext(),
        p = f.getExtension("WEBGL_debug_renderer_info");
      t = p
        ? f.getParameter(p.UNMASKED_RENDERER_WEBGL)
        : f.getParameter(f.RENDERER);
    } catch {}
    let n =
        i.level.cinematicPath && i.level.cinematicPath.length >= 2
          ? i.level.cinematicPath
          : [
              { pos: [-32, 1.7, 6], look: [0, 2, 5] },
              { pos: [10, 1.7, 6], look: [30, 6, 0] },
            ],
      s = [],
      o = 0,
      r = 0,
      a = 30,
      l = new W(),
      c = new W(),
      u = new W(),
      h = new W();
    i.player && (i.player.enabled = !1),
      (i.bench = {
        frame(f) {
          o += f;
          let p = ((o / a) % 1) * (n.length - 1),
            d = Math.min(n.length - 2, Math.floor(p)),
            v = p - d,
            g = v * v * (3 - 2 * v);
          if (
            (l.fromArray(n[d].pos),
            c.fromArray(n[d + 1].pos),
            u.fromArray(n[d].look),
            h.fromArray(n[d + 1].look),
            i.camera.position.lerpVectors(l, c, g),
            i.camera.lookAt(u.lerp(h, g)),
            o > 2 && s.push(f * 1e3),
            s.length > 3e3 && s.shift(),
            o - r > 1 && s.length > 10)
          ) {
            r = o;
            let x = s.slice().sort((M, E) => M - E),
              y = x.reduce((M, E) => M + E, 0) / x.length,
              b = x[Math.floor(x.length * 0.99)],
              m = x[x.length >> 1],
              A = i.render.stats ? i.render.stats() : {},
              _ = i.renderer.getDrawingBufferSize(new Ae());
            e.textContent = `几猫性能测试  t=${o.toFixed(0)}s
GPU: ${t}
buffer ${_.x}x${_.y}  quality ${i.quality.name}  dpr ${window.devicePixelRatio}
frame ms avg ${y.toFixed(1)}  median ${m.toFixed(1)}  p99 ${b.toFixed(1)}  => ${(1e3 / y).toFixed(0)} fps
stats ${JSON.stringify(A)}
errors ${window.__errors.length}${
              window.__errors.length
                ? `
 - ` +
                  window.__errors.slice(0, 6).join(`
 - `)
                : ""
            }`;
          }
        },
      });
  }
  function tP() {
    let i = () => {};
    return {
      move: { x: 0, y: 0 },
      look: { dx: 0, dy: 0 },
      fire: !1,
      ads: !1,
      sprint: !1,
      crouch: !1,
      locked: !1,
      touch: !1,
      sensitivity: 1,
      down: () => !1,
      pressed: () => !1,
      update: i,
      endFrame: i,
      requestLock: i,
      exitLock: i,
    };
  }
  function nP(i) {
    return {
      pos: new W(0, 0, 4),
      vel: new W(),
      yaw: 0,
      pitch: 0,
      health: 100,
      maxHealth: 100,
      alive: !0,
      onGround: !0,
      sprinting: !1,
      crouching: !1,
      ads: 0,
      speed: 0,
      eye: new W(0, Pi.eye, 4),
      forward: new W(0, 0, -1),
      enabled: !1,
      reset() {},
      damage() {},
      heal() {},
      addRecoil() {},
      addShake() {},
      update() {},
    };
  }
  QC().catch((i) => bM((i && i.stack) || i));
})();

