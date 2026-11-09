// Numbers that change: a score, a standing, a race position, a price, the weather.
//
// Owner, 2026-10-04, after a Michigan football site showed "Data pending" where its record
// and Big Ten standing should have been: "people will build cool shit like f1positions
// tracker and stuff and we need real time data for all this". He was right that this is
// not hard. A great many public sources need no key and allow a page to call them
// directly: ESPN, OpenF1, CoinGecko, Open-Meteo, GitHub and Open Food Facts all answer a
// plain browser request. The builder finds the right one with web_search while it writes
// the site (prompt.ts), and the page reads it here.
//
// The site reads the source, not the page. Measured in a real browser the same day, of ten
// public sources seven answered a page directly and ESPN and Frankfurter refused, although
// both answer a plain command-line request saying "allow any origin". The one that refused
// is the sports data this started with. Asking the site instead: no browser rules in the
// way, one reading shared by every visitor rather than one call each, and the day a source
// needs a key it can be held on the server instead of printed in the page.
//
// What this is for, and is not: ONE public address that answers with JSON over https, with
// no key in it. The site only reads addresses its own code asks for (src/lib/site/live-feeds.ts).
//
// The promise this keeps: a page never shows a number nobody checked. While it is reading,
// `loading`. If the source cannot be reached, or answers with something else, `failed`, and
// the page says so in its own words. `data` is only ever what the source really sent.

import { useCallback, useEffect, useRef, useState } from "react";
import { cloudCall } from "./cloud.js";

/** The last reading of each address, as the source sent it: shared by every widget on it. */
const READINGS = new Map();
/** Reads in flight, so widgets asking at the same moment make one call between them. */
const GOING = new Map();
/** How long a reading serves without asking again. The site holds one for about as long. */
const HOLD_MS = 25_000;
/** After a source could not be read, how long before asking it again. */
const COOL_MS = 60_000;
/** The fastest a page reads, however often it asks: a source does not change every second. */
const LEAST_GAP_S = 20;
/** Longest a page waits for a reading before calling the source unreachable. */
const TIMEOUT_MS = 12000;
/**
 * A page is not a download manager: a feed bigger than this is not read. It must match what the
 * site itself allows (FEED_MAX_BYTES in src/lib/site/feed-read.ts). Being the smaller of the two
 * made the page throw away a 3.3MB reading the site had already fetched and handed over, so a
 * race's gap column stayed empty while every other column filled (owner, 2026-10-05).
 */
const MAX_BYTES = 4_000_000;

function usable(url) {
  try {
    const u = new URL(url);
    // https only, and never the site's own address: that is what table() and useTable are for.
    return u.protocol === "https:" && !!u.hostname && u.hostname.includes(".");
  } catch {
    return false;
  }
}

async function fetchFeed(url, search) {
  // The read belongs to the page, not to whichever widget asked first: all of them wait for
  // this one call, so one of them being taken off the screen cannot cancel it for the rest.
  const ctrl = new AbortController();
  const stop = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const got = await cloudCall("feed", search ? { url, body: search } : { url }, { signal: ctrl.signal });
    const text = String(got?.body ?? "");
    if (!text || text.length > MAX_BYTES) throw new Error("the source sent nothing usable");
    return { raw: JSON.parse(text), at: Number(got.readAt) || Date.now(), stale: !!got.stale };
  } finally {
    clearTimeout(stop);
  }
}

/**
 * One read of an address for everyone on it: a reading taken moments ago is given straight
 * back, and widgets asking while a read is in flight share it. Four widgets on one source
 * cost one call, not four.
 */
export function sharedRead(url, fetchOne = fetchFeed, force = false) {
  const had = READINGS.get(url);
  if (!force && had && !had.stale && Date.now() - had.at < HOLD_MS) return Promise.resolve(had);
  const already = GOING.get(url);
  if (already) return already;
  const going = fetchOne(url)
    .then((got) => { READINGS.set(url, got); return got; })
    .finally(() => { if (GOING.get(url) === going) GOING.delete(url); });
  GOING.set(url, going);
  return going;
}

/**
 * What one widget is told about a reading. Each widget keeps its own `pick` of the same
 * reading, so two widgets reading different parts of one source never show each other's.
 */
