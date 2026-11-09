import { lazy, Suspense, useEffect, useState } from "react";
import { Img } from "@wron/kit";
import { PAPER_POSTER } from "../../data/site";

// The 3D wrapper (and three.js behind it) loads after first paint, once the browser is idle.
const LazyScene = lazy(() => import("./HeroSceneInner"));

function Poster() {
  return (
    <Img
      src={PAPER_POSTER}
      alt=""
      ratio="4/3"
      priority
      sizes="(min-width: 1024px) 50vw, 100vw"
      className="absolute inset-0 w-full h-full"
      imgClassName="w-full h-full object-cover"
    />
  );
}

export default function HeroScene() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let id;
    let cancelled = false;
    const go = () => {
      if (!cancelled) setReady(true);
    };
    if (typeof window.requestIdleCallback === "function") {
      id = window.requestIdleCallback(go, { timeout: 1500 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback?.(id);
      };
    }
    id = setTimeout(go, 600);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, []);

  return (
    <>
      <Poster />
      {ready && (
        <Suspense fallback={null}>
          <LazyScene />
        </Suspense>
      )}
    </>
  );
}
