(function () {
  const canvas = document.getElementById("spider-game");
  const trigger = document.querySelector(".spider-trigger");
  const status = document.getElementById("spider-status");

  if (!canvas || !trigger) return;

  const ctx = canvas.getContext("2d");
  const root = document.documentElement;
  const styles = getComputedStyle(root);
  const colors = {
    ink: styles.getPropertyValue("--ink").trim() || "#1f2823",
    soft: styles.getPropertyValue("--ink-soft").trim() || "#4f5b55",
    moss: styles.getPropertyValue("--moss").trim() || "#2f6f5e",
    clay: styles.getPropertyValue("--clay").trim() || "#9a5b44",
    gold: styles.getPropertyValue("--gold").trim() || "#a17a32",
    line: styles.getPropertyValue("--line-strong").trim() || "#b7ad99"
  };

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const TAU = Math.PI * 2;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const randomBetween = (min, max) => min + Math.random() * (max - min);
  const normalizeAngle = (angle) => {
    let normalized = angle;
    while (normalized > Math.PI) normalized -= TAU;
    while (normalized < -Math.PI) normalized += TAU;
    return normalized;
  };
  const spiderSprite = {
    image: new Image(),
    loaded: false,
    frameWidth: 128,
    frameHeight: 128,
    drawSize: 74,
    frames: {
      descend: [0, 1, 0, 2],
      swingSlow: [13],
      swingMedium: [12, 13, 14, 13],
      swingFast: [12, 14, 13, 14],
      catch: [6, 7],
      fallSlow: [8],
      fallFast: [8, 9],
      impact: [10],
      fallenRest: [10, 11]
    },
    frameDuration: {
      descend: 210,
      catch: 140,
      impact: 155,
      fallenRest: 680
    },
    framePlacement: {
      0: { cx: 63.7, cy: 67.3 },
      1: { cx: 63.7, cy: 71.1 },
      2: { cx: 63.6, cy: 69.3 },
      6: { cx: 64.7, cy: 61.9 },
      7: { cx: 67.3, cy: 65.0 },
      8: { cx: 63.7, cy: 69.4 },
      9: { cx: 67.5, cy: 71.4 },
      10: { cx: 62.8, cy: 77.3 },
      11: { cx: 62.9, cy: 73.4 },
      12: { cx: 70.2, cy: 61.5 },
      13: { cx: 70.7, cy: 59.5 },
      14: { cx: 72.3, cy: 57.8 }
    }
  };
  const spritePoseTransitionDuration = 0.14;
  const spriteFrameTransitionDuration = 0.08;
  const spriteAnimationMinHold = 0.15;
  const spriteImpactMinHold = 0.18;
  const swingMotionLineSpeed = 125;
  const loopCompletion = TAU * 0.92;
  const attachedGravity = 460;
  const threadDamping = 0.9996;
  const catchMomentumBase = 320;
  const storyDuration = 45;
  const storyCompletionCatches = 3;
  const storyFadeDuration = 3.2;
  const storyFadeHold = 0.55;
  const introStartDrop = 26;
  const introThreadOffset = 10;
  const passiveArrivalDelay = 3.5;
  const passiveSeedDuration = 0.28;
  const gameplayLaunchEaseDuration = 0.9;
  const freeDrawHoldDuration = 0.22;
  const freeDrawFadeDuration = 1.2;
  const freeDrawMoveTolerance = 18;

  const state = {
    active: false,
    running: false,
    rafId: null,
    passiveTimerId: null,
    mode: "idle",
    dpr: 1,
    width: 0,
    height: 0,
    lastTime: 0,
    intro: 0,
    previewSeed: 0,
    speed: 58,
    difficulty: 1,
    hookTimer: 0,
    hookIndex: 0,
    launchEase: {
      active: false,
      elapsed: 0,
      duration: gameplayLaunchEaseDuration
    },
    anchor: null,
    ropeLength: 132,
    hangVector: { x: 0, y: 132 },
    playBand: {
      top: 70,
      bottom: 420,
      firstLane: 260
    },
    spider: makeSpider(),
    hooks: [],
    bursts: [],
    bumps: [],
    missHints: [],
    story: makeStory(),
    freeDraw: makeFreeDraw(),
    lastAngle: 0,
    rotation: 0
  };

  function makeSpider() {
    return {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 10,
      pain: 0,
      squish: 0,
      floorBounces: 0,
      restingOnFloor: false,
      impactHold: 0,
      blink: 0,
      catchPose: 0,
      facing: -1,
      renderPose: makeRenderPose()
    };
  }

  function makeRenderPose() {
    return {
      currentAnimation: "swingSlow",
      currentFrameIndex: 13,
      previousAnimation: null,
      previousFrameIndex: null,
      blend: 1,
      transitionDuration: spritePoseTransitionDuration,
      holdRemaining: 0,
      age: 0
    };
  }

  function makeStory() {
    return {
      phase: "idle",
      elapsed: 0,
      catches: 0,
      loops: 0,
      threads: [],
      activations: [],
      loopEchoes: [],
      webRemnants: [],
      endingThreads: [],
      branches: [],
      glintPath: [],
      completedAt: 0,
      pendingComplete: false
    };
  }

  function makeFreeDraw() {
    return {
      unlocked: false,
      pending: false,
      active: false,
      pointerId: null,
      holdTimerId: null,
      holdStartedAt: 0,
      suppressClick: false,
      start: { x: 0, y: 0 },
      current: { x: 0, y: 0 },
      trails: []
    };
  }

  spiderSprite.image.onload = () => {
    spiderSprite.loaded = true;
    if (state.active) draw();
  };
  spiderSprite.image.src = "spider-micro-arcade-sprite-sheet-v3.png";

  function resizeCanvas() {
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.width = window.innerWidth;
    state.height = window.innerHeight;
    canvas.width = Math.round(state.width * state.dpr);
    canvas.height = Math.round(state.height * state.dpr);
    canvas.style.width = `${state.width}px`;
    canvas.style.height = `${state.height}px`;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  }

  function getPortraitLaunch() {
    const imageWrap = trigger.querySelector(".portrait-image-wrap");
    const rect = (imageWrap || trigger).getBoundingClientRect();
    const cardRect = trigger.getBoundingClientRect();
    const seedXMax = Math.max(28, state.width - 28);
    const seedYMax = Math.max(36, state.height - 82);
    const seedX = clamp(cardRect.right + 12, 28, seedXMax);
    const seedY = clamp(cardRect.bottom + 10, 36, seedYMax);
    const preferredDrop = state.width <= 680 ? 76 : 122;
    const visibleDrop = Math.max(32, state.height - seedY - 42);
    const dropLength = clamp(Math.min(preferredDrop, visibleDrop), 32, preferredDrop);

    return {
      x: seedX,
      y: seedY,
      dropY: seedY + dropLength,
      hangX: seedX,
      hangY: seedY + dropLength,
      minRopeLength: 32,
      maxRopeLength: Math.max(40, preferredDrop),
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
      mobile: state.width <= 680
    };
  }

  function getLaunchHangVector(launch) {
    const targetX = typeof launch.hangX === "number" ? launch.hangX : launch.x;
    const targetY = typeof launch.hangY === "number"
      ? launch.hangY
      : launch.dropY + introThreadOffset;
    const dx = targetX - launch.x;
    const dy = targetY - launch.y;
    const desiredLength = Math.hypot(dx, dy) || 1;
    const minRopeLength = typeof launch.minRopeLength === "number" ? launch.minRopeLength : 112;
    const maxRopeLength = typeof launch.maxRopeLength === "number" ? launch.maxRopeLength : 184;
    const ropeLength = clamp(desiredLength, minRopeLength, maxRopeLength);
    const scale = ropeLength / desiredLength;

    return {
      x: dx * scale,
      y: dy * scale,
      length: ropeLength
    };
  }

  function setPlayBand(launch) {
    const stackedPortrait = state.width <= 680 || launch.top > state.height * 0.42;

    if (stackedPortrait) {
      const top = clamp(launch.top - 36, 82, state.height - 210);
      const bottom = clamp(launch.bottom + 150, top + 132, state.height - 44);
      state.playBand = {
        top,
        bottom,
        firstLane: clamp(launch.bottom - launch.height * 0.16, top + 48, bottom - 44)
      };
      return;
    }

    const top = clamp(state.height * 0.1, 58, 118);
    const bottom = clamp(state.height * 0.58, top + 120, 500);
    state.playBand = {
      top,
      bottom,
      firstLane: clamp(state.height * 0.38, 170, 320)
    };
  }

  function getFallLine() {
    const heroCopy = document.querySelector(".hero-layout > div");
    if (!heroCopy) return 42;
    const rect = heroCopy.getBoundingClientRect();
    return clamp(rect.left + 18, 24, Math.min(260, state.width * 0.28));
  }

  function announce(message) {
    if (status) status.textContent = message;
  }

  function clearPassiveArrivalTimer() {
    if (!state.passiveTimerId) return;

    clearTimeout(state.passiveTimerId);
    state.passiveTimerId = null;
  }

  function schedulePassiveArrival() {
    if (reducedMotion.matches) return;

    clearPassiveArrivalTimer();
    state.passiveTimerId = window.setTimeout(() => {
      state.passiveTimerId = null;
      startPassiveArrival();
    }, passiveArrivalDelay * 1000);
  }

  function prepareLaunchState(launch, mode, settled) {
    setPlayBand(launch);
    state.active = true;
    state.running = true;
    state.mode = mode;
    state.lastTime = performance.now();
    state.intro = settled ? 1.08 : 0;
    state.previewSeed = 0;
    state.speed = 58;
    state.difficulty = 1;
    state.hookTimer = 0.15;
    state.hookIndex = 0;
    resetGameplayLaunchEase();
    const hangVector = getLaunchHangVector(launch);
    state.ropeLength = hangVector.length;
    state.hangVector = {
      x: hangVector.x,
      y: hangVector.y
    };
    state.anchor = {
      x: launch.x,
      y: launch.y,
      vx: 0,
      id: "portrait"
    };
    state.spider = makeSpider();
    state.spider.x = launch.x + (settled ? state.hangVector.x : 0);
    state.spider.y = settled
      ? launch.y + state.hangVector.y
      : launch.y + introStartDrop;
    resetSpiderRenderPose(state.spider, settled ? "swingSlow" : "descend");
    state.hooks = [];
    state.bursts = [];
    state.bumps = [];
    state.missHints = [];
    state.story = makeStory();
    state.rotation = 0;
    state.lastAngle = Math.PI / 2;
  }

  function startPassiveArrival() {
    if (reducedMotion.matches || state.active) return;

    resizeCanvas();
    document.body.classList.add("spider-game-active");
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }

    const launch = getPortraitLaunch();
    prepareLaunchState(launch, "previewSeed", false);
    state.rafId = requestAnimationFrame(tick);
  }

  function startGame() {
    clearPassiveArrivalTimer();
    lockFreeDraw();
    resizeCanvas();
    document.body.classList.add("spider-game-active");
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }

    const launch = getPortraitLaunch();

    if (reducedMotion.matches) {
      prepareLaunchState(launch, "quiet", true);
      state.running = false;
      draw();
      announce("A small line-drawn spider is hanging from the portrait.");
      return;
    }

    if (state.active && (state.mode === "previewSeed" || state.mode === "previewIntro" || state.mode === "previewHang")) {
      setPlayBand(launch);
      if (state.mode === "previewSeed" || state.mode === "previewIntro") {
        settleSpiderToPreviewHang();
      }
      state.hooks = [];
      state.bursts = [];
      state.bumps = [];
      state.story = makeStory();
      state.speed = 58;
      state.difficulty = 1;
      state.hookTimer = 0.15;
      state.hookIndex = 0;
    } else {
      prepareLaunchState(launch, "previewHang", true);
    }

    beginGameplayFromHang();
  }

  function beginGameplayFromHang() {
    state.mode = "attached";
    state.running = true;
    state.active = true;
    state.lastTime = performance.now();
    state.ropeLength = clamp(
      Math.hypot(state.spider.x - state.anchor.x, state.spider.y - state.anchor.y),
      state.anchor.id === "portrait" ? Math.min(78, Math.max(32, state.ropeLength)) : 78,
      Math.min(230, state.height * 0.42)
    );
    startGameplayLaunchEase();
    state.anchor.vx = 0;
    state.spider.vx = clamp(state.spider.vx, -18, 18);
    state.spider.vy = clamp(state.spider.vy, -18, 18);
    updateSpiderFacing(state.spider);
    state.lastAngle = Math.atan2(state.spider.y - state.anchor.y, state.spider.x - state.anchor.x);
    state.rotation = 0;
    seedHooks(state.anchor.x);
    state.story.phase = "weaving";
    announce("Spider game started.");
    state.rafId = requestAnimationFrame(tick);
  }

  function resetGameplayLaunchEase() {
    state.launchEase.active = false;
    state.launchEase.elapsed = gameplayLaunchEaseDuration;
    state.launchEase.duration = gameplayLaunchEaseDuration;
  }

  function startGameplayLaunchEase() {
    state.launchEase.active = true;
    state.launchEase.elapsed = 0;
    state.launchEase.duration = gameplayLaunchEaseDuration;
  }

  function updateGameplayLaunchEase(dt) {
    if (!state.launchEase.active) return;

    state.launchEase.elapsed = Math.min(state.launchEase.elapsed + dt, state.launchEase.duration);
    if (state.launchEase.elapsed >= state.launchEase.duration) {
      state.launchEase.active = false;
    }
  }

  function getGameplayLaunchFactor() {
    if (!state.launchEase.active) return 1;

    const progress = clamp(state.launchEase.elapsed / state.launchEase.duration, 0, 1);
    return progress * progress * (3 - 2 * progress);
  }

  function getGameplayPlaySpeed() {
    return state.speed * getGameplayLaunchFactor() * getEarlyCatchSpeedScale();
  }

  function getEarlyCatchSpeedScale() {
    if (state.story.phase !== "weaving" || state.story.catches >= storyCompletionCatches) return 1;

    return [0.68, 0.8, 0.9][state.story.catches] || 1;
  }

  function seedHooks(originX) {
    const start = clamp(originX + 105, state.width * 0.58, state.width - 42);
    const firstLane = state.playBand.firstLane;
    const lanes = [firstLane, firstLane - 46, firstLane + 38];

    for (let index = 0; index < 3; index += 1) {
      spawnHook(start + index * randomBetween(105, 145), true, lanes[index], {
        kind: "starter",
        hitBonus: 10,
        visualBoost: 1
      });
    }
  }

  function spawnHook(forcedX, seeded, forcedY, options = {}) {
    state.hookIndex += 1;
    const bandTop = state.playBand.top;
    const bandBottom = state.playBand.bottom;
    const wave = Math.sin(state.hookIndex * 1.37) * 0.18 + Math.sin(state.hookIndex * 0.61) * 0.12;
    const normalized = clamp(randomBetween(0.18, 0.82) + wave, 0.12, 0.88);

    state.hooks.push({
      id: `hook-${state.hookIndex}`,
      x: forcedX || state.width + randomBetween(52, 180),
      y: typeof forcedY === "number" ? forcedY : bandTop + (bandBottom - bandTop) * normalized,
      radius: options.radius || (seeded ? 12 : randomBetween(9, 13)),
      phase: randomBetween(0, TAU),
      age: 0,
      kind: options.kind || (seeded ? "seeded" : "normal"),
      hitBonus: options.hitBonus || 0,
      visualBoost: options.visualBoost || 0
    });
  }

  function tick(now) {
    if (!state.running) {
      state.rafId = null;
      return;
    }

    const dt = Math.min((now - state.lastTime) / 1000 || 0.016, 0.033);
    state.lastTime = now;

    update(dt);
    draw();

    if (state.running) {
      state.rafId = requestAnimationFrame(tick);
    } else {
      state.rafId = null;
    }
  }

  function update(dt) {
    updateFreeDraw(dt);
    updateStory(dt);

    if (!state.active || state.story.phase === "complete") {
      updateBursts(dt);
      return;
    }

    updateBursts(dt);
    updateBumps(dt);
    updateMissHints(dt);

    if (state.mode === "previewSeed") {
      updatePreviewSeed(dt);
      return;
    }

    if (state.mode === "previewIntro") {
      updatePreviewIntro(dt);
      updateSpiderRenderPose(state.spider, dt);
      return;
    }

    if (state.mode === "previewHang") {
      updatePreviewHang(dt);
      updateSpiderRenderPose(state.spider, dt);
      return;
    }

    updateGameplayLaunchEase(dt);
    updateHooks(dt);

    if (state.mode === "intro") {
      updateIntro(dt);
      updateSpiderRenderPose(state.spider, dt);
      return;
    }

    if (state.mode === "attached") {
      updateAttached(dt);
      updateSpiderRenderPose(state.spider, dt);
      return;
    }

    if (state.mode === "falling") {
      updateFalling(dt);
      updateSpiderRenderPose(state.spider, dt);
    }
  }

  function updateStory(dt) {
    const story = state.story;
    if (story.phase === "idle" || story.phase === "done") return;

    story.elapsed += dt;

    for (const thread of story.threads) {
      thread.age += dt;
    }

    for (const echo of story.loopEchoes) {
      echo.age += dt;
    }

    for (const remnant of story.webRemnants) {
      remnant.age += dt;
    }

    for (const activation of story.activations) {
      activation.age += dt;
      activation.life -= dt;
    }
    story.activations = story.activations.filter((activation) => activation.life > 0);

    if (story.phase === "complete") {
      if (story.elapsed - story.completedAt >= storyFadeDuration) {
        finishStoryArc();
      }
      return;
    }

    if (story.pendingComplete && state.mode !== "falling") {
      completeStoryArc();
      return;
    }

    if (story.elapsed >= storyDuration) {
      if (state.mode === "falling") {
        story.pendingComplete = true;
      } else {
        completeStoryArc();
      }
    }
  }

  function clearFreeDrawHoldTimer() {
    if (!state.freeDraw.holdTimerId) return;

    clearTimeout(state.freeDraw.holdTimerId);
    state.freeDraw.holdTimerId = null;
  }

  function lockFreeDraw() {
    clearFreeDrawHoldTimer();
    state.freeDraw = makeFreeDraw();
    document.body.classList.remove("spider-web-draw-active");
  }

  function unlockFreeDraw() {
    clearFreeDrawHoldTimer();
    state.freeDraw = makeFreeDraw();
    state.freeDraw.unlocked = !reducedMotion.matches;
    updateFreeDrawBodyClass();
  }

  function hasFreeDrawVisual() {
    return state.freeDraw.active || state.freeDraw.trails.length > 0;
  }

  function updateFreeDrawBodyClass() {
    document.body.classList.toggle("spider-web-draw-active", hasFreeDrawVisual());
  }

  function ensureFreeDrawLoop() {
    resizeCanvas();
    if (state.running) return;

    state.running = true;
    state.lastTime = performance.now();
    if (!state.rafId) {
      state.rafId = requestAnimationFrame(tick);
    }
  }

  function updateFreeDraw(dt) {
    if (state.freeDraw.trails.length > 0) {
      for (const trail of state.freeDraw.trails) {
        trail.age += dt;
      }
      state.freeDraw.trails = state.freeDraw.trails.filter((trail) => trail.age < trail.life);
    }

    updateFreeDrawBodyClass();

    if (!state.active && state.mode === "idle" && !hasFreeDrawVisual()) {
      state.running = false;
    }
  }

  function completeStoryArc() {
    const story = state.story;
    if (story.phase === "complete" || story.phase === "done") return;

    story.phase = "complete";
    story.completedAt = story.elapsed;
    story.pendingComplete = false;
    prepareStoryEndingWeb(story);
    story.activations = [];
    state.mode = "ending";
    state.hooks = [];
    state.anchor = null;
    state.bursts = [];
    state.hookTimer = Number.POSITIVE_INFINITY;
    announce("The spider finished a hanging web.");
  }

  function finishStoryArc() {
    state.running = false;
    state.active = false;
    state.mode = "idle";
    state.anchor = null;
    state.hooks = [];
    state.bursts = [];
    state.bumps = [];
    state.story.phase = "done";
    document.body.classList.remove("spider-game-active");
    ctx.clearRect(0, 0, state.width, state.height);
    unlockFreeDraw();
  }

  function prepareStoryEndingWeb(story) {
    const playerThreads = story.threads
      .map((thread, index) =>
        makeEndingThread(thread.x1, thread.y1, thread.x2, thread.y2, index, {
          kind: "player",
          alpha: 0.24,
          sag: 10 + index * 2,
          delay: index * 0.025,
          color: colors.soft
        })
      )
      .filter(Boolean);

    if (state.anchor) {
      playerThreads.push(
        makeEndingThread(
          state.anchor.x,
          state.anchor.y,
          state.spider.x,
          state.spider.y - 9,
          playerThreads.length,
          {
            kind: "live",
            live: true,
            alpha: 0.38,
            sag: 12,
            color: colors.line
          }
        )
      );
    }

    const web = makeViewportWeb(getEndingWebOrigin(playerThreads));
    story.endingThreads = [...playerThreads, ...web.radials];
    story.branches = [...web.crossStrands, ...web.hangers];
    story.glintPath = web.radials.slice(1, 7).map((thread) => ({
      x1: thread.x1,
      y1: thread.y1,
      x2: thread.x2,
      y2: thread.y2,
      length: thread.length,
      sag: thread.sag,
      sway: thread.sway
    }));
  }

  function getEndingWebOrigin(playerThreads) {
    const fallback = {
      x: state.spider.x,
      y: state.spider.y - 9
    };
    const liveThread = playerThreads.find((thread) => thread.live);
    const origin = liveThread ? { x: liveThread.x2, y: liveThread.y2 } : fallback;

    return {
      x: clamp(origin.x, state.width * 0.18, state.width * 0.86),
      y: clamp(origin.y, state.height * 0.16, state.height * 0.78)
    };
  }

  function makeEndingThread(x1, y1, x2, y2, index, options = {}) {
    const length = Math.hypot(x2 - x1, y2 - y1);
    if (length < 8) return null;

    return {
      x1,
      y1,
      x2,
      y2,
      age: 0,
      length,
      live: Boolean(options.live),
      kind: options.kind || "thread",
      phase: options.phase ?? index * 2,
      delay: options.delay ?? 0,
      sag: options.sag ?? clamp(length * 0.08, 10, 72),
      sway: options.sway ?? 0,
      alpha: options.alpha ?? 0.28,
      color: options.color || colors.soft
    };
  }

  function makeViewportWeb(origin) {
    const width = state.width;
    const height = state.height;
    const anchors = [
      { x: width * 0.04, y: 18 },
      { x: width * 0.2, y: 10 },
      { x: width * 0.39, y: 16 },
      { x: width * 0.62, y: 8 },
      { x: width * 0.82, y: 18 },
      { x: width - 12, y: height * 0.16 },
      { x: width - 10, y: height * 0.38 },
      { x: width - 18, y: height * 0.68 },
      { x: width * 0.84, y: height - 16 },
      { x: width * 0.62, y: height - 10 },
      { x: width * 0.38, y: height - 18 },
      { x: width * 0.16, y: height - 12 },
      { x: 12, y: height * 0.78 },
      { x: 10, y: height * 0.5 },
      { x: 14, y: height * 0.26 }
    ].map((point) => ({
      x: clamp(point.x, 8, width - 8),
      y: clamp(point.y, 8, height - 10)
    }));

    const radials = anchors.map((anchor, index) => {
      const length = Math.hypot(anchor.x - origin.x, anchor.y - origin.y);
      const isTopAnchor = anchor.y < origin.y;
      return makeEndingThread(origin.x, origin.y, anchor.x, anchor.y, index, {
        kind: "radial",
        color: index % 3 === 1 ? colors.moss : colors.soft,
        alpha: index % 3 === 1 ? 0.23 : 0.31,
        delay: index * 0.028,
        sag: clamp(length * (isTopAnchor ? 0.14 : 0.08) + (isTopAnchor ? 28 : 12), 20, 118),
        sway: Math.sin(index * 1.7) * 14
      });
    }).filter(Boolean);

    const crossStrands = [];
    const rings = [0.26, 0.43, 0.61, 0.78];

    rings.forEach((ring, ringIndex) => {
      anchors.forEach((anchor, index) => {
        const next = anchors[(index + 1) % anchors.length];
        const x1 = origin.x + (anchor.x - origin.x) * ring;
        const y1 = origin.y + (anchor.y - origin.y) * ring;
        const x2 = origin.x + (next.x - origin.x) * ring;
        const y2 = origin.y + (next.y - origin.y) * ring;
        const length = Math.hypot(x2 - x1, y2 - y1);
        if (length < 20) return;

        crossStrands.push(
          makeEndingThread(x1, y1, x2, y2, ringIndex * anchors.length + index, {
            kind: "cross",
            color: ringIndex % 2 ? colors.moss : colors.soft,
            alpha: ringIndex % 2 ? 0.18 : 0.24,
            delay: 0.18 + ringIndex * 0.11 + index * 0.012,
            sag: clamp(10 + length * 0.1 + ringIndex * 8, 14, 82),
            sway: Math.sin(index * 0.9 + ringIndex) * 9
          })
        );
      });
    });

    const hangers = anchors
      .filter((anchor, index) => anchor.y < height * 0.18 && index % 2 === 0)
      .map((anchor, index) => {
        const drop = clamp(height * (0.16 + index * 0.035), 52, 132);
        return makeEndingThread(anchor.x, anchor.y, anchor.x + Math.sin(index * 1.2) * 16, anchor.y + drop, index, {
          kind: "hanger",
          color: colors.line,
          alpha: 0.28,
          delay: 0.34 + index * 0.08,
          sag: clamp(drop * 0.12, 10, 24),
          sway: Math.sin(index * 2.1) * 18,
          phase: index * 3
        });
      })
      .filter(Boolean);

    return { radials, crossStrands, hangers };
  }

  function updateIntro(dt) {
    updateDescent(dt);

    if (state.intro >= 1.08) {
      state.mode = "attached";
      startGameplayLaunchEase();
      state.anchor.vx = 0;
      state.spider.vx = clamp(state.spider.vx, -18, 18);
      state.spider.vy = 0;
      updateSpiderFacing(state.spider);
      state.lastAngle = Math.atan2(state.spider.y - state.anchor.y, state.spider.x - state.anchor.x);
      state.rotation = 0;
    }
  }

  function updatePreviewIntro(dt) {
    updateDescent(dt);

    if (state.intro >= 1.08) {
      settleSpiderToPreviewHang();
    }
  }

  function updatePreviewSeed(dt) {
    state.previewSeed += dt;
    state.spider.blink += dt;

    if (state.previewSeed >= passiveSeedDuration) {
      state.mode = "previewIntro";
      state.previewSeed = passiveSeedDuration;
      state.intro = 0;
      state.spider.x = state.anchor.x;
      state.spider.y = state.anchor.y + introStartDrop;
      state.spider.vx = 0;
      state.spider.vy = 0;
      resetSpiderRenderPose(state.spider, "descend");
    }
  }

  function updateDescent(dt) {
    state.intro += dt * 0.92;
    const eased = 1 - Math.pow(1 - clamp(state.intro, 0, 1), 3);
    state.spider.x = state.anchor.x + state.hangVector.x * eased + Math.sin(state.intro * 8) * 1.5;
    state.spider.y = state.anchor.y + introStartDrop * (1 - eased) + state.hangVector.y * eased;
    state.spider.blink += dt;
  }

  function settleSpiderToPreviewHang() {
    state.mode = "previewHang";
    state.intro = 1.08;
    state.anchor.vx = 0;
    state.spider.x = state.anchor.x + state.hangVector.x;
    state.spider.y = state.anchor.y + state.hangVector.y;
    state.spider.vx = 0;
    state.spider.vy = 0;
    updateSpiderFacing(state.spider);
  }

  function updatePreviewHang(dt) {
    if (!state.anchor) return;

    state.spider.blink += dt;
    const sway = Math.sin(state.spider.blink * 1.35) * 4;
    const bob = Math.sin(state.spider.blink * 1.9) * 1.4;
    const length = Math.hypot(state.hangVector.x, state.hangVector.y) || state.ropeLength;
    const ux = state.hangVector.x / length;
    const uy = state.hangVector.y / length;
    const px = -uy;
    const py = ux;

    state.spider.x = state.anchor.x + state.hangVector.x + px * sway + ux * bob;
    state.spider.y = state.anchor.y + state.hangVector.y + py * sway + uy * bob;
    state.spider.vx =
      px * Math.cos(state.spider.blink * 1.35) * 5.4 +
      ux * Math.cos(state.spider.blink * 1.9) * 2.7;
    state.spider.vy =
      py * Math.cos(state.spider.blink * 1.35) * 5.4 +
      uy * Math.cos(state.spider.blink * 1.9) * 2.7;
    updateSpiderFacing(state.spider);
  }

  function updateHooks(dt) {
    const targetHooks = clamp(2 + Math.floor(state.difficulty / 3), 2, 5);
    const earlyEase = getEarlyCatchSpeedScale();
    const spacing = clamp(1.22 - state.difficulty * 0.035, 0.62, 1.22);
    const playSpeed = getGameplayPlaySpeed();

    state.hookTimer -= dt;
    if (state.hooks.length < targetHooks && state.hookTimer <= 0) {
      spawnHook();
      state.hookTimer = randomBetween(spacing * 0.72, spacing * 1.22);
    }

    for (const hook of state.hooks) {
      hook.age += dt;
      hook.x -= playSpeed * dt;
      hook.y += Math.sin(hook.age * 1.4 + hook.phase) * dt * (6 + state.difficulty * 0.38) * earlyEase;
    }

    state.hooks = state.hooks.filter((hook) => hook.x > -70);
  }

  function updateAttached(dt) {
    const spider = state.spider;
    const anchor = state.anchor;
    const playSpeed = getGameplayPlaySpeed();

    anchor.vx = -playSpeed;
    anchor.x += anchor.vx * dt;
    spider.vy += attachedGravity * dt;
    spider.x += spider.vx * dt;
    spider.y += spider.vy * dt;

    constrainToThread(anchor, spider);
    applyLoopAssist(spider, dt);
    trackLoop(anchor, spider);

    spider.pain = Math.max(0, spider.pain - dt * 2.2);
    spider.catchPose = Math.max(0, spider.catchPose - dt);
    updateSpiderFacing(spider);
    spider.blink += dt;

    if (anchor.x <= getFallLine()) {
      detachSpider();
    }
  }

  function constrainToThread(anchor, spider) {
    const dx = spider.x - anchor.x;
    const dy = spider.y - anchor.y;
    const dist = Math.max(Math.hypot(dx, dy), 0.001);
    const nx = dx / dist;
    const ny = dy / dist;
    const anchorVx = anchor.vx || 0;
    const relativeVx = spider.vx - anchorVx;
    const relativeVy = spider.vy;
    const radialVelocity = relativeVx * nx + relativeVy * ny;

    spider.x = anchor.x + nx * state.ropeLength;
    spider.y = anchor.y + ny * state.ropeLength;
    spider.vx -= radialVelocity * nx;
    spider.vy -= radialVelocity * ny;
    spider.vx *= threadDamping;
    spider.vy *= threadDamping;
  }

  function trackLoop(anchor, spider) {
    const angle = Math.atan2(spider.y - anchor.y, spider.x - anchor.x);
    let delta = angle - state.lastAngle;

    if (delta > Math.PI) delta -= TAU;
    if (delta < -Math.PI) delta += TAU;

    state.rotation += delta;
    state.lastAngle = angle;

    if (Math.abs(state.rotation) >= loopCompletion) {
      state.rotation -= Math.sign(state.rotation) * loopCompletion;
      addLoopBurst(anchor.x, anchor.y);
      recordStoryLoop(anchor);
      state.speed = clamp(state.speed + 4, 58, 150);
      state.difficulty += 0.35;
      if (state.story.phase !== "complete") {
        announce("The spider looped the thread.");
      }
    }
  }

  function detachSpider() {
    if (state.mode === "falling") return;
    const spider = state.spider;
    state.mode = "falling";
    state.anchor = null;
    spider.vx -= randomBetween(16, 34);
    spider.vy = Math.max(spider.vy, 40);
    spider.pain = 1;
    spider.squish = 0;
    spider.floorBounces = 0;
    spider.restingOnFloor = false;
    spider.impactHold = 0;
    state.hookTimer = Math.min(state.hookTimer, 0.18);
    seedRecoveryHooks();
    announce("The spider slipped. Click a hook point to catch it again.");
  }

  function updateFalling(dt) {
    const spider = state.spider;
    const floor = state.height - 22;
    const side = spider.radius + 8;

    spider.catchPose = Math.max(0, spider.catchPose - dt);
    updateSpiderFacing(spider);
    spider.blink += dt;
    spider.impactHold = Math.max(0, spider.impactHold - dt);

    if (spider.restingOnFloor) {
      updateFallenRest(spider, floor, side, dt);
      return;
    }

    spider.vy += 710 * dt;
    spider.x += spider.vx * dt;
    spider.y += spider.vy * dt;
    spider.vx *= 0.996;
    spider.pain = Math.max(0, spider.pain - dt * 0.7);

    if (spider.y + spider.radius >= floor) {
      handleFloorImpact(spider, floor);
    }

    if (spider.x < side) {
      spider.x = side;
      spider.vx = Math.abs(spider.vx) * 0.48 + 20;
      spider.pain = 1;
      spider.squish = Math.max(spider.squish, 0.5);
    } else if (spider.x > state.width - side) {
      spider.x = state.width - side;
      spider.vx = -Math.abs(spider.vx) * 0.48 - 20;
      spider.pain = 1;
      spider.squish = Math.max(spider.squish, 0.5);
    }

    if (state.hooks.length === 0) {
      state.hookTimer = Math.min(state.hookTimer, 0.2);
    }

    spider.squish = Math.max(0, spider.squish - dt * 4.5);
  }

  function handleFloorImpact(spider, floor) {
    const impactSpeed = Math.abs(spider.vy);
    const bounceVelocity = impactSpeed * 0.42;

    spider.y = floor - spider.radius;
    spider.floorBounces += 1;
    spider.impactHold = Math.max(spider.impactHold, 0.24);
    spider.squish = 1;
    spider.pain = 1;

    if (impactSpeed > 45) {
      addBump(spider.x, floor);
    }

    if (spider.floorBounces >= 2 || bounceVelocity < 60) {
      settleSpiderOnFloor(spider, floor);
      return;
    }

    spider.vy = -bounceVelocity;
    spider.vx *= 0.82;
  }

  function settleSpiderOnFloor(spider, floor) {
    spider.y = floor - spider.radius;
    spider.vy = 0;
    spider.vx *= 0.62;
    spider.restingOnFloor = true;
    spider.squish = 0;
    spider.pain = 1;
  }

  function updateFallenRest(spider, floor, side, dt) {
    spider.y = floor - spider.radius;
    spider.vy = 0;
    spider.vx *= Math.pow(0.08, dt);
    if (Math.abs(spider.vx) < 3) spider.vx = 0;
    spider.x += spider.vx * dt;
    spider.x = clamp(spider.x, side, state.width - side);
    spider.pain = Math.max(0.65, spider.pain - dt * 0.12);
    spider.squish = 0;

    if (state.hooks.length === 0) {
      state.hookTimer = Math.min(state.hookTimer, 0.2);
    }
  }

  function seedRecoveryHooks() {
    const visibleHooks = state.hooks.filter((hook) => hook.x > state.width * 0.35 && hook.x < state.width + 220).length;
    const firstLane = state.playBand.firstLane;

    for (let index = visibleHooks; index < 2; index += 1) {
      spawnHook(
        state.width * (0.68 + index * 0.16) + randomBetween(-24, 24),
        true,
        firstLane + (index === 0 ? -36 : 34),
        {
          kind: "recovery",
          radius: 14,
          hitBonus: 28,
          visualBoost: 1.45
        }
      );
    }
  }

  function updateSpiderFacing(spider) {
    const directionX = getSpiderDirectionX(spider);

    if (directionX < -24) {
      spider.facing = -1;
    } else if (directionX > 24) {
      spider.facing = 1;
    }
  }

  function getSpiderDirectionX(spider) {
    return state.anchor ? spider.vx - (state.anchor.vx || 0) : spider.vx;
  }

  function getSpiderVisualSpeed(spider) {
    const swing = getSwingKinematics(spider);
    if (swing) return Math.abs(swing.tangentialSpeed);

    const relativeVx = getSpiderDirectionX(spider);
    return Math.hypot(relativeVx, spider.vy);
  }

  function resetSpiderRenderPose(spider, animation) {
    const visualSpeed = getSpiderVisualSpeed(spider);
    const frameIndex = getSpiderFrameIndex(spider, animation, visualSpeed);
    spider.renderPose = makeRenderPose();
    spider.renderPose.currentAnimation = animation;
    spider.renderPose.currentFrameIndex = frameIndex;
    spider.renderPose.previousAnimation = null;
    spider.renderPose.previousFrameIndex = null;
    spider.renderPose.blend = 1;
    spider.renderPose.holdRemaining = getAnimationHold(animation);
  }

  function updateSpiderRenderPose(spider, dt) {
    const pose = spider.renderPose || (spider.renderPose = makeRenderPose());
    const visualSpeed = getSpiderVisualSpeed(spider);
    let targetAnimation = getSpiderTargetAnimation(spider, visualSpeed, pose.currentAnimation);

    pose.age += dt;
    pose.holdRemaining = Math.max(0, pose.holdRemaining - dt);

    if (targetAnimation !== pose.currentAnimation && !canChangeSpriteAnimation(pose, targetAnimation)) {
      targetAnimation = pose.currentAnimation;
    }

    const targetFrameIndex = getSpiderFrameIndex(spider, targetAnimation, visualSpeed);
    const animationChanged = targetAnimation !== pose.currentAnimation;
    const frameChanged = targetFrameIndex !== pose.currentFrameIndex;

    if (animationChanged) {
      beginSpriteTransition(pose, targetAnimation, targetFrameIndex, spritePoseTransitionDuration);
    } else if (frameChanged && shouldBlendFrameChange(targetAnimation)) {
      beginSpriteTransition(pose, targetAnimation, targetFrameIndex, spriteFrameTransitionDuration);
    } else if (frameChanged) {
      pose.currentFrameIndex = targetFrameIndex;
    }

    advanceSpriteTransition(pose, dt);
  }

  function getSpiderTargetAnimation(spider, visualSpeed, currentAnimation) {
    if (state.mode === "intro" || state.mode === "previewIntro") return "descend";
    if (state.mode === "previewHang") return "swingSlow";

    if (state.mode === "falling") {
      if (spider.restingOnFloor) {
        if (spider.impactHold > 0) return "impact";
        return "fallenRest";
      }
      if (spider.impactHold > 0) return "impact";
      const hit = spider.squish > 0.28 || (spider.pain > 0.35 && Math.abs(spider.vy) < 28);
      if (hit) return "impact";
      if (currentAnimation === "fallFast" && visualSpeed > 125) return "fallFast";
      return visualSpeed > 170 ? "fallFast" : "fallSlow";
    }

    if (spider.catchPose > 0) return "catch";

    if (currentAnimation === "swingFast" && visualSpeed > 110) return "swingFast";
    if (visualSpeed > 140) return "swingFast";
    if (currentAnimation === "swingMedium" && visualSpeed > 58) return "swingMedium";
    if (visualSpeed > 82) return "swingMedium";
    return "swingSlow";
  }

  function canChangeSpriteAnimation(pose, targetAnimation) {
    if (targetAnimation === "impact" || targetAnimation === "catch") return true;
    if (pose.currentAnimation === "impact" && pose.holdRemaining > 0) return false;
    if (getSpriteAnimationGroup(pose.currentAnimation) !== getSpriteAnimationGroup(targetAnimation)) return true;
    return pose.holdRemaining <= 0;
  }

  function getSpriteAnimationGroup(animation) {
    if (animation === "descend") return "descend";
    if (animation === "catch") return "catch";
    if (animation === "impact") return "impact";
    if (animation === "fallenRest") return "rest";
    if (animation === "fallSlow" || animation === "fallFast") return "fall";
    return "swing";
  }

  function getAnimationHold(animation) {
    if (animation === "impact") return spriteImpactMinHold;
    if (animation === "fallenRest") return spriteAnimationMinHold;
    if (animation === "fallSlow" || animation === "fallFast" || animation === "swingMedium" || animation === "swingFast") {
      return spriteAnimationMinHold;
    }
    return 0;
  }

  function shouldBlendFrameChange(animation) {
    return animation === "descend" || animation === "fallFast" || animation === "fallSlow" || animation === "impact" || animation === "fallenRest" || animation === "catch";
  }

  function beginSpriteTransition(pose, animation, frameIndex, duration) {
    if (pose.currentAnimation === animation && pose.currentFrameIndex === frameIndex) return;

    pose.previousAnimation = pose.currentAnimation;
    pose.previousFrameIndex = pose.currentFrameIndex;
    pose.currentAnimation = animation;
    pose.currentFrameIndex = frameIndex;
    pose.blend = 0;
    pose.transitionDuration = Math.max(duration, 0.001);
    pose.holdRemaining = Math.max(pose.holdRemaining, getAnimationHold(animation));
  }

  function advanceSpriteTransition(pose, dt) {
    if (pose.blend >= 1) return;

    pose.blend = clamp(pose.blend + dt / pose.transitionDuration, 0, 1);
    if (pose.blend >= 1) {
      pose.previousAnimation = null;
      pose.previousFrameIndex = null;
    }
  }

  function getSpiderAnimationDefinition(animation, visualSpeed) {
    if (animation === "descend") {
      return {
        sequence: spiderSprite.frames.descend,
        duration: spiderSprite.frameDuration.descend
      };
    }

    if (animation === "fallFast" || animation === "fallSlow") {
      return {
        sequence: spiderSprite.frames[animation],
        duration: clamp(230 - visualSpeed * 0.45, 110, 230)
      };
    }

    if (animation === "impact") {
      return {
        sequence: spiderSprite.frames.impact,
        duration: spiderSprite.frameDuration.impact
      };
    }

    if (animation === "fallenRest") {
      return {
        sequence: spiderSprite.frames.fallenRest,
        duration: spiderSprite.frameDuration.fallenRest
      };
    }

    if (animation === "catch") {
      return {
        sequence: spiderSprite.frames.catch,
        duration: spiderSprite.frameDuration.catch
      };
    }

    if (animation === "swingFast") {
      return {
        sequence: spiderSprite.frames.swingFast,
        duration: clamp(170 - visualSpeed * 0.28, 82, 135)
      };
    }

    if (animation === "swingMedium") {
      return {
        sequence: spiderSprite.frames.swingMedium,
        duration: clamp(245 - visualSpeed * 0.52, 130, 205)
      };
    }

    return {
      sequence: spiderSprite.frames.swingSlow,
      duration: 220
    };
  }

  function getSpiderFrameIndex(spider, animation, visualSpeed) {
    const { sequence, duration } = getSpiderAnimationDefinition(animation, visualSpeed);
    return sequence[Math.floor((spider.blink * 1000 / duration) % sequence.length)];
  }

  function getSwingKinematics(spider) {
    if (!state.anchor) return null;

    const dx = spider.x - state.anchor.x;
    const dy = spider.y - state.anchor.y;
    const radius = Math.max(Math.hypot(dx, dy), 0.001);
    const nx = dx / radius;
    const ny = dy / radius;
    const tangentX = -ny;
    const tangentY = nx;
    const relativeVx = spider.vx - (state.anchor.vx || 0);
    const relativeVy = spider.vy;
    const tangentialSpeed = relativeVx * tangentX + relativeVy * tangentY;

    return {
      angle: Math.atan2(dy, dx),
      radius,
      nx,
      ny,
      tangentX,
      tangentY,
      tangentialSpeed,
      direction: tangentialSpeed < 0 ? -1 : 1
    };
  }

  function getSpiderTilt(spider, animation) {
    if (animation === "impact" || animation === "fallenRest") return 0;

    const swing = getSwingKinematics(spider);
    if (swing) {
      const ropeTilt = normalizeAngle(swing.angle - Math.PI / 2);
      const motionAccent = clamp(swing.tangentialSpeed * 0.0004, -0.1, 0.1);
      return normalizeAngle(ropeTilt + motionAccent);
    }

    return clamp(spider.vx * 0.002, -0.42, 0.42);
  }

  function boostCatchMomentum(spider) {
    const swing = getSwingKinematics(spider);
    if (!swing) return;

    const currentSpeed = swing.tangentialSpeed;
    const fallbackDirection = spider.x < state.anchor.x ? -1 : 1;
    const direction = Math.abs(currentSpeed) > 24 ? Math.sign(currentSpeed) : fallbackDirection;
    const targetSpeed = direction * clamp(catchMomentumBase + state.ropeLength * 0.34 + state.difficulty * 7, 320, 405);
    const needsBoost = Math.abs(currentSpeed) < Math.abs(targetSpeed);

    if (!needsBoost) return;

    const delta = targetSpeed - currentSpeed;
    spider.vx += swing.tangentX * delta;
    spider.vy += swing.tangentY * delta;
  }

  function applyLoopAssist(spider, dt) {
    const swing = getSwingKinematics(spider);
    if (!swing) return;

    const speed = Math.abs(swing.tangentialSpeed);
    if (speed < 110) return;

    const overTop = clamp((-swing.ny - 0.08) / 0.86, 0, 1);
    const assist = (42 + overTop * 118) * dt * swing.direction;
    spider.vx += swing.tangentX * assist;
    spider.vy += swing.tangentY * assist;
  }

  function recordStoryCatch(fromAnchor, toAnchor) {
    const story = state.story;
    if (story.phase !== "weaving") return;

    story.catches += 1;
    addStoryWebRemnant(fromAnchor, story.catches);

    if (fromAnchor && toAnchor) {
      story.threads.push({
        x1: fromAnchor.x,
        y1: fromAnchor.y,
        x2: toAnchor.x,
        y2: toAnchor.y,
        age: 0
      });
      story.threads = story.threads.slice(-8);
    }

    story.activations.push({
      x: toAnchor.x,
      y: toAnchor.y,
      age: 0,
      life: 0.85,
      kind: "catch"
    });

    if (story.pendingComplete || story.catches >= storyCompletionCatches) {
      completeStoryArc();
    }
  }

  function addStoryWebRemnant(anchor, index) {
    if (!anchor) return;

    state.story.webRemnants.push({
      x: anchor.x,
      y: anchor.y,
      age: 0,
      radius: 8 + (index % 3) * 2,
      phase: index * 0.82,
      side: index % 2 === 0 ? -1 : 1
    });
    state.story.webRemnants = state.story.webRemnants.slice(-7);
  }

  function recordStoryLoop(anchor) {
    const story = state.story;
    if (story.phase !== "weaving") return;

    story.loops += 1;
    story.loopEchoes.push({
      x: anchor.x,
      y: anchor.y,
      age: 0,
      phase: story.loops * 0.86,
      radius: 16 + (story.loops % 3) * 3,
      direction: story.loops % 2 === 0 ? -1 : 1
    });
    story.loopEchoes = story.loopEchoes.slice(-5);
    story.activations.push({
      x: anchor.x,
      y: anchor.y,
      age: 0,
      life: 1.2,
      kind: "loop"
    });
  }

  function updateBursts(dt) {
    for (const burst of state.bursts) {
      burst.life -= dt;
      burst.age += dt;
    }
    state.bursts = state.bursts.filter((burst) => burst.life > 0);
  }

  function updateBumps(dt) {
    for (const bump of state.bumps) {
      bump.life -= dt;
      bump.age += dt;
    }
    state.bumps = state.bumps.filter((bump) => bump.life > 0);
  }

  function updateMissHints(dt) {
    for (const hint of state.missHints) {
      hint.life -= dt;
      hint.age += dt;
    }
    state.missHints = state.missHints.filter((hint) => hint.life > 0);
  }

  function attachToHook(hook) {
    const spider = state.spider;
    const previousAnchor = state.anchor
      ? { x: state.anchor.x, y: state.anchor.y, id: state.anchor.id }
      : { x: spider.x, y: spider.y, id: "recovery" };
    const nextAnchor = {
      x: hook.x,
      y: hook.y,
      vx: -state.speed,
      id: hook.id
    };

    state.hooks = state.hooks.filter((candidate) => candidate !== hook);
    state.anchor = nextAnchor;
    state.ropeLength = clamp(Math.hypot(spider.x - hook.x, spider.y - hook.y), 78, Math.min(230, state.height * 0.42));
    state.mode = "attached";
    resetGameplayLaunchEase();
    const earlyCatch = state.story.phase === "weaving" && state.story.catches < storyCompletionCatches;
    state.difficulty += earlyCatch ? 0.28 : 0.5;
    state.speed = clamp(state.speed + (earlyCatch ? 3 : 5), 58, 154);
    boostCatchMomentum(spider);
    spider.pain = 0;
    spider.squish = 0;
    spider.floorBounces = 0;
    spider.restingOnFloor = false;
    spider.impactHold = 0;
    spider.catchPose = 0.36;
    state.lastAngle = Math.atan2(spider.y - hook.y, spider.x - hook.x);
    state.rotation = 0;
    addCatchBurst(hook.x, hook.y);
    recordStoryCatch(previousAnchor, nextAnchor);

    if (state.story.phase !== "complete") {
      announce("The spider caught a new thread.");
    }

    if (!state.running && !reducedMotion.matches) {
      state.running = true;
      state.lastTime = performance.now();
      state.rafId = requestAnimationFrame(tick);
    }
  }

  function nearestHook(x, y) {
    let best = null;
    let bestDistance = Infinity;

    for (const hook of state.hooks) {
      const distance = Math.hypot(hook.x - x, hook.y - y);
      const hitRadius = getHookHitRadius(hook);
      if (distance <= hitRadius && distance < bestDistance) {
        best = hook;
        bestDistance = distance;
      }
    }

    return best;
  }

  function getPrimaryHook() {
    if (!isGameplayMode() || state.story.phase !== "weaving") return null;

    return state.hooks
      .filter((hook) => hook.x > 12 && hook.x < state.width + 36)
      .sort((a, b) => a.x - b.x)[0] || null;
  }

  function getNearestVisibleHook(x, y) {
    let best = null;
    let bestDistance = Infinity;

    for (const hook of state.hooks) {
      if (hook.x < -24 || hook.x > state.width + 48) continue;
      const distance = Math.hypot(hook.x - x, hook.y - y);
      if (distance < bestDistance) {
        best = hook;
        bestDistance = distance;
      }
    }

    return best;
  }

  function getHookHitRadius(hook) {
    const earlyBonus = state.story.phase === "weaving" && state.story.catches < storyCompletionCatches ? 22 : 0;
    const recoveryBonus = hook.kind === "recovery" ? 28 : 0;
    const fallingBonus = state.mode === "falling" ? 8 : 0;

    return hook.radius + 48 + hook.hitBonus + earlyBonus + recoveryBonus + fallingBonus;
  }

  function isGameplayMode() {
    return state.mode === "attached" || state.mode === "falling";
  }

  function addMissHint(x, y) {
    const target = getNearestVisibleHook(x, y);

    state.missHints.push({
      x,
      y,
      target: target ? { x: target.x, y: target.y, radius: target.radius } : null,
      age: 0,
      life: 0.72
    });
    state.missHints = state.missHints.slice(-3);
  }

  function addLoopBurst(x, y) {
    state.bursts.push({
      x,
      y,
      age: 0,
      life: 0.75,
      kind: "loop"
    });
  }

  function addCatchBurst(x, y) {
    state.bursts.push({
      x,
      y,
      age: 0,
      life: 0.48,
      kind: "catch"
    });
  }

  function addBump(x, y) {
    state.bumps.push({
      x,
      y,
      age: 0,
      life: 0.45
    });
  }

  function draw() {
    ctx.clearRect(0, 0, state.width, state.height);

    if (!state.active) {
      drawFreeDraw();
      return;
    }

    if (state.mode === "falling") {
      drawFloor();
    }

    drawStory();

    if (state.story.phase === "complete") {
      drawEndingSpider();
      return;
    }

    const primaryHook = getPrimaryHook();
    drawCatchGuide(primaryHook);

    for (const hook of state.hooks) {
      drawHook(hook, hook === primaryHook);
    }

    if (state.anchor) {
      if (state.mode === "previewSeed") {
        drawPassiveSeed();
      } else {
        drawThread(state.anchor, state.spider);
        drawAnchor(state.anchor);
      }
    }

    drawBursts();
    drawBumps();
    drawMissHints();
    drawPassiveStartHint();
    if (state.mode === "previewSeed") return;
    drawSpider(state.spider);
    drawFreeDraw();
  }

  function getStoryFade() {
    if (state.story.phase !== "complete") return 1;
    const elapsed = state.story.elapsed - state.story.completedAt;
    return 1 - clamp((elapsed - storyFadeHold) / (storyFadeDuration - storyFadeHold), 0, 1);
  }

  function drawStory() {
    const story = state.story;
    if (story.phase === "idle" || story.phase === "done") return;

    const fade = getStoryFade();
    if (story.phase === "complete") {
      drawStoryEndingGrowth(fade);
      return;
    }

    drawStoryThreads(fade);
    drawStoryRemnants(fade);
    drawStoryLoopEchoes(fade);
    drawStoryActivations(fade);
  }

  function drawStoryThreads(fade) {
    for (const thread of state.story.threads) {
      const reveal = clamp(thread.age / 0.5, 0, 1);
      const alpha = fade * reveal * 0.28;
      drawPixelLine(thread.x1, thread.y1, thread.x2, thread.y2, {
        color: colors.soft,
        alpha,
        size: 2,
        step: 9,
        skipEvery: 5,
        phase: Math.floor(thread.age * 4)
      });
      drawPixelLine(thread.x1, thread.y1, thread.x2, thread.y2, {
        color: colors.moss,
        alpha: alpha * 0.4,
        size: 2,
        step: 17,
        skipEvery: 3
      });
    }
  }

  function drawStoryRemnants(fade) {
    for (const remnant of state.story.webRemnants) {
      const reveal = clamp(remnant.age / 0.48, 0, 1);
      const alpha = fade * reveal;
      drawTinyWebRemnant(remnant.x, remnant.y, remnant.radius, remnant.phase, remnant.side, alpha);
    }
  }

  function drawStoryActivations(fade) {
    for (const activation of state.story.activations) {
      const duration = activation.kind === "loop" ? 1.2 : 0.85;
      const progress = clamp(activation.age / duration, 0, 1);
      const alpha = fade * (1 - progress);
      const color = activation.kind === "loop" ? colors.gold : colors.moss;
      const radius = activation.kind === "loop" ? 10 + progress * 30 : 7 + progress * 20;

      drawPixelRing(activation.x, activation.y, radius, {
        color,
        alpha: alpha * 0.62,
        size: 2,
        points: activation.kind === "loop" ? 28 : 20,
        phase: progress * TAU * 0.18
      });

      if (activation.kind === "loop") {
        drawPixelSpark(activation.x, activation.y, radius + 10, {
          color,
          alpha: alpha * 0.48,
          size: 2,
          rays: 6,
          phase: -progress * TAU * 0.2
        });
      }
    }
  }

  function drawStoryLoopEchoes(fade) {
    for (const echo of state.story.loopEchoes) {
      const reveal = clamp(echo.age / 0.7, 0, 1);
      const settle = clamp(echo.age / 1.2, 0, 1);
      const radius = echo.radius + reveal * 3;
      const phase = echo.phase + settle * 0.12 * echo.direction;
      const alpha = fade * reveal;

      drawPixelArc(echo.x, echo.y, radius, phase, phase + echo.direction * 1.65, {
        color: colors.gold,
        alpha: alpha * 0.26,
        size: 2,
        step: 5
      });
      drawPixelArc(echo.x, echo.y, radius + 7, phase + 1.9, phase + 1.9 + echo.direction * 1.25, {
        color: colors.soft,
        alpha: alpha * 0.2,
        size: 2,
        step: 6
      });

      for (let index = 0; index < 3; index += 1) {
        const angle = phase + echo.direction * (0.35 + index * 0.46);
        const tail = 6 + index * 3 + settle * 4;
        const startX = echo.x + Math.cos(angle) * (radius - 2);
        const startY = echo.y + Math.sin(angle) * (radius - 2);
        const endX = echo.x + Math.cos(angle) * (radius + tail);
        const endY = echo.y + Math.sin(angle) * (radius + tail) + 4 + index * 2;

        drawPixelLine(startX, startY, endX, endY, {
          color: index === 1 ? colors.gold : colors.line,
          alpha: alpha * (index === 1 ? 0.2 : 0.16),
          size: 2,
          step: 5,
          skipEvery: 4,
          phase: index
        });
      }
    }
  }

  function drawStoryEndingGrowth(fade) {
    const story = state.story;
    const elapsed = story.elapsed - story.completedAt;
    const wake = 1 - Math.pow(1 - clamp(elapsed / 1.15, 0, 1), 3);

    for (const thread of story.endingThreads) {
      const progress = 1 - Math.pow(1 - clamp((elapsed - thread.delay) / 1.2, 0, 1), 3);
      if (progress <= 0) continue;

      drawSaggingPixelLine(thread, progress, {
        color: thread.color,
        alpha: fade * progress * thread.alpha * (thread.live ? 1.22 : 1),
        size: 2,
        step: 8,
        skipEvery: 5,
        phase: thread.phase
      });

      drawSaggingPixelLine(thread, progress, {
        color: colors.moss,
        alpha: fade * wake * 0.05,
        size: 2,
        step: 22,
        skipEvery: 4,
        phase: thread.phase + 1
      });
    }

    for (const branch of story.branches) {
      const progress = 1 - Math.pow(1 - clamp((elapsed - branch.delay) / 1.05, 0, 1), 3);
      if (progress <= 0) continue;

      drawSaggingPixelLine(branch, progress, {
        color: branch.color,
        alpha: fade * progress * branch.alpha,
        size: 2,
        step: branch.kind === "hanger" ? 6 : 7,
        skipEvery: branch.kind === "hanger" ? 3 : 4,
        phase: branch.phase
      });

      if (branch.kind === "hanger" && progress > 0.7) {
        const end = getSaggingPoint(branch, progress);
        ctx.save();
        ctx.fillStyle = colors.line;
        ctx.globalAlpha = fade * (progress - 0.7) * 0.28;
        drawPixelBlock(end.x, end.y, 3);
        ctx.restore();
      }
    }

    drawSilkGlint(elapsed, fade);
  }

  function drawSilkGlint(elapsed, fade) {
    const progress = clamp((elapsed - 0.44) / 1.7, 0, 1);
    if (progress <= 0 || progress >= 1 || state.story.glintPath.length === 0) return;

    const point = getPointAlongGlintPath(state.story.glintPath, progress);
    const glintAlpha = fade * Math.sin(progress * Math.PI) * 0.46;

    ctx.save();
    ctx.fillStyle = colors.gold;
    ctx.globalAlpha = glintAlpha;
    drawPixelBlock(point.x, point.y, 3);
    ctx.restore();

    drawPixelRing(point.x, point.y, 5, {
      color: colors.gold,
      alpha: glintAlpha * 0.32,
      size: 2,
      points: 10,
      phase: progress * TAU * 0.2
    });
  }

  function drawFreeDraw() {
    const draw = state.freeDraw;
    if (!hasFreeDrawVisual()) return;

    for (const trail of draw.trails) {
      const fade = 1 - clamp(trail.age / trail.life, 0, 1);
      drawFreeDrawStrand(trail, fade * fade, false);
    }

    if (draw.active) {
      const strand = makeFreeDrawStrand(draw.start, draw.current, draw.trails.length + 1);
      if (!strand) return;

      drawFreeDrawStrand(strand, 0.88, true);
      drawPixelRing(draw.current.x, draw.current.y, 6, {
        color: colors.gold,
        alpha: 0.18,
        size: 2,
        points: 10,
        phase: state.lastTime * 0.001
      });
    }
  }

  function makeFreeDrawStrand(start, current, index) {
    const length = Math.hypot(current.x - start.x, current.y - start.y);
    if (length < 10) return null;

    const direction = Math.atan2(current.y - start.y, current.x - start.x);
    const phase = index * 0.67 + length * 0.003;
    return {
      x1: start.x,
      y1: start.y,
      x2: current.x,
      y2: current.y,
      length,
      sag: clamp(length * 0.055, 4, 30),
      sway: clamp((current.x - start.x) * 0.035, -14, 14),
      phase,
      direction,
      branches: [
        { t: 0.28, side: 1, length: clamp(length * 0.09, 7, 16) },
        { t: 0.52, side: -1, length: clamp(length * 0.075, 6, 14) },
        { t: 0.72, side: 1, length: clamp(length * 0.06, 5, 12) }
      ]
    };
  }

  function drawFreeDrawStrand(strand, alpha, live) {
    drawSaggingPixelLine(strand, 1, {
      color: colors.soft,
      alpha: alpha * (live ? 0.52 : 0.36),
      size: 2,
      step: 7,
      skipEvery: 5,
      phase: Math.floor(strand.phase * 10)
    });
    drawSaggingPixelLine(strand, 1, {
      color: colors.gold,
      alpha: alpha * (live ? 0.11 : 0.07),
      size: 2,
      step: 18,
      skipEvery: 4,
      phase: Math.floor(strand.phase * 7) + 1
    });

    for (let index = 0; index < strand.branches.length; index += 1) {
      const branch = strand.branches[index];
      const start = getSaggingPoint(strand, branch.t);
      const angle = strand.direction + branch.side * (Math.PI * 0.52 + index * 0.08);
      const endX = start.x + Math.cos(angle) * branch.length;
      const endY = start.y + Math.sin(angle) * branch.length + 4 + index;
      drawPixelLine(start.x, start.y, endX, endY, {
        color: index === 1 ? colors.gold : colors.line,
        alpha: alpha * (index === 1 ? 0.12 : 0.18),
        size: 2,
        step: 5,
        skipEvery: 3,
        phase: index
      });
    }
  }

  function getPointAlongGlintPath(path, progress) {
    const totalLength = path.reduce((sum, segment) => sum + segment.length, 0);
    let remaining = totalLength * progress;

    for (const segment of path) {
      if (remaining <= segment.length) {
        const t = segment.length <= 0 ? 0 : remaining / segment.length;
        return getSaggingPoint(segment, t);
      }

      remaining -= segment.length;
    }

    const last = path[path.length - 1];
    return getSaggingPoint(last, 1);
  }

  function drawEndingSpider() {
    const fade = getStoryFade();
    if (fade <= 0.02) return;

    ctx.save();
    multiplyGlobalAlpha(fade * 0.72);
    drawSpider(state.spider);
    ctx.restore();
  }

  function drawPixelBlock(x, y, size = 2) {
    ctx.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), size, size);
  }

  function multiplyGlobalAlpha(alpha) {
    ctx.globalAlpha *= clamp(alpha, 0, 1);
  }

  function drawPixelLine(x1, y1, x2, y2, options = {}) {
    const size = options.size || 2;
    const step = options.step || 7;
    const alpha = options.alpha ?? 1;
    const color = options.color || colors.ink;
    const phase = options.phase || 0;
    const dist = Math.max(Math.hypot(x2 - x1, y2 - y1), 0.001);
    const count = Math.max(1, Math.floor(dist / step));

    ctx.save();
    ctx.fillStyle = color;
    multiplyGlobalAlpha(alpha);
    for (let index = 0; index <= count; index += 1) {
      if (options.skipEvery && (index + phase) % options.skipEvery === 0) continue;
      const t = index / count;
      drawPixelBlock(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, size);
    }
    ctx.restore();
  }

  function drawSaggingPixelLine(strand, progress = 1, options = {}) {
    const size = options.size || 2;
    const step = options.step || 7;
    const alpha = options.alpha ?? 1;
    const color = options.color || colors.soft;
    const phase = options.phase || 0;
    const count = Math.max(2, Math.ceil(strand.length / step));
    const limit = Math.max(1, Math.ceil(count * clamp(progress, 0, 1)));

    ctx.save();
    ctx.fillStyle = color;
    multiplyGlobalAlpha(alpha);
    for (let index = 0; index <= limit; index += 1) {
      if (options.skipEvery && (index + phase) % options.skipEvery === 0) continue;
      const t = clamp(index / count, 0, progress);
      const point = getSaggingPoint(strand, t);
      drawPixelBlock(point.x, point.y, size);
    }
    ctx.restore();
  }

  function getSaggingPoint(strand, t) {
    const controlX = (strand.x1 + strand.x2) * 0.5 + (strand.sway || 0);
    const controlY = (strand.y1 + strand.y2) * 0.5 + (strand.sag || 0);
    const inverse = 1 - t;

    return {
      x: inverse * inverse * strand.x1 + 2 * inverse * t * controlX + t * t * strand.x2,
      y: inverse * inverse * strand.y1 + 2 * inverse * t * controlY + t * t * strand.y2
    };
  }

  function drawPixelRing(x, y, radius, options = {}) {
    const size = options.size || 2;
    const alpha = options.alpha ?? 1;
    const color = options.color || colors.moss;
    const points = options.points || 28;
    const phase = options.phase || 0;

    ctx.save();
    ctx.fillStyle = color;
    multiplyGlobalAlpha(alpha);
    for (let index = 0; index < points; index += 1) {
      const angle = phase + (index / points) * TAU;
      drawPixelBlock(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, size);
    }
    ctx.restore();
  }

  function drawPixelArc(x, y, radius, startAngle, endAngle, options = {}) {
    const size = options.size || 2;
    const alpha = options.alpha ?? 1;
    const color = options.color || colors.soft;
    const step = options.step || 5;
    const arcLength = Math.abs(endAngle - startAngle) * radius;
    const count = Math.max(2, Math.ceil(arcLength / step));

    ctx.save();
    ctx.fillStyle = color;
    multiplyGlobalAlpha(alpha);
    for (let index = 0; index <= count; index += 1) {
      const t = index / count;
      const angle = startAngle + (endAngle - startAngle) * t;
      drawPixelBlock(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, size);
    }
    ctx.restore();
  }

  function drawPixelSpark(x, y, radius, options = {}) {
    const color = options.color || colors.gold;
    const alpha = options.alpha ?? 1;
    const size = options.size || 2;
    const rays = options.rays || 8;
    const phase = options.phase || 0;

    for (let index = 0; index < rays; index += 1) {
      const angle = phase + (index / rays) * TAU;
      const inner = radius * 0.72;
      const outer = radius;
      drawPixelLine(
        x + Math.cos(angle) * inner,
        y + Math.sin(angle) * inner,
        x + Math.cos(angle) * outer,
        y + Math.sin(angle) * outer,
        { color, alpha, size, step: 5 }
      );
    }
  }

  function drawTinyWebRemnant(x, y, radius, phase, side, alpha) {
    if (alpha <= 0.01) return;

    const spokeAngles = [
      phase + side * 0.16,
      phase + side * 0.92,
      phase - side * 0.68
    ];

    for (let index = 0; index < spokeAngles.length; index += 1) {
      const angle = spokeAngles[index];
      const inner = radius * 0.28;
      const outer = radius + index * 2;
      drawPixelLine(
        x + Math.cos(angle) * inner,
        y + Math.sin(angle) * inner,
        x + Math.cos(angle) * outer,
        y + Math.sin(angle) * outer,
        {
          color: index === 1 ? colors.gold : colors.line,
          alpha: alpha * (index === 1 ? 0.16 : 0.24),
          size: 2,
          step: 5,
          skipEvery: index === 2 ? 3 : 0,
          phase: index
        }
      );
    }

    drawPixelArc(x, y, radius, phase - side * 0.12, phase + side * 1.18, {
      color: colors.soft,
      alpha: alpha * 0.28,
      size: 2,
      step: 5
    });
    drawPixelArc(x, y, radius + 6, phase + side * 0.35, phase + side * 1.05, {
      color: colors.line,
      alpha: alpha * 0.18,
      size: 2,
      step: 6
    });

    const tailStart = phase + side * 0.7;
    const tail = {
      x1: x + Math.cos(tailStart) * (radius * 0.58),
      y1: y + Math.sin(tailStart) * (radius * 0.58),
      x2: x + Math.cos(tailStart + side * 0.25) * (radius + 14),
      y2: y + Math.sin(tailStart + side * 0.25) * (radius + 14) + 7,
      length: radius + 14,
      sag: 6,
      sway: side * 2,
      phase: Math.floor(phase * 10)
    };
    drawSaggingPixelLine(tail, 1, {
      color: colors.soft,
      alpha: alpha * 0.18,
      size: 2,
      step: 5,
      skipEvery: 3,
      phase: tail.phase
    });
  }

  function drawWebKnot(x, y, radius, options = {}) {
    const pulse = options.pulse || 0;
    const phase = options.phase || 0;
    const alpha = options.alpha ?? 1;
    const spokes = options.spokes || 8;
    const outerOffset = options.outerOffset ?? 9;
    const outerRadius = radius + outerOffset + pulse * 3;
    const innerRadius = Math.max(3, radius * 0.38);
    const ringRadii = [radius * 0.72, radius + 4, outerRadius];

    if (options.hanging) {
      drawPixelLine(x, y - outerRadius - 8, x, y - outerRadius + 1, {
        color: colors.soft,
        alpha: alpha * 0.42,
        size: 2,
        step: 5,
        skipEvery: 3,
        phase: Math.floor(phase * 10)
      });
    }

    for (let index = 0; index < spokes; index += 1) {
      const angle = phase + (index / spokes) * TAU;
      const spokeRadius = outerRadius + (index % 2 ? 2 : 0);
      drawPixelLine(
        x + Math.cos(angle) * innerRadius,
        y + Math.sin(angle) * innerRadius,
        x + Math.cos(angle) * spokeRadius,
        y + Math.sin(angle) * spokeRadius,
        {
          color: colors.soft,
          alpha: alpha * (0.34 + pulse * 0.06),
          size: 2,
          step: 5
        }
      );
    }

    ringRadii.forEach((ringRadius, ringIndex) => {
      const ringAlpha = alpha * (ringIndex === 1 ? 0.34 + pulse * 0.08 : 0.24);
      for (let index = 0; index < spokes; index += 1) {
        const skipSegment =
          ringIndex === 0 ? index % 3 === 1 : ringIndex === 1 ? index % 4 === 2 : index % 3 === 0;
        if (skipSegment) continue;
        const startAngle = phase + (index / spokes) * TAU + 0.13;
        const endAngle = phase + ((index + 1) / spokes) * TAU - 0.13;
        drawPixelArc(x, y, ringRadius, startAngle, endAngle, {
          color: ringIndex === 1 ? colors.moss : colors.soft,
          alpha: ringAlpha,
          size: 2,
          step: ringIndex === 2 ? 5 : 4
        });
      }
    });

    if (options.looseThread) {
      const tailAngle = phase + Math.PI * 0.72;
      drawPixelLine(
        x + Math.cos(tailAngle) * (outerRadius * 0.62),
        y + Math.sin(tailAngle) * (outerRadius * 0.62),
        x + Math.cos(tailAngle + 0.12) * (outerRadius + 8),
        y + Math.sin(tailAngle + 0.12) * (outerRadius + 8),
        {
          color: colors.soft,
          alpha: alpha * 0.3,
          size: 2,
          step: 5,
          skipEvery: 4,
          phase: 1
        }
      );
    }

    drawPixelRing(x, y, Math.max(4, radius * 0.42), {
      color: colors.moss,
      alpha: alpha * 0.7,
      size: 2,
      points: 12,
      phase
    });

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = colors.ink;
    drawPixelBlock(x, y, 4);
    ctx.globalAlpha = alpha * 0.72;
    ctx.fillStyle = colors.moss;
    drawPixelBlock(x - 4, y, 2);
    drawPixelBlock(x + 4, y, 2);
    drawPixelBlock(x, y - 4, 2);
    drawPixelBlock(x, y + 4, 2);
    ctx.globalAlpha = alpha * (0.34 + pulse * 0.22);
    ctx.fillStyle = colors.gold;
    drawPixelBlock(x + 3, y - 3, 2);
    ctx.restore();
  }

  function drawCatchGuide(hook) {
    if (!hook || !state.spider) return;

    const pulse = Math.sin(state.lastTime * 0.004 + hook.phase) * 0.5 + 0.5;
    const alpha = (state.mode === "falling" ? 0.18 : 0.12) + pulse * 0.05;

    drawPixelLine(state.spider.x, state.spider.y - 9, hook.x, hook.y, {
      color: colors.gold,
      alpha,
      size: 2,
      step: 18,
      skipEvery: 2,
      phase: Math.floor(state.lastTime / 160)
    });

    drawPixelRing(hook.x, hook.y, hook.radius + 32 + pulse * 5, {
      color: colors.gold,
      alpha: alpha * 0.55,
      size: 2,
      points: 24,
      phase: pulse * TAU * 0.08
    });
  }

  function drawHook(hook, primary) {
    const pulse = Math.sin((hook.age + hook.phase) * 3) * 0.5 + 0.5;
    const phase = hook.phase * 0.18 + Math.sin(hook.age * 0.9 + hook.phase) * 0.08;
    const earlyCatch = state.story.phase === "weaving" && state.story.catches < storyCompletionCatches;
    const emphasis = 1 + hook.visualBoost * 0.32 + (earlyCatch ? 0.16 : 0) + (primary ? 0.24 : 0);

    drawWebKnot(hook.x, hook.y, hook.radius, {
      pulse,
      phase,
      alpha: Math.min(1, 0.98 * emphasis),
      hanging: true,
      looseThread: true,
      outerOffset: 8,
      spokes: 8
    });

    drawPixelRing(hook.x, hook.y, hook.radius + 13 + pulse * (2.5 + hook.visualBoost), {
      color: colors.gold,
      alpha: (0.18 + pulse * 0.1) * emphasis,
      size: 2,
      points: hook.kind === "recovery" ? 18 : 16,
      phase: phase * 1.4
    });

    drawPixelRing(hook.x, hook.y, hook.radius + 22 + pulse * 3, {
      color: colors.line,
      alpha: (0.06 + pulse * 0.035) * emphasis,
      size: 2,
      points: 20,
      phase: -phase
    });

    if (primary) {
      drawPixelRing(hook.x, hook.y, hook.radius + 35 + pulse * 4, {
        color: colors.moss,
        alpha: 0.08 + pulse * 0.04,
        size: 2,
        points: 22,
        phase: phase * -1.2
      });
    }

    ctx.save();
    ctx.fillStyle = colors.gold;
    ctx.globalAlpha = clamp((0.36 + pulse * 0.18) * emphasis, 0, 1);
    drawPixelBlock(hook.x + 3, hook.y - 3, 2);
    drawPixelBlock(hook.x - 4, hook.y + 3, 2);
    ctx.restore();
  }

  function drawMissHints() {
    for (const hint of state.missHints) {
      const progress = clamp(hint.age / 0.72, 0, 1);
      const fade = 1 - progress;

      drawPixelRing(hint.x, hint.y, 8 + progress * 18, {
        color: colors.clay,
        alpha: fade * 0.24,
        size: 2,
        points: 14,
        phase: progress * TAU * 0.18
      });

      if (!hint.target) continue;

      drawPixelLine(hint.x, hint.y, hint.target.x, hint.target.y, {
        color: colors.gold,
        alpha: fade * 0.12,
        size: 2,
        step: 15,
        skipEvery: 2,
        phase: Math.floor(progress * 5)
      });

      drawPixelRing(hint.target.x, hint.target.y, hint.target.radius + 28 + progress * 8, {
        color: colors.gold,
        alpha: fade * 0.13,
        size: 2,
        points: 20,
        phase: -progress * TAU * 0.16
      });
    }
  }

  function drawAnchor(anchor) {
    drawWebKnot(anchor.x, anchor.y, 6, {
      pulse: 0.18,
      phase: state.lastTime * 0.0004,
      alpha: 0.58,
      outerOffset: 5,
      spokes: 6
    });
  }

  function drawPassiveSeed() {
    if (!state.anchor) return;

    const progress = clamp(state.previewSeed / passiveSeedDuration, 0, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    drawWebKnot(state.anchor.x, state.anchor.y, 4 + eased * 2, {
      pulse: 0.16 + eased * 0.16,
      phase: state.lastTime * 0.0005,
      alpha: 0.28 + eased * 0.3,
      outerOffset: 4,
      spokes: 6
    });
  }

  function drawPassiveStartHint() {
    if (!state.anchor || !isPassivePreviewMode()) return;

    const t = (state.lastTime * 0.001) % 1.4;
    const progress = t / 1.4;
    const alpha = (1 - progress) * 0.22;
    const target = state.mode === "previewSeed" ? state.anchor : state.spider;
    const radius = state.mode === "previewSeed" ? 10 + progress * 8 : 22 + progress * 14;

    drawPixelRing(target.x, target.y, radius, {
      color: colors.gold,
      alpha,
      size: 2,
      points: 18,
      phase: progress * TAU * 0.15
    });
  }

  function drawThread(anchor, spider) {
    drawPixelLine(anchor.x, anchor.y, spider.x, spider.y - 9, {
      color: colors.soft,
      alpha: 0.68,
      size: 2,
      step: 8,
      phase: Math.floor(state.lastTime / 180),
      skipEvery: 4
    });
  }

  function drawRadialSwingMotion(spider, animation, visualSpeed) {
    if (animation !== "swingFast") return;

    const swing = getSwingKinematics(spider);
    if (!swing) return;

    const intensity = clamp((visualSpeed - swingMotionLineSpeed) / 130, 0, 1);
    if (intensity <= 0.02) return;

    const dir = swing.direction;
    const wobble = Math.sin(spider.blink * 12) * 0.012;
    const arcSpan = 0.22 + intensity * 0.36;
    const trailRadii = [
      { offset: -20, color: colors.soft, alpha: 0.2, lag: 0.02 },
      { offset: -7, color: colors.line, alpha: 0.26, lag: 0.08 },
      { offset: 10, color: colors.gold, alpha: 0.18, lag: 0.14 }
    ];

    for (const mark of trailRadii) {
      const radius = Math.max(20, swing.radius + mark.offset);
      const startAngle = swing.angle - dir * (mark.lag + wobble);
      const endAngle = swing.angle - dir * (mark.lag + arcSpan);
      drawPixelArc(state.anchor.x, state.anchor.y, radius, startAngle, endAngle, {
        color: mark.color,
        alpha: mark.alpha * intensity,
        size: 2,
        step: 6
      });
    }

    const legSweep = [
      { offset: -28, lag: 0.04, span: 0.26, alpha: 0.22 },
      { offset: -14, lag: 0.1, span: 0.22, alpha: 0.17 },
      { offset: 14, lag: 0.07, span: 0.24, alpha: 0.18 },
      { offset: 27, lag: 0.13, span: 0.2, alpha: 0.14 }
    ];

    for (const sweep of legSweep) {
      const radius = Math.max(20, swing.radius + sweep.offset);
      const startAngle = swing.angle - dir * (sweep.lag + wobble);
      const endAngle = swing.angle - dir * (sweep.lag + sweep.span + intensity * 0.05);
      drawPixelArc(state.anchor.x, state.anchor.y, radius, startAngle, endAngle, {
        color: colors.ink,
        alpha: sweep.alpha * intensity,
        size: 2,
        step: 5
      });

      const toeAngle = endAngle;
      ctx.save();
      ctx.fillStyle = colors.ink;
      multiplyGlobalAlpha(sweep.alpha * intensity * 0.75);
      drawPixelBlock(
        state.anchor.x + Math.cos(toeAngle) * radius,
        state.anchor.y + Math.sin(toeAngle) * radius,
        2
      );
      ctx.restore();
    }
  }

  function drawSpider(spider) {
    if (spiderSprite.loaded) {
      drawSpriteSpider(spider);
      return;
    }

    drawLineSpider(spider);
  }

  function getSpiderFrame(spider) {
    const visualSpeed = getSpiderVisualSpeed(spider);
    const pose = spider.renderPose || makeRenderPose();
    return {
      animation: pose.currentAnimation,
      frameIndex: pose.currentFrameIndex,
      visualSpeed,
      previousAnimation: pose.previousAnimation,
      previousFrameIndex: pose.previousFrameIndex,
      blend: pose.blend
    };
  }

  function getSpiderDrawSize(animation) {
    if (animation === "descend") return spiderSprite.drawSize * 0.78;
    if (animation === "fallSlow" || animation === "fallFast") return spiderSprite.drawSize * 0.78;
    if (animation === "impact" || animation === "fallenRest") return spiderSprite.drawSize * 0.78;
    return spiderSprite.drawSize;
  }

  function getSpiderDrawOffsetY(animation) {
    if (animation === "fallSlow" || animation === "fallFast") return 2;
    if (animation === "impact" || animation === "fallenRest") return 2;
    return 0;
  }

  function drawSpriteSpider(spider) {
    const render = getSpiderRenderFrames(spider);

    if (render.previous) {
      drawSpriteFrame(spider, render.previous, render.visualSpeed, 1 - render.blend);
    }
    drawSpriteFrame(spider, render.current, render.visualSpeed, render.previous ? render.blend : 1);

    drawRadialSwingMotion(spider, render.current.animation, render.visualSpeed);
    drawSpritePain(spider, render.current.animation, render.visualSpeed);
  }

  function getSpiderRenderFrames(spider) {
    const pose = spider.renderPose || (spider.renderPose = makeRenderPose());
    const visualSpeed = getSpiderVisualSpeed(spider);
    const current = {
      animation: pose.currentAnimation,
      frameIndex: pose.currentFrameIndex
    };
    const previous = pose.previousAnimation && pose.blend < 1
      ? {
        animation: pose.previousAnimation,
        frameIndex: pose.previousFrameIndex
      }
      : null;

    return {
      current,
      previous,
      blend: pose.blend,
      visualSpeed
    };
  }

  function drawSpriteFrame(spider, frame, visualSpeed, alpha) {
    if (alpha <= 0.01) return;

    const { animation, frameIndex } = frame;
    const tilt = getSpiderTilt(spider, animation);
    const size = getSpiderDrawSize(animation);
    const offsetY = getSpiderDrawOffsetY(animation);
    const facing = animation === "descend" ? 1 : spider.facing;
    const breathe = animation === "swingSlow" ? Math.sin(spider.blink * 4) * 1.2 : 0;
    const speedStretch = animation === "swingFast" ? clamp(visualSpeed / 520, 0, 0.12) : 0;
    const frameOffset = getSpriteFrameOffset(frameIndex, size);

    ctx.save();
    multiplyGlobalAlpha(alpha);
    ctx.translate(spider.x, spider.y + offsetY + breathe);
    ctx.rotate(tilt);
    ctx.scale(facing * (1 + speedStretch), 1 - speedStretch * 0.35);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      spiderSprite.image,
      frameIndex * spiderSprite.frameWidth,
      0,
      spiderSprite.frameWidth,
      spiderSprite.frameHeight,
      -size / 2 - frameOffset.x,
      -size / 2 - frameOffset.y,
      size,
      size
    );
    ctx.restore();
  }

  function getSpriteFrameOffset(frameIndex, size) {
    const placement = spiderSprite.framePlacement[frameIndex];
    if (!placement) return { x: 0, y: 0 };

    return {
      x: ((placement.cx - spiderSprite.frameWidth / 2) / spiderSprite.frameWidth) * size,
      y: ((placement.cy - spiderSprite.frameHeight / 2) / spiderSprite.frameHeight) * size
    };
  }

  function drawSpritePain(spider, animation, visualSpeed) {
    if (animation === "impact" || animation === "fallenRest") return;
    if (spider.pain <= 0.05) return;

    const tilt = getSpiderTilt(spider, animation);
    const offsetY = getSpiderDrawOffsetY(animation);
    const facing = animation === "descend" ? 1 : spider.facing;
    const breathe = animation === "swingSlow" ? Math.sin(spider.blink * 4) * 1.2 : 0;
    const speedStretch = animation === "swingFast" ? clamp(visualSpeed / 520, 0, 0.12) : 0;

    ctx.save();
    ctx.translate(spider.x, spider.y + offsetY + breathe);
    ctx.rotate(tilt);
    ctx.scale(facing * (1 + speedStretch), 1 - speedStretch * 0.35);
    drawPainMarks(spider.pain);
    ctx.restore();
  }

  function drawLineSpider(spider) {
    const pain = spider.pain;
    const squish = spider.squish;
    const tilt = clamp(spider.vx * 0.002, -0.32, 0.32) + Math.sin(spider.blink * 8) * pain * 0.05;
    const legCurl = pain * 4 + squish * 3;

    ctx.save();
    ctx.translate(spider.x, spider.y);
    ctx.rotate(tilt);
    ctx.strokeStyle = pain > 0.25 ? colors.clay : colors.ink;
    ctx.fillStyle = colors.ink;
    ctx.lineWidth = 1.7;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    drawLegs(legCurl);

    ctx.save();
    ctx.scale(1 + squish * 0.22, 1 - squish * 0.24);
    ctx.beginPath();
    ctx.ellipse(0, 3, 8.5, 10.5, 0, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, -8, 6.2, 5.5, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = pain > 0.25 ? colors.clay : colors.ink;
    ctx.beginPath();
    ctx.arc(-2.5, -9, 0.9, 0, TAU);
    ctx.arc(2.5, -9, 0.9, 0, TAU);
    ctx.fill();

    if (pain > 0.05) {
      drawPainMarks(pain);
    }

    ctx.restore();
  }

  function drawLegs(curl) {
    const legs = [
      [-5, -3, -14, -11 - curl, -23, -7],
      [-6, 0, -17, -4 - curl, -25, 2],
      [-5, 4, -15, 9 + curl, -23, 12],
      [-2, 8, -8, 17 + curl, -16, 20],
      [5, -3, 14, -11 - curl, 23, -7],
      [6, 0, 17, -4 - curl, 25, 2],
      [5, 4, 15, 9 + curl, 23, 12],
      [2, 8, 8, 17 + curl, 16, 20]
    ];

    ctx.beginPath();
    for (const leg of legs) {
      ctx.moveTo(leg[0], leg[1]);
      ctx.quadraticCurveTo(leg[2], leg[3], leg[4], leg[5]);
    }
    ctx.stroke();
  }

  function drawPainMarks(pain) {
    const alpha = clamp(pain, 0, 0.85);
    const wobble = Math.sin(state.lastTime * 0.02) * 1.5;

    drawPixelLine(-14, -22 + wobble, -8, -17 + wobble, { color: colors.clay, alpha, size: 2, step: 4 });
    drawPixelLine(-13, -17 + wobble, -7, -22 + wobble, { color: colors.clay, alpha, size: 2, step: 4 });
    drawPixelLine(9, -23 - wobble, 14, -19 - wobble, { color: colors.clay, alpha, size: 2, step: 4 });
    drawPixelLine(14, -19 - wobble, 10, -15 - wobble, { color: colors.clay, alpha, size: 2, step: 4 });
  }

  function drawBursts() {
    for (const burst of state.bursts) {
      const progress = 1 - burst.life / (burst.kind === "loop" ? 0.75 : 0.48);
      const alpha = 1 - progress;
      const radius = burst.kind === "loop" ? 16 + progress * 36 : 8 + progress * 22;
      const color = burst.kind === "loop" ? colors.gold : colors.moss;

      if (burst.kind === "loop") {
        drawPixelRing(burst.x, burst.y, radius, {
          color,
          alpha: alpha * 0.7,
          size: 2,
          points: 34,
          phase: progress * TAU * 0.22
        });
        drawPixelRing(burst.x, burst.y, radius + 10, {
          color,
          alpha: alpha * 0.44,
          size: 2,
          points: 22,
          phase: -progress * TAU * 0.18
        });
        drawPixelSpark(burst.x, burst.y, radius + 18, {
          color,
          alpha: alpha * 0.55,
          size: 2,
          rays: 6,
          phase: progress * TAU * 0.3
        });
      } else {
        drawPixelRing(burst.x, burst.y, radius, {
          color,
          alpha: alpha * 0.68,
          size: 2,
          points: 22,
          phase: progress * TAU * 0.12
        });
        drawPixelSpark(burst.x, burst.y, radius + 10, {
          color,
          alpha: alpha * 0.62,
          size: 2,
          rays: 8,
          phase: progress * TAU * 0.2
        });
      }
    }
  }

  function drawBumps() {
    for (const bump of state.bumps) {
      const progress = 1 - bump.life / 0.45;
      const alpha = (1 - progress) * 0.58;
      const spread = progress * 18;

      drawPixelLine(bump.x - 22 - spread, bump.y, bump.x - 7, bump.y - 7 - progress * 5, {
        color: colors.clay,
        alpha,
        size: 2,
        step: 5
      });
      drawPixelLine(bump.x + 7, bump.y - 7 - progress * 5, bump.x + 22 + spread, bump.y, {
        color: colors.clay,
        alpha,
        size: 2,
        step: 5
      });
      drawPixelLine(bump.x - 8 - spread * 0.4, bump.y + 3, bump.x + 8 + spread * 0.4, bump.y + 3, {
        color: colors.line,
        alpha: alpha * 0.62,
        size: 2,
        step: 5
      });
    }
  }

  function drawFloor() {
    const y = state.height - 22;
    const phase = Math.floor(state.lastTime / 160) % 6;

    ctx.save();
    ctx.fillStyle = colors.line;
    ctx.globalAlpha = 0.38;
    for (let x = -phase * 4; x < state.width + 12; x += 16) {
      ctx.fillRect(Math.round(x), Math.round(y + 10), 8, 2);
    }
    ctx.restore();
  }

  function isPassivePreviewMode() {
    return state.mode === "previewSeed" || state.mode === "previewIntro" || state.mode === "previewHang";
  }

  function nearestPassiveStartTarget(x, y) {
    if (!isPassivePreviewMode()) return null;

    if (state.mode === "previewSeed" && state.anchor) {
      return Math.hypot(x - state.anchor.x, y - state.anchor.y) <= 38 ? state.anchor : null;
    }

    const spiderHit = Math.hypot(x - state.spider.x, y - state.spider.y) <= 58;
    if (spiderHit) return state.spider;

    if (state.anchor && Math.hypot(x - state.anchor.x, y - state.anchor.y) <= 34) {
      return state.anchor;
    }

    return null;
  }

  function getPointerPoint(event) {
    return {
      x: event.clientX,
      y: event.clientY
    };
  }

  function isInteractiveTarget(target) {
    return Boolean(
      target &&
        target.closest(
          "a, button, input, textarea, select, summary, label, [contenteditable], [role='button'], [role='link']"
        )
    );
  }

  function canStartFreeDraw(event) {
    if (!state.freeDraw.unlocked || state.active || state.mode !== "idle" || reducedMotion.matches) return false;
    if (event.pointerType === "mouse" && event.button !== 0) return false;
    if (event.isPrimary === false) return false;
    const target = event.target instanceof Element ? event.target : null;
    return !isInteractiveTarget(target);
  }

  function cancelPendingFreeDraw() {
    clearFreeDrawHoldTimer();
    if (!state.freeDraw.pending) return;

    state.freeDraw.pending = false;
    state.freeDraw.pointerId = null;
  }

  function startFreeDrawFromPending() {
    const draw = state.freeDraw;
    if (!draw.unlocked || !draw.pending || state.active || state.mode !== "idle") {
      cancelPendingFreeDraw();
      return;
    }

    clearFreeDrawHoldTimer();
    draw.pending = false;
    draw.active = true;
    draw.suppressClick = true;
    updateFreeDrawBodyClass();
    ensureFreeDrawLoop();
  }

  function finishFreeDraw(event) {
    const draw = state.freeDraw;
    if (!draw.active && !draw.pending) return;

    if (event && draw.pointerId === event.pointerId) {
      draw.current = getPointerPoint(event);
    }

    clearFreeDrawHoldTimer();

    if (draw.active) {
      const strand = makeFreeDrawStrand(draw.start, draw.current, draw.trails.length + 1);
      if (strand) {
        draw.trails.push({
          ...strand,
          age: 0,
          life: freeDrawFadeDuration
        });
        draw.trails = draw.trails.slice(-4);
        ensureFreeDrawLoop();
      }
      draw.suppressClick = true;
    }

    draw.pending = false;
    draw.active = false;
    draw.pointerId = null;
    updateFreeDrawBodyClass();
  }

  function onDocumentPointerDown(event) {
    if (!canStartFreeDraw(event)) return;

    const point = getPointerPoint(event);
    const draw = state.freeDraw;
    clearFreeDrawHoldTimer();
    draw.pending = true;
    draw.active = false;
    draw.pointerId = event.pointerId;
    draw.holdStartedAt = performance.now();
    draw.start = point;
    draw.current = point;
    draw.holdTimerId = window.setTimeout(startFreeDrawFromPending, freeDrawHoldDuration * 1000);
  }

  function onDocumentPointerMove(event) {
    const draw = state.freeDraw;
    if (draw.pointerId !== event.pointerId) return;

    draw.current = getPointerPoint(event);

    if (draw.pending) {
      const distance = Math.hypot(draw.current.x - draw.start.x, draw.current.y - draw.start.y);
      if (distance > freeDrawMoveTolerance) {
        cancelPendingFreeDraw();
      }
      return;
    }

    if (!draw.active) return;

    event.preventDefault();
    event.stopPropagation();
    ensureFreeDrawLoop();
  }

  function onDocumentPointerUp(event) {
    if (state.freeDraw.pointerId !== event.pointerId) return;

    const wasActive = state.freeDraw.active;
    finishFreeDraw(event);

    if (wasActive) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function onDocumentPointerCancel(event) {
    if (state.freeDraw.pointerId !== event.pointerId) return;
    finishFreeDraw(event);
  }

  function onDocumentClick(event) {
    if (state.freeDraw.suppressClick) {
      state.freeDraw.suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (!state.active || state.mode === "quiet") return;

    if (nearestPassiveStartTarget(event.clientX, event.clientY)) {
      event.preventDefault();
      event.stopPropagation();
      startGame();
      return;
    }

    const hook = nearestHook(event.clientX, event.clientY);
    if (!hook) {
      const target = event.target instanceof Element ? event.target : null;
      if (isGameplayMode() && !isInteractiveTarget(target)) {
        addMissHint(event.clientX, event.clientY);
      }
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    attachToHook(hook);
  }

  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    startGame();
  });

  document.addEventListener("pointerdown", onDocumentPointerDown, true);
  document.addEventListener("pointermove", onDocumentPointerMove, { capture: true, passive: false });
  document.addEventListener("pointerup", onDocumentPointerUp, true);
  document.addEventListener("pointercancel", onDocumentPointerCancel, true);
  document.addEventListener("click", onDocumentClick, true);

  window.addEventListener("resize", () => {
    resizeCanvas();
    if (state.active) draw();
  });

  schedulePassiveArrival();
})();
