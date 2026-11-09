// Community sharing, no account needed.
// Shares go to the owner's "shared_templates" inbox table first (spam and abuse protection),
// and appear in the public "community_templates" list once the owner publishes them from D1.
// Reports and copies are logged as their own rows.
import { table } from "@wron/kit";
import { TABLES } from "../data/site";
import { contentForSharing } from "./templateStore";

const LAST_SHARE = "otl-last-share-at";
const MIN_GAP_MS = 60 * 1000;

export async function shareTemplate(doc, { name = "", confirmed = false } = {}) {
  if (!confirmed) throw new Error("Please confirm you removed personal details.");
  if (!doc?.title?.trim()) throw new Error("Give the template a title before sharing.");
  if (!(doc.blocks || []).some((b) => b.type !== "image")) throw new Error("Add some text or a field before sharing.");
  const last = Number(window.sessionStorage?.getItem(LAST_SHARE) || 0);
  if (Date.now() - last < MIN_GAP_MS) throw new Error("You just shared a template. Please wait a minute before sharing another.");
  const row = await table(TABLES.submissions).add({
    title: doc.title.trim().slice(0, 140),
    category: (doc.category || "").slice(0, 60),
    author_name: name.trim().slice(0, 60),
    content: contentForSharing(doc),
    confirmed_removed: true,
  });
  try { window.sessionStorage?.setItem(LAST_SHARE, String(Date.now())); } catch { /* ignore */ }
  return row;
}

export const SHARE_SENT = "Thanks. Your template was sent and appears in the community after a quick check.";

export async function reportTemplate(row, reason = "") {
  return table(TABLES.reports).add({
    template_id: String(row.id),
    template_title: row.title || "",
    reason: reason.slice(0, 500),
  });
}

export async function logCopy(row) {
  try { await table(TABLES.copies).add({ template_id: String(row.id) }); } catch { /* a missed count never blocks copying */ }
}

export const authorName = (row) => (row?.author_name && row.author_name.trim()) || "Anonymous";

// Chips: All + the three confirmed examples + any other category that exists in the data.
export function categoryChips(rows = [], base = ["Resumes", "Cover letters", "Demand letters"]) {
  const extra = [...new Set(rows.map((r) => r.category).filter(Boolean))].filter((c) => !base.includes(c)).sort();
  return ["All categories", ...base, ...extra];
}
