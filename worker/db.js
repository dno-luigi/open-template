// The four tables from db/schema.json, implemented on D1.
//
// Access rules live here, on the server, never in the browser:
//
//   community_templates  anyone may read; only the owner publishes (in D1)
//   shared_templates     anyone may submit; never listed publicly
//   template_reports     anyone may submit; never listed publicly
//   template_copies      anyone may submit; bumps community_templates.uses
//
// Column names are never taken from the request: only the names in a table's
// COLUMNS can reach the SQL, and every value is bound as a parameter.
import { sha256Hex } from "./crypto.js";
import { clientIp, fail, json, nowIso } from "./util.js";

const MAX_LIMIT = 200;

const TABLES = {
  community_templates: {
    read: true,
    add: null,
    columns: {
      title: "text",
      category: "text",
      author_name: "text",
      content: "json",
      shared_on: "text",
      uses: "number",
    },
  },
  shared_templates: {
    read: false,
    add: "share",
    columns: {
      title: "text",
      category: "text",
      author_name: "text",
      content: "json",
      confirmed_removed: "boolean",
    },
  },
  template_reports: {
    read: false,
    add: "report",
    columns: { template_id: "text", template_title: "text", reason: "text" },
  },
  template_copies: {
    read: false,
    add: "copy",
    columns: { template_id: "text" },
  },
};

