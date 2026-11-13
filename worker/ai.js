// AI help for the Recreate panel (src/components/recreate.js -> ai.chat).
//
// Providers, in the order they are used, all on your own account, never Wron's:
//
//   orproxy / OpenRouter / any OpenAI-compatible proxy
//     the AI-PROXY or ORPROXY service binding (called as POST /api/chat), or
//     ORPROXY_URL + ORPROXY_API_KEY for a plain /chat/completions URL
//   Workers AI
//     the "ai" binding in wrangler.jsonc, used when no proxy is configured
//
// A scan sends a picture with the question, so image parts are kept: the proxy
// receives OpenAI image_url parts, Workers AI receives the bytes. With neither
// configured the endpoint refuses with a readable message, and every call is
// counted per visitor IP so an open site cannot spend credits without limit.
import { sha256Hex } from "./crypto.js";
import { clientIp, fail, json, nowIso } from "./util.js";

const DEFAULT_TEXT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const DEFAULT_VISION_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";
/** An OpenRouter-style model slug works on the proxy; a vision model by default. */
const DEFAULT_PROXY_MODEL = "openai/gpt-4o-mini";
const DEFAULT_MODELS =
  "openai/gpt-4o-mini,google/gemini-2.5-flash,anthropic/claude-sonnet-4.5,qwen/qwen2.5-vl-72b-instruct";
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_IMAGES = 2;

function proxyBinding(env) {
  // Names match wrangler.jsonc; AI_PROXY is kept for older configurations.
  return env["AI-PROXY"] || env.AI_PROXY || env.ORPROXY || null;
}

function proxyConfig(env) {
  return {
    binding: proxyBinding(env),
    key: env.ORPROXY_API_KEY || env.OPENAI_API_KEY || "",
    base: String(env.ORPROXY_URL || env.OPENAI_BASE_URL || "").replace(/\/+$/, ""),
    model: env.ORPROXY_MODEL || env.AI_MODEL || "",
  };
}

/** The pi harness (op), fetched through its service binding. */
function opBinding(env) {
  const binding = env["PI-H"];
  return binding && typeof binding.fetch === "function" ? binding : null;
}

/** The saved audit record, read back from the proxy that stores it. */
async function auditRecord(env, audit) {
  if (!env.ORPROXY) return "";
  try {
    const res = await env.ORPROXY.fetch(
      new Request(`https://orproxy/v1/audit/${encodeURIComponent(audit)}`, {
        headers: { accept: "application/json" },
      }),
    );
    if (!res.ok) return "";
    const data = await res.json().catch(() => ({}));
    return String(data.rawText || data.lastResponse || "").slice(0, 24_000);
  } catch {
    return "";
  }
}

/** Which backend a call will use: "proxy-binding" | "proxy" | "workers-ai" | "". */
function providerName(env) {
  const p = proxyConfig(env);
  if (p.binding) return "proxy-binding";
  if (p.key && p.base) return "proxy";
  if (env.AI) return "workers-ai";
  return "";
}

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

  if (!providerName(env) && !opBinding(env)) {
    return fail(
      503,
      "ai_not_configured",
      "AI help is not connected. Set ORPROXY_URL and ORPROXY_API_KEY on the Worker, or bind Workers AI (see README.md).",
    );
  }

  const messages = messagesFor(body);
  if (!messages.length) return fail(400, "empty_prompt", "Describe the form you want first.");

  // Only models the owner listed can be chosen, so a caller cannot run up a bill.
  const models = String(env.AI_MODELS || DEFAULT_MODELS)
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  const requested = typeof body.model === "string" ? body.model.trim() : "";
  if (requested && !models.includes(requested)) {
    return fail(400, "model_not_allowed", `Choose one of: ${models.join(", ")}.`);
  }
  // A full page of items can run past 2k tokens; too small a cap truncates the JSON.
  const maxTokens = Math.min(8000, Math.max(256, Number(body.max_tokens) || 6000));

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
  const provider = providerName(env);
  try {
    const proxy = proxyConfig(env);
    if (requested) proxy.model = requested;
    const audit = typeof body.audit === "string" ? body.audit.trim().slice(0, 120) : "";
    const op = opBinding(env);
    console.log("ai provider:", op && audit ? "op" : provider, "audit:", audit || "none");
    // An arriving audit id means the record already exists: fill the form from
    // it through op, and keep the model chain as the fallback.
    if (op && audit) {
      try {
        text = await askOp(env, op, messages, audit, maxTokens);
      } catch (err) {
        console.error("op fill failed:", (err && err.message) || err);
      }
    }
    if (!text) {
      text =
        provider === "workers-ai"
          ? await askWorkersAi(env, messages, maxTokens)
          : await askProxy(env, messages, proxy, maxTokens);
    }
  } catch (err) {
    console.error("ai failed:", err && err.stack ? err.stack : err);
    const detail = String((err && err.message) || "");
    // Workers AI gates the Llama vision model behind a one-time licence acceptance.
    if (/5016|submit the prompt ['\"]?agree/i.test(detail)) {
      return fail(
        502,
        "ai_license",
        "The vision model needs its licence accepted once on this Cloudflare account (Workers AI, or the agree call in README.md).",
      );
    }
    if (/401|403|unauthori[sz]ed|invalid api key/i.test(detail)) {
      return fail(502, "ai_key_rejected", "The AI proxy rejected the key. Check ORPROXY_API_KEY on the Worker.");
    }
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

/**
 * Fill a form from a finished Truth Engine audit, through op.
 *
 * The record is fetched here rather than assumed: op has no way to look an
 * audit up by id, so the report travels in the prompt. Anything the record does
 * not contain is left for the model to leave empty, never invented.
 */
async function askOp(env, binding, messages, audit, maxTokens = 6000) {
  const record = await auditRecord(env, audit);
  const system = messages.find((m) => m.role === "system");
  const asked = messages
    .filter((m) => m.role !== "system")
    .map((m) => m.text)
    .filter(Boolean)
    .join("\n\n");
  if (!asked) throw new Error("nothing to ask");
  const prompt = [
    system && system.text ? `Instructions:\n${system.text.slice(0, 8000)}` : "",
    `Truth Engine audit ${audit}${record ? `:\n\n${record}` : " (record could not be read)"}`,
    asked,
    "Use only the audit above. Reply with the JSON object the instructions ask for and nothing else.",
  ]
    .filter(Boolean)
    .join("\n\n");
  const res = await binding.fetch(
    new Request("https://op/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        message: prompt.slice(0, 39_000),
        preset: "truth",
        session: `template:${audit}`,
        from: "open-template",
      }),
    }),
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data && data.error && data.error.message) || `op answered ${res.status}`);
  const text = contentText(data && data.text).trim();
  if (!text) throw new Error("op returned nothing");
  return text;
}

