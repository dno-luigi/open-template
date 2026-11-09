// What every generated website knows about where it is running.
//
// These files are not part of Wron's own app. They are read from disk by
// src/lib/site/compile.ts and bundled INTO each customer site, the way
// src/lib/app-kit.ts ships a kit inside every generated app. The model never
// writes them and cannot change them; it imports them as "@wron/kit".
//
// The compiler writes window.__WRON__ into the page head before the bundle runs:
//   mode     "preview" inside the builder's iframe, "live" on a published site
//   siteId   the project the site belongs to (its backend is keyed on it)
//   api      the Wron origin the site's backend calls go to
//   key      the site's public key for those calls (never a secret)
//   path     the route a preview should open on
// During prerendering there is no window at all, which is its own mode.

// In the browser the page wrote window.__WRON__; when the site is rendered ahead of time there
// is no window, and the renderer sets the same object on its global instead (prerender.ts).
const boot = (typeof window !== "undefined" ? window.__WRON__ : typeof globalThis !== "undefined" ? globalThis.__WRON__ : null) || {};

export const isServer = typeof window === "undefined";
export const isPreview = !isServer && boot.mode === "preview";
export const isLive = !isServer && !isPreview;
export const siteId = boot.siteId || "";
export const apiBase = (boot.api || "").replace(/\/$/, "");
export const siteKey = boot.key || "";
/** The builder's preview: the server's signed pass that marks its entries as tests. */
export const previewPass = boot.pass || "";
/** "vercel" when the host resizes pictures on request; "" everywhere else (preview, export, the fallback host). */
export const resizeHost = boot.resize || "";

/** Tell the builder around the preview something happened. A published site has no parent to tell. */
export function toBuilder(message) {
  if (!isPreview) return;
  try { window.parent.postMessage({ source: "wron-site", ...message }, "*"); } catch { /* detached frame */ }
}

/** The one storage every kit module uses. A sandboxed frame throws on localStorage access; this never does. */
const memory = new Map();
export const storage = {
  get(key) {
    try { return window.localStorage.getItem(key); } catch { return memory.has(key) ? memory.get(key) : null; }
  },
  set(key, value) {
    try { window.localStorage.setItem(key, value); } catch { memory.set(key, value); }
  },
  remove(key) {
    try { window.localStorage.removeItem(key); } catch { memory.delete(key); }
  },
};

/** Join class names, skipping falsy ones. */
export function cn(...parts) {
  return parts.flat(Infinity).filter(Boolean).join(" ");
}

// ── Boxes with a shape ──────────────────────────────────────────────────────
// Safari before 15 (iPhones on iOS 14) has no aspect-ratio, so a box sized only by
// it was 0px tall and its picture, map or video vanished. There, and only there, the
// box is held open by top padding instead; what fills it is absolutely placed, so the
// padding moves nothing (audit, 2026-10-12).
export const RATIO_FALLBACK = "[@supports_not_(aspect-ratio:1/1)]:pt-[var(--wron-ratio)]";

/** The top padding that gives a box this shape: "16/9" or 1.5 -> "56.25%"; null when it can't tell. */
export function ratioPadding(ratio) {
  const m = String(ratio ?? "").match(/^\s*(\d*\.?\d+)\s*(?:\/\s*(\d*\.?\d+)\s*)?$/);
  if (!m) return null;
  const w = Number(m[1]), h = m[2] === undefined ? 1 : Number(m[2]);
  return w > 0 && h > 0 ? `${+((h / w) * 100).toFixed(4)}%` : null;
}

/**
 * The same for a box shaped by a class (aspect-video, aspect-square, aspect-[4/3]):
 * the style that carries its padding, or null. A box with its own height needs none.
 */
export function ratioStyle(className) {
  const s = typeof className === "string" ? className : "";
  if (/(^|\s)h-/.test(s)) return null;
  const m = s.match(/(?:^|\s)aspect-(video|square|\[([^\]\s]+)\])(?=\s|$)/);
  const pad = m && ratioPadding(m[1] === "video" ? "16/9" : m[1] === "square" ? "1/1" : m[2]);
  return pad ? { "--wron-ratio": pad } : null;
}

// ── Moving the page ─────────────────────────────────────────────────────────
/** How tall a header pinned to the top of the window is, so a section is not hidden under it. */
export function pinnedHeaderHeight() {
  if (typeof document === "undefined") return 0;
  let h = 0;
  for (const el of document.querySelectorAll("header, [data-pinned-header]")) {
    const st = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if ((st.position === "fixed" || st.position === "sticky") && r.top <= 1 && r.bottom > 0 && r.height < window.innerHeight / 2) h = Math.max(h, r.bottom);
  }
  return Math.round(h);
}

/**
 * Take the visitor to a part of the page: an element, an id ("date") or a selector.
 * Works with the kit's smooth scrolling, and stops below a pinned header.
 * scrollToSection("date"), scrollToSection(ref.current), scrollToSection("#faq", { smooth: false }).
 */
export function scrollToSection(target, { smooth = true, offset = 16 } = {}) {
  if (typeof document === "undefined") return false;
  let el = target;
  if (typeof target === "string") {
    try { el = document.getElementById(target.replace(/^#/, "")) || document.querySelector(target); } catch { el = null; }
  }
  if (!el || typeof el.getBoundingClientRect !== "function") return false;
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const gap = pinnedHeaderHeight() + offset;
  if (window.__wronLenis) window.__wronLenis.scrollTo(el, { offset: -gap, immediate: !smooth || reduce });
  else window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - gap), behavior: smooth && !reduce ? "smooth" : "auto" });
  return true;
}
