// Owner-only account reads for published sites. Tokens live only in this module's
// memory, never in the site's public key, localStorage, URL, or generated files.
import { createElement, useSyncExternalStore } from "react";
import { apiBase, isPreview, isServer, siteId } from "./runtime.js";

const state = { token: "", expiresAt: 0, pending: false, error: "" };
const listeners = new Set();
let snapshot = { connected: false, pending: false, error: "", available: !isServer && !isPreview && !!apiBase && !!siteId };

function emit() {
  snapshot = {
    connected: !!state.token && Date.now() < state.expiresAt - 5000,
    pending: state.pending,
    error: state.error,
    available: !isServer && !isPreview && !!apiBase && !!siteId,
  };
  for (const listener of listeners) listener();
}

function subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
function getSnapshot() { return snapshot; }
const serverSnapshot = { connected: false, pending: false, error: "", available: false };
function getServerSnapshot() { return serverSnapshot; }

export class OwnerToolError extends Error {
  constructor(message, code = "owner_tool_error", status = 0) {
    super(message);
    this.name = "OwnerToolError";
    this.code = code;
    this.status = status;
  }
}

function requireLive() {
  if (isServer || isPreview) throw new OwnerToolError("Connected account data is available only to the owner on the published site.", "not_live");
  if (!apiBase || !siteId) throw new OwnerToolError("This site is not connected to Wron yet.", "not_connected");
}

function validSession() {
  if (state.token && Date.now() < state.expiresAt - 5000) return state.token;
  if (state.token) { state.token = ""; state.expiresAt = 0; emit(); }
  throw new OwnerToolError("Sign in as the site owner to load connected account data.", "owner_sign_in_required", 401);
}

async function post(path, body, token) {
  let response;
  try {
    response = await fetch(`${apiBase}/api/web-builder/composio/bridge/${path}?siteId=${encodeURIComponent(siteId)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new OwnerToolError("Could not reach Wron. Check your connection and try again.", "network_error");
  }
  let data = {};
  try { data = await response.json(); } catch { /* response error below */ }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      state.token = "";
      state.expiresAt = 0;
      emit();
    }
    throw new OwnerToolError(data.error || data.message || "Connected account request failed.", data.code || "request_failed", response.status);
  }
  return data;
}

/** Open Wron's sign-in page from a user click, then redeem a short-lived, site-scoped owner session. */
export async function connectOwnerComposio() {
  requireLive();
  if (state.pending) throw new OwnerToolError("Owner sign-in is already open.", "pending");
  const wronOrigin = new URL(apiBase).origin;
  const siteOrigin = window.location.origin;
  const authorize = new URL("/web-builder/composio-authorize", wronOrigin);
  authorize.searchParams.set("siteId", siteId);
  authorize.searchParams.set("origin", siteOrigin);
  const popup = window.open(authorize.toString(), "wron-owner-connect", "popup=yes,width=540,height=700");
  if (!popup) throw new OwnerToolError("Allow the Wron sign-in popup and try again.", "popup_blocked");
  state.pending = true;
  state.error = "";
  emit();
  try {
    const code = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => finish(new OwnerToolError("Owner sign-in timed out. Try again.", "timeout")), 120000);
      const closed = setInterval(() => {
        if (popup.closed) finish(new OwnerToolError("Owner sign-in was closed.", "cancelled"));
      }, 500);
      function finish(error, value) {
        clearTimeout(timeout);
        clearInterval(closed);
        window.removeEventListener("message", onMessage);
        if (error) reject(error); else resolve(value);
      }
      function onMessage(event) {
        if (event.origin !== wronOrigin || event.source !== popup) return;
        if (event.data?.type !== "wron-composio-code" || event.data?.siteId !== siteId) return;
        if (typeof event.data.code !== "string" || !event.data.code) return;
        finish(null, event.data.code);
      }
      window.addEventListener("message", onMessage);
    });
    const data = await post("redeem", { code, siteId });
    if (typeof data.token !== "string" || !data.token) throw new OwnerToolError("Owner sign-in did not return a session.", "invalid_session");
    const expiry = typeof data.expiresAt === "number" ? data.expiresAt : Date.parse(data.expiresAt || "");
    state.token = data.token;
    state.expiresAt = Number.isFinite(expiry) ? expiry : Date.now() + 4 * 60 * 1000;
    state.error = "";
    emit();
    return true;
  } catch (error) {
    state.error = error instanceof Error ? error.message : "Owner sign-in failed.";
    emit();
    throw error;
  } finally {
    state.pending = false;
    try { popup.close(); } catch { /* browser already closed it */ }
    emit();
  }
}

/** Run one server-verified READ tool; posting, deleting, and ad changes are unavailable here. */
export async function readOwnerComposio(toolkitSlug, toolSlug, args = {}) {
  requireLive();
  const token = validSession();
  if (typeof toolkitSlug !== "string" || !toolkitSlug || typeof toolSlug !== "string" || !toolSlug) {
    throw new OwnerToolError("Choose a connected account and read tool.", "invalid_tool");
  }
  return post("execute", { toolkitSlug, toolSlug, arguments: args }, token);
}

/** Discover the connected toolkit's server-approved read tools and input schemas. */
export async function listOwnerComposioTools(toolkitSlug) {
  requireLive();
  const token = validSession();
  if (typeof toolkitSlug !== "string" || !toolkitSlug) throw new OwnerToolError("Choose a connected account.", "invalid_toolkit");
  const data = await post("tools", { toolkitSlug }, token);
  return Array.isArray(data.tools) ? data.tools : [];
}

/** Forget the browser's owner session; the connected account itself remains in Wron. */
export function disconnectOwnerComposio() {
  state.token = "";
  state.expiresAt = 0;
  state.error = "";
  emit();
}

/** Reactive owner session state. Never call read tools until connected is true. */
export function useOwnerComposio() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** A small safe gate for internal dashboards: no account data is fetched in preview or for visitors. */
export function OwnerComposioGate({ children, className = "", buttonClassName = "", fallback, unavailable }) {
  const { connected, pending, error, available } = useOwnerComposio();
  if (connected) return typeof children === "function" ? children() : children;
  if (!available) return unavailable ?? createElement("p", { className }, "Connected account data appears after publishing and owner sign-in.");
  if (fallback) return typeof fallback === "function" ? fallback({ connect: connectOwnerComposio, pending, error }) : fallback;
  return createElement("div", { className },
    createElement("p", null, "Sign in as this site's owner to view connected account data."),
    createElement("button", { type: "button", className: buttonClassName, disabled: pending, onClick: () => { connectOwnerComposio().catch(() => {}); } }, pending ? "Opening Wron…" : "Connect as owner"),
    error ? createElement("p", { role: "alert" }, error) : null,
  );
}
