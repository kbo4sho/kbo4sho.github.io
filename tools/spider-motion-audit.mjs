#!/usr/bin/env node
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outputDir = "/tmp/spider-motion-audit";
const sampleInterval = 33;
const alphaThreshold = 24;
const frameClip = { width: 96, height: 130 };
const thresholds = {
  apparentDelta: 8,
  sizeDelta: 12,
  minPixelRatio: 0.65,
  maxPixelRatio: 1.45,
  minPixels: 80,
  toggleMs: 150
};

const scenarioArg = getArg("--scenarios") || "all";
const requestedScenarios = scenarioArg === "all"
  ? ["intro", "hook-loss", "fall-frame", "impact"]
  : scenarioArg.split(",").map((scenario) => scenario.trim()).filter(Boolean);

const { chromium } = await loadPlaywright();
await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });

const server = await startStaticServer(repoRoot);
const browser = await chromium.launch({ headless: true });
const results = [];

try {
  for (const scenario of requestedScenarios) {
    results.push(await runScenario(browser, server.url, scenario));
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.instance.close(resolve));
}

const summary = {
  generatedAt: new Date().toISOString(),
  outputDir,
  thresholds,
  scenarios: results.map(({ frames, filmstrip, ...result }) => ({
    ...result,
    filmstrip,
    frameCount: frames.length
  }))
};

await fs.writeFile(path.join(outputDir, "metrics.json"), JSON.stringify({
  ...summary,
  frames: Object.fromEntries(results.map((result) => [result.name, result.frames]))
}, null, 2));

console.log(JSON.stringify(summary, null, 2));

if (summary.scenarios.some((scenario) => scenario.failures.length > 0)) {
  process.exitCode = 1;
}

function getArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return "";
  return process.argv[index + 1] || "";
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    const require = createRequire(import.meta.url);
    const candidates = [
      ...((process.env.NODE_PATH || "").split(path.delimiter).filter(Boolean).map((root) => path.join(root, "playwright"))),
      path.join(os.homedir(), ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")
    ];

    for (const candidate of candidates) {
      try {
        return require(candidate);
      } catch {
        // Try the next known local runtime.
      }
    }
  }

  throw new Error("Playwright is not installed. Install playwright or run from the Codex bundled runtime.");
}

function startStaticServer(root) {
  const mimeTypes = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".mjs": "application/javascript",
    ".css": "text/css",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".pdf": "application/pdf"
  };

  const instance = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
      const filePath = path.normalize(path.join(root, pathname));

      if (!filePath.startsWith(root)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }

      const body = await fs.readFile(filePath);
      response.writeHead(200, {
        "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream"
      });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });

  return new Promise((resolve) => {
    instance.listen(0, "127.0.0.1", () => {
      const { port } = instance.address();
      resolve({ instance, url: `http://127.0.0.1:${port}` });
    });
  });
}

async function runScenario(browser, baseUrl, name) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const errors = [];

  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await instrumentGameScript(page);
  await page.addInitScript(() => {
    let seed = 7;
    Math.random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  });

  await page.goto(`${baseUrl}/?motion-audit=${name}`, { waitUntil: "load" });
  await page.getByRole("button", { name: "Try the portrait" }).click();
  await waitForGameReady(page);

  if (name === "intro") {
    await collectFrames(page, name, 1650);
  } else if (name === "hook-loss") {
    await page.waitForTimeout(1280);
    await page.evaluate(() => window.__spiderGameTest.detachSpider());
    await collectFrames(page, name, 1050);
  } else if (name === "fall-frame") {
    await page.waitForTimeout(1280);
    await page.evaluate(() => {
      window.__spiderGameTest.detachSpider();
      const spider = window.__spiderGameTest.state.spider;
      spider.vx = 210;
      spider.vy = 120;
      spider.blink = 0;
      window.__spiderGameTest.updateSpiderRenderPose(spider, 0.001);
    });
    await collectFrames(page, name, 950);
  } else if (name === "impact") {
    await page.waitForTimeout(1280);
    await page.evaluate(() => {
      window.__spiderGameTest.detachSpider();
      const spider = window.__spiderGameTest.state.spider;
      spider.y = window.innerHeight - 88;
      spider.vx = 34;
      spider.vy = 570;
      spider.blink = 0;
      window.__spiderGameTest.updateSpiderRenderPose(spider, 0.001);
    });
    await collectFrames(page, name, 900);
  } else {
    throw new Error(`Unknown scenario "${name}"`);
  }

  const frames = await page.evaluate(() => window.__motionAuditFrames);
  const failures = evaluateFrames(frames);
  if (errors.length) {
    failures.push(...errors.map((error) => ({ type: "console-error", message: error })));
  }

  const filmstrip = path.join(outputDir, `${name}.png`);
  await writeFilmstrip(browser, frames, filmstrip);
  await page.close();

  return {
    name,
    pass: failures.length === 0,
    failures,
    filmstrip,
    frames
  };
}

