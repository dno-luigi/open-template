// AI help for the Recreate panel (src/components/recreate.js -> ai.chat).
//
// Two ways to run it, both on your own account, never on Wron's:
//   Workers AI         add the "ai" binding in wrangler.jsonc
//   OpenAI-compatible  `wrangler secret put OPENAI_API_KEY` (+ OPENAI_BASE_URL, AI_MODEL)
//
// A scan sends a picture with the question, so image parts are kept: Workers AI
// gets the bytes, an OpenAI-compatible provider gets the image_url parts. With
// neither configured the endpoint refuses with a readable message, and every
// call is counted per visitor IP so an open site cannot spend credits without limit.
import { sha256Hex } from "./crypto.js";
import { clientIp, fail, json, nowIso } from "./util.js";

const DEFAULT_TEXT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const DEFAULT_VISION_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_IMAGES = 2;

/** One incoming message, keeping text and pictures apart. */
function normalize(message) {
  const role = message && ["system", "user", "assistant"].includes(message.role) ? message.role : "user";
  const raw = message && message.content;
  if (typeof raw === "string") return { role, text: raw.slice(0, 60_000), images: [] };
  if (!Array.isArray(raw)) return { role, text: "", images: [] };

  const texts = [];
  const images = [];
  for (const part of raw) {
    if (!part) continue;
    if (part.type === "text") texts.push(String(part.text || ""));
    else if (part.type === "image_url") {
      const url = typeof part.image_url === "string" ? part.image_url : part.image_url && part.image_url.url;
      if (url) images.push(String(url));
    }
  }
  return { role, text: texts.join("\n").slice(0, 60_000), images: images.slice(0, MAX_IMAGES) };
}

function messagesFor(body) {
  const list = [];
  if (body.system) list.push({ role: "system", text: String(body.system).slice(0, 20_000), images: [] });
  for (const message of Array.isArray(body.messages) ? body.messages : []) list.push(normalize(message));
  // The newest turns are what matter; the full history is not sent again.
  return list.filter((m) => m.text || m.images.length).slice(-20);
}

/** Base64 data URL or an https picture, as bytes for Workers AI. */
async function imageBytes(url) {
  const raw = String(url || "");
  const data = /^data:image\/[a-z0-9.+-]+;base64,(.+)$/i.exec(raw);
  if (data) {
    const binary = atob(data[1]);
    if (binary.length > MAX_IMAGE_BYTES) throw new Error("image_too_large");
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  if (/^https:\/\//i.test(raw)) {
    const res = await fetch(raw);
    if (!res.ok) throw new Error("image_fetch_failed");
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > MAX_IMAGE_BYTES) throw new Error("image_too_large");
    return new Uint8Array(buffer);
  }
  throw new Error("bad_image");
}

export async function handleAi(request, env, body) {
  if (body.op === "image") return fail(501, "not_supported", "Image generation is not set up on this site.");

  if (!env.AI && !env.OPENAI_API_KEY) {
    return fail(
      503,
      "ai_not_configured",
      "AI help is not connected. Add an OPENAI_API_KEY secret to the Worker, or bind Workers AI (see README.md).",
    );
  }

  const messages = messagesFor(body);
  if (!messages.length) return fail(400, "empty_prompt", "Describe the form you want first.");

  const db = env.DB;
  const day = nowIso().slice(0, 10);
  const ipHash = await sha256Hex(clientIp(request));
  const limit = Number(env.AI_DAILY_LIMIT || 20) || 20;
  if (db) {
    const used = await db
      .prepare("SELECT COUNT(*) AS n FROM ai_usage WHERE day = ? AND ip_hash = ?")
      .bind(day, ipHash)
      .first();
    if (Number(used?.n || 0) >= limit) {
      return fail(429, "rate_limited", "The daily limit for AI help is used up. Try again tomorrow.");
    }
  }

  let text;
  try {
    text = await ask(env, messages);
  } catch (err) {
    console.error("ai failed:", err && err.stack ? err.stack : err);
    return fail(502, "ai_failed", "The form could not be read right now. Try again, or plot the points by hand.");
  }

  if (db) {
    await db
      .prepare("INSERT INTO ai_usage (id, ip_hash, day, created_at) VALUES (?, ?, ?, ?)")
      .bind(crypto.randomUUID(), ipHash, day, nowIso())
      .run();
  }
  return json({ text });
}

async function ask(env, messages) {
  if (env.AI) {
    const images = [];
    for (const message of messages) {
      for (const url of message.images) images.push(await imageBytes(url));
    }
    const chat = messages.map((m) => ({ role: m.role, content: m.text || "(the picture below)" }));
    const model = env.AI_MODEL || (images.length ? DEFAULT_VISION_MODEL : DEFAULT_TEXT_MODEL);
    const out = await env.AI.run(model, images.length ? { messages: chat, image: images } : { messages: chat });
    const text = typeof out === "string" ? out : out && out.response;
    if (!text) throw new Error("The model returned nothing.");
    return String(text);
  }

  const base = (env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const openai = messages.map((m) => ({
    role: m.role,
    content: m.images.length
      ? [
          { type: "text", text: m.text || "List every part of this form." },
          ...m.images.map((url) => ({ type: "image_url", image_url: { url } })),
        ]
      : m.text,
  }));
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: env.AI_MODEL || DEFAULT_OPENAI_MODEL, messages: openai, temperature: 0.2 }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data && data.error && data.error.message) || `The AI provider answered ${res.status}.`);
  const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!text) throw new Error("The model returned nothing.");
  return String(text);
}
