// Other companies' widgets on a page, the way each company says to place them
// (researched 2026-10-01 against their live scripts):
//
//   <Widget kind="opentable" rid="412810" />        a tool the owner connected under
//                                                   Integrations; the builder is given
//                                                   the exact props for each one
//   <Embed url="https://open.spotify.com/..." />     anything the owner pasted a link to:
//                                                   music, podcasts, videos, forms
//
// Every prop is checked against the shape its company issues before it goes into an
// address or a script, so a page can't be made to load anything else. Scripts load
// once per page, from the company's own address, and never in <head>: several find
// their own <script> tag to know where to draw.
//
// The builder's preview is a locked-down frame (it must never reach the owner's Wron
// account), and booking, ticket and payment widgets can't run inside it: there the
// page shows a card saying what will be in that spot on the published site. Players
// (music, podcasts, video) play in the preview too.
import { useEffect, useId, useRef, useState } from "react";
import { cn, isPreview, isServer, RATIO_FALLBACK, ratioStyle } from "./runtime.js";

const frameClass = "absolute inset-0 h-full w-full border-0";

/** An id for a widget's box that is unique on the page (the same widget can appear twice) and safe in a selector. */
function useBoxId(prefix) {
  return `${prefix}-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
}
const scripts = new Map();

/** Load a script once per page. `into`: an element it must sit inside (scripts that find themselves). */
function loadScript(src, { into, attrs } = {}) {
  if (isServer) return Promise.reject(new Error("server"));
  if (!into && scripts.has(src)) return scripts.get(src);
  const p = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    if (attrs) for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
    s.onload = () => resolve(s);
    s.onerror = () => { scripts.delete(src); reject(new Error(`Couldn't load ${src}`)); };
    (into || document.body).appendChild(s);
  });
  if (!into) scripts.set(src, p);
  return p;
}

