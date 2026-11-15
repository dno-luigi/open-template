// The library: forms pulled from the Judicial Council, and anything uploaded or
// mailed in.
//
//   POST /api/site/:id/forms    { number: "FL-320", refresh?: true }
//        -> { row, cached }   pulls the official PDF, stores it in R2, records it
//   POST /api/site/:id/library  { op: list | get | remove, id? }
//
// Pulling is idempotent: the form number is unique, so asking for FL-320 again
// returns the copy already stored instead of fetching and storing a second one.
//
// Visibility is enforced here, not in the browser. Documents pulled by number are
// public; anything mailed in or uploaded belongs to the owner, and is left out of
// every reply that did not arrive with the owner pass.
import { fileUrl, storeBytes } from "./files.js";
import { FormError, fetchFormPage, fetchFormPdf, normalizeFormNumber } from "./forms.js";
import { describePdf, readableTitle } from "./pdf.js";
import { fail, isOwner, json, nowIso } from "./util.js";

const READ_COLUMNS = [
  "id",
  "form_number",
  "title",
  "kind",
  "packet",
  "r2_key",
  "bytes",
  "sha256",
  "content_type",
  "filename",
  "revision",
  "source_url",
  "pages",
  "field_count",
  "status",
  "visibility",
  "source",
  "subject",
  "fetched_at",
  "created_at",
  "updated_at",
].join(", ");

// The columns a pulled form writes. visibility, source and the mail fields keep
// their defaults (public, form).
const FORM_COLUMNS = [
  "id",
  "form_number",
  "title",
  "kind",
  "packet",
  "r2_key",
  "bytes",
  "sha256",
  "content_type",
  "filename",
  "revision",
  "source_url",
  "pages",
  "field_count",
  "status",
  "fetched_at",
  "created_at",
  "updated_at",
].join(", ");

const MAX_LIST = 200;

