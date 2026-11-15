// Cloudflare backend for Forms (forms.nspired.cc).
//
// The app's bundled client kit (src/wron-kit/cloud.js) was written against a
// hosted backend at /api/site/<siteId>/<action>. This Worker serves that same
// contract from Cloudflare, so the community list, shares, reports, copy counts
// and AI help go to your own Worker and D1 database instead of wron.ai:
//
//   POST /api/site/:siteId/db      { op: list | get | add | count, table, ... }
//   POST /api/site/:siteId/ai      { messages, system }
//   POST /api/site/:siteId/shot    { url } -> a Browser Run screenshot
//   POST /api/site/:siteId/jcf     { audit, description } -> a filled court form
//   POST /api/site/:siteId/upload  multipart "file" -> a stored file URL
//   POST /api/site/:siteId/forms   { number } -> the official form, stored
//   POST /api/site/:siteId/library { op: list | get | remove }
//   POST /api/site/:siteId/hit     page-view beacon (accepted, not stored)
//   POST /api/site/:siteId/errors  client-error beacon (accepted, not stored)
//
//   GET  /files/<key>              the bytes stored in R2
//   email(message)                 mail to this Worker (Email Routing), owner-only
//
// Anything else falls through to the built single-page app in ./dist.
//
// /files/* is listed in assets.run_worker_first (wrangler.jsonc). Without that,
// the asset handler answers first and every stored PDF comes back as index.html.
import { handleAi } from "./ai.js";
import { handleDb } from "./db.js";
import { handleFileGet, handleUpload } from "./files.js";
import { handleEmail, ingestMessage } from "./inbox.js";
import { handleJcf } from "./jcf.js";
import { handleForms, handleLibrary } from "./library.js";
import { handleShot } from "./shot.js";
import { fail, isOwner, json, readBody } from "./util.js";

const ROUTE = /^\/api\/site\/([A-Za-z0-9_-]{1,64})\/([a-z]+)\/?$/;
const FILE = /^\/files\/([A-Za-z0-9][A-Za-z0-9._/-]{0,200})$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const file = FILE.exec(url.pathname);
    if (file) {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return fail(405, "method_not_allowed", "Use GET.");
      }
      return await handleFileGet(request, env, file[1]);
    }

    const match = ROUTE.exec(url.pathname);

    if (!match) {
      if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
        return fail(404, "not_found", "No such endpoint.");
      }
      return env.ASSETS.fetch(request);
    }

    if (request.method !== "POST") return fail(405, "method_not_allowed", "Use POST.");

    const action = match[2];

    try {
      // Storage actions come first: their bodies are bytes and form data, not the
      // JSON the rest of the API takes, and uploads need FILES rather than DB.
      if (action === "upload") return await handleUpload(request, env);

      if (!env.DB) return fail(503, "not_connected", "This site is not connected to its database yet.");

      // Raw MIME in, the same path Email Routing takes. Owner only: it is how mail
      // can be tested without sending any, and a door for another provider later.
      if (action === "inbox") {
        if (!isOwner(request, env)) return fail(403, "not_owner", "Only the owner can add mailed files.");
        const raw = await request.arrayBuffer();
        if (!raw.byteLength) return fail(400, "empty", "Send the message as the request body.");
        const summary = await ingestMessage(raw, env, { from: request.headers.get("x-mail-from") || "" });
        return json(summary);
      }

      let body;
      try {
        body = await readBody(request);
      } catch {
        return fail(413, "too_large", "That request is too large.");
      }

      switch (action) {
        case "db":
          return await handleDb(request, env, body);
        case "ai":
          return await handleAi(request, env, body);
        case "shot":
          return await handleShot(request, env, body);
        case "jcf":
          return await handleJcf(request, env, body);
        case "forms":
          return await handleForms(request, env, body);
        case "library":
          return await handleLibrary(request, env, body);
        case "hit":
        case "errors":
          // Beacons: accepted so the page never errors, deliberately not stored.
          return new Response(null, { status: 204 });
        default:
          return fail(501, "not_supported", `"${action}" is not part of this site's backend.`);
      }
    } catch (err) {
      console.error(`${action} failed:`, err && err.stack ? err.stack : err);
      return fail(500, "server_error", "Something went wrong on the server. Please try again.");
    }
  },

  /** Mail to any address routed to this Worker (Cloudflare Email Routing). */
  async email(message, env) {
    await handleEmail(message, env);
  },
};
