// Wron Cloud: the backend every generated website gets with zero setup.
//
//   forms     useForm("contact") / submitForm(...)  -> the owner's inbox + an email
//   data      table("bookings") / useTable(...)     -> a real database table
//   accounts  auth / useUser() / <SignedIn> ...     -> visitor sign-up and sign-in
//   files     upload(file)                          -> a hosted file URL
//   payments  checkout(...) / useCart()             -> Stripe checkout on the owner's account
//   ai        ai.chat(...)                          -> the owner's connected AI key
//
// Every call goes to Wron at /api/site/<siteId>/<action>. Who may read or write a
// table is declared per table in db/schema.json and enforced on the server; this
// file only carries requests. Nothing secret is in here: a published page's
// source is public.
import { createElement, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { apiBase, isPreview, isServer, previewPass, siteId, storage } from "./runtime.js";

// ── Transport ───────────────────────────────────────────────────────────────
const SESSION_KEY = `wron:session:${siteId}`;
const DEVICE_KEY = `wron:device:${siteId}`;

function deviceId() {
  let id = storage.get(DEVICE_KEY);
  if (!id) {
    id = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now();
    storage.set(DEVICE_KEY, id);
  }
  return id;
}

export class CloudError extends Error {
  constructor(message, code, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/**
 * What a visitor sends that anyone could send a thousand of (a form, a booking, a
 * new row, a sign-up). When the owner connected a spam check (Cloudflare Turnstile
 * or Google reCAPTCHA, Integrations), the published page defines window.__wronHuman
 * and its token rides along; the server checks it.
 */
function humanCheck(action, body) {
  if (isPreview || typeof window === "undefined" || typeof window.__wronHuman !== "function") return null;
  if (action === "forms") return "form";
  if (action === "appointments" && body?.op === "book") return "booking";
  // Even with a saved session: it may have expired, and the server checks anyone it can't sign in.
  if (action === "db" && body?.op === "add") return "add";
  if (action === "auth" && body?.action === "signup") return "signup";
  return null;
}

async function call(action, body, init = {}) {
  if (isServer) throw new CloudError("Not available while prerendering.", "server", 0);
  if (!apiBase || !siteId) throw new CloudError("This site isn't connected to its backend yet.", "not_connected", 0);
  const headers = { "X-Wron-Device": deviceId() };
  const session = storage.get(SESSION_KEY);
  if (session) headers["X-Wron-Session"] = session;
  const pass = ownerPass();
  if (pass) headers["X-Wron-Owner"] = pass;
  if (isPreview) headers["X-Wron-Preview"] = previewPass || "1";
  const check = humanCheck(action, body);
  if (check) {
    // A check that cannot run sends nothing, and the server says what to do. Nor can
    // one that never answers hold a form on "Sending" forever: after 15 seconds the
    // request goes without a token (audit, 2026-10-12).
    let timer;
    try {
      const token = await Promise.race([
        window.__wronHuman(check),
        new Promise((_, rej) => { timer = setTimeout(() => rej(new Error("spam check timeout")), 15000); }),
      ]);
      if (typeof token === "string" && token) headers["X-Wron-Human"] = token;
    } catch { /* see above */ } finally { clearTimeout(timer); }
  }
  let payload = body;
  if (!(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body ?? {});
  }
  let res;
  try {
    res = await fetch(`${apiBase}/api/site/${siteId}/${action}`, { method: "POST", headers, body: payload, ...init });
  } catch {
    throw new CloudError("Couldn't reach the server. Check your connection and try again.", "network", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // The saved session is no good: forget it too, or every later call sends it again (audit, 2026-10-12).
    if (res.status === 401 && data.error === "sign_in_required") { storage.remove(SESSION_KEY); setUser(null); }
    throw new CloudError(data.message || data.details || "Something went wrong. Please try again.", data.error || "error", res.status);
  }
  if (action === "forms") converted(/newsletter|subscribe|signup|sign-up|sign_up|waitlist|wait-list|mailing|updates|notify/i.test(String(body?.form || "")) ? "signup" : "lead");
  else if (action === "appointments" && body?.op === "book") converted("booking");
  else if (action === "auth" && body?.action === "signup") converted("signup");
  return data;
}

/**
 * Tell the page's ad and analytics tools (Integrations) that a visitor did what
 * the site is for: "lead" (a form), "signup", "booking" or "purchase". Each
 * connected tool hears it as its own standard event. Never from the preview.
 */
function converted(type, detail) {
  if (isPreview || typeof window === "undefined") return;
  try { window.dispatchEvent(new CustomEvent("wron:conversion", { detail: { type, ...(detail || {}) } })); } catch { /* nothing listens */ }
}

// ── Appointments ────────────────────────────────────────────────────────────
// The schedule is declared in db/schema.json ("appointments"); the server keeps the
// calendar, offers only free start times and never books a time twice.
/** The same door the rest of this file uses, for the live reader next to it (live.js). */
export const cloudCall = (action, body, init) => call(action, body, init);

export const appointments = {
  /** Free start times: { configured, timezone, days: [{ date: "2026-10-02", times: ["09:00", ...] }] }. */
  availability: ({ duration = 60, days = 14, from } = {}) => call("appointments", { op: "availability", duration, days, from }),
  /** Book one: { date, time, duration, service, name, email, phone?, notes?, details? } -> { ref, date, time, end }. */
  book: (booking) => call("appointments", { op: "book", ...(booking || {}) }),
  /** A visitor's own booking, by its reference and their email. */
  lookup: (ref, email) => call("appointments", { op: "lookup", ref, email }).then((d) => d.booking),
  /** Cancel a visitor's own booking. */
  cancel: (ref, email) => call("appointments", { op: "cancel", ref, email }).then((d) => d.booking),
};

/** Free times for a duration, kept fresh. const { days, loading, error, configured, reload } = useAvailability({ duration: 60 }). */
export function useAvailability({ duration = 60, days = 14, from } = {}) {
  const [state, setState] = useState({ days: [], configured: true, timezone: "", loading: true, error: null });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    if (isServer) return;
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    appointments.availability({ duration, days, from }).then(
      (d) => { if (live) setState({ days: Array.isArray(d.days) ? d.days : [], configured: d.configured !== false, timezone: d.timezone || "", loading: false, error: null }); },
      (e) => { if (live) setState((s) => ({ ...s, loading: false, error: e })); },
    );
    return () => { live = false; };
  }, [duration, days, from, tick]);
  return { ...state, reload };
}

// ── Forms ───────────────────────────────────────────────────────────────────
function formToObject(form) {
  const out = {};
  const fd = new FormData(form);
  for (const [k, v] of fd.entries()) {
    if (v instanceof File) continue; // files go through upload() first
    if (k in out) out[k] = [].concat(out[k], v);
    else out[k] = v;
  }
  return out;
}

/** Send a form's fields to the owner's inbox (and their email). name: "contact", "booking", "waitlist"... */
export async function submitForm(name, data) {
  return call("forms", { form: String(name), data: data || {} });
}

/**
 * The whole life of a form in one hook.
 *   const form = useForm("contact");
 *   <form onSubmit={form.onSubmit}> <input name="email" required /> ...
 *     <button disabled={form.sending}>{form.sending ? "Sending..." : "Send"}</button>
 *     {form.sent && <p>Thanks, we'll be in touch.</p>}
 *     {form.error && <p role="alert">{form.error}</p>}
 * Every <input>/<select>/<textarea> needs a name. File inputs are uploaded first
 * and arrive as links. A hidden field named "_gotcha" traps spam bots.
 */
export function useForm(name, { onSuccess, reset = true } = {}) {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  // A second tap while the first is still sending would send the entry (and its email)
  // twice; the button's disabled={form.sending} only lands a render later (audit, 2026-10-12).
  const busy = useRef(false);
  const onSubmit = useCallback(async (e) => {
    e?.preventDefault?.();
    const form = e?.currentTarget;
    if (!form || busy.current) return;
    busy.current = true;
    setStatus("sending");
    setError(null);
    try {
      const data = formToObject(form);
      if (data._gotcha) { setStatus("sent"); return; }
      delete data._gotcha;
      for (const input of form.querySelectorAll('input[type="file"][name]')) {
        const urls = [];
        for (const file of input.files || []) urls.push((await upload(file)).url);
        if (urls.length) data[input.name] = input.multiple ? urls : urls[0];
      }
      const result = await submitForm(name, data);
      setStatus("sent");
      if (reset) form.reset();
      onSuccess?.(result, data);
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Couldn't send. Please try again.");
    } finally {
      busy.current = false;
    }
  }, [name, onSuccess, reset]);
  return { onSubmit, status, error, sending: status === "sending", sent: status === "sent", reset: () => { setStatus("idle"); setError(null); } };
}

// ── Data ────────────────────────────────────────────────────────────────────
/**
 * One table, as declared in db/schema.json.
 *   table("listings").list({ where: { city: "Leeds" }, orderBy: "price", desc: false, limit: 24 })
 *   table("bookings").add({ name, date, guests })
 *   table("favorites").update(id, { note }) / .remove(id) / .get(id)
 * Every row also has id, created_at and updated_at; mine: true on rows the
 * signed-in visitor created.
 */
export function table(name) {
  const t = String(name);
  return {
    list: (opts = {}) => call("db", { op: "list", table: t, ...opts }).then((r) => r.rows || []),
    get: (id) => call("db", { op: "get", table: t, id }).then((r) => r.row || null),
    add: (values) => call("db", { op: "add", table: t, values }).then((r) => r.row),
    update: (id, values) => call("db", { op: "update", table: t, id, values }).then((r) => r.row),
    remove: (id) => call("db", { op: "remove", table: t, id }).then(() => true),
    count: (opts = {}) => call("db", { op: "count", table: t, ...opts }).then((r) => r.count || 0),
  };
}

/**
 * Rows from a table, kept fresh.
 *   const { rows, loading, error, add, update, remove, reload } = useTable("reviews", { orderBy: "created_at", desc: true });
 * add/update/remove change the list immediately and roll back if the server refuses.
 */
export function useTable(name, opts = {}) {
  const key = JSON.stringify([name, opts]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const next = await table(name).list(opts);
      if (alive.current) { setRows(next); setError(null); }
    } catch (err) {
      if (alive.current) setError(err?.message || "Couldn't load.");
    } finally {
      if (alive.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => { reload(); }, [reload]);

  const add = useCallback(async (values) => {
    const row = await table(name).add(values);
    setRows((prev) => (opts.desc ? [row, ...prev] : [...prev, row]));
    return row;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const update = useCallback(async (id, values) => {
    let before;
    setRows((prev) => prev.map((r) => (r.id === id ? ((before = r), { ...r, ...values }) : r)));
    try {
      const row = await table(name).update(id, values);
      setRows((prev) => prev.map((r) => (r.id === id ? row : r)));
      return row;
    } catch (err) {
      if (before) setRows((prev) => prev.map((r) => (r.id === id ? before : r)));
      throw err;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const remove = useCallback(async (id) => {
    let removed;
    setRows((prev) => prev.filter((r) => (r.id === id ? ((removed = r), false) : true)));
    try {
      await table(name).remove(id);
    } catch (err) {
      if (removed) setRows((prev) => [...prev, removed]);
      throw err;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { rows, loading, error, reload, add, update, remove };
}

/** One row by id: const { row, loading, error } = useRow("listings", id). */
export function useRow(name, id) {
  const [state, setState] = useState({ row: null, loading: true, error: null });
  useEffect(() => {
    let live = true;
    if (!id) { setState({ row: null, loading: false, error: null }); return; }
    setState((s) => ({ ...s, loading: true }));
    table(name).get(id)
      .then((row) => live && setState({ row, loading: false, error: null }))
      .catch((err) => live && setState({ row: null, loading: false, error: err?.message || "Couldn't load." }));
    return () => { live = false; };
  }, [name, id]);
  return state;
}

// ── Accounts ────────────────────────────────────────────────────────────────
let currentUser = undefined; // undefined = not checked yet, null = signed out
const userListeners = new Set();
function setUser(u) {
  currentUser = u;
  userListeners.forEach((l) => l());
}
let checking = null;
function checkUser() {
  if (currentUser !== undefined || checking || isServer) return;
  if (returning) { checking = returning.finally(() => { checking = null; if (currentUser === undefined) checkUser(); }); return; }
  if (!storage.get(SESSION_KEY)) { setUser(null); return; }
  checking = call("auth", { action: "me" })
    .then((r) => setUser(r.user || null))
    .catch(() => setUser(null))
    .finally(() => { checking = null; });
}

function remember(result) {
  if (result?.session) storage.set(SESSION_KEY, result.session);
  setUser(result?.user || null);
  return result?.user || null;
}

export const auth = {
  /** Create an account. Returns the user. inviteCode: required on invite-only sites (checked by the server). */
  signUp: ({ email, password, name, inviteCode } = {}) => call("auth", { action: "signup", email, password, name, inviteCode }).then(remember),
  /** Sign in with email and password. Returns the user. */
  signIn: ({ email, password } = {}) => call("auth", { action: "signin", email, password }).then(remember),
  /**
   * Sign in with Google, from a click: the page goes to Google and comes back here signed in (useUser() then has
   * the user). Works on the published site once the owner has connected Google sign-in in Wron; throws a CloudError
   * with a message to show otherwise.
   */
  signInWithGoogle: async () => {
    if (isServer) throw new CloudError("Not available while prerendering.", "server", 0);
    if (isPreview) throw new CloudError("Google sign-in works on the published website, not in the preview.", "preview", 0);
    const back = window.location.href.split("#")[0];
    const start = await call("auth", { action: "google_start", ret: back });
    try { window.sessionStorage.setItem(GOOGLE_KEY, start.requestId); } catch { /* the code alone can't sign in: see below */ }
    window.location.assign(start.url);
    return new Promise(() => {}); // the page is leaving
  },
  /** Sign out on this device. */
  signOut: async () => {
    try { await call("auth", { action: "signout" }); } catch { /* signed out locally regardless */ }
    storage.remove(SESSION_KEY);
    setUser(null);
  },
  /** The signed-in visitor, or null. */
  user: () => currentUser ?? null,
};

// ── A site in two or more languages ───────────────────────────────────────
// Translating adds a language and keeps the site's own (owner, 2026-10-23: "both the version should work
// somehow ... like English and spanish").

const LANG_KEY = "wron:lang";
let langNow = null;
const langListeners = new Set();

function firstLanguage(list) {
  const saved = storage.get(LANG_KEY);
  if (saved && list.includes(saved)) return saved;
  const wanted = typeof navigator === "undefined" ? [] : (navigator.languages?.length ? navigator.languages : [navigator.language]);
  for (const w of wanted) {
    const hit = list.find((l) => l.slice(0, 2).toLowerCase() === String(w || "").slice(0, 2).toLowerCase());
    if (hit) return hit;
  }
  return list[0];
}

/**
 * The visitor's language, out of the site's own: const [lang, setLang] = useLanguage(["en", "es"]). The first is
 * the site's own language (what search engines see). A visitor's pick is remembered on this device; a first visit
 * gets the browser's language when the site has it. Keeps <html lang> right.
 */
export function useLanguage(languages) {
  const list = Array.isArray(languages) && languages.length ? languages : ["en"];
  const lang = useSyncExternalStore(
    (l) => { langListeners.add(l); return () => langListeners.delete(l); },
    () => (langNow && list.includes(langNow) ? langNow : (langNow = firstLanguage(list))),
    () => list[0],
  );
  useEffect(() => { if (!isServer) document.documentElement.lang = lang; }, [lang]);
  const setLang = useCallback((next) => {
    if (!list.includes(next)) return;
    langNow = next;
    storage.set(LANG_KEY, next);
    langListeners.forEach((l) => l());
  }, [list]);
  return [lang, setLang];
}

// ── The owner, on their own site ──────────────────────────────────────────
// "Sign in as owner" opens Wron, where the owner is signed in; Wron checks they own this site and the page gets
// a pass for 12 hours that the backend checks on every request (owner-pass.ts). Nothing in this page decides who
// the owner is: an email compared here would be readable, and fakeable, by every visitor.

const OWNER_KEY = `wron:owner:${siteId}`;
let ownerNow; // undefined until known
const ownerListeners = new Set();
function setOwner(v) { ownerNow = v; ownerListeners.forEach((l) => l()); }

function ownerPass() {
  const raw = storage.get(OWNER_KEY);
  if (!raw) return null;
  try {
    const { pass, expiresAt } = JSON.parse(raw);
    if (typeof pass === "string" && expiresAt > Date.now() + 60_000) return pass;
  } catch { /* unreadable: dropped below */ }
  storage.remove(OWNER_KEY);
  return null;
}

let checkingOwner = null;
function checkOwner() {
  if (isServer) return;
  // In the builder's preview the owner is the one looking.
  if (isPreview) { setOwner(true); return; }
  if (returning) { returning.finally(() => { if (ownerNow === undefined) checkOwner(); }); return; }
  if (!ownerPass()) { setOwner(false); return; }
  checkingOwner ??= call("auth", { action: "owner_check" })
    .then((r) => setOwner(r.owner === true))
    .catch(() => setOwner(false))
    .finally(() => { checkingOwner = null; });
}

export const owner = {
  /** Sign in as the site's owner, from a click: the page goes to Wron, where the owner is signed in, and comes back. */
  signIn: async () => {
    if (isServer) throw new CloudError("Not available while prerendering.", "server", 0);
    if (isPreview) { setOwner(true); return true; }
    if (!apiBase || !siteId) throw new CloudError("This site isn't connected to Wron yet.", "not_connected", 0);
    const page = new URL("/web-builder/site-owner", new URL(apiBase).origin);
    page.searchParams.set("siteId", siteId);
    page.searchParams.set("origin", window.location.origin);
    page.searchParams.set("back", window.location.pathname + window.location.search);
    window.location.assign(page.toString());
    return new Promise(() => {}); // the page is leaving
  },
  /** Stop being the owner on this device. */
  signOut: () => { storage.remove(OWNER_KEY); setOwner(isPreview); },
};

/** { owner, loading }: whether the person here is the site's owner, as Wron's backend confirms it. */
export function useOwner() {
  const v = useSyncExternalStore(
    (l) => { ownerListeners.add(l); return () => ownerListeners.delete(l); },
    () => ownerNow,
    () => undefined,
  );
  useEffect(() => { if (ownerNow === undefined) checkOwner(); }, []);
  return { owner: v === true, loading: v === undefined };
}

/** Renders children only for the site's owner; `fallback` (a "Sign in as owner" button, say) for everyone else. */
export function OwnerOnly({ children, fallback = null }) {
  const { owner: isOwner, loading } = useOwner();
  if (loading) return null;
  return isOwner ? children : fallback;
}

// ── Coming back from Google or from Wron ──────────────────────────────────
// Both sign-ins leave the page and come back with a one-time code in the address's #fragment (never sent to a
// server). Google's is traded with the request id this page kept before it left, so a sign-in link sent to someone
// else does nothing; the owner's is traded at this site's own address only.

const GOOGLE_KEY = `wron:google:${siteId}`;
let returning = (() => {
  if (isServer || isPreview || typeof window === "undefined") return null;
  const hash = window.location.hash || "";
  const google = /[#&]wron_google=([^&]+)/.exec(hash);
  const ownerCode = /[#&]wron_owner=([^&]+)/.exec(hash);
  if (!google && !ownerCode) return null;
  // The code goes from the address bar at once, whatever happens next.
  try { window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search); } catch { /* old browser */ }
  if (google) {
    let requestId = null;
    try { requestId = window.sessionStorage.getItem(GOOGLE_KEY); window.sessionStorage.removeItem(GOOGLE_KEY); } catch { /* none */ }
    if (!requestId) return null;
    return call("auth", { action: "google_finish", requestId, code: decodeURIComponent(google[1]) }).then(remember).catch(() => null);
  }
  return call("auth", { action: "owner_redeem", code: decodeURIComponent(ownerCode[1]) })
    .then((r) => { storage.set(OWNER_KEY, JSON.stringify({ pass: r.pass, expiresAt: r.expiresAt })); setOwner(true); })
    .catch(() => setOwner(false));
})();
// Done is done: the checks that waited on the return run normally after it, once. Left set, they waited on it again
// for ever, and the page froze (the jewelry site's owner area, 2026-10-23).
if (returning) returning = returning.finally(() => { returning = null; });

/** { user, loading }: user is null when signed out. Re-renders on sign-in and sign-out. */
export function useUser() {
  const user = useSyncExternalStore(
    (l) => { userListeners.add(l); return () => userListeners.delete(l); },
    () => currentUser,
    () => undefined,
  );
  useEffect(() => { checkUser(); }, []);
  return { user: user ?? null, loading: user === undefined };
}

/** Renders children only for a signed-in visitor. */
export function SignedIn({ children }) {
  const { user } = useUser();
  return user ? children : null;
}

/** Renders children only for a signed-out visitor. */
export function SignedOut({ children }) {
  const { user, loading } = useUser();
  return !loading && !user ? children : null;
}

/**
 * Wrap a page that needs an account. Signed-out visitors see `fallback`
 * (for example your sign-in form) instead of the page.
 */
export function RequireSignIn({ children, fallback = null, loading = null }) {
  const state = useUser();
  if (state.loading) return loading;
  return state.user ? children : fallback;
}

// ── Files ───────────────────────────────────────────────────────────────────
// 4 MB: the host refuses a request body over 4.5 MB before Wron sees it, without the
// headers the page needs to read the refusal, so a bigger file failed as "Couldn't reach
// the server" (audit, 2026-10-12).
const UPLOAD_MAX = 4 * 1024 * 1024;

/** Upload a file a visitor picked (images and PDFs, up to 4 MB). Returns { url, name, size, type }. */
export async function upload(file) {
  if (!file) throw new CloudError("Pick a file first.", "no_file", 0);
  if (file.size > UPLOAD_MAX) throw new CloudError("That file is over 4 MB.", "too_large", 413);
  const fd = new FormData();
  fd.append("file", file, file.name);
  return call("upload", fd);
}

// ── Payments ────────────────────────────────────────────────────────────────
/**
 * Send the visitor to a secure Stripe checkout.
 *   checkout("latte-1")                                   one product
 *   checkout([{ id: "mug", quantity: 2 }, { id: "tee" }])  several
 * Product ids and prices come from products.json; the server charges those
 * prices, never anything sent from the browser.
 *
 * What the buyer said about the order goes with it, as { details }:
 *   checkout(items, { details: { "Gift note": note, "Pickup day": day } })
 * It reaches the owner with the paid order. Never save an order to a table or a
 * form before this: an order nobody paid for is not an order.
 */
export async function checkout(items, options) {
  const list = (Array.isArray(items) ? items : [{ id: items, quantity: 1 }]).map((i) => ({ id: String(i.id), quantity: Math.max(1, Math.floor(i.quantity || 1)) }));
  const back = typeof window !== "undefined" ? window.location.pathname : "/";
  const details = options && options.details && typeof options.details === "object" ? options.details : null;
  const { url } = await call("checkout", { items: list, returnPath: back, ...(details ? { details } : {}) });
  if (isPreview) {
    window.open(url, "_blank", "noopener");
    return;
  }
  window.location.href = url;
}

// Back from a checkout (?checkout=success&order=cs_...): the page sends the
// checkout's id, and the server checks the payment with Stripe and records the order
// once, so it reaches the owner's Inbox, email and tools even if the page shows no
// confirmation. Only an order the server confirms as paid counts as a "purchase" for
// the ad tools (Greptile on PR #82: an address alone proves nothing), once per order.
let orderPromise = null;
if (!isServer && !isPreview && typeof window !== "undefined") {
  const params = new URLSearchParams(window.location.search);
  const session = params.get("checkout") === "success" ? params.get("order") : null;
  if (session && /^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(session)) {
    orderPromise = call("orders", { op: "confirm", session }).then((r) => r.order || null).catch(() => null);
    // Remembered in this browser (not just this tab), so a refresh or the same link
    // opened again is never a second sale.
    const counted = `wron:counted:${session}`;
    orderPromise.then((o) => {
      if (!o || storage.get(counted)) return;
      storage.set(counted, "1");
      converted("purchase", { value: o.totalCents / 100, currency: o.currency, id: o.ref });
    });
  }
}

/**
 * The paid order the visitor just came back from, for a confirmation:
 * { ref, totalCents, currency, items: [{ name, quantity }] }, or null (still
 * checking, cancelled, or not a checkout return).
 */
export function useOrder() {
  const [order, setOrder] = useState(null);
  useEffect(() => { let live = true; orderPromise?.then((o) => { if (live) setOrder(o); }); return () => { live = false; }; }, []);
  return order;
}

const CART_KEY = `wron:cart:${siteId}`;
let cart = null;
const cartListeners = new Set();
function readCart() {
  if (cart) return cart;
  try { cart = JSON.parse(storage.get(CART_KEY) || "[]"); } catch { cart = []; }
  if (!Array.isArray(cart)) cart = [];
  return cart;
}
function writeCart(next) {
  cart = next;
  storage.set(CART_KEY, JSON.stringify(next));
  cartListeners.forEach((l) => l());
}
const EMPTY = [];

/**
 * A shopping cart that survives page changes and reloads.
 *   const cart = useCart();
 *   cart.add({ id: "mug", name: "Stoneware mug", priceCents: 3200, image })
 *   cart.items, cart.count, cart.totalCents, cart.setQuantity(id, n), cart.remove(id), cart.clear()
 *   cart.checkout()   sends the whole cart to Stripe
 *   cart.checkout({ details: { "Gift note": note } })   with what the buyer said about the order
 */
export function useCart() {
  const items = useSyncExternalStore(
    (l) => { cartListeners.add(l); return () => cartListeners.delete(l); },
    () => readCart(),
    () => EMPTY,
  );
  const add = (product, quantity = 1) => {
    const list = readCart();
    const found = list.find((i) => i.id === product.id);
    writeCart(found
      ? list.map((i) => (i.id === product.id ? { ...i, quantity: i.quantity + quantity } : i))
      : [...list, { ...product, quantity }]);
  };
  const setQuantity = (id, quantity) => {
    const q = Math.max(0, Math.floor(quantity));
    writeCart(q === 0 ? readCart().filter((i) => i.id !== id) : readCart().map((i) => (i.id === id ? { ...i, quantity: q } : i)));
  };
  return {
    items,
    count: items.reduce((n, i) => n + i.quantity, 0),
    totalCents: items.reduce((n, i) => n + (Number(i.priceCents) || 0) * i.quantity, 0),
    add,
    setQuantity,
    remove: (id) => writeCart(readCart().filter((i) => i.id !== id)),
    clear: () => writeCart([]),
    checkout: (options) => checkout(readCart().map((i) => ({ id: i.id, quantity: i.quantity })), options),
  };
}

/** Format cents as money: money(3200) -> "$32.00". */
export function money(cents, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format((Number(cents) || 0) / 100);
}

/** After Stripe sends the visitor back: "success" | "cancel" | null. */
export function useCheckoutResult() {
  const [result, setResult] = useState(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("checkout");
    if (p === "success" || p === "cancel") setResult(p);
  }, []);
  return result;
}

// ── AI ──────────────────────────────────────────────────────────────────────
export const ai = {
  /**
   * Ask the site owner's connected AI model.
   *   const reply = await ai.chat([{ role: "user", content: "Suggest a gift under $50" }], { system: "You are a helpful shop assistant." })
   */
  chat: (messages, { system } = {}) => call("ai", { messages, system }).then((r) => r.text || ""),
  /**
   * The owner's AI product photo, from their own uploaded photo(s) of the item: the item stays exactly as it is,
   * only the light, background and setting change. Owner only (inside <OwnerOnly>), on their OpenAI key, one
   * picture per call (20 to 60 seconds; run several at once for several shots). Returns the new picture's URL.
   *   const url = await ai.image({ photos: [uploadedUrl], prompt: "on white marble, soft daylight, close-up" })
   */
  image: ({ photos, prompt } = {}) => call("ai", { op: "image", photos: Array.isArray(photos) ? photos : [photos], prompt }).then((r) => r.url),
};

// ── Visits ──────────────────────────────────────────────────────────────────
let lastHit = "";
/**
 * Count one page view on a published site. No cookies and nothing about the
 * visitor is stored: a path, the site that sent them, and the day. Used by the
 * site entry on every page change.
 */
export function recordVisit(path) {
  if (isServer || isPreview || !apiBase || !siteId) return;
  if (path === lastHit) return;
  lastHit = path;
  try {
    let ref = "";
    try { ref = document.referrer ? new URL(document.referrer).hostname : ""; } catch { /* no referrer */ }
    if (ref === window.location.hostname) ref = "";
    const body = JSON.stringify({ path: String(path).slice(0, 200), ref: ref.slice(0, 100) });
    const url = `${apiBase}/api/site/${siteId}/hit`;
    if (navigator.sendBeacon) navigator.sendBeacon(url, new Blob([body], { type: "text/plain" }));
    else fetch(url, { method: "POST", body, keepalive: true }).catch(() => {});
  } catch { /* counting must never break a page */ }
}

// ── Errors ──────────────────────────────────────────────────────────────────
let reported = 0;
/** Used by the site entry. Sends at most a few errors per page view. */
export function reportError(message, stack, where) {
  if (isServer || isPreview || reported >= 5 || !apiBase || !siteId) return;
  reported += 1;
  try {
    const body = JSON.stringify({ message: String(message).slice(0, 500), stack: String(stack || "").slice(0, 2000), where, path: window.location.pathname });
    const url = `${apiBase}/api/site/${siteId}/errors`;
    if (navigator.sendBeacon) navigator.sendBeacon(url, new Blob([body], { type: "text/plain" }));
    else fetch(url, { method: "POST", body, keepalive: true }).catch(() => {});
  } catch { /* never let error reporting throw */ }
}

/** A hidden field that catches spam bots. Put one inside every public form. */
export function SpamTrap() {
  return createElement("input", {
    type: "text", name: "_gotcha", tabIndex: -1, autoComplete: "off", "aria-hidden": "true",
    style: { position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 },
  });
}
