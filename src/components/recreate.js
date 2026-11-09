// Recreate a form: from a scan, a screenshot or a description to a list of points, then to a template.
// The points are plain data the person can edit. The AI step is optional and only runs when they press its button.
import { ai } from "@wron/kit";
import { uid, newDoc, textBlock, fieldBlock, ruleBlock } from "./templateStore";

export const KINDS = ["field", "text", "heading", "rule"];
export const KIND_LABEL = { field: "Field to fill in", text: "Fixed text", heading: "Heading", rule: "Divider line" };

const SHAPE =
  'Return JSON only, with no other words, in this shape: {"title": string, "category": string, "items": [{"kind": "heading"|"text"|"field"|"rule", "label": string, "x": number, "y": number}]}. ' +
  "A field is a blank someone fills in: a name line, a date, a case number, a checkbox row. Text is fixed wording that prints the same every time. " +
  "Never copy personal details that someone already filled in: make that spot a field with a short label. " +
  "Keep items in reading order, top to bottom, left to right. At most 80 items.";

const SCAN_SYSTEM =
  "You read a picture of a form, letter or other document and list every part of it so it can be rebuilt as a fill-in template. " +
  SHAPE +
  " x and y are the center of each item as a fraction of the picture, from 0 to 1, with 0,0 at the top left.";

const DESCRIBE_SYSTEM =
  "You plan a fill-in document template from a short description, such as a court form, a letter or a checklist. " +
  SHAPE +
  " Leave out x and y.";

const FAIL_READ = "The reply could not be read. Try again, or plot the points by hand.";

const num = (v) => (typeof v === "number" && isFinite(v) ? Math.min(1, Math.max(0, v)) : null);

function parseReply(reply) {
  const raw = typeof reply === "string" ? reply : reply?.content ?? reply?.text ?? reply?.message ?? "";
  const text = typeof raw === "string" ? raw : JSON.stringify(raw);
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error(FAIL_READ);
  let data;
  try {
    data = JSON.parse(text.slice(a, b + 1));
  } catch {
    throw new Error(FAIL_READ);
  }
  const items = (Array.isArray(data.items) ? data.items : [])
    .slice(0, 80)
    .map((it) => ({
      id: uid(),
      kind: KINDS.includes(it?.kind) ? it.kind : "field",
      label: String(it?.label ?? "").trim().slice(0, 200),
      x: num(it?.x),
      y: num(it?.y),
    }))
    .filter((it) => it.kind === "rule" || it.label);
  if (!items.length) throw new Error("Nothing was found. Try a clearer picture, or plot the points by hand.");
  return { title: String(data.title || "").slice(0, 140), category: String(data.category || "").slice(0, 60), items };
}

export async function scanWithAi(src) {
  const reply = await ai.chat(
    [
      {
        role: "user",
        content: [
          { type: "text", text: "List every part of this form." },
          { type: "image_url", image_url: { url: src } },
        ],
      },
    ],
    { system: SCAN_SYSTEM }
  );
  return parseReply(reply);
}

export async function describeWithAi(description) {
  const reply = await ai.chat([{ role: "user", content: String(description).slice(0, 4000) }], { system: DESCRIBE_SYSTEM });
  return parseReply(reply);
}

// One point per line of a description, no AI needed.
export function linesToItems(text) {
  return String(text)
    .split("\n")
    .map((l) => l.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 80)
    .map((label) => ({ id: uid(), kind: "field", label: label.slice(0, 200), x: null, y: null }));
}

export const newPoint = (n, x = null, y = null) => ({ id: uid(), kind: "field", label: `Field ${n}`, x, y });

// Top to bottom, then left to right, when every point sits on a scan. Otherwise the order they were added.
export function orderItems(items) {
  if (!items.every((i) => i.y != null)) return items;
  return [...items].sort((a, b) => (Math.abs(a.y - b.y) < 0.012 ? (a.x ?? 0) - (b.x ?? 0) : a.y - b.y));
}

export function buildDoc(items, { title = "", category = "" } = {}) {
  const blocks = orderItems(items).map((it) => {
    if (it.kind === "rule") return ruleBlock();
    if (it.kind === "heading") return textBlock(it.label, { variant: "heading" });
    if (it.kind === "text") return textBlock(it.label);
    return fieldBlock(it.label || "Field", "");
  });
  return newDoc({ title: title.trim() || "Recreated form", category: category.trim(), printTitle: false, font: "sans", margin: "0.75", blocks });
}
