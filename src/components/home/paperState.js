// Small shared state for the paper: local or shared mode, the share crossing, the save pulse, PDF errors.
import { useEffect, useState } from "react";

let state = { mode: "device", crossing: false, shareOpen: false, pulse: 0, pdfError: false };
const subs = new Set();

export const paperState = {
  get: () => state,
  set: (next) => {
    const patch = typeof next === "function" ? next(state) : next;
    state = { ...state, ...patch };
    subs.forEach((f) => f(state));
  },
  sub: (f) => {
    subs.add(f);
    return () => subs.delete(f);
  },
};

export function usePaperState() {
  const [s, setS] = useState(paperState.get());
  useEffect(() => {
    setS(paperState.get());
    return paperState.sub(setS);
  }, []);
  return s;
}
