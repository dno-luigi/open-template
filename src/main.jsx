// The first code every generated website runs. The model writes src/App.jsx (its
// <Routes>); this file owns everything around it so no site has to get it right:
// the router, errors, scrolling, links, toasts and the builder bridge.
import { Component, StrictMode, useEffect, useLayoutEffect } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter, MemoryRouter, useLocation, useNavigate } from "react-router";
import { MotionConfig } from "motion/react";
import App from "./App";
import "./styles.css";
import { isPreview, toBuilder } from "./wron-kit/runtime.js";
import { Toaster } from "./wron-kit/ui.jsx";
import { reportError, recordVisit } from "./wron-kit/cloud.js";
import { startEditorMotion } from "./wron-kit/editor-motion.js";

const boot = window.__WRON__ || {};
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

// ── Errors ──────────────────────────────────────────────────────────────────
function describe(error) {
  if (!error) return { message: "Unknown error", stack: "" };
  return { message: String(error.message || error), stack: String(error.stack || "").slice(0, 4000) };
}

// The page the visitor is on, from the router: in the builder's preview the window's
// own address is the frame's ("srcdoc"), never the site's page.
let currentPath = isPreview ? (boot.path || "/") : window.location.pathname;

function report(error, where) {
  const info = describe(error);
  toBuilder({ type: "error", where, path: currentPath, ...info });
  if (!isPreview) reportError(info.message, info.stack, where);
}

/**
 * Errors nobody can act on: a script from another website failing (the browser
 * hides everything about it but "Script error."), and the browser's own notice that
 * a resize settled late. Reporting them only asked the builder to fix the unknowable.
 */
function noise(e) {
  const message = String((e && e.message) || "");
  if (e && !e.error && /^Script error\.?$/i.test(message)) return true;
  return /ResizeObserver loop (limit exceeded|completed with undelivered notifications)/i.test(message);
}

window.addEventListener("error", (e) => { if (!noise(e)) report(e.error || e.message, "window"); });
window.addEventListener("unhandledrejection", (e) => report(e.reason, "promise"));

class PageBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { report(error, "render"); }
  render() {
    if (!this.state.error) return this.props.children;
    if (isPreview) {
      return (
        <div style={{ minHeight: "60vh", display: "grid", placeItems: "center", padding: 32, fontFamily: "system-ui, sans-serif" }}>
          <div style={{ maxWidth: 520, textAlign: "center" }}>
            <p style={{ fontSize: 13, letterSpacing: ".08em", textTransform: "uppercase", opacity: .55, margin: 0 }}>This page hit an error</p>
            <p style={{ fontSize: 16, margin: "12px 0 0", lineHeight: 1.5 }}>{describe(this.state.error).message}</p>
            <p style={{ fontSize: 13, opacity: .6, margin: "12px 0 0" }}>Press Fix in the builder and Wron will repair it.</p>
          </div>
        </div>
      );
    }
    return (
      <div style={{ minHeight: "60vh", display: "grid", placeItems: "center", padding: 32, fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
        <div>
          <p style={{ fontSize: 18, margin: 0 }}>Something went wrong on this page.</p>
          <button type="button" onClick={() => window.location.reload()} style={{ marginTop: 16, padding: "10px 18px", borderRadius: 999, border: "1px solid currentColor", background: "transparent", cursor: "pointer" }}>Reload</button>
        </div>
      </div>
    );
  }
}

// ── Links, scrolling and the builder bridge ─────────────────────────────────
function scrollToHash(hash, smooth) {
  if (!hash || hash === "#") return false;
  let el = null;
  try { el = document.getElementById(decodeURIComponent(hash.slice(1))) || document.querySelector(hash); } catch { /* not a selector */ }
  if (!el) return false;
  // With the kit's SmoothScroll on, Lenis owns the scroll position.
  if (window.__wronLenis) window.__wronLenis.scrollTo(el, { immediate: !smooth });
  else el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
  return true;
}

function scrollToTop() {
  if (window.__wronLenis) window.__wronLenis.scrollTo(0, { immediate: true, force: true });
  else window.scrollTo(0, 0);
}

function Shell({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(startEditorMotion, []);

  // A new page starts at the top; a link to #section lands on that section.
  useIsoLayoutEffect(() => {
    if (location.hash) {
      // The target may render a frame later (a lazy section, an animation wrapper).
      if (!scrollToHash(location.hash, false)) requestAnimationFrame(() => scrollToHash(location.hash, false));
    } else {
      scrollToTop();
    }
  }, [location.pathname, location.hash]);

  // Tell the builder which page is showing, so its page menu follows clicks; on a
  // published site, count the visit instead.
  useEffect(() => {
    currentPath = location.pathname;
    toBuilder({ type: "route", path: location.pathname + location.search + location.hash });
  }, [location.pathname, location.search, location.hash]);
  useEffect(() => {
    recordVisit(location.pathname);
    // Tracking tags that do not follow page changes by themselves (the Meta and
    // TikTok pixels, src/lib/site/integrations.ts) count them from this.
    try { window.dispatchEvent(new CustomEvent("wron:route", { detail: { path: location.pathname } })); } catch {}
  }, [location.pathname]);

  // Plain <a href="/pricing"> links (not <Link>) still navigate inside the site
  // instead of reloading it, and inside the builder's preview they could not work
  // any other way. Links to other websites open in a new tab in the preview, where
  // following them would replace the preview itself.
  useEffect(() => {
    function onClick(e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (!a || a.hasAttribute("download")) return;
      const href = a.getAttribute("href") || "";
      const target = a.getAttribute("target");
      if (href.startsWith("#")) {
        e.preventDefault();
        if (scrollToHash(href, true) && !isPreview) window.history.replaceState(null, "", href);
        return;
      }
      if (/^(mailto:|tel:|sms:)/i.test(href)) return;
      // A file (a menu .pdf) is not a page; the browser opens it, and target="_blank" keeps its new tab.
      const isFile = (p) => /\.[a-z0-9]{2,5}$/i.test(p);
      if (/^https?:\/\//i.test(href) || href.startsWith("//")) {
        // Resolved against the page: "//host/x" alone is not a URL and threw (audit, 2026-10-12).
        let u = null;
        try { u = new URL(href, window.location.href); } catch { /* bad url */ }
        if (u && !isPreview && u.origin === window.location.origin) {
          if (target === "_blank" || isFile(u.pathname)) return;
          e.preventDefault();
          navigate(u.pathname + u.search + u.hash);
        } else if (isPreview && target !== "_blank") {
          e.preventDefault();
          window.open(href, "_blank", "noopener");
        }
        return;
      }
      if (href.startsWith("/") && target !== "_blank" && !isFile(href.split(/[?#]/)[0])) {
        e.preventDefault();
        navigate(href);
      }
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [navigate]);

  // The builder's page menu and back/forward buttons drive the preview.
  useEffect(() => {
    if (!isPreview) return;
    function onMessage(e) {
      // Only the builder around the preview drives it, not a frame the site placed (audit, 2026-10-12).
      if (e.source !== window.parent) return;
      const d = e.data || {};
      if (d.type === "wron-go" && typeof d.path === "string") navigate(d.path);
      else if (d.type === "wron-back") navigate(-1);
      else if (d.type === "wron-forward") navigate(1);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [navigate]);

  return <PageBoundary key={location.pathname}>{children}</PageBoundary>;
}

function Root() {
  const Router = isPreview ? MemoryRouter : BrowserRouter;
  // A site served under a path (wron.ai/s/<name>/ before it has its own domain) routes below that prefix.
  const routerProps = isPreview ? { initialEntries: [boot.path || "/"] } : boot.base ? { basename: boot.base } : {};
  return (
    <StrictMode>
      {/* Visitors who ask their device for less motion get fades instead of movement, everywhere. */}
      <MotionConfig reducedMotion="user">
        <Router {...routerProps}>
          <Shell>
            <App />
          </Shell>
          <Toaster />
        </Router>
      </MotionConfig>
    </StrictMode>
  );
}

const container = document.getElementById("root");
// A published page arrives with its HTML already rendered (for search engines and
// a fast first paint); React takes it over instead of drawing it again.
if (container.hasChildNodes() && !isPreview) {
  hydrateRoot(container, <Root />, {
    // Content that legitimately differs between the server and the browser (a
    // date, a random pick) is re-rendered by React; it is not an error for anyone.
    onRecoverableError() {},
  });
} else {
  createRoot(container).render(<Root />);
}
toBuilder({ type: "ready" });
