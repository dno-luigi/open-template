// Cheap capture pipeline: a budget vision model reads the page, and an optional
// cheap text model turns its transcript into the template JSON. When the vision
// model already returns usable blocks, stage 2 is skipped (it usually only
// reshapes the same data and loses fields).
//
//   node scripts/pipeline.mjs <url> [visionModel] [extractModel]
//
// Examples:
//   node scripts/pipeline.mjs https://httpbin.org/forms/post google/gemini-2.5-flash-lite
//   node scripts/pipeline.mjs https://httpbin.org/forms/post openai/gpt-5-nano inference-net/schematron-v2-turbo
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";

const url = process.argv[2] || "https://httpbin.org/forms/post";
const visionModel = process.argv[3] || "openai/gpt-5-nano";
const extractModel = process.argv[4] || "";

const base =
  process.env.OTL_BASE || "https://open-template-library.ai-n.workers.dev/api/site/open-template-library";
const host = new URL(url).hostname;
const safe = (s) => s.replace(/[^a-z0-9.-]/gi, "-");
const dir = `artifacts/pipeline/${safe(host)}/${safe(visionModel)}${extractModel ? "__" + safe(extractModel) : ""}`;
mkdirSync(dir, { recursive: true });

const STAGE1_SYSTEM =
  "You transcribe a page image for a template builder. " +
  "Return compact JSON only, with no markdown fences, in this shape: " +
  '{"title": string, "page": {"width": number, "height": number}, "blocks": [{"text": string, "kind": "heading"|"text"|"field"|"rule"|"other", "x": number, "y": number, "w": number, "h": number}]}. ' +
  "Coordinates MUST be fractions of the image from 0 to 1 (0.5 means halfway), never pixels. 0,0 is the top left; x,y is the top-left corner and w,h the size. " +
  "A field is a blank someone fills in: use a short label, never the filled-in personal detail. " +
  "Text is fixed wording. Include every visible block, in reading order, at most 80. " +
  "Use the page's real title when it is visible; do not guess from the browser tab.";

const STAGE2_SYSTEM =
  "You convert a page transcript into a fill-in template. " +
  'Return compact JSON only, with no markdown fences, in this shape: {"title": string, "category": string, "items": [{"kind": "heading"|"text"|"field"|"rule", "label": string, "x": number, "y": number, "w": number, "h": number}]}. ' +
  "A field is a blank someone fills in; text is fixed wording; a rule is a divider line. " +
  "Keep reading order, copy coordinates from the transcript when present, and never invent content. At most 80 items.";

const pricingRows = loadModels();
const startedAll = Date.now();

async function callAi({ model, system, messages, max_tokens = 6000 }) {
  const started = Date.now();
  const res = await fetch(`${base}/ai`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, system, messages, max_tokens }),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ms: Date.now() - started, data, text: String(data.text || "") };
}

function parseJson(text) {
  const a = String(text).indexOf("{");
  const b = String(text).lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("no JSON object in reply");
  return JSON.parse(String(text).slice(a, b + 1));
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

/** Accepts blocks or items, pixel or fractional coordinates, and common key aliases. */
function toItems(parsed) {
  const raw = Array.isArray(parsed?.items)
    ? parsed.items
    : Array.isArray(parsed?.blocks)
      ? parsed.blocks
      : [];
  const page = parsed?.page || {};
  const width = num(page.width) || 1000;
  const height = num(page.height) || 1000;
  const pixelX = raw.some((o) => Math.abs(num(o?.x) ?? 0) > 1.5);
  const pixelY = raw.some((o) => Math.abs(num(o?.y) ?? 0) > 1.5);
  const sx = pixelX ? width : 1;
  const sy = pixelY ? height : 1;

  return raw
    .map((o) => {
      const rawKind = String(o?.kind || o?.type || "").toLowerCase();
      const kind = ["heading", "text", "field", "rule"].includes(rawKind)
        ? rawKind
        : o?.field !== undefined
          ? "field"
          : "text";
      const label = String(o?.label ?? o?.text ?? o?.field ?? o?.placeholder ?? "").trim();
      const x = num(o?.x);
      const y = num(o?.y);
      const w = num(o?.w);
      const h = num(o?.h);
      return {
        kind,
        label,
        x: x === null ? null : Math.min(1, Math.max(0, x / sx)),
        y: y === null ? null : Math.min(1, Math.max(0, y / sy)),
        w: w === null ? null : Math.min(1, Math.max(0, w / sx)),
        h: h === null ? null : Math.min(1, Math.max(0, h / sy)),
      };
    })
    .filter((item) => item.label || item.kind === "rule");
}

function summarize(items) {
  const kinds = {};
  let boxes = 0;
  for (const item of items) {
    kinds[item.kind] = (kinds[item.kind] || 0) + 1;
    if ([item.x, item.y, item.w, item.h].every((n) => Number.isFinite(n))) boxes += 1;
  }
  return { items: items.length, kinds, boxes };
}

// ---- screenshot -----------------------------------------------------------
const shotStart = Date.now();
let shot = {};
let shotStatus = 0;
for (let attempt = 0; attempt < 3; attempt += 1) {
  const res = await fetch(`${base}/shot`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url, fullPage: true, width: 1200, height: 1600, scale: 1, settle: true }),
  });
  shotStatus = res.status;
  shot = await res.json().catch(() => ({}));
  if (shot.image) break;
  console.log(`shot attempt ${attempt + 1}: ${res.status} ${shot.message || ""}`);
  await new Promise((r) => setTimeout(r, 3000));
}
console.log(`shot ${shotStatus} ${Date.now() - shotStart}ms ${shot.image ? Math.round(shot.image.length / 1024) + "KB" : shot.message || ""} title=${JSON.stringify(shot.title || "")}`);
if (!shot.image) process.exit(1);
writeFileSync(`${dir}/shot.jpg`, Buffer.from(shot.image.split(",")[1] || "", "base64"));

