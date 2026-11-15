// Mail in, files out.
//
// Cloudflare Email Routing can hand a message to a Worker's email() handler, so a
// file sent to forms@your-domain arrives here with no third party in between.
// Every attachment is stored in R2 and listed in the library as the owner's own —
// never public, because people mail themselves their own papers.
//
// What counts as something worth keeping:
//   .pdf                     a form or a scan, stored and marked encrypted or readable
//   .md / .markdown / .txt   a template, opened in the editor from the library
//   images                   a photo of a form, stored for reference
// A message with no attachment keeps its body as Markdown, so "send it to
// yourself" works from a mail app on a phone with nothing attached.
import PostalMime from "postal-mime";
import { sha256Hex } from "./crypto.js";
import { MAX_UPLOAD, storeBytes } from "./files.js";
import { describePdf } from "./pdf.js";
import { insertDocument } from "./library.js";
import { nowIso } from "./util.js";

const MAX_PER_SENDER_PER_DAY = 40;
const MAX_ATTACHMENTS = 12;

function classify(filename, contentType) {
  const name = String(filename || "").toLowerCase();
  const type = String(contentType || "").toLowerCase();
  if (name.endsWith(".pdf") || type === "application/pdf") return "pdf";
  if (/\.(md|markdown)$/.test(name) || /^text\/(markdown|x-markdown)$/.test(type)) return "markdown";
  if (/\.txt$/.test(name) || type === "text/plain") return "markdown";
  if (/^image\//.test(type) || /\.(png|jpe?g|webp|gif|heic)$/.test(name)) return "image";
  return null;
}

function titleFromName(filename) {
  const base = String(filename || "").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return base.slice(0, 140) || "Emailed file";
}

/**
 * Store everything usable in one message.
 * Returns { stored, skipped } — a summary, so the caller can log what happened.
 */
export async function ingestMessage(raw, env, meta = {}) {
  if (!env.FILES || !env.DB) return { stored: 0, skipped: "not_connected" };

  const email = await PostalMime.parse(raw);
  const sender = String(meta.from || email.from?.address || "").toLowerCase();
  const fromHash = await sha256Hex(sender || "unknown");
  const subject = String(email.subject || "").slice(0, 200);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM library_documents WHERE from_hash = ? AND created_at > ?"
  )
    .bind(fromHash, since)
    .first();
  if (Number(recent?.n || 0) >= MAX_PER_SENDER_PER_DAY) return { stored: 0, skipped: "rate_limited" };

  const found = [];
  const ignored = [];
  for (const attachment of email.attachments || []) {
    if (found.length >= MAX_ATTACHMENTS) {
      ignored.push(`stopped after ${MAX_ATTACHMENTS} attachments`);
      break;
    }
    const kind = classify(attachment.filename, attachment.mimeType);
    if (!kind) continue; // a signature image, a calendar part: not worth a line
    const bytes = new Uint8Array(attachment.content);
    if (!bytes.byteLength) {
      ignored.push(`${attachment.filename || "attachment"}: empty`);
      continue;
    }
    if (bytes.byteLength > MAX_UPLOAD) {
      ignored.push(`${attachment.filename || "attachment"}: over 10 MB`);
      continue;
    }
    found.push({ kind, name: attachment.filename || `${kind}.${kind === "pdf" ? "pdf" : "txt"}`, type: attachment.mimeType, bytes });
  }

  const body = String(email.text || "").trim();
  if (!found.length && body.length > 20) {
    found.push({
      kind: "markdown",
      name: `${subject || "emailed notes"}.md`,
      type: "text/markdown",
      bytes: new TextEncoder().encode(body),
    });
  }

  let stored = 0;
  const skipped = [...ignored];
  for (const item of found) {
    try {
      const contentType = item.type || (item.kind === "pdf" ? "application/pdf" : "text/plain");
      const blob = await storeBytes(env, item.bytes, contentType, item.name);
      const described = item.kind === "pdf" ? await describePdf(item.bytes) : { encrypted: false, pages: null, title: "" };
      const at = nowIso();
      await insertDocument(env, {
        id: crypto.randomUUID(),
        title: described.title || titleFromName(item.name),
        kind: item.kind,
        r2_key: blob.key,
        bytes: blob.bytes,
        sha256: blob.sha256,
        content_type: contentType,
        filename: item.name.slice(0, 120),
        pages: described.pages,
        status: described.encrypted ? "encrypted" : "stored",
        visibility: "owner",
        source: "email",
        from_hash: fromHash,
        subject,
        fetched_at: at,
        created_at: at,
        updated_at: at,
      });
      stored += 1;
    } catch (error) {
      skipped.push(`${item.name}: ${error?.message || "could not be stored"}`);
    }
  }

  return { stored, skipped: skipped.join("; ") };
}

/**
 * The Worker's email() handler. It must not throw for ordinary trouble: a throw
 * bounces the message back at the sender, and a 12 MB scan bouncing is worse than
 * a line in the log.
 */
export async function handleEmail(message, env) {
  try {
    const summary = await ingestMessage(message.raw, env, { from: message.from, to: message.to });
    console.log(`inbox: ${summary.stored} stored from ${message.from}`, summary.skipped || "");
  } catch (error) {
    console.error("inbox failed:", error && error.stack ? error.stack : error);
  }
}