async function instrumentGameScript(page) {
  await page.route("**/spider-game.js", async (route) => {
    const file = await fs.readFile(path.join(repoRoot, "spider-game.js"), "utf8");
    const instrumented = file.replace(
      /\}\)\(\);\s*$/,
      "window.__spiderGameTest = { state, draw, detachSpider, getSpiderFrame, getSpiderRenderFrames, drawSpriteFrame, updateSpiderRenderPose, spiderSprite };\n})();"
    );
    await route.fulfill({ status: 200, contentType: "application/javascript", body: instrumented });
  });
}

async function waitForGameReady(page) {
  await page.waitForFunction(() => Boolean(window.__spiderGameTest?.state?.active));
  await page.waitForFunction(() => Boolean(window.__spiderGameTest?.state?.spider?.renderPose));
  await page.waitForFunction(() => Boolean(window.__spiderGameTest?.spiderSprite?.loaded));
}

async function collectFrames(page, scenario, duration) {
  await page.evaluate(() => {
    window.__motionAuditFrames = [];
  });

  const startedAt = Date.now();
  let index = 0;
  while (Date.now() - startedAt < duration) {
    await page.waitForTimeout(sampleInterval);
    const frame = await page.evaluate(({ scenario, alphaThreshold, frameClip, captureImage }) => {
      const game = window.__spiderGameTest;
      const canvas = document.getElementById("spider-game");
      const ctx = canvas.getContext("2d");
      const dpr = game.state.dpr || 1;
      const spider = game.state.spider;
      const frame = game.getSpiderFrame(spider);
      const render = game.getSpiderRenderFrames(spider);
      const region = {
        x: Math.max(0, Math.min(window.innerWidth - frameClip.width, spider.x - frameClip.width / 2)),
        y: Math.max(0, Math.min(window.innerHeight - frameClip.height, spider.y - frameClip.height * 0.58)),
        width: frameClip.width,
        height: frameClip.height
      };
      const sx = Math.round(region.x * dpr);
      const sy = Math.round(region.y * dpr);
      const sw = Math.min(canvas.width - sx, Math.round(region.width * dpr));
      const sh = Math.min(canvas.height - sy, Math.round(region.height * dpr));
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (render.previous) {
        game.drawSpriteFrame(spider, render.previous, render.visualSpeed, 1 - render.blend);
      }
      game.drawSpriteFrame(spider, render.current, render.visualSpeed, render.previous ? render.blend : 1);

      const data = ctx.getImageData(sx, sy, sw, sh).data;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      let pixels = 0;

      for (let y = 0; y < sh; y += 1) {
        const globalY = region.y + y / dpr;
        if (globalY > game.state.height - 14) continue;
        for (let x = 0; x < sw; x += 1) {
          const alpha = data[(y * sw + x) * 4 + 3];
          if (alpha <= alphaThreshold) continue;
          pixels += 1;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }

      const bbox = pixels
        ? {
          x: region.x + minX / dpr,
          y: region.y + minY / dpr,
          width: (maxX - minX + 1) / dpr,
          height: (maxY - minY + 1) / dpr,
          pixels
        }
        : null;

      const sample = {
        scenario,
        index: window.__motionAuditFrames.length,
        t: performance.now(),
        mode: game.state.mode,
        animation: frame.animation,
        frameIndex: frame.frameIndex,
        previousAnimation: frame.previousAnimation,
        previousFrameIndex: frame.previousFrameIndex,
        blend: Number(frame.blend.toFixed(3)),
        visualSpeed: Math.round(frame.visualSpeed),
        spider: {
          x: Number(spider.x.toFixed(2)),
          y: Number(spider.y.toFixed(2)),
          vx: Number(spider.vx.toFixed(2)),
          vy: Number(spider.vy.toFixed(2))
        },
        bbox,
        region
      };

      if (captureImage) {
        const shot = document.createElement("canvas");
        shot.width = sw;
        shot.height = sh;
        shot.getContext("2d").drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
        sample.image = shot.toDataURL("image/png");
      }

      game.draw();
      window.__motionAuditFrames.push(sample);
      return sample;
    }, { scenario, alphaThreshold, frameClip, captureImage: index % 4 === 0 });

    index += 1;
  }
}

function evaluateFrames(frames) {
  const failures = [];
  const animationEvents = [];

  for (const frame of frames) {
    if (!frame.bbox || frame.bbox.pixels < thresholds.minPixels) {
      failures.push({
        type: "blank-frame",
        index: frame.index,
        animation: frame.animation,
        frameIndex: frame.frameIndex,
        pixels: frame.bbox?.pixels || 0
      });
    }
  }

  for (let index = 1; index < frames.length; index += 1) {
    const previous = frames[index - 1];
    const current = frames[index];
    if (!previous.bbox || !current.bbox) continue;

    const previousCenter = bboxCenter(previous.bbox);
    const currentCenter = bboxCenter(current.bbox);
    const centerDelta = distance(previousCenter, currentCenter);
    const spiderDelta = distance(previous.spider, current.spider);
    const apparentDelta = Math.max(0, centerDelta - spiderDelta);
    const animationChanged = previous.animation !== current.animation || previous.frameIndex !== current.frameIndex;
    const sizeDelta = Math.abs(current.bbox.width - previous.bbox.width) + Math.abs(current.bbox.height - previous.bbox.height);
    const pixelRatio = current.bbox.pixels / Math.max(1, previous.bbox.pixels);
    const involvesImpact = previous.animation === "impact" || current.animation === "impact";

    if (apparentDelta > thresholds.apparentDelta) {
      failures.push({
        type: "apparent-delta",
        index,
        from: frameLabel(previous),
        to: frameLabel(current),
        value: Number(apparentDelta.toFixed(2))
      });
    }

    if (animationChanged && sizeDelta > thresholds.sizeDelta) {
      failures.push({
        type: "size-delta",
        index,
        from: frameLabel(previous),
        to: frameLabel(current),
        value: Number(sizeDelta.toFixed(2))
      });
    }

    if (!involvesImpact && (pixelRatio < thresholds.minPixelRatio || pixelRatio > thresholds.maxPixelRatio)) {
      failures.push({
        type: "pixel-ratio",
        index,
        from: frameLabel(previous),
        to: frameLabel(current),
        value: Number(pixelRatio.toFixed(2))
      });
    }

    if (previous.animation !== current.animation) {
      animationEvents.push({
        index,
        t: current.t,
        from: previous.animation,
        to: current.animation
      });
    }
  }

  for (let index = 2; index < animationEvents.length; index += 1) {
    const first = animationEvents[index - 2];
    const current = animationEvents[index];
    if (first.from === current.to && current.t - first.t <= thresholds.toggleMs) {
      failures.push({
        type: "animation-toggle",
        index: current.index,
        sequence: `${first.from}->${first.to}->${current.to}`,
        elapsed: Number((current.t - first.t).toFixed(1))
      });
    }
  }

  return failures;
}

async function writeFilmstrip(browser, frames, outPath) {
  const shots = frames.filter((frame) => frame.image).slice(0, 18);
  if (!shots.length) return;

  const cellWidth = frameClip.width;
  const cellHeight = frameClip.height + 36;
  const columns = 6;
  const rows = Math.ceil(shots.length / columns);
  const page = await browser.newPage({ viewport: { width: columns * cellWidth, height: rows * cellHeight }, deviceScaleFactor: 1 });

  await page.setContent(`<canvas width="${columns * cellWidth}" height="${rows * cellHeight}"></canvas>`);
  await page.evaluate(async ({ shots, columns, cellWidth, cellHeight }) => {
    const canvas = document.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f4f2ea";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = "10px monospace";
    ctx.fillStyle = "#1f2823";

    await Promise.all(shots.map((shot, index) => new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        const x = (index % columns) * cellWidth;
        const y = Math.floor(index / columns) * cellHeight;
        ctx.drawImage(image, x, y, cellWidth, cellHeight - 36);
        ctx.fillText(`${shot.mode} ${shot.animation}:${shot.frameIndex}`, x + 6, y + cellHeight - 22);
        ctx.fillText(`blend ${shot.blend} v${shot.visualSpeed}`, x + 6, y + cellHeight - 8);
        resolve();
      };
      image.src = shot.image;
    })));
  }, { shots, columns, cellWidth, cellHeight });

  await page.locator("canvas").screenshot({ path: outPath });
  await page.close();
}

function bboxCenter(bbox) {
  return {
    x: bbox.x + bbox.width / 2,
    y: bbox.y + bbox.height / 2
  };
}

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function frameLabel(frame) {
  return `${frame.animation}:${frame.frameIndex}`;
}