// ---- stage 1 --------------------------------------------------------------
const stage1 = await callAi({
  model: visionModel,
  system: STAGE1_SYSTEM,
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "Transcribe every block on this page." },
        { type: "image_url", image_url: { url: shot.image } },
      ],
    },
  ],
});
writeFileSync(`${dir}/stage1.txt`, stage1.text);
console.log(`stage1 ${visionModel}: ${stage1.status} ${stage1.ms}ms chars=${stage1.text.length}${stage1.status !== 200 ? " " + (stage1.data.message || "") : ""}`);
if (stage1.status !== 200) process.exit(1);

let stage1Parsed = null;
let stage1Items = [];
let stage1Title = String(shot.title || "");
try {
  stage1Parsed = parseJson(stage1.text);
  writeFileSync(`${dir}/stage1.json`, JSON.stringify(stage1Parsed, null, 2));
  stage1Items = toItems(stage1Parsed);
  if (!stage1Title) stage1Title = String(stage1Parsed.title || "");
  console.log(`stage1 parsed: items=${stage1Items.length} title=${JSON.stringify(stage1Parsed.title || "")}`);
} catch (err) {
  console.log(`stage1 parse failed: ${err.message}`);
}

// ---- stage 2, only when it can add value ---------------------------------
let stage2 = null;
let finalItems = stage1Items;
let finalTitle = stage1Title || stage1Parsed?.title || "";
let source = "stage1";
if (extractModel && stage1Items.length === 0) {
  stage2 = await callAi({
    model: extractModel,
    system: STAGE2_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Page transcript:\n${stage1.text.slice(0, 20000)}\n\nReturn the template JSON.`,
      },
    ],
  });
  writeFileSync(`${dir}/stage2.txt`, stage2.text);
  console.log(`stage2 ${extractModel}: ${stage2.status} ${stage2.ms}ms chars=${stage2.text.length}`);
  if (stage2.status === 200) {
    try {
      const parsed = parseJson(stage2.text);
      const items = toItems(parsed);
      if (items.length) {
        finalItems = items;
        finalTitle = parsed.title || finalTitle;
        source = "stage2";
      }
    } catch (err) {
      console.log(`stage2 parse failed: ${err.message}`);
    }
  }
} else if (extractModel) {
  console.log(`stage2 ${extractModel}: skipped (stage 1 already returned usable blocks)`);
}

// ---- report ---------------------------------------------------------------
const stats = summarize(finalItems);
const cost = estimateCost(stage1, stage2, visionModel, extractModel);
const report = {
  url,
  visionModel,
  extractModel: extractModel || null,
  source,
  totalMs: Date.now() - startedAll,
  stage1: { status: stage1.status, ms: stage1.ms, chars: stage1.text.length },
  stage2: stage2 ? { status: stage2.status, ms: stage2.ms, chars: stage2.text.length } : null,
  ...stats,
  estimatedCostUsd: cost,
};
writeFileSync(`${dir}/template.json`, JSON.stringify({ title: finalTitle, items: finalItems }, null, 2));
writeFileSync(`${dir}/report.json`, JSON.stringify(report, null, 2));
console.log(
  `\nresult: source=${source} items=${stats.items} kinds=${JSON.stringify(stats.kinds)} boxes=${stats.boxes}/${stats.items} est_cost=$${cost ?? "?"}`,
);
console.log(`Wrote ${dir}`);

function estimateCost(stage1, stage2, vision, extract) {
  if (!pricingRows) return null;
  const usage = [
    { model: vision, inTok: 700 + stage1.text.length / 8, outTok: stage1.text.length / 4 },
    ...(stage2 ? [{ model: extract, inTok: stage1.text.length / 4 + 400, outTok: stage2.text.length / 4 }] : []),
  ];
  let total = 0;
  for (const u of usage) {
    const row = pricingRows.find((m) => m.id === u.model);
    if (!row) continue;
    // OpenRouter prices are per token, not per million tokens.
    total += u.inTok * Number(row.pricing?.prompt || 0) + u.outTok * Number(row.pricing?.completion || 0);
  }
  return Number(total.toFixed(6));
}

function loadModels() {
  try {
    return JSON.parse(readFileSync("/tmp/or-models.json", "utf8")).data || [];
  } catch {
    return null;
  }
}
