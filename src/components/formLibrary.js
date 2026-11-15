// Judicial Council forms by number, and the library they land in.
//
// A form is pulled from courts.ca.gov by the Worker and stored in R2, so nothing
// large is kept in this browser.
//
// Emailed and uploaded documents belong to the owner. The pass below is the same
// one the kit sends as X-Wron-Owner; the Worker compares it with OWNER_PASS and
// leaves private rows out of every reply that arrives without it.
import { cloudCall } from "../wron-kit/cloud.js";
import { siteId, storage } from "../wron-kit/runtime.js";

const OWNER_KEY = `wron:owner:${siteId}`;
const OWNER_DAYS = 30;

export function ownerPass() {
  try {
    const raw = storage.get(OWNER_KEY);
    if (!raw) return "";
    const { pass, expiresAt } = JSON.parse(raw);
    return typeof pass === "string" && expiresAt > Date.now() + 60_000 ? pass : "";
  } catch {
    return "";
  }
}

export function saveOwnerPass(pass) {
  storage.set(OWNER_KEY, JSON.stringify({ pass: String(pass), expiresAt: Date.now() + OWNER_DAYS * 864e5 }));
}

export function forgetOwnerPass() {
  storage.remove(OWNER_KEY);
}

/** Pull one form by number: "FL-320" -> the official PDF, stored and listed. */
export async function pullForm(number, { refresh = false } = {}) {
  return cloudCall("forms", { number, refresh });
}

/** Everything in the library, newest first, plus whether the owner pass was accepted. */
export async function listForms() {
  const { rows, owner } = await cloudCall("library", { op: "list" });
  return { rows: rows || [], owner: !!owner };
}

/** Remove a document from the library (and its bytes, unless they are shared). */
export async function forgetForm(id) {
  await cloudCall("library", { op: "remove", id });
  return true;
}

/** The text of a stored Markdown/template file. Private files need the pass. */
export async function fetchDocumentText(url) {
  const pass = ownerPass();
  const response = await fetch(url, { headers: pass ? { "x-wron-owner": pass } : {} });
  if (!response.ok) {
    throw new Error(response.status === 403 ? "That file is private." : "That file could not be opened.");
  }
  return response.text();
}

export function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (!n) return "";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** "2025-07" -> "Jul 2025" */
export function formatRevision(revision) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(revision || ""));
  if (!match) return "";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[Number(match[2]) - 1];
  return month ? `${month} ${match[1]}` : "";
}