function parseJson(value) {
  if (value == null) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function shape(row, config) {
  if (!row) return null;
  const out = { id: row.id, created_at: row.created_at, updated_at: row.updated_at };
  for (const [key, type] of Object.entries(config.columns)) {
    out[key] = type === "json" ? parseJson(row[key]) : row[key];
  }
  return out;
}

/** Keep only known columns and store each value in the type the schema declares. */
function pick(values, config) {
  const out = {};
  for (const [key, raw] of Object.entries(values || {})) {
    const type = config.columns[key];
    if (!type) continue;
    if (type === "number") {
      const number = Number(raw);
      if (Number.isFinite(number)) out[key] = number;
    } else if (type === "json") {
      out[key] = JSON.stringify(raw ?? {}).slice(0, 100_000);
    } else if (type === "boolean") {
      out[key] = raw ? 1 : 0;
    } else {
      out[key] = raw == null ? null : String(raw);
    }
  }
  return out;
}

function text(value, max) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function conditions(where, config) {
  const parts = [];
  const values = [];
  for (const [key, value] of Object.entries(where || {})) {
    if (key === "id") {
      parts.push("id = ?");
      values.push(String(value));
      continue;
    }
    if (!config.columns[key]) continue;
    if (value == null) {
      parts.push(`${key} IS NULL`);
      continue;
    }
    parts.push(`${key} = ?`);
    values.push(config.columns[key] === "number" ? Number(value) : String(value));
  }
  return { clause: parts.length ? ` WHERE ${parts.join(" AND ")}` : "", values };
}

export async function handleDb(request, env, body) {
  const db = env.DB;
  const table = String(body.table || "");
  const config = TABLES[table];
  if (!config) return fail(404, "unknown_table", "That table is not available on this site.");

  const op = String(body.op || "list");

  if (op === "list" || op === "count") {
    if (!config.read) return fail(403, "not_allowed", "That table cannot be read from the site.");

    const { clause, values } = conditions(body.where, config);
    if (op === "count") {
      const row = await db.prepare(`SELECT COUNT(*) AS n FROM ${table}${clause}`).bind(...values).first();
      return json({ count: Number(row?.n || 0) });
    }

    const limit = Math.min(Math.max(Number(body.limit) || MAX_LIMIT, 1), MAX_LIMIT);
    const orderBy = Object.prototype.hasOwnProperty.call(config.columns, body.orderBy) ||
      ["created_at", "updated_at"].includes(body.orderBy)
      ? body.orderBy
      : "shared_on";
    const direction = body.desc === false ? "ASC" : "DESC";
    const { results } = await db
      .prepare(`SELECT * FROM ${table}${clause} ORDER BY ${orderBy} ${direction} LIMIT ?`)
      .bind(...values, limit)
      .all();
    return json({ rows: (results || []).map((row) => shape(row, config)) });
  }

  if (op === "get") {
    if (!config.read) return fail(403, "not_allowed", "That table cannot be read from the site.");
    const row = await db.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(String(body.id || "")).first();
    return json({ row: shape(row, config) });
  }

  if (op === "add") {
    if (!config.add) return fail(403, "not_allowed", "That table only takes submissions.");
    const values = pick(body.values, config);

    if (config.add === "share") return await addShare(request, env, values);
    if (config.add === "report") return await addReport(env, values);
    if (config.add === "copy") return await addCopy(env, values);
  }

  return fail(400, "unknown_op", "That database action does not exist.");
}

/** A template a visitor shared. Reviewed by the owner in D1 before it is published. */
async function addShare(request, env, values) {
  const db = env.DB;
  if (!values.confirmed_removed) {
    return fail(400, "not_confirmed", "Please confirm you removed personal details.");
  }
  const title = text(values.title, 140);
  if (!title) return fail(400, "missing_title", "Give the template a title before sharing.");
  // pick() stores JSON columns as text; read it back before checking the shape.
  const content = parseJson(values.content);
  if (!content || !Array.isArray(content.blocks) || !content.blocks.some((b) => b && b.type !== "image")) {
    return fail(400, "empty_template", "Add some text or a field before sharing.");
  }

  const ipHash = await sha256Hex(clientIp(request));
  const cutoff = new Date(Date.now() - 60_000).toISOString();
  const recent = await db
    .prepare("SELECT COUNT(*) AS n FROM shared_templates WHERE ip_hash = ? AND created_at > ?")
    .bind(ipHash, cutoff)
    .first();
  if (Number(recent?.n || 0) >= 1) {
    return fail(429, "rate_limited", "You just shared a template. Please wait a minute before sharing another.");
  }

  const at = nowIso();
  const row = {
    id: crypto.randomUUID(),
    title,
    category: text(values.category, 60),
    author_name: text(values.author_name, 60),
    content: JSON.stringify(content).slice(0, 100_000),
    confirmed_removed: 1,
    status: "pending",
    ip_hash: ipHash,
    created_at: at,
  };
  const keys = Object.keys(row);
  await db
    .prepare(`INSERT INTO shared_templates (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`)
    .bind(...Object.values(row))
    .run();
  return json({ row: shape(row, TABLES.shared_templates) });
}

/** A report on a published template. Kept for the owner to read in D1. */
async function addReport(env, values) {
  const templateId = text(values.template_id, 64);
  if (!templateId) return fail(400, "missing_template", "That template could not be found.");
  const at = nowIso();
  const row = {
    id: crypto.randomUUID(),
    template_id: templateId,
    template_title: text(values.template_title, 140),
    reason: text(values.reason, 500),
    created_at: at,
  };
  const keys = Object.keys(row);
  await env.DB.prepare(`INSERT INTO template_reports (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`)
    .bind(...Object.values(row))
    .run();
  return json({ row: shape(row, TABLES.template_reports) });
}

/** One row per copy, and the published template's uses count goes up by one. */
async function addCopy(env, values) {
  const templateId = text(values.template_id, 64);
  if (!templateId) return fail(400, "missing_template", "That template could not be found.");
  const db = env.DB;
  const found = await db.prepare("SELECT id FROM community_templates WHERE id = ?").bind(templateId).first();
  if (!found) return fail(404, "not_found", "That template no longer exists.");

  const at = nowIso();
  const row = { id: crypto.randomUUID(), template_id: templateId, created_at: at };
  await db.batch([
    db.prepare("INSERT INTO template_copies (id, template_id, created_at) VALUES (?, ?, ?)").bind(row.id, row.template_id, at),
    db.prepare("UPDATE community_templates SET uses = uses + 1, updated_at = ? WHERE id = ?").bind(at, templateId),
  ]);
  return json({ row: shape(row, TABLES.template_copies) });
}
