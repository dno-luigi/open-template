// Other companies' tools, placed on a page: a booking calendar (Calendly or
// Cal.com, connected under Integrations), a Google map, a YouTube or Vimeo video.
// Each is a lazy iframe in a box the page sizes, and a link that still works if
// the frame cannot load. None needs a key.
import { useEffect, useState } from "react";
import { cn, RATIO_FALLBACK, ratioStyle } from "./runtime.js";

const frameClass = "absolute inset-0 h-full w-full border-0";

/** Calendly or Cal.com, inline. <BookingEmbed url="https://calendly.com/you/30min" className="h-[720px]" /> */
export function BookingEmbed({ url, className, title = "Book a time" }) {
  const [src, setSrc] = useState(null);
  const ok = typeof url === "string" && /^https:\/\/(calendly\.com|cal\.com)\/[A-Za-z0-9_.\/-]+$/.test(url);
  // Calendly asks for the page's own domain, which is only known in the browser.
  useEffect(() => {
    if (!ok) return;
    const u = new URL(url);
    if (u.hostname === "calendly.com") {
      u.searchParams.set("embed_type", "Inline");
      u.searchParams.set("embed_domain", window.location.hostname || "localhost");
      u.searchParams.set("hide_gdpr_banner", "1");
    } else {
      u.searchParams.set("embed", "true");
    }
    setSrc(u.toString());
  }, [url, ok]);
  if (!ok) return null;
  return (
    <div className={cn("relative w-full overflow-hidden", className || "h-[720px]")}>
      {src ? <iframe src={src} title={title} loading="lazy" className={frameClass} /> : null}
      <noscript><a href={url}>{title}</a></noscript>
    </div>
  );
}

/** A Google map of an address or a place name. <MapEmbed query="12 Harbour St, Whitby" className="aspect-[16/9]" /> */
export function MapEmbed({ query, zoom = 15, className, title, muted = false }) {
  if (!query) return null;
  const src = `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=${Math.max(3, Math.min(20, Number(zoom) || 15))}&output=embed`;
  const box = className || "aspect-[16/9]";
  const shape = ratioStyle(box);
  return (
    <div className={cn("relative w-full overflow-hidden", box, shape && RATIO_FALLBACK)} style={shape || undefined}>
      <iframe
        src={src}
        title={title || `Map of ${query}`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className={frameClass}
        style={muted ? { filter: "grayscale(1) contrast(1.05)" } : undefined}
      />
    </div>
  );
}

function videoSource(url, background) {
  if (typeof url !== "string") return null;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (yt) {
    const q = background ? `?autoplay=1&mute=1&loop=1&playlist=${yt[1]}&controls=0&playsinline=1&rel=0` : "?rel=0";
    return `https://www.youtube-nocookie.com/embed/${yt[1]}${q}`;
  }
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d{6,12})/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}${background ? "?background=1" : "?dnt=1"}`;
  return null;
}

/** A YouTube or Vimeo video. background plays it muted on a loop with no controls. */
export function VideoEmbed({ url, title = "Video", className, background = false }) {
  const src = videoSource(url, background);
  if (!src) return null;
  const box = className || "aspect-video";
  const shape = ratioStyle(box);
  return (
    <div className={cn("relative w-full overflow-hidden", box, shape && RATIO_FALLBACK)} style={shape || undefined}>
      <iframe
        src={src}
        title={title}
        loading="lazy"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        className={cn(frameClass, background && "pointer-events-none")}
      />
    </div>
  );
}
