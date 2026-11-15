// Files in R2, so a phone's local storage never has to hold them.
//
//   POST /api/site/:id/upload   multipart/form-data with "file" -> { url, name, size, type }
//   GET  /files/<key>           the bytes, immutably cached
//
// The kit's upload(file) (src/wron-kit/cloud.js) already sends that form, so the
// browser side is the kit's, unchanged. Keys are the SHA-256 of the contents:
// the same form pulled twice is one object, and a file that never changes can be
// cached forever.
import { sha256HexBytes } from "./crypto.js";
import { fail, isOwner, json } from "./util.js";

// 10 MB. The kit still refuses anything over 4 MB before it leaves the browser, so
// this ceiling is for what arrives by mail: a photo of a filed form from a phone is
// routinely more than 4 MB, and dropping it silently would be the wrong surprise.
export const MAX_UPLOAD = 10 * 1024 * 1024;

const EXTENSIONS = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "text/plain": "txt",
  "text/markdown": "md",
};

export function fileUrl(key) {
  return `/files/${key}`;
}

function extensionFor(filename, contentType) {
  const name = String(filename || "").toLowerCase();
  const found = /\.[a-z0-9]{2,5}$/.exec(name);
  if (found) return found[0];
  return `.${EXTENSIONS[String(contentType || "").toLowerCase()] || "bin"}`;
}

function safeName(filename) {
  return String(filename || "file")
    .replace(/[^\w.\- ()]/g, "")
    .trim()
    .slice(0, 120) || "file";
}

/**
 * Put bytes in R2 under their own hash. Returns { key, url, bytes, sha256, stored }
 * where stored is false when the object was already there.
 */
export async function storeBytes(env, bytes, contentType, filename) {
  if (!env.FILES) throw new Error("no_bucket");
  if (bytes.byteLength > MAX_UPLOAD) {
    const error = new Error("too_large");
    error.code = "too_large";
    throw error;
  }

  const digest = await sha256HexBytes(bytes);
  const key = `lib/${digest}${extensionFor(filename, contentType)}`;
  const existing = await env.FILES.head(key);
  if (!existing) {
    await env.FILES.put(key, bytes, {
      httpMetadata: {
        contentType: contentType || "application/octet-stream",
        cacheControl: "public, max-age=31536000, immutable",
      },
      customMetadata: { filename: safeName(filename) },
    });
  }

  return { key, url: fileUrl(key), bytes: bytes.byteLength, sha256: digest, stored: !existing };
}

/** POST /api/site/:id/upload — the body is a form, not JSON. */
export async function handleUpload(request, env) {
  if (!env.FILES) return fail(503, "no_storage", "File storage is not connected to this site yet.");

  let form;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "bad_upload", "Send the file as form data with a \"file\" field.");
  }

  const file = form.get("file");
  if (!file || typeof file === "string") return fail(400, "no_file", "Attach a file first.");
  if (file.size > MAX_UPLOAD) return fail(413, "too_large", "That file is over 4 MB.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  let stored;
  try {
    stored = await storeBytes(env, bytes, file.type, file.name);
  } catch (error) {
    if (error?.code === "too_large") return fail(413, "too_large", "That file is over 4 MB.");
    throw error;
  }

  return json({
    url: stored.url,
    name: safeName(file.name),
    size: stored.bytes,
    type: file.type || "application/octet-stream",
    key: stored.key,
  });
}

/** GET /files/<key> — the stored bytes. */
export async function handleFileGet(request, env, key) {
  if (!env.FILES) return fail(503, "no_storage", "File storage is not connected to this site yet.");
  if (key.includes("..")) return fail(404, "not_found", "No such file.");

  // A file mailed in or uploaded belongs to the owner. Its key is unguessable, but
  // unguessable is not the same as private.
  let isPrivate = false;
  if (env.DB) {
    const row = await env.DB.prepare("SELECT visibility FROM library_documents WHERE r2_key = ? LIMIT 1")
      .bind(key)
      .first();
    if (row && (row.visibility || "public") !== "public") {
      if (!isOwner(request, env)) return fail(403, "private", "That file is private.");
      isPrivate = true;
    }
  }

  const object = await env.FILES.get(key);
  if (!object) return fail(404, "not_found", "No such file.");

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", isPrivate ? "private, no-store" : "public, max-age=31536000, immutable");
  headers.set("content-length", String(object.size));
  if (!headers.has("content-type")) headers.set("content-type", "application/octet-stream");
  const name = object.customMetadata?.filename;
  if (name) headers.set("content-disposition", `inline; filename="${safeName(name)}"`);

  return new Response(request.method === "HEAD" ? null : object.body, { headers });
}
