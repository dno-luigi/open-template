// Only activates on sections the owner adjusted in the visual editor.
// CSS/WAAPI animations (including Motion's browser animations) keep their original
// keyframes, scaled once. Canvas and custom requestAnimationFrame loops are untouched.
//
// Nothing runs on a site with no direct edits: the timer starts only while the page
// holds an edited area or a background video, and stops when a route without one is
// shown (Greptile on #98). The shell persists across pages, so the page is checked
// again whenever elements are added or removed (a route change, a section that renders
// late), at most once a frame; between changes nothing runs.
const EDITED = "[data-wron-design],video[data-wron-background]";
export function startEditorMotion() {
  const seen = new WeakMap();
  function update() {
    if (document.hidden) return;
    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    for(const video of document.querySelectorAll("video[data-wron-background]")){
      if(reduced||getComputedStyle(video).getPropertyValue("--wron-editor-motion").trim()==="off")video.pause();
    }
    if (!document.querySelector("[data-wron-design]")) return;
    for (const animation of document.getAnimations().slice(0, 400)) {
      const target = animation.effect?.target;
      const area = target instanceof Element ? target.closest("[data-wron-design]") : null;
      if (!area) continue;
      const setting = getComputedStyle(area).getPropertyValue("--wron-editor-motion").trim();
      if(!setting)continue;
      if (seen.get(animation)?.setting === setting) continue;
      const original = seen.get(animation)?.frames || animation.effect.getKeyframes();
      seen.set(animation, { setting, frames: original });
      if (setting === "off") {
        try { animation.effect.updateTiming({ iterations: 1 }); animation.finish(); } catch { animation.cancel(); }
        continue;
      }
      const [speed, amount] = setting.split(",").map(Number);
      if (!Number.isFinite(speed) || speed < .25 || speed > 3 || !Number.isFinite(amount) || amount < 0 || amount > 1) continue;
      animation.updatePlaybackRate(speed);
      if (amount === 1) continue;
      const frames = original.map(frame => {
        const result = { ...frame };
        if (typeof frame.transform === "string" && frame.transform !== "none") {
          try {
            const matrix = new DOMMatrix(frame.transform);
            if (matrix.is2D) result.transform = `matrix(${1 + (matrix.a - 1) * amount},${matrix.b * amount},${matrix.c * amount},${1 + (matrix.d - 1) * amount},${matrix.e * amount},${matrix.f * amount})`;
          } catch { /* Keep transforms the browser cannot decompose, such as percentages. */ }
        }
        return result;
      });
      try { animation.effect.setKeyframes(frames); } catch { /* An animation may finish during inspection. */ }
    }
  }
  let timer = null;
  function check() {
    const present = !!document.querySelector(EDITED);
    if (present && timer === null) { update(); timer = setInterval(update, 250); }
    else if (!present && timer !== null) { clearInterval(timer); timer = null; }
  }
  // Added or removed elements (a route change, a lazily rendered section) trigger one check
  // on the next frame; attribute and text changes do not, so animations cost nothing here.
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; check(); });
  });
  check();
  observer.observe(document.body, { childList: true, subtree: true });
  return () => { observer.disconnect(); if (timer !== null) clearInterval(timer); };
}