/** OpenAI-compatible chat completions, through the URL or through the service binding. */
async function askProxy(env, messages, proxy, maxTokens = 6000) {
  const model = proxy.model || DEFAULT_PROXY_MODEL;
  const headers = { "content-type": "application/json" };
  if (proxy.key) headers.authorization = `Bearer ${proxy.key}`;
  // OpenRouter app attribution, when the owner sets it.
  if (env.ORPROXY_SITE_URL) headers["HTTP-Referer"] = String(env.ORPROXY_SITE_URL).slice(0, 200);
  if (env.ORPROXY_APP_NAME) headers["X-Title"] = String(env.ORPROXY_APP_NAME).slice(0, 80);

  const openai = messages.map((m) => ({
    role: m.role,
    content: m.images.length
      ? [
          { type: "text", text: m.text || "List every part of this form." },
          ...m.images.map((url) => ({ type: "image_url", image_url: { url } })),
        ]
      : m.text,
  }));

  const body = JSON.stringify({ model, messages: openai, temperature: 0.2, max_tokens: maxTokens });
  // The in-account proxy speaks its own /api/chat (orproxy forwards the path to ai-proxy);
  // a plain OpenAI-compatible URL uses the standard /chat/completions.
  const target = proxy.binding ? "https://ai-proxy/api/chat" : `${proxy.base}/chat/completions`;
  const res = proxy.binding
    ? await proxy.binding.fetch(new Request(target, { method: "POST", headers, body }))
    : await fetch(target, { method: "POST", headers, body });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data && data.error && data.error.message) || (data && data.message) || (data && data.error) || `The AI proxy answered ${res.status}.`;
    throw new Error(detail);
  }
  const text = contentText(
    data && (data.text ?? (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content)),
  );
  if (!text) throw new Error("The model returned nothing.");
  return text;
}

/** A reply that may arrive as a string or as OpenAI content parts. */
function contentText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => (part && (part.text || part.content)) || "").join("");
  return "";
}

/** Cloudflare Workers AI, used when no proxy is configured. */
async function askWorkersAi(env, messages, maxTokens = 6000) {
  const images = [];
  for (const message of messages) {
    for (const url of message.images) images.push(await imageBytes(url));
  }
  const chat = messages.map((m) => ({ role: m.role, content: m.text || "(the picture below)" }));
  const model = env.AI_MODEL || (images.length ? DEFAULT_VISION_MODEL : DEFAULT_TEXT_MODEL);
  const out = await env.AI.run(
    model,
    images.length ? { messages: chat, image: images, max_tokens: maxTokens } : { messages: chat, max_tokens: maxTokens },
  );
  const text = typeof out === "string" ? out : out && out.response;
  if (!text) throw new Error("The model returned nothing.");
  return String(text);
}

/**
 * One JSON-shaped question, through the same chain handleAi uses. Kept separate so
 * the court-form filler can plan values without going through the chat endpoint.
 */
export async function askForJson(env, { audit = "", system = "", user = "", maxTokens = 3000 } = {}) {
  const messages = [
    ...(system ? [{ role: "system", text: system, images: [] }] : []),
    { role: "user", text: String(user).slice(0, 40_000), images: [] },
  ];
  const op = opBinding(env);
  if (op && audit) {
    try {
      return await askOp(env, op, messages, audit, maxTokens);
    } catch (err) {
      console.error("op plan failed:", (err && err.message) || err);
    }
  }
  const provider = providerName(env);
  if (provider === "workers-ai") return askWorkersAi(env, messages, maxTokens);
  if (provider) return askProxy(env, messages, proxyConfig(env), maxTokens);
  throw new Error("AI help is not connected on this site.");
}
