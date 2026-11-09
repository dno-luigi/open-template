// Interactive pieces with the details people forget: Escape closes, focus moves
// into a dialog and back out, the page behind stops scrolling, keyboard users can
// reach everything, and nothing breaks when prerendered. Styling is left to the
// site through className props, so every site still looks like itself.
import { useCallback, useEffect, useId, useRef, useState, Children } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn, isServer } from "./runtime.js";
import { EASE_OUT } from "./motion.jsx";

// ── Scroll lock + focus, shared by Dialog and Sheet ─────────────────────────
let locks = 0;
function useScrollLock(active) {
  useEffect(() => {
    if (!active) return;
    locks += 1;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      locks -= 1;
      if (locks === 0) document.body.style.overflow = prev;
    };
  }, [active]);
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

// onClose lives in a ref: a page's inline onClose={() => setOpen(false)} is a new
// function every render, and with it in the effect's list each keystroke in a form
// inside the dialog moved focus back to Close (and closed the iPhone keyboard)
// (audit, 2026-10-12).
function useFocusTrap(open, ref, onClose) {
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement;
    const node = ref.current;
    const first = node && node.querySelector(FOCUSABLE);
    (first || node)?.focus?.();
    function onKey(e) {
      if (e.key === "Escape") { e.stopPropagation(); close.current?.(); return; }
      if (e.key !== "Tab" || !node) return;
      const items = Array.from(node.querySelectorAll(FOCUSABLE));
      if (!items.length) return;
      const a = items[0], z = items[items.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      before?.focus?.();
    };
  }, [open, ref]);
}

function Portal({ children }) {
  if (isServer) return null;
  return createPortal(children, document.body);
}

/**
 * A modal dialog. Controlled: <Dialog open={open} onClose={() => setOpen(false)} title="Book a table">...</Dialog>
 * panelClassName styles the box (colors, radius, padding, width).
 */
