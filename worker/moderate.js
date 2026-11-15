// The review queue: shares waiting before they reach the community list.
//
//   POST /api/site/:id/moderate  { op: "list" }
//   POST /api/site/:id/moderate  { op: "publish", id }
//   POST /api/site/:id/moderate  { op: "reject", id }
//
// Every op needs the owner pass (OWNER_PASS on the Worker, sent as X-Wron-Owner).
// shared_templates is never readable from the browser: this is the only way a
// pending share is listed, and publishing is the only way one becomes public.
import { fail, isOwner, json, nowIso } from "./util.js";

const SHARE_COLUMNS = "id, title, category, author_name, content, status, created_at";

function parseContent(value) {
  if (value && typeof value === "object") return value;
  try {
    const parsed = JSON.parse(String(value || "{}"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function shape(row) {
  return {
    id: row.id,
    title: row.title || "",
    category: row.category || "",
    author: row.author_name || "",
    status: row.status || "pending",
    createdAt: row.created_at,
    content: parseContent(row.content),
  };
}

/** POST /api/site/:id/moderate */
export async function handleModerate(request, env, body) {
  if (!isOwner(request, env)) {
    return fail(403, "not_owner", "That needs the owner pass on this device.");
  }

  const op = String(body.op || "list");

  if (op === "list") {
    const { results } = await env.DB.prepare(
      `SELECT ${SHARE_COLUMNS} FROM shared_templates WHERE status = 'pending' ORDER BY created_at LIMIT 100`
    ).all();
    const { results: counts } = await env.DB.prepare(
      "SELECT status, COUNT(*) AS n FROM shared_templates GROUP BY status"
    ).all();
    const tally = {};
    for (const row of counts || []) tally[row.status || "pending"] = Number(row.n || 0);
    return json({ rows: (results || []).map(shape), counts: tally });
  }

  const id = String(body.id || "");
  if (!id) return fail(400, "missing_id", "Which share?");

  if (op === "publish") {
    const row = await env.DB.prepare(`SELECT ${SHARE_COLUMNS} FROM shared_templates WHERE id = ?`).bind(id).first();
    if (!row) return fail(404, "not_found", "That share is not in the queue.");
    if ((row.status || "pending") !== "pending") {
      return fail(409, "already_handled", `That share was already ${row.status}.`);
    }
    const at = nowIso();
    // The content goes across as it arrived: it was already stripped of field
    // values when the person shared it.
    await env.DB.prepare(
      `INSERT INTO community_templates (id, title, category, author_name, content, shared_on, uses, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7, ?7)`
    )
      .bind(crypto.randomUUID(), row.title || "", row.category || "", row.author_name || "", row.content || "{}", at, at)
      .run();
    await env.DB.prepare("UPDATE shared_templates SET status = 'published' WHERE id = ?").bind(id).run();
    return json({ published: true, id });
  }

  if (op === "reject") {
    const row = await env.DB.prepare("SELECT id, status FROM shared_templates WHERE id = ?").bind(id).first();
    if (!row) return fail(404, "not_found", "That share is not in the queue.");
    if ((row.status || "pending") !== "pending") {
      return fail(409, "already_handled", `That share was already ${row.status}.`);
    }
    await env.DB.prepare("UPDATE shared_templates SET status = 'rejected' WHERE id = ?").bind(id).run();
    return json({ rejected: true, id });
  }

  return fail(400, "unknown_op", "That review action does not exist.");
}
