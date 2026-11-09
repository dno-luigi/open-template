// "@wron/kit/3d": real-time 3D for generated sites, on react-three-fiber.
//
// <Scene> is the only way a site puts a WebGL canvas on a page, because the
// canvas is where 3D goes wrong: it cannot be prerendered, a phone without
// WebGL (or with it switched off) must still see the design, it must stop
// drawing when scrolled away, and a crash inside it must not take the page down.
// Scene handles all of that and shows its `poster` (a still of the scene) until
// the first frame is drawn, and instead of the canvas whenever 3D cannot run.
//
// This file is the light half: it never imports three.js. The canvas itself
// (./three-stage.jsx) and whatever the scene draws load only when a Scene mounts
// in a browser, so on a published site the words and pictures arrive first and
// the 3D after. A scene's own code belongs in src/three/*.jsx, passed as `load`,
// for the same reason, and imports the objects (Shape, Model, Particles, Waves,
// Globe) from "@wron/kit/3d/objects", never from here: a re-export here would put
// three.js back into every page's first download.
import { Component, Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { cn } from "./runtime.js";


const Stage = lazy(() => import("./three-stage.jsx"));

// The kit's cn() does not resolve conflicts, so "relative" is only added when the
// site has not positioned the scene itself (className="absolute inset-0" is the norm).
const POSITIONED = /(^|\s)(absolute|fixed|sticky|relative)(\s|$)/;

// Asked once a page: each probe held a WebGL context of its own, and a browser keeps
// only a handful (about 16) before it drops the oldest, a live scene's among them
// (audit, 2026-10-12).
let webgl = null;
function webglAvailable() {
  if (webgl !== null) return webgl;
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    webgl = !!gl;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webgl = false;
  }
  return webgl;
}

// The canvas's code arrives in a file of its own; when that file cannot load (a flaky
// connection, a deploy that replaced it) the error stops here and the poster stays,
// instead of reaching the page's boundary and blanking the page (audit, 2026-10-12).
class StageBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFail?.(); }
  render() { return this.state.failed ? null : this.props.children; }
}

/**
 * A WebGL canvas, done right.
 *
 * load       () => import("../three/Hero.jsx"): the scene's code, loaded when needed.
 *            Its default export is drawn inside the canvas, given `sceneProps`.
 * children   react-three-fiber elements, for scenes written inline (prefer `load`,
 *            which keeps three.js out of the page's first download)
 * poster     image URL (or element) shown until the first frame, and instead of
 *            the canvas without WebGL, with mobile="poster" on phones, or on error
 * lighting   "studio" | "soft" | "warm" | "cool" | "dramatic" | "neon" | "none"
 * accent     recolours the rim light
 * camera     { position: [x,y,z], fov } (defaults [0,0,6], 35)
 * effects    { bloom, noise, vignette, chromatic } post-processing, desktop only
 * mobile     "full" | "lite" (default: lower resolution, no effects) | "poster"
 */
export function Scene({
  children, load, sceneProps, className, style, poster, posterAlt = "", posterClassName, lighting = "studio", accent,
  camera, orthographic = false, effects, mobile = "lite", shadows = false, onReady, ...rest
}) {
  const wrap = useRef(null);
  const progress = useRef(0);
  const [mounted, setMounted] = useState(false);
  const [small, setSmall] = useState(false);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const reduce = !!useReducedMotion();

  useEffect(() => {
    setSmall(window.matchMedia("(max-width: 767px)").matches);
    if (!webglAvailable()) setFailed(true);
    setMounted(true);
  }, []);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "200px 0px" });
    io.observe(el);
    let raf = 0;
    const measure = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      progress.current = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(measure); };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const Loaded = useMemo(() => {
    if (!load) return null;
    return lazy(async () => {
      const m = await load();
      const C = m?.default;
      if (typeof C !== "function" && typeof C !== "object") throw new Error("the scene file has no default export");
      return { default: C };
    });
  }, [load]);

  const posterOnly = failed || (small && mobile === "poster");
  const lite = small && mobile !== "full";
  const ctx = useMemo(() => ({ progress, small, reduce }), [small, reduce]);

  const posterNode = poster
    ? typeof poster === "string"
      ? <img src={poster} alt={posterAlt} className={cn("absolute inset-0 h-full w-full object-cover", posterClassName)} draggable={false} />
      : poster
    : null;

  return (
    <div ref={wrap} className={cn(!POSITIONED.test(className || "") && "relative", "overflow-hidden", className)} style={style} data-wron-3d={ready ? "ready" : posterOnly && mounted ? "poster" : ""} {...rest}>
      {posterNode ? (
        <div aria-hidden={posterAlt ? undefined : true} className="absolute inset-0 transition-opacity duration-700" style={{ opacity: ready && !posterOnly ? 0 : 1 }}>
          {posterNode}
        </div>
      ) : null}
      {mounted && !posterOnly ? (
        <div className="absolute inset-0" style={{ opacity: ready ? 1 : 0, transition: "opacity .7s ease" }}>
          <StageBoundary onFail={() => setFailed(true)}>
            <Suspense fallback={null}>
              <Stage
                ctx={ctx}
                frameloop={!visible ? "never" : reduce ? "demand" : "always"}
                lite={lite}
                orthographic={orthographic}
                shadows={shadows}
                camera={camera}
                lighting={lighting}
                accent={accent}
                effects={effects}
                // eslint-disable-next-line react-hooks/static-components -- Loaded is memoised on `load`, so it is one component for the Scene's life, not one per render.
                content={Loaded ? <Loaded {...(sceneProps || {})} /> : children}
                onReady={() => { setReady(true); onReady?.(); }}
                onFail={() => setFailed(true)}
              />
            </Suspense>
          </StageBoundary>
        </div>
      ) : null}
    </div>
  );
}

const loadGradient = () => import("./three-objects.jsx").then((m) => ({ default: m.Gradient }));

/** A living mesh gradient, full-bleed behind content: <GradientBackground colors={["#0b1020","#154BFF","#E9E1D2","#11110F"]} /> */
export function GradientBackground({ colors = ["#0b1020", "#3a2cff", "#ff6a3d", "#f4efe6"], speed = 0.35, grain = 0.06, className, style, poster }) {
  const fallback = poster || <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${colors.join(", ")})` }} />;
  const sceneProps = useMemo(() => ({ colors, speed, grain }), [colors, speed, grain]);
  return (
    <Scene className={cn(!POSITIONED.test(className || "") && "absolute inset-0", className)} style={style} poster={fallback} lighting="none" mobile="full" load={loadGradient} sceneProps={sceneProps} />
  );
}
