// The signature moves award-level sites are made of (see the 2026-09-30 design
// research): each is small, respects reduced motion and touch screens, and is
// the kind of detail a model gets subtly wrong when it writes it from scratch.
import { Children, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform, useInView } from "motion/react";
import { cn } from "./runtime.js";
import { EASE_OUT } from "./motion.jsx";

const NOISE = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>')}")`;

/** A fixed film-grain layer over the whole page (editorial, luxury, food, wellness). Static by design. */
export function Grain({ opacity = 0.05, className }) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none fixed inset-0 z-[55]", className)}
      style={{ opacity, backgroundImage: NOISE, backgroundSize: "180px 180px" }}
    />
  );
}

/**
 * A header that slides away while reading down and returns on the way up,
 * transparent over the hero and solid once scrolled.
 * <SmartHeader className="..." solidClassName="bg-bg/85 backdrop-blur border-b border-line">...</SmartHeader>
 */
export function SmartHeader({ children, className, solidClassName = "bg-bg/85 backdrop-blur-md border-b border-line", threshold = 24 }) {
  const { scrollY } = useScroll();
  const reduce = useReducedMotion();
  const [hidden, setHidden] = useState(false);
  const [solid, setSolid] = useState(false);
  const last = useRef(0);
  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = last.current;
    last.current = y;
    setSolid(y > threshold);
    if (reduce) return;
    if (y > 240 && y > prev + 4) setHidden(true);
    else if (y < prev - 4 || y < 120) setHidden(false);
  });
  return (
    <motion.header
      className={cn("fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300", solid ? solidClassName : "border-b border-transparent", className)}
      animate={{ y: hidden ? "-100%" : "0%" }}
      transition={{ duration: 0.3, ease: EASE_OUT }}
      onFocusCapture={() => setHidden(false)}
    >
      {children}
    </motion.header>
  );
}

/**
 * The business name as one huge line that exactly fills its container (the
 * studio-footer move). Pass the name; it scales to any width.
 */
export function Wordmark({ text, className, fill = "currentColor" }) {
  const chars = Math.max(1, [...String(text)].length);
  // A viewBox sized to the text's rough proportions; textLength does the exact fit.
  const w = 1000;
  const h = Math.round((w / chars) * 1.25);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("block w-full", className)} role="img" aria-label={text}>
      <text
        x="0"
        y={h * 0.82}
        textLength={w}
        lengthAdjust="spacingAndGlyphs"
        fill={fill}
        style={{ fontFamily: "var(--font-display)", fontSize: h * 1.02, letterSpacing: "-0.03em" }}
      >
        {text}
      </text>
    </svg>
  );
}

/** A card with a soft light that follows the cursor. Set the glow colour with glow="rgb(var(--c-primary) / .14)". */
export function Spotlight({ children, className, glow = "rgb(var(--c-primary) / .14)", size = 380, ...rest }) {
  const ref = useRef(null);
  return (
    <div
      ref={ref}
      className={cn("relative overflow-hidden", className)}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el || e.pointerType !== "mouse") return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--x", `${e.clientX - r.left}px`);
        el.style.setProperty("--y", `${e.clientY - r.top}px`);
        el.style.setProperty("--o", "1");
      }}
      onPointerLeave={() => ref.current?.style.setProperty("--o", "0")}
      {...rest}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{ opacity: "var(--o, 0)", background: `radial-gradient(${size}px circle at var(--x, 50%) var(--y, 50%), ${glow}, transparent 60%)` }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

/**
 * One word in a headline that cycles ("Websites for [dentists / gyms / florists]").
 * The slot keeps the width of the longest word, so nothing around it jumps.
 */
