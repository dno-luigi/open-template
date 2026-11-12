import { lazy, Suspense, useEffect, useState } from "react";

// The 3D wrapper (and three.js behind it) loads after first paint, once the browser is idle.
const LazyScene = lazy(() => import("./HeroSceneInner"));

// No poster: the still was rendered in the old violet theme, and because the
// canvas paints transparent it stayed visible underneath the live scene. The
// card's own paper colour holds the space until the first frame arrives.

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
      {ready && (
        <Suspense fallback={null}>
          <LazyScene />
        </Suspense>
      )}
    </>
  );
}
