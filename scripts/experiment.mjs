// Compare capture modes and vision models on one page.
//
//   node scripts/experiment.mjs https://example.com/form
//   EXPERIMENT_MODELS="openai/gpt-4o-mini,google/gemini-2.5-flash" node scripts/experiment.mjs <url>
//
// Writes the screenshots, raw model replies and a report under
// artifacts/experiments/<host>/. Uses the deployed Worker's /shot and /ai
// endpoints, so it exercises the same path the browser UI does.
import { mkdirSync, writeFileSync } from "node:fs";

const target = process.argv[2] || "https://open-template-library.ai-n.workers.dev/";
const base =
  process.env.OTL_BASE || "https://open-template-library.ai-n.workers.dev/api/site/open-template-library";
const models = (
  process.env.EXPERIMENT_MODELS ||
  "openai/gpt-4o-mini,google/gemini-2.5-flash,anthropic/claude-sonnet-4.5,qwen/qwen2.5-vl-72b-instruct"
)
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

const host = new URL(target).hostname;
const dir = `artifacts/experiments/${host.replace(/[^a-z0-9.-]/gi, "-")}`;
mkdirSync(dir, { recursive: true });

const SCAN_SYSTEM =
  "You read a picture of a form, letter or other document and list every part of it so it can be rebuilt as a fill-in template. " +
  'Return JSON only, with no other words, in this shape: {"title": string, "category": string, "items": [{"kind": "heading"|"text"|"field"|"rule", "label": string, "x": number, "y": number}]}. ' +
  "A field is a blank someone fills in: a name line, a date, a case number, a checkbox row. Text is fixed wording that prints the same every time. " +
  "Never copy personal details that someone already filled in: make that spot a field with a short label. " +
  "Keep items in reading order, top to bottom, left to right. At most 80 items. " +
  "Return compact JSON on one line, with no code fences. " +
  "x and y are the center of each item as a fraction of the picture, from 0 to 1, with 0,0 at the top left.";

const variants = [
  { name: "full", fullPage: true, width: 1200, height: 1600, scale: 1 },
  { name: "viewport", fullPage: false, width: 1200, height: 1600, scale: 1 },
];

const shots = [];
const images = {};
for (const variant of variants) {
  const started = Date.now();
  const res = await fetch(`${base}/shot`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: target, settle: true, ...variant, name: undefined }),
  });
  const data = await res.json().catch(() => ({}));
  const ms = Date.now() - started;
  if (!res.ok) {
    shots.push({ variant: variant.name, status: res.status, error: data.message || data.error });
    console.log(`shot ${variant.name}: ${res.status} ${data.message || data.error || ""}`);
    continue;
  }
  const bytes = Buffer.from(String(data.image).split(",")[1] || "", "base64");
  images[variant.name] = data.image;
  writeFileSync(`${dir}/${variant.name}.jpg`, bytes);
  shots.push({ variant: variant.name, status: res.status, ms, bytes: bytes.length });
  console.log(`shot ${variant.name}: 200 ${ms}ms ${Math.round(bytes.length / 1024)}KB`);
}

const source = images.full ? "full" : images.viewport ? "viewport" : "";
if (!source) {
  console.log("No screenshot was captured; stopping.");
  process.exit(1);
}

const runs = [];
for (const model of models) {
  const started = Date.now();
  const res = await fetch(`${base}/ai`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      system: SCAN_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "List every part of this form." },
            { type: "image_url", image_url: { url: images[source] } },
          ],
        },
      ],
    }),
  });
  const data = await res.json().catch(() => ({}));
  const ms = Date.now() - started;
  const raw = String(data.text || "");
  writeFileSync(`${dir}/${model.replace(/[^a-z0-9.-]/gi, "-")}.json`, JSON.stringify(data, null, 2));

  let parsed = null;
  let parseError = "";
  try {
    const a = raw.indexOf("{");
    const b = raw.lastIndexOf("}");
    parsed = JSON.parse(raw.slice(a, b + 1));
  } catch (err) {
    parseError = err.message;
  }
  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  const kinds = {};
  for (const item of items) {
    const kind = String(item?.kind || "?");
    kinds[kind] = (kinds[kind] || 0) + 1;
  }
  runs.push({
    model,
    status: res.status,
    ms,
    replyChars: raw.length,
    items: items.length,
    kinds,
    title: parsed?.title || "",
    parseError,
    error: data.message || data.error || "",
  });
  console.log(
    `${model}: ${res.status} ${ms}ms items=${items.length} kinds=${JSON.stringify(kinds)}` +
      (parseError ? ` parse_error=${parseError}` : data.message ? ` error=${data.message}` : ""),
  );
}

const report = { target, capturedAt: new Date().toISOString(), source, shots, runs };
writeFileSync(`${dir}/report.json`, JSON.stringify(report, null, 2));
console.log(`\nWrote ${dir}/report.json`);