export function RotatingWord({ words = [], interval = 2400, cycles = 3, className }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const count = useRef(0);
  useEffect(() => {
    if (reduce || words.length < 2) return;
    const t = setInterval(() => {
      count.current += 1;
      if (count.current >= words.length * cycles) { clearInterval(t); setI(0); return; }
      setI((n) => (n + 1) % words.length);
    }, interval);
    return () => clearInterval(t);
  }, [reduce, words.length, interval, cycles]);
  return (
    <span className={cn("relative inline-grid align-bottom", className)} aria-live="off">
      {words.map((w) => <span key={w} aria-hidden="true" style={{ gridArea: "1 / 1", visibility: "hidden" }}>{w}</span>)}
      <span style={{ gridArea: "1 / 1", overflow: "hidden", display: "inline-block" }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={words[i]}
            style={{ display: "inline-block" }}
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: "0%", opacity: 1 }}
            exit={{ y: "-100%", opacity: 0 }}
            transition={{ duration: 0.45, ease: EASE_OUT }}
          >
            {words[i]}
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  );
}

/**
 * A picture or video that starts inset with rounded corners and grows to the full
 * width of the screen as it scrolls into place.
 */
export function ExpandMedia({ children, className, height = "90vh" }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const clip = useTransform(scrollYProgress, [0, 1], ["inset(8% 14% round 28px)", "inset(0% 0% round 0px)"]);
  return (
    <div ref={ref} className={cn("relative w-full overflow-hidden", className)} style={{ height }}>
      <motion.div className="absolute inset-0" style={reduce ? undefined : { clipPath: clip }}>
        {children}
      </motion.div>
    </div>
  );
}

/**
 * "How it works" storytelling: text steps scroll past while their picture stays
 * pinned beside them and changes with the step. Phones get each picture inline.
 * steps: [{ title, body, media }] where media is any element (an <Img>, a screenshot).
 */
export function StickySteps({ steps = [], className, stepClassName, mediaClassName = "rounded-theme overflow-hidden" }) {
  const [active, setActive] = useState(0);
  return (
    <div className={cn("grid gap-10 md:grid-cols-2 md:gap-16", className)}>
      <div>
        {steps.map((s, i) => (
          <Step key={i} index={i} onActive={setActive} className={stepClassName}>
            <div className={cn("md:hidden mb-6", mediaClassName)}>{s.media}</div>
            {s.title && <h3 className="text-2xl md:text-3xl">{s.title}</h3>}
            {s.body && <div className="mt-3 text-muted leading-relaxed">{s.body}</div>}
          </Step>
        ))}
      </div>
      <div className="relative hidden md:block">
        <div className={cn("sticky top-24 h-[calc(100vh-8rem)]", mediaClassName)}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active}
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: EASE_OUT }}
            >
              {steps[active]?.media}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function Step({ index, onActive, children, className }) {
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.6 });
  useEffect(() => { if (inView) onActive(index); }, [inView, index, onActive]);
  return <div ref={ref} className={cn("flex min-h-[70vh] flex-col justify-center py-10", className)}>{children}</div>;
}