function shape(row) {
  if (!row) return null;
  return {
    id: row.id,
    formNumber: row.form_number,
    title: row.title,
    kind: row.kind,
    packet: row.packet,
    url: row.r2_key ? fileUrl(row.r2_key) : null,
    bytes: Number(row.bytes || 0),
    sha256: row.sha256,
    contentType: row.content_type,
    filename: row.filename,
    revision: row.revision,
    sourceUrl: row.source_url,
    pages: row.pages == null ? null : Number(row.pages),
    fieldCount: row.field_count == null ? null : Number(row.field_count),
    status: row.status,
    visibility: row.visibility || "public",
    source: row.source || "form",
    subject: row.subject || "",
    fetchedAt: row.fetched_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Insert one document. Shared with the inbox, which stores mailed attachments the
 * same way a pulled form is stored, apart from being private to the owner.
 */
export async function insertDocument(env, row) {
  const at = nowIso();
  await env.DB.prepare(
    `INSERT INTO library_documents (
       id, form_number, title, kind, packet, r2_key, bytes, sha256, content_type, filename,
       revision, source_url, pages, field_count, status, visibility, source, from_hash,
       subject, fetched_at, created_at, updated_at
     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22)`
  )
    .bind(
      row.id,
      row.form_number ?? null,
      row.title ?? "",
      row.kind ?? "pdf",
      row.packet ?? null,
      row.r2_key,
      row.bytes ?? 0,
      row.sha256 ?? "",
      row.content_type ?? "application/pdf",
      row.filename ?? "",
      row.revision ?? null,
      row.source_url ?? null,
      row.pages ?? null,
      row.field_count ?? null,
      row.status ?? "stored",
      row.visibility ?? "public",
      row.source ?? "upload",
      row.from_hash ?? null,
      row.subject ?? null,
      row.fetched_at ?? at,
      row.created_at ?? at,
      row.updated_at ?? at
    )
    .run();
  return row;
}

/** POST /api/site/:id/forms */
export async function handleForms(request, env, body) {
  if (!env.FILES) return fail(503, "no_storage", "File storage is not connected to this site yet.");

  const form = normalizeFormNumber(body.number);
  if (!form) return fail(400, "bad_number", "That is not a form number. Try FL-320, FL-150 or DV-100.");
  if (form.local) {
    return fail(
      400,
      "local_form",
      `${form.display} looks like a local court form (San Diego's D- numbers, for example). Those are not published on courts.ca.gov — upload or mail that PDF instead.`
    );
  }

  const existing = await env.DB.prepare(`SELECT ${READ_COLUMNS} FROM library_documents WHERE form_number = ?`)
    .bind(form.display)
    .first();
  if (existing && body.refresh !== true) return json({ row: shape(existing), cached: true });

  let fetched;
  try {
    fetched = await fetchFormPdf(form.id);
  } catch (error) {
    // A form already stored stays usable when the source is unreachable.
    if (existing && error instanceof FormError) {
      return json({ row: shape(existing), cached: true, warning: error.message });
    }
    if (error instanceof FormError) return fail(error.status, error.code, error.message);
    throw error;
  }

  // The bytes are content-addressed, so putting an identical PDF again is free.
  // The row is still recomputed: a re-pull is how a stored copy picks up a title
  // from the court's page, or a status this Worker learned to read since.
  const stored = await storeBytes(env, fetched.bytes, "application/pdf", `${form.display}.pdf`);

  // Encrypted forms cannot be walked until the blank password is removed. Until
  // then the pages and fields stay unknown rather than guessed, and the name
  // comes from the court's own page about the form.
  const described = await describePdf(fetched.bytes);
  let title = described.title;
  if (!title) {
    const page = await fetchFormPage(form.display);
    title = readableTitle(page.title) || form.display;
  }
  const status = described.encrypted ? "encrypted" : "stored";
  const at = nowIso();
  const row = {
    id: existing?.id || crypto.randomUUID(),
    form_number: form.display,
    title,
    kind: "pdf",
    r2_key: stored.key,
    bytes: stored.bytes,
    sha256: stored.sha256,
    content_type: "application/pdf",
    filename: `${form.display}.pdf`,
    revision: fetched.revision,
    source_url: fetched.sourceUrl,
    pages: described.pages,
    status,
    fetched_at: at,
    created_at: existing?.created_at || at,
    updated_at: at,
  };

  await env.DB.prepare(
    `INSERT INTO library_documents (${FORM_COLUMNS})
     VALUES (?1, ?2, ?3, ?4, NULL, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, NULL, ?13, ?14, ?15, ?16)
     ON CONFLICT(form_number) DO UPDATE SET
       title = excluded.title,
       r2_key = excluded.r2_key,
       bytes = excluded.bytes,
       sha256 = excluded.sha256,
       content_type = excluded.content_type,
       filename = excluded.filename,
       revision = excluded.revision,
       source_url = excluded.source_url,
       pages = excluded.pages,
       status = excluded.status,
       fetched_at = excluded.fetched_at,
       updated_at = excluded.updated_at`
  )
    .bind(
      row.id,
      row.form_number,
      row.title,
      row.kind,
      row.r2_key,
      row.bytes,
      row.sha256,
      row.content_type,
      row.filename,
      row.revision,
      row.source_url,
      row.pages,
      row.status,
      row.fetched_at,
      row.created_at,
      row.updated_at
    )
    .run();

  const saved = await env.DB.prepare(`SELECT ${READ_COLUMNS} FROM library_documents WHERE form_number = ?`)
    .bind(form.display)
    .first();
  return json({ row: shape(saved || row), cached: false });
}

/** POST /api/site/:id/library */
export async function handleLibrary(request, env, body) {
  const op = String(body.op || "list");
  const owner = isOwner(request, env);

  if (op === "list") {
    const limit = Math.min(Math.max(Number(body.limit) || MAX_LIST, 1), MAX_LIST);
    const where = owner ? "" : " WHERE visibility = 'public'";
    const { results } = await env.DB.prepare(
      `SELECT ${READ_COLUMNS} FROM library_documents${where} ORDER BY updated_at DESC LIMIT ?`
    )
      .bind(limit)
      .all();
    return json({ rows: (results || []).map(shape), owner });
  }

  if (op === "get") {
    const row = await env.DB.prepare(`SELECT ${READ_COLUMNS} FROM library_documents WHERE id = ?`)
      .bind(String(body.id || ""))
      .first();
    if (!row) return json({ row: null });
    if ((row.visibility || "public") !== "public" && !owner) return fail(404, "not_found", "That document is not here.");
    return json({ row: shape(row) });
  }

  if (op === "remove") {
    const id = String(body.id || "");
    if (!id) return fail(400, "missing_id", "Which document?");
    const row = await env.DB.prepare("SELECT id, r2_key, visibility FROM library_documents WHERE id = ?")
      .bind(id)
      .first();
    if (!row) return fail(404, "not_found", "That document is not in the library.");
    if ((row.visibility || "public") !== "public" && !owner) {
      return fail(404, "not_found", "That document is not in the library.");
    }
    await env.DB.prepare("DELETE FROM library_documents WHERE id = ?").bind(id).run();
    // The object is content-addressed, so another row may share it: only remove
    // the bytes when nothing else points at the same key.
    if (env.FILES && row.r2_key) {
      const shared = await env.DB.prepare("SELECT COUNT(*) AS n FROM library_documents WHERE r2_key = ?")
        .bind(row.r2_key)
        .first();
      if (Number(shared?.n || 0) === 0) await env.FILES.delete(row.r2_key);
    }
    return json({ removed: true });
  }

  return fail(400, "unknown_op", "That library action does not exist.");
}
