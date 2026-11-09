// "@wron/kit/scroll": scrolling the way award sites do it. <SmoothScroll /> once
// in the layout gives inertial scrolling (Lenis); gsap comes with ScrollTrigger
// registered and driven by the same clock, so pinned and scrubbed sections stay
// exactly in step with the smoothed scroll. Reduced motion keeps native scrolling.
import { useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import Lenis from "lenis";
import { scrollToSection } from "./runtime.js";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger, useGSAP);

/** Smooth, inertial page scrolling. Render once, e.g. at the top of the layout. */
export function SmoothScroll({ lerp = 0.1, wheelMultiplier = 1 }) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ lerp, wheelMultiplier, anchors: true });
    const tick = (time) => lenis.raf(time * 1000);
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    window.__wronLenis = lenis;
    // A page's own element.scrollIntoView() fights Lenis, which owns the scroll
    // position, and the jump stalls or snaps back ("Continue to date" did not move,
    // 2026-09-30). While smooth scrolling is on, a page-level scrollIntoView goes
    // through Lenis and stops below a pinned header; one inside a scrolling box
    // (a carousel, a panel) keeps the browser's own.
    const native = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (arg) {
      if (window.__wronLenis !== lenis || insideScroller(this)) return native.call(this, arg);
      const opts = typeof arg === "object" && arg ? arg : { block: arg === false ? "end" : "start" };
      if (opts.block && opts.block !== "start") return native.call(this, arg);
      scrollToSection(this, { smooth: opts.behavior !== "auto" && opts.behavior !== "instant" });
    };
    return () => {
      Element.prototype.scrollIntoView = native;
      gsap.ticker.remove(tick);
      lenis.destroy();
      if (window.__wronLenis === lenis) window.__wronLenis = undefined;
    };
  }, [lerp, wheelMultiplier]);
  return null;
}

/** Is this element inside a box that scrolls on its own (not the page)? */
function insideScroller(el) {
  for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
    const st = getComputedStyle(p);
    if (/(auto|scroll)/.test(st.overflowY + st.overflowX) && (p.scrollHeight > p.clientHeight || p.scrollWidth > p.clientWidth)) return true;
  }
  return false;
}

/** Stops (true) or resumes (false) page scrolling, e.g. while a full-screen menu is open. */
export function useScrollLock(locked) {
  useEffect(() => {
    if (!locked) return;
    const lenis = window.__wronLenis;
    if (lenis) lenis.stop();
    else document.documentElement.style.overflow = "hidden";
    return () => {
      if (lenis) lenis.start();
      else document.documentElement.style.overflow = "";
    };
  }, [locked]);
}

export { gsap, ScrollTrigger, useGSAP };
