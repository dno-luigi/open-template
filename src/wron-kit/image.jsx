// <Img> for every picture on a site: sized before it loads (no layout jump),
// lazy below the fold, fades in, serves smaller files to phones when the host
// can resize, and never shows a broken-image box.
import { useEffect, useRef, useState } from "react";
import { cn, RATIO_FALLBACK, ratioPadding, ratioStyle, resizeHost } from "./runtime.js";

const WIDTHS = [480, 768, 1080, 1440, 1920];

/** A srcset for hosts that resize on request; null for everything else. */
function responsive(src) {
  if (typeof src !== "string") return null;
  try {
    const u = new URL(src);
    if (u.hostname === "images.pexels.com") {
      return WIDTHS.map((w) => {
        const v = new URL(src);
        v.searchParams.set("auto", "compress");
        v.searchParams.set("cs", "tinysrgb");
        v.searchParams.set("w", String(w));
        v.searchParams.delete("h");
        return `${v.toString()} ${w}w`;
      }).join(", ");
    }
    // The site's own pictures, on a host that resizes on request: one file in the store, the
    // right size for each screen on the way out. Without this every phone downloaded the full
    // picture; a shop's home page came to 9 MB that way (measured 2026-10-06).
    if (resizeHost === "vercel" && u.hostname === "firebasestorage.googleapis.com") {
      return WIDTHS.map((w) => `/_vercel/image?url=${encodeURIComponent(src)}&w=${w}&q=75 ${w}w`).join(", ");
    }
    if (u.hostname === "images.unsplash.com") {
      return WIDTHS.map((w) => {
        const v = new URL(src);
        v.searchParams.set("w", String(w));
        v.searchParams.set("auto", "format");
        v.searchParams.set("q", "75");
        return `${v.toString()} ${w}w`;
      }).join(", ");
    }
  } catch { /* relative or malformed: leave it alone */ }
  return null;
}

/**
 * src        the image URL
 * alt        what the picture shows (required; "" only for pure decoration)
 * ratio      reserve the shape before it loads: "16/9", "4/5", "1/1", "3/2"
 * priority   the hero image: load immediately, never lazily
 * className  the frame (size, rounding, shadow); imgClassName the picture itself
 * sizes      how wide it shows, for choosing a file ("(min-width: 1024px) 50vw, 100vw")
 */
export function Img({ src, alt = "", ratio, priority = false, className, imgClassName, sizes = "100vw", position, style, ...rest }) {
  const [state, setState] = useState("loading");
  const ref = useRef(null);
  // A prerendered page's image can finish loading before React attaches its
  // onLoad, which would leave it invisible; check once after mounting.
  useEffect(() => {
    const el = ref.current;
    setState("loading");
    if (el && el.complete) setState(el.naturalWidth > 0 ? "loaded" : "error");
  }, [src]);
  const srcSet = responsive(src);
  const failed = state === "error" || !src;
  // A picture in a reserved shape fills it, cropped, unless the page says how it should
  // sit. "object-contain" beside the default "object-cover" lost to it (both are one
  // class each and the stylesheet lists cover later), so a logo asked to be shown whole
  // was cropped at both ends: the default steps aside when the page names its own.
  const ownFit = /(^|\s)object-(contain|fill|none|scale-down)(\s|$)/.test(typeof imgClassName === "string" ? imgClassName : "");
  // A frame the page gave its own height needs no padding to hold it open.
  const pad = ratio && !/(^|\s)h-/.test(typeof className === "string" ? className : "") ? ratioPadding(ratio) : null;
  return (
    <div
      className={cn("relative overflow-hidden", pad && RATIO_FALLBACK, className)}
      style={{ ...(ratio ? { aspectRatio: ratio } : null), ...(pad ? { "--wron-ratio": pad } : null), ...style }}
    >
      {failed ? (
        <div
          data-wron-image-error=""
          role={alt ? "img" : undefined}
          aria-label={alt || undefined}
          className={ratio ? "absolute inset-0" : cn("w-full aspect-[16/10]", RATIO_FALLBACK)}
          style={{ ...(ratio ? null : ratioStyle("aspect-[16/10]")), background: "linear-gradient(135deg, rgb(var(--c-surface) / 1), rgb(var(--c-line) / 1))" }}
        />
      ) : (
        <img
          ref={ref}
          src={src}
          srcSet={srcSet || undefined}
          sizes={srcSet ? sizes : undefined}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          decoding="async"
          onLoad={() => setState("loaded")}
          onError={() => setState("error")}
          className={cn(
            ratio ? "absolute inset-0 h-full w-full" : "block h-auto w-full",
            ratio && !ownFit ? "object-cover" : null,
            "transition-opacity duration-700",
            state === "loaded" || priority ? "opacity-100" : "opacity-0",
            imgClassName,
          )}
          style={position ? { objectPosition: position } : undefined}
          {...rest}
        />
      )}
    </div>
  );
}
