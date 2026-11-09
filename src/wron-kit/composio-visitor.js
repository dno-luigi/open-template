// Connected accounts for signed-in visitors of a published site. The site's
// Composio key and connection policy stay on Wron's server.
import { createElement, useEffect, useState, useSyncExternalStore } from "react";
import { auth, useUser } from "./cloud.js";
import { apiBase, isPreview, isServer, siteId, storage } from "./runtime.js";

const SESSION_KEY = `wron:session:${siteId}`;
const listeners = new Set();
const states = new Map();
const pending = new Map();
const empty = { connected: false, enabled: false, loading: true, error: "" };

function emit() { for (const listener of listeners) listener(); }
function subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
function snapshot(slug) { return states.get(slug) || empty; }
function update(slug, patch) { states.set(slug, { ...snapshot(slug), ...patch }); emit(); }

export class VisitorToolError extends Error {
  constructor(message, code = "visitor_tool_error", status = 0) {
    super(message);
    this.name = "VisitorToolError";
    this.code = code;
    this.status = status;
  }
}

async function request(operation, body) {
  if (isServer || isPreview) throw new VisitorToolError("Connected accounts work on the published site.", "not_live");
  if (!apiBase || !siteId) throw new VisitorToolError("This site is not connected to Wron.", "not_connected");
  const session = storage.get(SESSION_KEY);
  if (!session) throw new VisitorToolError("Sign in to this site first.", "sign_in_required", 401);
  let response;
  try {
    response = await fetch(`${apiBase}/api/site/${encodeURIComponent(siteId)}/composio/${operation}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Wron-Session": session },
      body: JSON.stringify(body),
    });
  } catch {
    throw new VisitorToolError("Could not reach Wron. Check your connection and try again.", "network_error");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new VisitorToolError(data.error || "Connected-account request failed.", data.code || "request_failed", response.status);
  return data;
}

// A project-wide Composio verifier returns here after OAuth. Keep its
// single-use URI in the fragment, remove it before any other code can navigate,
// and let the server verify this site's live login against the original attempt.
if (!isServer && !isPreview) queueMicrotask(() => {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const attemptId = params.get("wron_composio_attempt");
  const sessionUri = params.get("wron_composio_session");
  const toolkitSlug = params.get("wron_composio_toolkit");
  if (!attemptId || !sessionUri || !toolkitSlug) return;
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  update(toolkitSlug, { loading: true, error: "" });
  request("complete", { attemptId, sessionUri }).then(async () => {
    if (pending.has(toolkitSlug)) await pending.get(toolkitSlug).catch(() => {});
    return refreshVisitorComposio(toolkitSlug);
  })
    .catch(error => update(toolkitSlug, { loading: false, connected: false, error: error?.message || "Could not verify this connection." }));
});

/** Check whether this signed-in site visitor connected a toolkit. */
export async function refreshVisitorComposio(toolkitSlug) {
  if (pending.has(toolkitSlug)) return pending.get(toolkitSlug);
  update(toolkitSlug, { loading: true, error: "" });
  const task = request("status", {}).then(data => {
    const row = data.toolkits?.find(item => item.slug === toolkitSlug);
    update(toolkitSlug, { loading: false, enabled: !!row, connected: !!row?.connected, error: "" });
    return !!row?.connected;
  }).catch(error => {
    update(toolkitSlug, { loading: false, connected: false, error: error.message });
    throw error;
  }).finally(() => pending.delete(toolkitSlug));
  pending.set(toolkitSlug, task);
  return task;
}

/** Start this visitor's own OAuth flow. The provider returns to this site. */
export async function connectVisitorComposio(toolkitSlug) {
  const data = await request("connect", { toolkitSlug });
  if (data.connected) {
    await refreshVisitorComposio(toolkitSlug);
    return true;
  }
  if (typeof data.redirectUrl !== "string") throw new VisitorToolError("The account provider did not return a connection page.");
  window.location.assign(data.redirectUrl);
  return false;
}

/** Server-approved read tools for this visitor's connected toolkit. */
export async function listVisitorComposioTools(toolkitSlug) {
  const data = await request("tools", { toolkitSlug });
  return Array.isArray(data.tools) ? data.tools : [];
}

/** Execute a server-approved read tool against only this visitor's account. */
export async function readVisitorComposio(toolkitSlug, toolSlug, args = {}) {
  return request("execute", { toolkitSlug, toolSlug, arguments: args });
}

/** Reactive { connected, enabled, loading, error, available, refresh }. */
export function useVisitorComposio(toolkitSlug) {
  const { user, loading: userLoading } = useUser();
  const userId = user?.id;
  const state = useSyncExternalStore(subscribe, () => snapshot(toolkitSlug), () => empty);
  useEffect(() => {
    if (!userId) {
      update(toolkitSlug, { connected: false, loading: false, error: "" });
      return;
    }
    if (!isServer && !isPreview) refreshVisitorComposio(toolkitSlug).catch(() => {});
  }, [toolkitSlug, userId]);
  return { ...state, loading: userLoading || state.loading,
    available: !isServer && !isPreview && !!apiBase && !!siteId,
    refresh: () => refreshVisitorComposio(toolkitSlug) };
}

function DefaultSignIn({ toolkitSlug }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      if (mode === "signup") await auth.signUp({ email, password, name, inviteCode });
      else await auth.signIn({ email, password });
      await connectVisitorComposio(toolkitSlug);
    } catch (e) { setError(e?.message || "Could not sign in."); }
    finally { setBusy(false); }
  }
  return createElement("form", { onSubmit: submit, style: { display: "grid", gap: 10, maxWidth: 360 } },
    createElement("p", null, mode === "signup" ? "Create an account to connect yours." : "Sign in to connect your account."),
    mode === "signup" && createElement("input", { value: name, onChange: e => setName(e.target.value), placeholder: "Name", "aria-label": "Name", autoComplete: "name" }),
    createElement("input", { value: email, onChange: e => setEmail(e.target.value), placeholder: "Email", type: "email", required: true, "aria-label": "Email", autoComplete: "email" }),
    createElement("input", { value: password, onChange: e => setPassword(e.target.value), placeholder: "Password", type: "password", required: true, "aria-label": "Password", autoComplete: mode === "signup" ? "new-password" : "WRON_SECRET_REMOVED" }),
    mode === "signup" && createElement("input", { value: inviteCode, onChange: e => setInviteCode(e.target.value), placeholder: "Invite code, if required", "aria-label": "Invite code" }),
    createElement("button", { type: "submit", disabled: busy }, busy ? "Please wait…" : mode === "signup" ? "Create account and connect" : "Sign in and connect"),
    createElement("button", { type: "button", onClick: () => setMode(mode === "signup" ? "signin" : "signup") }, mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"),
    error && createElement("p", { role: "alert" }, error));
}

/** Gates account-backed UI on the visitor's own site login and OAuth grant. */
export function VisitorComposioGate({ toolkitSlug, children, signedOut, fallback, unavailable, className = "" }) {
  const { user, loading: userLoading } = useUser();
  const state = useVisitorComposio(toolkitSlug);
  if (!state.available) return unavailable ?? createElement("p", { className }, "Connected account data appears on the published site after you sign in.");
  if (userLoading) return createElement("p", { className }, "Checking your account…");
  if (!user) return signedOut ?? createElement(DefaultSignIn, { toolkitSlug });
  if (state.connected) return typeof children === "function" ? children() : children;
  if (fallback) return typeof fallback === "function" ? fallback({ ...state, connect: () => connectVisitorComposio(toolkitSlug) }) : fallback;
  return createElement("div", { className },
    createElement("p", null, state.loading ? "Checking your connection…" : "Connect your account to see your data."),
    !state.loading && state.enabled && createElement("button", { type: "button", onClick: () => connectVisitorComposio(toolkitSlug).catch(error => update(toolkitSlug, { error: error.message })) }, "Connect account"),
    !state.loading && !state.enabled && createElement("p", null, "This connection is not enabled for this site."),
    state.error && createElement("p", { role: "alert" }, state.error));
}
