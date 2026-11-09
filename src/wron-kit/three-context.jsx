// The state a <Scene> shares with what is drawn inside it. Kept apart from the
// three.js code so a page that only places a Scene does not download three.js.
import { createContext, useContext } from "react";

export const SceneContext = createContext({ progress: { current: 0 }, small: false, reduce: false });

/** Inside a Scene: { progress, small, reduce }. progress.current runs 0 -> 1 as the
 *  scene's element travels from entering the bottom of the screen to leaving the top. */
export function useScene() {
  return useContext(SceneContext);
}

/** Inside a Scene: a ref whose .current is the scene's scroll progress, 0 -> 1. */
export function useSceneScroll() {
  return useContext(SceneContext).progress;
}

const pointer = { x: 0, y: 0 };
let pointerBound = false;
function bindPointer() {
  if (pointerBound || typeof window === "undefined") return;
  pointerBound = true;
  window.addEventListener("pointermove", (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
  }, { passive: true });
}

/** The cursor anywhere on the page, -1..1 on both axes (y up). Read it in useFrame. */
export function usePagePointer() {
  bindPointer();
  return pointer;
}
