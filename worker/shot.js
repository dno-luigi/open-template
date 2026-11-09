// Screenshot a page with Cloudflare Browser Run (Playwright) so it can be read
// by the vision model and rebuilt as a fill-in template.
//
//   POST /api/site/:siteId/shot { url, fullPage?, width?, height?, scale?, settle? }
//   -> { image: "data:image/jpeg;base64,...", url, width, height, fullPage, scale }
//
// The browser binding is optional: without BROWSER the endpoint says so and the
// upload path still works. Every capture is counted against the same daily
// per-IP limit as AI help, because each one starts a real browser.
import { launch } from "@cloudflare/playwright";
import { sha256Hex } from "./crypto.js";
import { clientIp, fail, json, nowIso } from "./util.js";

const MAX_URL = 2000;
const MAX_IMAGE_BYTES = 3_500_000;
// Hosts that must never be reachable from a public screenshot endpoint.
const PRIVATE =
  /^(localhost|127\.|0\.0\.0\.0|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\])/i;
const PRIVATE_SUFFIX = /\.(local|internal|localhost)$/i;

const clamp = (value, min, max, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};

export async function handleShot(request, env, body) {
  if (!env.BROWSER) {
    return fail(503, "browser_not_configured", "Browser screenshots are not connected on this site.");
  }

  const raw = String(body.url || "").trim().slice(0, MAX_URL);
  let target;
  try {
    target = new URL(raw);
  } catch {
    return fail(400, "bad_url", "Paste a full address, starting with https://.");
  }
  if (!/^https?:$/.test(target.protocol)) {
    return fail(400, "bad_url", "Only http and https addresses can be captured.");
  }
  if (PRIVATE.test(target.hostname) || PRIVATE_SUFFIX.test(target.hostname)) {
    return fail(400, "bad_url", "That address cannot be captured from here.");
  }

  const width = clamp(body.width, 320, 2000, 1200);
  const height = clamp(body.height, 400, 3000, 1600);
  const scale = Number(body.scale) === 2 ? 2 : 1;
  const fullPage = body.fullPage !== false;
  const settle = body.settle !== false;

  const db = env.DB;
  const day = nowIso().slice(0, 10);
  const ipHash = await sha256Hex(clientIp(request));
  const limit = Number(env.AI_DAILY_LIMIT || 20) || 20;
  if (db) {
    const used = await db
      .prepare("SELECT COUNT(*) AS n FROM ai_usage WHERE day = ? AND ip_hash = ?")
      .bind(day, ipHash)
      .first();
    if (Number(used?.n || 0) >= limit) {
      return fail(429, "rate_limited", "The daily limit for captures is used up. Try again tomorrow.");
    }
  }

  let browser;
  try {
    browser = await launchWithRetry(env.BROWSER);
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
    const response = await page.goto(target.href, { waitUntil: "networkidle", timeout: 30_000 });
    if (!response || response.status() >= 400) {
      return fail(502, "shot_failed", `That page answered ${response ? response.status() : "nothing"}.`);
    }

    if (settle) {
      // Scroll the page so reveal/lazy sections render, then return to the top.
      await page.evaluate(async () => {
        const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const step = Math.max(300, Math.round(window.innerHeight * 0.75));
        const limit = document.documentElement.scrollHeight;
        for (let y = 0, n = 0; y < limit && n < 60; y += step, n += 1) {
          window.scrollTo(0, y);
          await pause(120);
        }
        window.scrollTo(0, 0);
        await pause(300);
      });
    }
    await page.waitForTimeout(400);

    let buffer = await page.screenshot({
      type: "jpeg",
      quality: 80,
      fullPage,
      animations: "disabled",
      caret: "hide",
    });
    if (buffer.length > MAX_IMAGE_BYTES) {
      buffer = await page.screenshot({
        type: "jpeg",
        quality: 78,
        fullPage: false,
        animations: "disabled",
        caret: "hide",
      });
    }

    if (db) {
      await db
        .prepare("INSERT INTO ai_usage (id, ip_hash, day, created_at) VALUES (?, ?, ?, ?)")
        .bind(crypto.randomUUID(), ipHash, day, nowIso())
        .run();
    }
    const title = await page.title().catch(() => "");
    return json({
      image: `data:image/jpeg;base64,${toBase64(buffer)}`,
      url: target.href,
      title: String(title || "").slice(0, 200),
      width,
      height,
      fullPage,
      scale,
    });
  } catch (err) {
    console.error("screenshot failed:", err && err.stack ? err.stack : err);
    return fail(502, "shot_failed", "That page could not be captured. Check the address and try again.");
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

async function launchWithRetry(binding, attempts = 2) {
  let last;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await launch(binding);
    } catch (err) {
      last = err;
      if (i + 1 < attempts) await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  throw last;
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