export function Dialog({ open, onClose, title, children, className, panelClassName, overlayClassName, labelledBy }) {
  const ref = useRef(null);
  const id = useId();
  const reduce = useReducedMotion();
  useScrollLock(open);
  useFocusTrap(open, ref, onClose);
  return (
    <Portal>
      <AnimatePresence>
        {open && (
          <div className={cn("fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-6", className)}>
            <motion.div
              className={cn("absolute inset-0 bg-black/50 backdrop-blur-[2px]", overlayClassName)}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
            />
            <motion.div
              ref={ref}
              role="dialog"
              aria-modal="true"
              aria-labelledby={labelledBy || (title ? id : undefined)}
              tabIndex={-1}
              className={cn("relative w-full sm:max-w-lg max-h-[90vh] overflow-auto rounded-t-3xl sm:rounded-3xl bg-surface text-ink p-6 sm:p-8 shadow-2xl outline-none", panelClassName)}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
            >
              {title && <h2 id={id} className="text-xl font-semibold pr-10">{title}</h2>}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full opacity-70 transition hover:opacity-100 hover:bg-black/5"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
              <div className={title ? "mt-4" : ""}>{children}</div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Portal>
  );
}

/** A panel that slides in from the side (mobile navigation, a cart, filters). side: "right" | "left". */
export function Sheet({ open, onClose, side = "right", children, className, panelClassName, label = "Menu" }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  useScrollLock(open);
  useFocusTrap(open, ref, onClose);
  const offset = side === "left" ? "-100%" : "100%";
  return (
    <Portal>
      <AnimatePresence>
        {open && (
          <div className={cn("fixed inset-0 z-[70]", className)}>
            <motion.div className="absolute inset-0 bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
            <motion.aside
              ref={ref}
              role="dialog"
              aria-modal="true"
              aria-label={label}
              tabIndex={-1}
              className={cn(
                "absolute top-0 bottom-0 w-[86vw] max-w-sm overflow-y-auto bg-surface text-ink p-6 shadow-2xl outline-none",
                side === "left" ? "left-0" : "right-0",
                panelClassName,
              )}
              initial={reduce ? { opacity: 0 } : { x: offset }}
              animate={reduce ? { opacity: 1 } : { x: 0 }}
              exit={reduce ? { opacity: 0 } : { x: offset }}
              transition={{ duration: 0.35, ease: EASE_OUT }}
            >
              {children}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </Portal>
  );
}

/**
 * Questions and answers that open one at a time.
 * <Accordion items={[{ q: "Do you take walk-ins?", a: "Yes, until 6pm." }]} />
 * or pass children as <AccordionItem title="...">...</AccordionItem>.
 */
export function Accordion({ items, children, multiple = false, className, itemClassName, defaultOpen = -1 }) {
  const [openSet, setOpenSet] = useState(() => new Set(defaultOpen >= 0 ? [defaultOpen] : []));
  const list = items
    ? items.map((it, i) => <AccordionItem key={i} title={it.q ?? it.title}>{it.a ?? it.content}</AccordionItem>)
    : Children.toArray(children);
  return (
    <div className={cn("divide-y divide-line border-y border-line", className)}>
      {list.map((child, i) => (
        <AccordionRow
          key={i}
          open={openSet.has(i)}
          className={itemClassName}
          onToggle={() =>
            setOpenSet((prev) => {
              const next = new Set(multiple ? prev : []);
              if (prev.has(i)) next.delete(i); else next.add(i);
              return next;
            })
          }
          {...child.props}
        />
      ))}
    </div>
  );
}

export function AccordionItem() {
  return null; // rendered through Accordion, which reads its props
}

function AccordionRow({ title, children, open, onToggle, className }) {
  const id = useId();
  const reduce = useReducedMotion();
  return (
    <div className={className}>
      <h3 className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-6 py-5 text-left text-base sm:text-lg font-medium"
        >
          <span>{title}</span>
          <motion.svg
            width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
            animate={{ rotate: open ? 45 : 0 }} transition={{ duration: reduce ? 0 : 0.25 }}
            style={{ flexShrink: 0, opacity: 0.7 }}
          >
            <path d="M12 5v14M5 12h14" />
          </motion.svg>
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            role="region"
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            style={{ overflow: "hidden" }}
          >
            <div className="pb-5 text-muted leading-relaxed">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Tabs. <Tabs tabs={[{ label: "Monthly", content: <A/> }, { label: "Yearly", content: <B/> }]} />
 * listClassName / tabClassName style the row; pillClassName is the sliding highlight, activeClassName the active label.
 */
export function Tabs({ tabs = [], initial = 0, onChange, className, listClassName, tabClassName, pillClassName = "bg-ink", activeClassName = "text-bg", panelClassName }) {
  const [active, setActive] = useState(initial);
  const refs = useRef([]);
  const base = useId();
  const select = (i) => { setActive(i); onChange?.(i); };
  return (
    <div className={className}>
      <div role="tablist" className={cn("inline-flex gap-1 rounded-full border border-line p-1", listClassName)}
        onKeyDown={(e) => {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          const next = (active + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
          select(next);
          refs.current[next]?.focus();
        }}
      >
        {tabs.map((t, i) => (
          <button
            key={i}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="tab"
            id={`${base}-t${i}`}
            aria-selected={active === i}
            aria-controls={`${base}-p${i}`}
            tabIndex={active === i ? 0 : -1}
            onClick={() => select(i)}
            className={cn("relative rounded-full px-4 py-2 text-sm font-medium transition-colors", active === i ? activeClassName : "opacity-70 hover:opacity-100", tabClassName)}
          >
            {active === i && (
              <motion.span
                layoutId={`${base}-pill`}
                aria-hidden="true"
                className={cn("absolute inset-0 rounded-full", pillClassName)}
                transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
              />
            )}
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </div>
      {tabs.map((t, i) => (
        <div key={i} role="tabpanel" id={`${base}-p${i}`} aria-labelledby={`${base}-t${i}`} hidden={active !== i} className={panelClassName}>
          {t.content}
        </div>
      ))}
    </div>
  );
}

/**
 * A swipeable row with arrow buttons and dots (testimonials, a gallery, products).
 * Native scroll snapping underneath, so it works with a finger, a trackpad and a keyboard.
 */
export function Carousel({ children, className, trackClassName, itemClassName = "w-[85%] sm:w-[48%] lg:w-[32%]", showArrows = true, showDots = true, arrowClassName, label = "Carousel" }) {
  const track = useRef(null);
  const items = Children.toArray(children);
  const [index, setIndex] = useState(0);
  const onScroll = useCallback(() => {
    const el = track.current;
    if (!el || !el.children.length) return;
    const w = el.children[0].getBoundingClientRect().width || 1;
    setIndex(Math.round(el.scrollLeft / w));
  }, []);
  const go = (i) => {
    const el = track.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(items.length - 1, i));
    const child = el.children[clamped];
    if (child) el.scrollTo({ left: child.offsetLeft - el.offsetLeft, behavior: "smooth" });
  };
  const arrow = cn("grid h-11 w-11 place-items-center rounded-full border border-line bg-surface/80 backdrop-blur transition hover:bg-surface disabled:opacity-30", arrowClassName);
  return (
    <div className={cn("relative", className)} role="region" aria-roledescription="carousel" aria-label={label}>
      <div
        ref={track}
        onScroll={onScroll}
        className={cn("flex gap-5 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", trackClassName)}
        style={{ scrollSnapType: "x mandatory" }}
      >
        {items.map((c, i) => (
          <div key={i} className={cn("shrink-0", itemClassName)} style={{ scrollSnapAlign: "start" }}>{c}</div>
        ))}
      </div>
      {(showArrows || showDots) && items.length > 1 && (
        <div className="mt-6 flex items-center justify-between gap-4">
          {showDots ? (
            <div className="flex gap-2">
              {items.map((_, i) => (
                <button key={i} type="button" aria-label={`Go to slide ${i + 1}`} onClick={() => go(i)}
                  className={cn("h-2 rounded-full transition-all", i === index ? "w-6 bg-ink" : "w-2 bg-ink/25")} />
              ))}
            </div>
          ) : <span />}
          {showArrows && (
            <div className="flex gap-2">
              <button type="button" className={arrow} aria-label="Previous" onClick={() => go(index - 1)} disabled={index <= 0}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg>
              </button>
              <button type="button" className={arrow} aria-label="Next" onClick={() => go(index + 1)} disabled={index >= items.length - 1}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m9 18 6-6-6-6" /></svg>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** A draggable before/after comparison of two images. */
export function BeforeAfter({ before, after, beforeAlt = "Before", afterAlt = "After", className, initial = 50 }) {
  const [pos, setPos] = useState(initial);
  return (
    <div className={cn("relative select-none overflow-hidden", className)}>
      <img src={after} alt={afterAlt} className="block h-full w-full object-cover" draggable={false} />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <img src={before} alt={beforeAlt} className="block h-full w-full object-cover" draggable={false} />
      </div>
      <div className="pointer-events-none absolute inset-y-0" style={{ left: `${pos}%`, width: 2, background: "white", boxShadow: "0 0 0 1px rgba(0,0,0,.15)" }}>
        <div className="absolute top-1/2 left-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-black shadow-lg">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m9 18-6-6 6-6M15 6l6 6-6 6" /></svg>
        </div>
      </div>
      <input
        type="range" min="0" max="100" value={pos} aria-label="Compare before and after"
        onChange={(e) => setPos(Number(e.target.value))}
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}

// ── Toasts ──────────────────────────────────────────────────────────────────
const listeners = new Set();
let toastId = 0;

/** Show a short message: toast("Saved"), toast.error("Could not send"), toast.success("Booked!"). */
export function toast(message, opts = {}) {
  const t = { id: ++toastId, message: String(message), tone: opts.tone || "default", duration: opts.duration ?? 3800 };
  listeners.forEach((l) => l(t));
  return t.id;
}
toast.success = (m, o) => toast(m, { ...o, tone: "success" });
toast.error = (m, o) => toast(m, { ...o, tone: "error" });

/** Mounted once by the site entry. Sites never render it themselves. */
export function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const add = (t) => {
      setItems((prev) => [...prev.slice(-3), t]);
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), t.duration);
    };
    listeners.add(add);
    return () => listeners.delete(add);
  }, []);
  return (
    <div aria-live="polite" style={{ position: "fixed", zIndex: 80, left: 0, right: 0, bottom: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, pointerEvents: "none", padding: "0 16px" }}>
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            style={{
              pointerEvents: "auto", maxWidth: 440, padding: "12px 18px", borderRadius: 14, fontSize: 14, lineHeight: 1.4,
              fontFamily: "var(--font-body, system-ui), system-ui, sans-serif",
              background: t.tone === "error" ? "#7f1d1d" : t.tone === "success" ? "#14532d" : "#111",
              color: "#fff", boxShadow: "0 10px 30px rgba(0,0,0,.25)",
            }}
          >
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ── Small state helper for menus, dialogs and sheets ────────────────────────
/** const menu = useDisclosure(); <button onClick={menu.onOpen}/> <Sheet open={menu.open} onClose={menu.onClose}/> */
export function useDisclosure(initial = false) {
  const [open, setOpen] = useState(initial);
  const onOpen = useCallback(() => setOpen(true), []);
  const onClose = useCallback(() => setOpen(false), []);
  const onToggle = useCallback(() => setOpen((o) => !o), []);
  return { open, onOpen, onClose, onToggle, setOpen };
}

/**
 * The way back to the cookie choice, for the footer: <CookieSettingsLink className="..." />.
 * It shows only where the site's cookie notice asks this visitor (Integrations,
 * Cookie notice), and renders nothing everywhere else, so it is safe on every site.
 */
export function CookieSettingsLink({ className, children = "Cookie settings" }) {
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(!!(typeof window !== "undefined" && window.wronCookies && window.wronCookies.applies)); }, []);
  if (!on) return null;
  return (
    <a href="#cookie-settings" className={className} onClick={(e) => { e.preventDefault(); window.wronCookies?.open?.(); }}>
      {children}
    </a>
  );
}