/** What will be in this spot on the published site (the preview can't run it). */
function PreviewCard({ name, href, className, note }) {
  return (
    <div className={cn("flex w-full flex-col items-center justify-center gap-2 rounded-theme border border-dashed border-line bg-surface p-6 text-center", className)}>
      <p className="font-display text-lg text-ink">{name}</p>
      <p className="max-w-sm text-sm text-muted">{note || "This appears here on your published site."}</p>
      {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline underline-offset-4">Open it in a new tab</a> : null}
    </div>
  );
}

/**
 * A frame in a box the page sizes (className replaces the default size, `box`),
 * with a link that still works if the frame can't load. `look` always applies.
 */
function Frame({ src, title, className, box, look, allow, href }) {
  const size = className || box;
  const shape = ratioStyle(size);
  return (
    <div className={cn("relative w-full overflow-hidden", look, size, shape && RATIO_FALLBACK)} style={shape || undefined}>
      <iframe src={src} title={title} loading="lazy" allow={allow} className={frameClass} referrerPolicy="strict-origin-when-cross-origin" />
      {href ? <noscript><a href={href}>{title}</a></noscript> : null}
    </div>
  );
}

/** A button in the site's own style that opens another company's booking window. */
function OpenButton({ label, className, onClick, disabled, id }) {
  return (
    <button id={id} type="button" onClick={onClick} disabled={disabled}
      className={cn("inline-flex items-center justify-center rounded-theme bg-primary px-6 py-3 font-medium text-primary-ink transition-opacity hover:opacity-90 disabled:opacity-60", className)}>
      {label}
    </button>
  );
}

// ── Restaurants ─────────────────────────────────────────────────────────────
const OT_DOMAINS = /^(com|co\.uk|de|ca|com\.au|jp|com\.mx|ie|nl|it|es|fr|ae|hk|sg|co\.th|tw|nz)$/;
const LANG = /^[a-z]{2}(-[A-Z]{2})?$/;

/**
 * OpenTable's own loader script, as its dashboard gives it (iframe mode). It draws
 * next to its own script tag, so the tag goes in this box. (The older
 * /widget/reservation/canvas page still answers, but the loader is what OpenTable
 * hands out today and it moved restaurants to its new widget in 2025.)
 */
function OpenTable({ rid, domain, lang, className }) {
  const box = useRef(null);
  const d = OT_DOMAINS.test(domain || "") ? domain : "com";
  const l = LANG.test(lang || "") ? lang : "en-US";
  useEffect(() => {
    if (isPreview || !box.current) return;
    const el = box.current;
    el.replaceChildren();
    const q = new URLSearchParams({ rid, type: "standard", theme: "standard", color: "1", dark: "false", iframe: "true", domain: d, lang: l, newtab: "false", ot_source: "Restaurant website", cfe: "true" });
    loadScript(`https://www.opentable.com/widget/reservation/loader?${q}`, { into: el }).catch(() => {});
    return () => { el.replaceChildren(); };
  }, [rid, d, l]);
  const href = `https://www.opentable.${d}/restref/client/?rid=${rid}`;
  if (isPreview) return <PreviewCard name="OpenTable reservations" href={href} className={cn("min-h-[320px]", className)} />;
  return <div ref={box} className={cn("w-full", className)}><noscript><a href={href}>Reserve a table</a></noscript></div>;
}

function Resy({ venueId, apiKey, label = "Reserve a table", className }) {
  const [busy, setBusy] = useState(false);
  if (isPreview) return <PreviewCard name="Resy reservations" note="On your published site this button opens Resy's booking window." className={className} />;
  const open = async () => {
    setBusy(true);
    try {
      await loadScript("https://widgets.resy.com/embed.js");
      window.resyWidget.openModal({ venueId: Number(venueId), apiKey, replace: "true" });
    } catch { /* blocked: nothing to open */ }
    setBusy(false);
  };
  return <OpenButton label={label} className={className} onClick={open} disabled={busy} />;
}

function SevenRooms({ venue, region, type = "reservations", label = "Reserve a table", className }) {
  const id = useBoxId("sr");
  useEffect(() => {
    if (isPreview) return;
    const host = region === "eu" ? "https://eu.sevenrooms.com" : "https://www.sevenrooms.com";
    loadScript(`${host}/widget/embed.js`).then(() => {
      // The trigger must exist before init; it does, this runs after render.
      window.SevenroomsWidget?.init({ venueId: venue, triggerId: id, type: type === "events" ? "events" : "reservations", styleButton: false, clientToken: "", ...(region === "eu" ? { env: "EU" } : {}) });
    }).catch(() => {});
  }, [venue, region, type, id]);
  if (isPreview) return <PreviewCard name="SevenRooms reservations" note="On your published site this button opens SevenRooms' booking window." className={className} />;
  return <OpenButton id={id} label={label} className={className} />;
}

// ── Salons, spas, studios ───────────────────────────────────────────────────
/** Vagaro's own code finds itself inside a .vagaro box, so it is added there. */
function Vagaro({ src, className }) {
  const box = useRef(null);
  useEffect(() => {
    if (isPreview || !box.current) return;
    const el = box.current;
    el.innerHTML = "";
    loadScript(src, { into: el }).catch(() => {});
    return () => { el.innerHTML = ""; };
  }, [src]);
  if (isPreview) return <PreviewCard name="Vagaro booking" className={cn("min-h-[320px]", className)} />;
  return <div ref={box} className={cn("vagaro w-full", className)} />;
}

/** Booksy draws just before its own script tag, so the tag goes in this box. */
function Booksy({ id, country, lang, mode, className }) {
  const box = useRef(null);
  useEffect(() => {
    if (isPreview || !box.current) return;
    const el = box.current;
    el.innerHTML = "";
    const q = new URLSearchParams({ id, country, lang, ...(mode === "inline" ? { mode: "inline" } : {}) });
    loadScript(`https://booksy.com/widget/code.js?${q}`, { into: el }).catch(() => {});
    return () => { el.innerHTML = ""; };
  }, [id, country, lang, mode]);
  if (isPreview) return <PreviewCard name="Booksy booking" className={className} />;
  return <div ref={box} className={cn("w-full", className)} />;
}

function SquareAppointments({ merchant, location, className, title = "Book an appointment" }) {
  const src = `https://app.squareup.com/appointments/buyer/widget/${merchant}/${location}`;
  const href = `https://book.squareup.com/appointments/${merchant}/location/${location}/services`;
  if (isPreview) return <PreviewCard name="Square Appointments" href={href} className={cn("min-h-[320px]", className)} />;
  return <Frame src={src} title={title} href={href} allow="payment" className={className} box="h-[720px]" />;
}

/** Acuity's resize script only binds frames already on the page: the frame first, then the script. */
function Acuity({ url, className, title = "Book an appointment" }) {
  useEffect(() => {
    if (isPreview) return;
    loadScript("https://embed.acuityscheduling.com/js/embed.js").catch(() => {});
  }, [url]);
  if (isPreview) return <PreviewCard name="Acuity Scheduling" href={url} className={cn("min-h-[320px]", className)} />;
  return (
    <div className={cn("w-full", className)}>
      <iframe src={url} title={title} width="100%" height="800" frameBorder="0" className="w-full border-0" />
    </div>
  );
}

// ── Events and tickets ──────────────────────────────────────────────────────
function Eventbrite({ eventId, className, height = 425 }) {
  const id = useBoxId(`eventbrite-widget-container-${eventId}`);
  useEffect(() => {
    if (isPreview) return;
    loadScript("https://www.eventbrite.com/static/widgets/eb_widgets.js").then(() => {
      window.EBWidgets?.createWidget({ widgetType: "checkout", eventId: String(eventId), iframeContainerId: id, iframeContainerHeight: Number(height) || 425 });
    }).catch(() => {});
  }, [eventId, id, height]);
  const href = `https://www.eventbrite.com/e/${eventId}`;
  if (isPreview) return <PreviewCard name="Eventbrite tickets" href={href} className={cn("min-h-[320px]", className)} />;
  return <div id={id} className={cn("w-full", className)}><noscript><a href={href}>Get tickets</a></noscript></div>;
}

function Luma({ eventId, className, title = "Register" }) {
  const href = `https://luma.com/event/${eventId}`;
  if (isPreview) return <PreviewCard name="Luma registration" href={href} className={cn("min-h-[320px]", className)} />;
  return <Frame src={`https://luma.com/embed/event/${eventId}/simple`} title={title} href={href} allow="fullscreen; payment" className={className} box="h-[450px] max-w-[600px]" />;
}

function Tito({ event, className }) {
  const id = useBoxId("tito");
  useEffect(() => {
    if (isPreview) return;
    // Tito's own queue: calls made before its script arrives run once it does. It
    // finds the box by a selector (it calls querySelector with it), not an element.
    window.tito = window.tito || function () { (window.tito.q = window.tito.q || []).push(arguments); };
    loadScript("https://js.tito.io/v2").catch(() => {});
    window.tito("widget.mount", { el: `#${id}`, event });
  }, [event, id]);
  if (isPreview) return <PreviewCard name="Tito tickets" href={`https://ti.to/${event}`} className={cn("min-h-[240px]", className)} />;
  return <div id={id} className={cn("w-full", className)} />;
}

// ── Selling ─────────────────────────────────────────────────────────────────
/** Shopify's Storefront Web Components: a product with its price and a Buy now button, no token. */
function Shopify({ store, handle, label = "Buy now", className }) {
  const box = useRef(null);
  const storeId = useBoxId(`shopify-${handle}`);
  useEffect(() => {
    if (isPreview || !box.current) return;
    const el = box.current;
    // Built as elements, not HTML text: the values are checked, and nothing is parsed from strings.
    const shop = document.createElement("shopify-store");
    shop.id = storeId;
    shop.setAttribute("store-domain", `https://${store}`);
    const ctx = document.createElement("shopify-context");
    ctx.setAttribute("type", "product");
    ctx.setAttribute("handle", handle);
    const tpl = document.createElement("template");
    const row = document.createElement("div");
    row.className = "flex flex-wrap items-center gap-4";
    const price = document.createElement("shopify-money");
    price.setAttribute("query", "product.selectedOrFirstAvailableVariant.price");
    price.className = "text-lg text-ink";
    const buy = document.createElement("button");
    buy.type = "button";
    buy.textContent = label;
    buy.className = "inline-flex items-center justify-center rounded-theme bg-primary px-6 py-3 font-medium text-primary-ink hover:opacity-90";
    buy.setAttribute("onclick", `document.getElementById(${JSON.stringify(storeId)}).buyNow(event)`);
    row.append(price, buy);
    tpl.content.append(row);
    ctx.append(tpl);
    el.replaceChildren(shop, ctx);
    loadScript("https://cdn.shopify.com/storefront/web-components.js").catch(() => {});
    return () => { el.replaceChildren(); };
  }, [store, handle, label, storeId]);
  if (isPreview) return <PreviewCard name="Shopify product" note="On your published site this shows the product's price and a Buy now button." href={`https://${store}/products/${handle}`} className={className} />;
  return <div ref={box} className={cn("w-full", className)} />;
}

/** A PayPal button made in PayPal (its price is set there, so a page can't change it). */
function PayPal({ clientId, buttonId, currency = "USD", className }) {
  const id = useBoxId(`paypal-container-${buttonId}`);
  useEffect(() => {
    if (isPreview) return;
    const cur = /^[A-Z]{3}$/.test(currency) ? currency : "USD";
    loadScript(`https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&components=hosted-buttons&disable-funding=venmo&currency=${cur}`).then(() => {
      const el = document.getElementById(id);
      if (el && !el.childElementCount) window.paypal?.HostedButtons({ hostedButtonId: buttonId }).render(`#${id}`);
    }).catch(() => {});
  }, [clientId, buttonId, currency, id]);
  if (isPreview) return <PreviewCard name="PayPal checkout" note="On your published site this is your PayPal button." className={className} />;
  return <div id={id} className={cn("w-full max-w-[420px]", className)} />;
}

/** A Gumroad product, inline; checkout happens on Gumroad. */
function Gumroad({ url, className }) {
  const box = useRef(null);
  useEffect(() => {
    if (isPreview || !box.current) return;
    loadScript("https://gumroad.com/js/gumroad-embed.js").catch(() => {});
  }, [url]);
  if (isPreview) return <PreviewCard name="Gumroad product" href={url} className={className} />;
  return (
    <div ref={box} className={cn("gumroad-product-embed w-full", className)}>
      <a href={url}>Loading...</a>
    </div>
  );
}

// ── The checked shape of each kind's props ──────────────────────────────────
/** An Acuity scheduling page, or one appointment type or calendar on it, on Acuity's own hosts. */
export const ACUITY = /^https:\/\/(app\.acuityscheduling\.com\/schedule\.php\?owner=\d{1,12}(&[A-Za-z0-9_%.=-]{1,80}){0,6}|[a-z0-9-]{2,63}\.(as\.me|acuityscheduling\.com)\/[A-Za-z0-9_%./?=&-]{0,240})$/;
const KINDS = {
  opentable: (p) => (/^\d{1,9}$/.test(String(p.rid)) ? <OpenTable {...p} rid={String(p.rid)} /> : null),
  resy: (p) => (/^\d{1,9}$/.test(String(p.venueId)) && /^[A-Za-z0-9]{8,64}$/.test(String(p.apiKey || "")) ? <Resy {...p} /> : null),
  sevenrooms: (p) => (/^[a-z0-9_-]{2,80}$/i.test(String(p.venue)) ? <SevenRooms {...p} /> : null),
  vagaro: (p) => (/^https:\/\/www\.vagaro\.com\/\/?resources\/Widget(?:Embedded|Popup)Loader\/[A-Za-z0-9]+\?v=[A-Za-z0-9]+#?$/.test(String(p.src)) ? <Vagaro {...p} /> : null),
  booksy: (p) => (/^\d{1,10}$/.test(String(p.id)) && /^[a-z]{2}$/.test(String(p.country)) && /^[a-z]{2}(-[A-Za-z]{2})?$/.test(String(p.lang)) ? <Booksy {...p} /> : null),
  square: (p) => (/^[A-Za-z0-9][A-Za-z0-9-]{6,38}[A-Za-z0-9]$/.test(String(p.merchant)) && /^[A-Z0-9]{8,24}$/.test(String(p.location)) ? <SquareAppointments {...p} /> : null),
  acuity: (p) => (ACUITY.test(String(p.url)) ? <Acuity {...p} /> : null),
  eventbrite: (p) => (/^\d{9,15}$/.test(String(p.eventId)) ? <Eventbrite {...p} eventId={String(p.eventId)} /> : null),
  luma: (p) => (/^evt-[A-Za-z0-9]{10,20}$/.test(String(p.eventId)) ? <Luma {...p} /> : null),
  tito: (p) => (/^[\w-]{1,80}\/[\w-]{1,80}$/.test(String(p.event)) ? <Tito {...p} /> : null),
  shopify: (p) => (/^[a-z0-9][a-z0-9-]{0,60}\.myshopify\.com$/.test(String(p.store)) && /^[a-z0-9][a-z0-9-]{0,120}$/.test(String(p.handle)) ? <Shopify {...p} /> : null),
  paypal: (p) => (/^[A-Za-z0-9_-]{20,100}$/.test(String(p.clientId)) && /^[A-Z0-9]{8,20}$/.test(String(p.buttonId)) ? <PayPal {...p} /> : null),
  gumroad: (p) => (/^https:\/\/([a-z0-9-]{1,63}\.)?gumroad\.com\/l\/[\w-]{1,80}$/.test(String(p.url)) ? <Gumroad {...p} /> : null),
};

/**
 * A booking, ticket or shop widget the owner connected under Integrations. The
 * builder is told the exact props for each connected one; a kind or a value that
 * doesn't check out renders nothing.
 */
export function Widget({ kind, ...props }) {
  const make = KINDS[kind];
  return make ? make(props) : null;
}

// ── A pasted link: music, podcasts, video, forms ────────────────────────────
function embedFor(url) {
  if (typeof url !== "string") return null;
  let m;
  if ((m = url.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|playlist|artist|show|episode)\/([A-Za-z0-9]{22})/)))
    return { kind: "media", src: `https://open.spotify.com/embed/${m[1]}/${m[2]}`, box: m[1] === "track" || m[1] === "episode" ? "h-[152px]" : "h-[352px]", allow: "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture", round: true, title: "Spotify" };
  if ((m = url.match(/podcasts\.apple\.com\/([a-z]{2})\/podcast\/(?:([^/?#]+)\/)?id(\d{3,15})(?:\?(?:.*&)?i=(\d{3,20}))?/)))
    return { kind: "media", src: `https://embed.podcasts.apple.com/${m[1]}/podcast/${m[2] ? `${encodeURIComponent(m[2])}/` : ""}id${m[3]}${m[4] ? `?i=${m[4]}` : ""}`, box: m[4] ? "h-[175px] max-w-[660px]" : "h-[450px] max-w-[660px]", allow: "autoplay *; encrypted-media *; fullscreen *; clipboard-write", round: true, title: "Apple Podcasts" };
  if ((m = url.match(/^https:\/\/(?:www\.|m\.)?soundcloud\.com\/([\w-]{1,80})\/(sets\/)?([\w-]{1,120})\/?(?:[?#].*)?$/)))
    return { kind: "media", src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(`https://soundcloud.com/${m[1]}/${m[2] || ""}${m[3]}`)}&visual=true&show_artwork=true`, box: m[2] ? "h-[450px]" : "h-[166px]", allow: "autoplay; encrypted-media", title: "SoundCloud" };
  if ((m = url.match(/loom\.com\/(?:share|embed)\/([0-9a-f]{32})/)))
    return { kind: "media", src: `https://www.loom.com/embed/${m[1]}?hideEmbedTopBar=true`, box: "aspect-video", allow: "fullscreen", title: "Loom video" };
  if ((m = url.match(/vimeo\.com\/(?:video\/)?(\d{6,12})(?:\/([0-9a-f]{10}))?(?:[?&]h=([0-9a-f]{10}))?/)))
    return { kind: "media", src: `https://player.vimeo.com/video/${m[1]}${m[2] || m[3] ? `?h=${m[2] || m[3]}&dnt=1` : "?dnt=1"}`, box: "aspect-video", allow: "autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share", title: "Vimeo video" };
  if ((m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)))
    return { kind: "media", src: `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0`, box: "aspect-video", allow: "autoplay; encrypted-media; picture-in-picture; fullscreen", title: "YouTube video" };
  if ((m = url.match(/^https:\/\/(?:[a-z0-9-]+\.)?typeform\.com\/to\/([A-Za-z0-9]{4,20})/)))
    return { kind: "typeform", id: m[1], href: `https://form.typeform.com/to/${m[1]}`, title: "Typeform" };
  if ((m = url.match(/^https:\/\/tally\.so\/(?:r|embed|forms)\/([A-Za-z0-9]{3,12})/)))
    return { kind: "tally", id: m[1], href: `https://tally.so/r/${m[1]}`, title: "Tally form" };
  if ((m = url.match(/^https:\/\/(?:form\.|www\.)?jotform\.com\/(?:form\/)?(\d{12,16})/)))
    return { kind: "jotform", id: m[1], href: `https://form.jotform.com/${m[1]}`, title: "Jotform" };
  return null;
}

function TypeformEmbed({ id, className }) {
  const box = useRef(null);
  useEffect(() => {
    if (isPreview || !box.current) return;
    const el = box.current;
    let widget = null;
    loadScript("https://embed.typeform.com/next/embed.js").then(() => {
      widget = window.tf?.createWidget(id, { container: el, opacity: 0, hideHeaders: true, hideFooter: false });
    }).catch(() => {});
    return () => { try { widget?.unmount?.(); } catch { /* gone */ } el.replaceChildren(); };
  }, [id]);
  if (isPreview) return <PreviewCard name="Typeform" href={`https://form.typeform.com/to/${id}`} className={cn("min-h-[320px]", className)} />;
  return <div ref={box} className={cn("w-full", className || "h-[560px]")} />;
}

function TallyEmbed({ id, className, title }) {
  const frame = useRef(null);
  const src = `https://tally.so/embed/${id}?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1`;
  useEffect(() => {
    if (isPreview) return;
    loadScript("https://tally.so/widgets/embed.js").then(() => window.Tally?.loadEmbeds())
      // Tally's own advice: without its script, load the frame as a plain frame.
      .catch(() => { if (frame.current && !frame.current.src) frame.current.src = src; });
  }, [id, src]);
  if (isPreview) return <PreviewCard name="Tally form" href={`https://tally.so/r/${id}`} className={cn("min-h-[240px]", className)} />;
  return <iframe ref={frame} data-tally-src={src} loading="lazy" width="100%" height="300" frameBorder="0" title={title} className={cn("w-full border-0", className)} />;
}

function JotformEmbed({ id, className, title }) {
  useEffect(() => {
    if (isPreview) return;
    loadScript("https://cdn.jotfor.ms/s/umd/latest/for-form-embed-handler.js").then(() => {
      window.jotformEmbedHandler?.(`iframe[id='JotFormIFrame-${id}']`, "https://form.jotform.com/");
    }).catch(() => {});
  }, [id]);
  if (isPreview) return <PreviewCard name="Jotform" href={`https://form.jotform.com/${id}`} className={cn("min-h-[320px]", className)} />;
  return <iframe id={`JotFormIFrame-${id}`} title={title} src={`https://form.jotform.com/${id}`} allow="geolocation; microphone; camera; fullscreen; payment" scrolling="no" className={cn("min-h-[540px] w-full border-0", className)} />;
}

/**
 * Something the owner shared a link to, placed the way its company says:
 * Spotify, Apple Podcasts, SoundCloud, YouTube, Vimeo, Loom, Typeform, Tally or
 * Jotform. <Embed url="https://open.spotify.com/show/..." className="..." />.
 * A link it doesn't know renders nothing.
 */
export function Embed({ url, className, title }) {
  const e = embedFor(url);
  if (!e) return null;
  if (e.kind === "typeform") return <TypeformEmbed id={e.id} className={className} />;
  if (e.kind === "tally") return <TallyEmbed id={e.id} className={className} title={title || e.title} />;
  if (e.kind === "jotform") return <JotformEmbed id={e.id} className={className} title={title || e.title} />;
  return <Frame src={e.src} title={title || e.title} allow={e.allow} look={e.round ? "rounded-[12px]" : undefined} className={className} box={e.box} href={url} />;
}
