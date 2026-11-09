// Small shared helpers for the Worker: JSON replies, request bodies and the
// session token the client kit sends as X-Wron-Session (kept for compatibility).
export const MAX_BODY = 4 * 1024 * 1024; // 4 MB, the same ceiling the client enforces

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Replies depend on who is asking (mine flags, accounts): never cache them.
      "cache-control": "no-store",
    },
  });
}

export function fail(status, code, message) {
  return json({ error: code, message }, status);
}

export function nowIso() {
  return new Date().toISOString();
}

/** The session token: the kit's header, or a cookie for anyone calling the API directly. */
export function sessionToken(request) {
  const header = request.headers.get("x-wron-session") || request.headers.get("x-site-session");
  if (header) return header.trim().slice(0, 200);
  const cookie = request.headers.get("cookie") || "";
  const found = /(?:^|;\s*)site_session=([^;]+)/.exec(cookie);
  return found ? decodeURIComponent(found[1]) : "";
}

/** JSON body; beacons may arrive as text/plain, so a plain parse is attempted too. */
export async function readBody(request) {
  const raw = await request.text();
  if (raw.length > MAX_BODY) throw new Error("too_large");
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** The visitor's address, hashed: enough to rate-limit, never stored in the clear. */
export function clientIp(request) {
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "local";
}
