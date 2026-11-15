// Community sharing, no account needed.
// Shares go to the owner's "shared_templates" inbox table first (spam and abuse protection),
// and appear in the public "community_templates" list once the owner publishes them from D1.
// Reports and copies are logged as their own rows.
import { table } from "@wron/kit";
import { TABLES } from "../data/site";
import { contentForSharing } from "./templateStore";

const LAST_SHARE = "otl-last-share-at";
const MIN_GAP_MS = 60 * 1000;

/** What stops this document being shared, or "" when nothing does. */
export function templateProblem(doc) {
  if (!doc?.title?.trim()) return "Give the template a title before sharing.";
  // An imported page carries its whole document as html and has no blocks at all.
  if (!(doc.blocks || []).some((b) => b.type !== "image") && !String(doc.html || "").trim()) {
    return "Add some text or a field before sharing.";
  }
  return "";
}

const submissionFor = (doc, name) => ({
  title: doc.title.trim().slice(0, 140),
  category: (doc.category || "").slice(0, 60),
  author_name: String(name || "").trim().slice(0, 60),
  content: contentForSharing(doc),
  confirmed_removed: true,
});

const noteShared = () => {
  try { window.sessionStorage?.setItem(LAST_SHARE, String(Date.now())); } catch { /* ignore */ }
};

const waitMessage = "You just shared a template. Please wait a minute before sharing another.";

const tooSoon = () => Date.now() - Number(window.sessionStorage?.getItem(LAST_SHARE) || 0) < MIN_GAP_MS;

export async function shareTemplate(doc, { name = "", confirmed = false } = {}) {
  if (!confirmed) throw new Error("Please confirm you removed personal details.");
  const problem = templateProblem(doc);
  if (problem) throw new Error(problem);
  if (tooSoon()) throw new Error(waitMessage);
  const row = await table(TABLES.submissions).add(submissionFor(doc, name));
  noteShared();
  return row;
}

/**
 * Several templates in one go. One gap covers the batch instead of each template,
 * and one failure is reported without stopping the rest.
 */
export async function shareTemplates(docs, { name = "", confirmed = false, onProgress } = {}) {
  if (!confirmed) throw new Error("Please confirm you removed personal details.");
  const list = (Array.isArray(docs) ? docs : []).filter(Boolean);
  if (!list.length) throw new Error("Choose at least one template first.");
  if (tooSoon()) throw new Error(waitMessage);

  const results = [];
  for (const doc of list) {
    const title = doc.title?.trim() || "Untitled template";
    const problem = templateProblem(doc);
    if (problem) {
      results.push({ title, ok: false, error: problem });
    } else {
      try {
        await table(TABLES.submissions).add(submissionFor(doc, name));
        results.push({ title, ok: true });
      } catch (error) {
        results.push({ title, ok: false, error: error?.message || "Sharing did not work." });
      }
    }
    onProgress?.(results.length, list.length, results[results.length - 1]);
  }
  if (results.some((r) => r.ok)) noteShared();
  return results;
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