/** A vertical line that fills as the visitor scrolls through a list of steps. */
export function Timeline({ items = [], className, lineClassName = "bg-primary" }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 70%", "end 60%"] });
  return (
    <div ref={ref} className={cn("relative pl-10", className)}>
      <div aria-hidden="true" className="absolute left-3 top-2 bottom-2 w-px bg-line" />
      <motion.div aria-hidden="true" className={cn("absolute left-3 top-2 bottom-2 w-px origin-top", lineClassName)} style={reduce ? undefined : { scaleY: scrollYProgress }} />
      <ol className="grid gap-12">
        {items.map((it, i) => (
          <li key={i} className="relative">
            <span aria-hidden="true" className="absolute -left-10 top-1.5 grid h-6 w-6 place-items-center rounded-full border border-line bg-bg text-[11px]">{i + 1}</span>
            {it.title && <h3 className="text-xl md:text-2xl">{it.title}</h3>}
            {it.body && <div className="mt-2 text-muted leading-relaxed">{it.body}</div>}
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── Local business ──────────────────────────────────────────────────────────
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_NAMES = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };

function toMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || "").trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
function fmt(hhmm) {
  const mins = toMinutes(hhmm);
  if (mins === null) return hhmm;
  const h = Math.floor(mins / 60) % 24, m = mins % 60;
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, "0")}${ampm}` : `${h12}${ampm}`;
}

/** "Open now · closes 9pm" / "Closed · opens Tue 8am". hours: { mon: ["08:00", "21:00"], ..., sun: null }. */
export function openStatus(hours, now = new Date()) {
  const day = DAYS[now.getDay()];
  const mins = now.getHours() * 60 + now.getMinutes();
  const today = hours?.[day];
  if (today) {
    const o = toMinutes(today[0]), c = toMinutes(today[1]);
    if (o !== null && c !== null && mins >= o && mins < (c <= o ? c + 1440 : c)) return { open: true, label: `Open now · closes ${fmt(today[1])}` };
  }
  for (let k = 0; k < 7; k += 1) {
    const d = DAYS[(now.getDay() + k) % 7];
    const h = hours?.[d];
    if (!h) continue;
    if (k === 0 && toMinutes(h[0]) !== null && mins < toMinutes(h[0])) return { open: false, label: `Closed · opens ${fmt(h[0])}` };
    if (k > 0) return { open: false, label: `Closed · opens ${DAY_NAMES[d].slice(0, 3)} ${fmt(h[0])}` };
  }
  return { open: false, label: "Closed" };
}

/** The live open/closed line. Renders nothing when prerendered (the time would be the server's). */
export function OpenNow({ hours, className }) {
  const [label, setLabel] = useState(null);
  useEffect(() => {
    const update = () => setLabel(openStatus(hours));
    update();
    const t = setInterval(update, 60000);
    return () => clearInterval(t);
  }, [hours]);
  if (!label) return null;
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: label.open ? "#16a34a" : "#9ca3af" }} />
      {label.label}
    </span>
  );
}

/** The week's hours as a list, today highlighted. */
export function HoursTable({ hours, className, closedLabel = "Closed" }) {
  const [today, setToday] = useState(null);
  useEffect(() => { setToday(DAYS[new Date().getDay()]); }, []);
  const order = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  return (
    <dl className={cn("grid gap-2", className)}>
      {order.map((d) => (
        <div key={d} className={cn("flex justify-between gap-6", today === d && "font-semibold")}>
          <dt>{DAY_NAMES[d]}</dt>
          <dd className="tabular-nums">{hours?.[d] ? `${fmt(hours[d][0])} to ${fmt(hours[d][1])}` : closedLabel}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A bar pinned to the bottom of phone screens once the hero has scrolled away:
 * one or two big actions (Call, Book, Get a quote). Hidden on desktop.
 */
export function StickyActions({ children, className, after = 480 }) {
  const { scrollY } = useScroll();
  const [show, setShow] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setShow(y > after));
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className={cn("fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-line bg-bg/95 p-3 backdrop-blur md:hidden", className)}
          style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
          initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          transition={{ duration: 0.3, ease: EASE_OUT }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * A button/link label that rolls up to a copy of itself on hover. Put it inside
 * any element with the `group` class: <a className="group ..."><RollText>Book a table</RollText></a>
 */
export function RollText({ children, className }) {
  return (
    <span className={cn("relative inline-flex overflow-hidden", className)}>
      <span className="block transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-full motion-reduce:transition-none">{children}</span>
      <span aria-hidden="true" className="absolute inset-0 block translate-y-full transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0 motion-reduce:transition-none">{children}</span>
    </span>
  );
}

/** Children laid out as a masonry wall (testimonials, a gallery of mixed shapes). */
export function Masonry({ children, className, columns = "columns-1 sm:columns-2 lg:columns-3", gap = "gap-4" }) {
  return (
    <div className={cn(columns, gap, className)}>
      {Children.toArray(children).map((c, i) => <div key={i} className="mb-4 break-inside-avoid">{c}</div>)}
    </div>
  );
}
