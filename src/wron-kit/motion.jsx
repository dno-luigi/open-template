// Motion that is hard to get right by hand, done once, well: every piece honours
// "reduce motion", animates only transform and opacity, and renders its final
// state when prerendered so search engines and slow phones see real content.
import { Children, useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { cn } from "./runtime.js";

/* eslint-disable react-hooks/static-components -- motion[tag] returns the same cached
   component for a tag every time (motion's own proxy), so picking one by the `as` prop is a
   lookup, not a component created per render. */
export const EASE_OUT = [0.16, 1, 0.3, 1];

function motionTag(as) {
  return motion[as] || motion.div;
}

/** Fades and rises into place the first time it scrolls into view. */
export function Reveal({ as = "div", children, delay = 0, y = 28, x = 0, scale = 1, duration = 0.8, once = true, amount = 0.15, className, ...rest }) {
  const reduce = useReducedMotion();
  const Tag = motionTag(as);
  if (reduce) return <Tag className={className} {...rest}>{children}</Tag>;
  return (
    <Tag
      className={className}
      data-reveal=""
      initial={{ opacity: 0, y, x, scale }}
      whileInView={{ opacity: 1, y: 0, x: 0, scale: 1 }}
      viewport={{ once, amount, margin: "0px 0px -8% 0px" }}
      transition={{ duration, delay, ease: EASE_OUT }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

const staggerParent = (gap, delay) => ({ hidden: {}, show: { transition: { staggerChildren: gap, delayChildren: delay } } });

/** Children wrapped in <StaggerItem> arrive one after another. */
export function Stagger({ as = "div", children, gap = 0.08, delay = 0, once = true, amount = 0.15, className, ...rest }) {
  const reduce = useReducedMotion();
  const Tag = motionTag(as);
  if (reduce) return <Tag className={className} {...rest}>{children}</Tag>;
  return (
    <Tag className={className} initial="hidden" whileInView="show" viewport={{ once, amount }} variants={staggerParent(gap, delay)} {...rest}>
      {children}
    </Tag>
  );
}

export function StaggerItem({ as = "div", children, y = 24, duration = 0.7, className, ...rest }) {
  const Tag = motionTag(as);
  return (
    <Tag
      className={className}
      data-reveal=""
      variants={{ hidden: { opacity: 0, y }, show: { opacity: 1, y: 0, transition: { duration, ease: EASE_OUT } } }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** A page's outer wrapper: a short fade in on arrival. Put <Seo> inside it or pass title/description to Page in index.js. */
export function PageFade({ as = "main", children, className, ...rest }) {
  const reduce = useReducedMotion();
  const Tag = motionTag(as);
  if (reduce) return <Tag className={className} {...rest}>{children}</Tag>;
  return (
    <Tag className={className} data-reveal="" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, ease: EASE_OUT }} {...rest}>
      {children}
    </Tag>
  );
}

/** Moves slower (or faster, with a negative speed) than the page as it scrolls. speed 0.1-0.4 reads as depth. */
export function Parallax({ children, speed = 0.2, className, ...rest }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const distance = speed * 240;
  const y = useTransform(scrollYProgress, [0, 1], [-distance, distance]);
  return (
    <motion.div ref={ref} className={className} style={reduce ? undefined : { y }} {...rest}>
      {children}
    </motion.div>
  );
}

const MARQUEE_CSS = `@keyframes wron-marquee{from{transform:translate3d(0,0,0)}to{transform:translate3d(-50%,0,0)}}
.wron-marquee-track{display:flex;width:max-content;animation:wron-marquee var(--wron-marquee-duration,30s) linear infinite}
.wron-marquee[data-reverse="true"] .wron-marquee-track{animation-direction:reverse}
.wron-marquee[data-pause="true"]:hover .wron-marquee-track{animation-play-state:paused}
@media (prefers-reduced-motion:reduce){.wron-marquee-track{animation:none}}`;

/** An endless horizontal ticker (logos, testimonials, words). Children are repeated to fill the loop. */
export function Marquee({ children, duration = 30, reverse = false, pauseOnHover = true, fade = true, gap = "3rem", className }) {
  const items = Children.toArray(children);
  const group = (hidden) => (
    <div aria-hidden={hidden || undefined} style={{ display: "flex", gap, paddingRight: gap, flexShrink: 0 }}>
      {items}
    </div>
  );
  // The fade is on an INNER layer: masking the outer element would also fade its
  // background, leaving pale smudges at the edges of a coloured band (2026-09-30).
  const fadeMask = "linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)";
  return (
    <div
      className={cn("wron-marquee", className)}
      data-reverse={reverse}
      data-pause={pauseOnHover}
      style={{ overflow: "hidden", ["--wron-marquee-duration"]: `${duration}s` }}
    >
      {/* Rendered by every marquee (repeated rules are harmless) so a prerendered page and the browser agree. */}
      <style>{MARQUEE_CSS}</style>
      <div style={fade ? { maskImage: fadeMask, WebkitMaskImage: fadeMask } : undefined}>
        <div className="wron-marquee-track">
          {group(false)}
          {group(true)}
        </div>
      </div>
    </div>
  );
}

/** Counts up to a number the first time it is seen. Renders the real number when prerendered. */
export function CountUp({ to, from = 0, duration = 1.6, decimals = 0, prefix = "", suffix = "", className }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const [value, setValue] = useState(to);
  const started = useRef(false);
  const format = (n) => new Intl.NumberFormat(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);

  useEffect(() => {
    if (reduce || started.current) return;
    if (!inView) { setValue(from); return; }
    started.current = true;
    const controls = animate(from, to, { duration, ease: EASE_OUT, onUpdate: setValue });
    return () => controls.stop();
  }, [inView, reduce, from, to, duration]);

  return <span ref={ref} className={className} style={{ fontVariantNumeric: "tabular-nums" }}>{prefix}{format(value)}{suffix}</span>;
}

/**
 * A headline whose words (or letters) rise into view one after another.
 * text must be a plain string. by: "word" | "char".
 */
export function SplitText({ text = "", as = "h2", by = "word", delay = 0, stagger = 0.06, className, once = true }) {
  const reduce = useReducedMotion();
  const Tag = as;
  const pieces = by === "char" ? Array.from(text) : text.split(/(\s+)/);
  if (reduce) return <Tag className={className}>{text}</Tag>;
  let index = 0;
  return (
    <Tag className={className} aria-label={text}>
      <motion.span
        aria-hidden="true"
        style={{ display: "inline" }}
        initial="hidden"
        whileInView="show"
        viewport={{ once, amount: 0.4 }}
        variants={staggerParent(stagger, delay)}
      >
        {pieces.map((piece, i) => {
          if (/^\s+$/.test(piece)) return <span key={i}>{piece}</span>;
          index += 1;
          return (
            <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "top", paddingBottom: "0.08em", marginBottom: "-0.08em" }}>
              <motion.span
                data-reveal=""
                style={{ display: "inline-block", willChange: "transform" }}
                variants={{ hidden: { y: "110%" }, show: { y: "0%", transition: { duration: 0.8, ease: EASE_OUT } } }}
              >
                {piece === " " ? " " : piece}
              </motion.span>
            </span>
          );
        })}
      </motion.span>
    </Tag>
  );
}

function useFinePointer() {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    setFine(mq.matches);
    const on = () => setFine(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return fine;
}

/** Pulls its child gently toward the cursor (buttons, icons). Off on touch screens. */
export function Magnetic({ children, strength = 0.3, className }) {
  const ref = useRef(null);
  const fine = useFinePointer();
  const reduce = useReducedMotion();
  const x = useSpring(useMotionValue(0), { stiffness: 250, damping: 18, mass: 0.4 });
  const y = useSpring(useMotionValue(0), { stiffness: 250, damping: 18, mass: 0.4 });
  const active = fine && !reduce;
  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ display: "inline-block", x, y }}
      onPointerMove={(e) => {
        if (!active || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onPointerLeave={() => { x.set(0); y.set(0); }}
    >
      {children}
    </motion.div>
  );
}

/** A card that tilts in 3D toward the cursor. Off on touch screens. */
export function Tilt({ children, max = 8, className, ...rest }) {
  const fine = useFinePointer();
  const reduce = useReducedMotion();
  const rx = useSpring(0, { stiffness: 200, damping: 20 });
  const ry = useSpring(0, { stiffness: 200, damping: 20 });
  const active = fine && !reduce;
  return (
    <motion.div
      className={className}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900, transformStyle: "preserve-3d" }}
      onPointerMove={(e) => {
        if (!active) return;
        const r = e.currentTarget.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        ry.set(px * max * 2);
        rx.set(-py * max * 2);
      }}
      onPointerLeave={() => { rx.set(0); ry.set(0); }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** A thin bar at the very top that fills as the page is read. */
export function ScrollProgress({ className = "bg-primary", height = 3 }) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });
  return (
    <motion.div
      aria-hidden="true"
      className={className}
      style={{ position: "fixed", top: 0, left: 0, right: 0, height, transformOrigin: "0% 50%", scaleX, zIndex: 60 }}
    />
  );
}

/**
 * Cards that pin and stack on top of each other while scrolling (a classic
 * "how it works" or case-study pattern). Each child becomes one card.
 * top: where the stack pins, in px from the top of the screen (clear the nav).
 */
export function StackCards({ children, top = 96, step = 18, className, cardClassName }) {
  const items = Children.toArray(children);
  return (
    <div className={className} style={{ display: "grid", gap: 32 }}>
      {items.map((child, i) => (
        <div key={i} className={cardClassName} style={{ position: "sticky", top: top + i * step }}>
          {child}
        </div>
      ))}
    </div>
  );
}

/**
 * A row that scrolls sideways while the page scrolls down (galleries, timelines,
 * case studies). On phones and with reduced motion it becomes a swipeable row.
 */
export function HorizontalScroll({ children, className, trackClassName, gap = 24 }) {
  const ref = useRef(null);
  const trackRef = useRef(null);
  const reduce = useReducedMotion();
  const [distance, setDistance] = useState(0);
  const [wide, setWide] = useState(false);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, [0, 1], [0, -distance]);

  useEffect(() => {
    const measure = () => {
      setWide(window.innerWidth >= 768);
      if (trackRef.current) setDistance(Math.max(0, trackRef.current.scrollWidth - window.innerWidth + 48));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  if (reduce || !wide) {
    return (
      <div className={className} style={{ overflowX: "auto", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}>
        <div className={trackClassName} style={{ display: "flex", gap, width: "max-content", padding: "0 24px" }}>
          {Children.toArray(children).map((c, i) => <div key={i} style={{ scrollSnapAlign: "start" }}>{c}</div>)}
        </div>
      </div>
    );
  }
  return (
    <section ref={ref} className={className} style={{ position: "relative", height: `calc(100vh + ${distance}px)` }}>
      <div style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden", display: "flex", alignItems: "center" }}>
        <motion.div ref={trackRef} className={trackClassName} style={{ x, display: "flex", gap, paddingLeft: 24, paddingRight: 24, width: "max-content" }}>
          {children}
        </motion.div>
      </div>
    </section>
  );
}

/** An image (or any block) uncovered by a wipe the first time it is seen. from: "bottom" | "left" | "right" | "top". */
export function ClipReveal({ children, from = "bottom", duration = 1.1, delay = 0, className }) {
  // The wrapper is what is watched: a fully clipped element has no visible area, so
  // the browser never reports it as in view and a clip that watched itself never
  // opened (the hero image stayed invisible, 2026-09-30). Every value is in percent
  // on both ends because motion cannot blend "100%" with a bare "0".
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });
  const reduce = useReducedMotion();
  const start = { bottom: "inset(100% 0% 0% 0%)", top: "inset(0% 0% 100% 0%)", left: "inset(0% 100% 0% 0%)", right: "inset(0% 0% 0% 100%)" }[from] || "inset(100% 0% 0% 0%)";
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <div ref={ref} className={className}>
      <motion.div
        data-reveal=""
        initial={{ clipPath: start }}
        animate={{ clipPath: inView ? "inset(0% 0% 0% 0%)" : start }}
        transition={{ duration, delay, ease: EASE_OUT }}
      >
        {children}
      </motion.div>
    </div>
  );
}

/** Words that light up one by one as the reader scrolls past (a big statement paragraph). */
export function ScrollText({ text = "", as = "p", className, dim = 0.18 }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 45%"] });
  const words = text.split(/\s+/).filter(Boolean);
  const Tag = as;
  if (reduce) return <Tag className={className}>{text}</Tag>;
  return (
    <Tag ref={ref} className={className} aria-label={text}>
      {words.map((w, i) => (
        <Word key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]} dim={dim}>{w}</Word>
      ))}
    </Tag>
  );
}

function Word({ children, progress, range, dim }) {
  const opacity = useTransform(progress, range, [dim, 1]);
  return (
    <motion.span aria-hidden="true" style={{ opacity }}>
      {children}{" "}
    </motion.span>
  );
}
