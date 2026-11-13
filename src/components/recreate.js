// Recreate a form: from a scan, a screenshot or a description to a list of points, then to a template.
// The points are plain data the person can edit. The AI step is optional and only runs when they press its button.
import { ai } from "@wron/kit";
import { uid, newDoc, textBlock, fieldBlock, ruleBlock } from "./templateStore";

export const KINDS = ["field", "text", "heading", "rule"];
export const KIND_LABEL = { field: "Field to fill in", text: "Fixed text", heading: "Heading", rule: "Divider line" };

const SHAPE =
  'Return JSON only, with no other words, in this shape: {"title": string, "category": string, "items": [{"kind": "heading"|"text"|"field"|"rule", "label": string, "x": number, "y": number}]}. ' +
  "\"label\" is the exact words that print on the page: full sentences for a text item, the section title for a heading, and the short caption for a field (\"Your name\"). " +
  "Keep items in reading order, top to bottom, left to right. At most 80 items.";

const SCAN_SYSTEM =
  "You read a picture of a form, letter or other document and list every part of it so it can be rebuilt as a fill-in template. " +
  SHAPE +
  " x and y are the center of each item as a fraction of the picture, from 0 to 1, with 0,0 at the top left.";

const DESCRIBE_SYSTEM =
  "You draft a partially filled court form from a description and, when one is supplied, from an audit of the case. " +
  "Write it the way the court prints it, in this order: " +
  "(1) a caption block: the form number and its official title, the court ('SUPERIOR COURT OF CALIFORNIA, COUNTY OF ...'), " +
  "the party block with names, addresses and phone where known, the case caption ('PETITIONER' / 'RESPONDENT'), 'CASE NUMBER:' and the hearing date, time and department when known; " +
  "(2) the numbered sections of the form in order, each a heading with its own number and title, followed by the text this person's situation calls for; " +
  "(3) the declaration under penalty of perjury, then the date and a signature line. " +
  "Use kind 'text' for anything that prints the same for everyone, and for facts already stated in the description or the audit: the county, the case number, a posting date, a payment date, an amount demanded, a party name that was given. " +
  "Use kind 'field' only where the person must supply something the record does not answer: their own name, address, phone, email, signature, and any blank the facts do not fill. " +
  "Write sentences, never bare labels: 'The three-day notice was posted on the door on March 3, and rent was paid on March 5.' " +
  "Where something must be written in by hand, put a bracketed blank inside the sentence: [ date you paid ]. " +
  "The caption is filled first: if the description or the audit names the county, the parties, the case number, the hearing date or the department, print those words in the caption and in the body exactly as given. " +
  "A bracket in the caption is only for something the record truly does not say, never for something it does. " +
  "Never invent a case number, a date, a name or an amount that was not given. A partially filled form is the goal: the caption and every fact the record supports are already written, and only what the person alone knows is left blank. " +
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

// The model names the county in the title and still leaves "[ county ]" in the
// caption. When the title says which county it is, that blank is answered.
function fillCounty(items, title) {
  const m = /([A-Z][A-Za-z.'\- ]{2,40}?)\s+County/.exec(String(title || ""));
  if (!m) return items;
  const county = m[1].trim().toUpperCase();
  return items.map((it) => ({ ...it, label: it.label.replace(/\[\s*county\s*\]/gi, county) }));
}

export async function describeWithAi(description) {
  const reply = await ai.chat([{ role: "user", content: String(description).slice(0, 4000) }], { system: DESCRIBE_SYSTEM });
  const out = parseReply(reply);
  return { ...out, items: fillCounty(out.items, out.title) };
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
    // A point with no name is not a field anyone can fill: drop it instead of
    // shipping "Field 3" onto the page.
    return it.label && String(it.label).trim() ? fieldBlock(it.label, "") : null;
  });
  return newDoc({ title: title.trim() || "Recreated form", category: category.trim(), printTitle: false, font: "sans", margin: "0.75", blocks: blocks.filter(Boolean) });
}