export function readingState(got, pick) {
  let data;
  try {
    data = pick ? pick(got.raw) : got.raw;
  } catch {
    // A source that changed shape makes the page say so, and never crash it.
    data = null;
  }
  if (data === undefined || data === null) return { data: null, loading: false, failed: true, updatedAt: got.at };
  // A reading the site could not refresh is never handed over as live. The page may still
  // show it with freshness(), which says in words how old it is.
  return { data, loading: false, failed: !!got.stale, updatedAt: got.at };
}

/**
 * Read a public JSON source, and keep reading it if you ask.
 *
 *   const { data, loading, failed, updatedAt, reload } = useLive(
 *     "https://api.openf1.org/v1/position?session_key=latest",
 *     { every: 60, pick: (d) => d.at(-1) },
 *   );
 *   if (loading) return <Skeleton />;
 *   if (failed) return <p>Live positions are unavailable right now.</p>;
 *   return <p>{data.position}</p>;
 *
 * url    one public https address answering JSON, and no secret in it
 * every  seconds between reads while the page is open; left out, it reads once
 * pick   takes the source's answer and returns just the part this widget shows. It runs
 *        inside a try: a source that changes shape makes the page say so, never crash.
 */
export function useLive(url, { every, pick, body } = {}) {
  // A search sent as a POST (a data company's fare search, data-providers.ts): its body is part of
  // which reading this is, so two different searches never share one.
  const search = body && typeof body === "object" ? body : undefined;
  const key = search ? `${url}#${JSON.stringify(search)}` : url;
  // The page may pass a new arrow function every render; the read must not restart for that,
  // so the newest one is kept here, outside the render.
  const take = useRef(pick);
  useEffect(() => { take.current = pick; }, [pick]);
  const [state, setState] = useState(() => {
    if (!usable(url)) return { data: null, loading: false, failed: true, updatedAt: null };
    const had = READINGS.get(key);
    // A reading another widget already took: shown at once, with the time it was taken.
    return had ? readingState(had, pick) : { data: null, loading: true, failed: false, updatedAt: null };
  });
  const cool = useRef(0);

  const load = useCallback(async (signal, force) => {
    if (!usable(url)) { setState({ data: null, loading: false, failed: true, updatedAt: null }); return; }
    if (!force && Date.now() < cool.current) return;
    // Only the first read shows as loading: a refresh must not blank a number already on screen.
    setState((s) => (s.data === null && !s.loading ? { ...s, loading: true } : s));
    try {
      const got = await sharedRead(key, () => fetchFeed(url, search), force);
      if (signal?.aborted) return;
      if (got.stale) cool.current = Date.now() + COOL_MS;
      setState(readingState(got, take.current));
    } catch (e) {
      // Nothing is invented and nothing already read is thrown away: an old reading stays on
      // screen with the time it was taken, and the source is left alone for a minute.
      cool.current = Date.now() + COOL_MS;
      // "needs_key": the site's data company is not connected yet. The page may say so plainly.
      const reason = e?.code === "needs_key" ? "needs_key" : undefined;
      if (!signal?.aborted) setState((s) => ({ data: s.data, loading: false, failed: true, updatedAt: s.updatedAt, ...(reason ? { reason } : {}) }));
    }
  }, [url, key]);

  useEffect(() => {
    if (!usable(url)) return undefined;
    const ctrl = new AbortController();
    load(ctrl.signal);
    if (!every || every <= 0) return () => ctrl.abort();
    // Only while the page is actually being looked at: a tab left open all night reads nothing.
    const gap = Math.max(LEAST_GAP_S, every) * 1000;
    const tick = setInterval(() => { if (!document.hidden) load(ctrl.signal); }, gap);
    const wake = () => { if (!document.hidden) load(ctrl.signal); };
    document.addEventListener("visibilitychange", wake);
    return () => { ctrl.abort(); clearInterval(tick); document.removeEventListener("visibilitychange", wake); };
  }, [load, every, url]);

  const reload = useCallback(() => { cool.current = 0; return load(undefined, true); }, [load]);
  return { ...state, reload };
}

/** "updated 2 minutes ago", for a page that shows when its number was last read. */
export function freshness(updatedAt, now = Date.now()) {
  if (!updatedAt) return "";
  const secs = Math.max(0, Math.round((now - updatedAt) / 1000));
  if (secs < 45) return "updated just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `updated ${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `updated ${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `updated ${days} day${days === 1 ? "" : "s"} ago`;
}
