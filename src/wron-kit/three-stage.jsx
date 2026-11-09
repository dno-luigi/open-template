// The heavy half of <Scene> (three.js, react-three-fiber, post-processing):
// loaded only once a Scene is on the page and mounted in a browser.
import { Component, Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { EffectComposer, Bloom, Noise, Vignette, ChromaticAberration } from "@react-three/postprocessing";
import * as THREE from "three";
import { SceneContext } from "./three-context.jsx";

// ── Lighting ────────────────────────────────────────────────────────────────
// Each preset: ambient level, key light, and four light panels that the objects
// reflect. `accent` recolours the rim panel, e.g. a cobalt edge light.
const LIGHTS = {
  studio: { ambient: 0.4, key: ["#ffffff", 1.4], panels: [["#ffffff", 3], ["#ffffff", 1.2], ["#ffffff", 1.6], ["#ffffff", 0.8]] },
  soft: { ambient: 0.7, key: ["#ffffff", 0.8], panels: [["#ffffff", 1.6], ["#ffffff", 1], ["#ffffff", 1], ["#ffffff", 0.6]] },
  warm: { ambient: 0.45, key: ["#ffe2c4", 1.5], panels: [["#ffd9b0", 3], ["#fff1e0", 1.2], ["#ffb070", 1.8], ["#ffffff", 0.6]] },
  cool: { ambient: 0.4, key: ["#dfefff", 1.3], panels: [["#cfe6ff", 3], ["#ffffff", 1.2], ["#6fb6ff", 2], ["#ffffff", 0.6]] },
  dramatic: { ambient: 0.08, key: ["#ffffff", 2.2], panels: [["#ffffff", 5], ["#000000", 0], ["#ffffff", 2.5], ["#000000", 0]] },
  neon: { ambient: 0.15, key: ["#ffffff", 0.6], panels: [["#ff2bd6", 4], ["#2bf0ff", 3], ["#7c4dff", 3], ["#ffffff", 0.5]] },
};

function Lighting({ preset = "studio", accent }) {
  if (preset === "none") return null;
  const p = LIGHTS[preset] || LIGHTS.studio;
  const [a, b, c, d] = p.panels;
  return (
    <>
      <ambientLight intensity={p.ambient} />
      <directionalLight position={[3, 4, 5]} intensity={p.key[1]} color={p.key[0]} />
      <Environment resolution={256} frames={1}>
        <group rotation={[-Math.PI / 3, 0, 1]}>
          <Lightformer form="circle" intensity={a[1]} color={a[0]} rotation-x={Math.PI / 2} position={[0, 5, -9]} scale={2} />
          <Lightformer form="circle" intensity={b[1]} color={b[0]} rotation-y={Math.PI / 2} position={[-5, 1, -1]} scale={2} />
          <Lightformer form="circle" intensity={c[1] * (accent ? 1.3 : 1)} color={accent || c[0]} rotation-y={-Math.PI / 2} position={[10, 1, 0]} scale={8} />
          <Lightformer form="rect" intensity={d[1]} color={d[0]} rotation-y={Math.PI / 2} position={[-10, 1, 0]} scale={[20, 2, 1]} />
        </group>
      </Environment>
    </>
  );
}

class SceneBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) {
    console.warn("[wron 3d] scene failed, showing the poster:", error?.message || error);
    this.props.onFail?.();
  }
  render() { return this.state.failed ? null : this.props.children; }
}

/** Marks the scene ready once its content has loaded and drawn a frame. */
function FirstFrame({ onReady }) {
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    requestAnimationFrame(() => onReady());
  });
  return null;
}

function Effects({ bloom = 0, noise = 0, vignette = 0, chromatic = 0 }) {
  const offset = useMemo(() => new THREE.Vector2(chromatic, chromatic), [chromatic]);
  // EffectComposer wants real effect elements, never null or fragments.
  const list = [
    bloom ? <Bloom key="bloom" intensity={bloom} luminanceThreshold={0.6} luminanceSmoothing={0.2} mipmapBlur /> : null,
    chromatic ? <ChromaticAberration key="ca" offset={offset} /> : null,
    noise ? <Noise key="noise" opacity={noise} premultiply /> : null,
    vignette ? <Vignette key="vignette" eskil={false} offset={0.2} darkness={vignette} /> : null,
  ].filter(Boolean);
  if (!list.length) return null;
  return <EffectComposer multisampling={0}>{list}</EffectComposer>;
}

/**
 * A WebGL canvas, done right. Children are react-three-fiber elements, or pass
 * `load={() => import("../three/Hero.jsx")}` to load the scene's code only when
 * the page needs it.
 *
 * poster     image URL (or element) shown until the first frame, and instead of
 *            the canvas without WebGL, with reduced motion + mobile="poster", or on error
 * lighting   "studio" | "soft" | "warm" | "cool" | "dramatic" | "neon" | "none"
 * accent     recolours the rim light
 * camera     { position: [x,y,z], fov } (defaults [0,0,6], 35)
 * effects    { bloom, noise, vignette, chromatic } post-processing, desktop only
 * mobile     "full" | "lite" (default: lower resolution, no effects) | "poster"
 */
export default function Stage({ ctx, frameloop, lite, orthographic, shadows, camera, lighting, accent, effects, content, onReady, onFail }) {
  return (
    <Canvas
      style={{ position: "absolute", inset: 0 }}
      dpr={lite ? [1, 1.5] : [1, 2]}
      frameloop={frameloop}
      orthographic={orthographic}
      shadows={shadows}
      gl={{ antialias: !lite, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0, 6], fov: 35, near: 0.1, far: 200, ...(camera || {}) }}
      aria-hidden="true"
    >
      <SceneContext.Provider value={ctx}>
        <SceneBoundary onFail={onFail}>
          <Suspense fallback={null}>
            <Lighting preset={lighting} accent={accent} />
            {content}
            {effects && !lite ? <Effects {...effects} /> : null}
            <FirstFrame onReady={onReady} />
          </Suspense>
        </SceneBoundary>
      </SceneContext.Provider>
    </Canvas>
  );
}
