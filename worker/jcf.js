// The official Judicial Council forms, filled from the record.
//
// The blanks live in public/forms (ud105.pdf, fl320.pdf), decrypted once with the
// blank password the Council ships them with, so this Worker can open them. Each
// one has a map beside it: semantic key -> the form's own field name, found by the
// field's /TU label rather than by its (unstable) name. See docs/judicial-council-forms.md.
//
//   POST /api/site/:siteId/jcf   { audit, description, form?, values?, dry? }
//
// With no values, the model reads the audit and the description and returns the
// facts the record actually contains; anything it does not know stays blank on the
// form for the person to complete. The reply is the filled PDF itself.
import { PDFDocument } from "pdf-lib";
import { askForJson } from "./ai.js";
import { sha256Hex } from "./crypto.js";
import { clientIp, fail, json } from "./util.js";

const FORMS = {
  "UD-105": { file: "ud105.pdf", map: "ud105.json" },
  "FL-320": { file: "fl320.pdf", map: "fl320.json" },
};

const KEY_HELP = {
  "UD-105": {
    county: "county name only, e.g. LOS ANGELES",
    courtAddress: "the court's street address",
    courtCityZip: "the court's city and ZIP",
    courtBranch: "the court branch name",
    caseNumber: "the case number as printed on the papers",
    plaintiff: "the plaintiff (landlord) name",
    defendant: "the defendant (tenant) name",
    defendantList: "every defendant this answer is for, comma separated",
    generalDenial: "true when the answer denies the complaint as a whole",
    specificDenials: "true when the answer denies particular statements of the complaint",
    defenseFacts: "2 to 5 sentences of the facts that support the denials, written for the form",
    printName: "the name of the person signing",
    signDate: "the date of signing, as MM/DD/YYYY",
  },
  "FL-320": {
    county: "county name only, e.g. LOS ANGELES",
    courtAddress: "the court's street address",
    courtCityZip: "the court's city and ZIP",
    courtBranch: "the court branch name",
    caseNumber: "the case number as printed on the papers",
    petitioner: "the petitioner name",
    respondent: "the respondent name",
    otherParty: "any other parent or party named",
    hearingDate: "the hearing date, MM/DD/YYYY",
    hearingTime: "the hearing time",
    department: "the department or room",
    facts: "the facts supporting the responsive declaration, in the person's own voice",
    printName: "the name of the person signing",
    signDate: "the date of signing, MM/DD/YYYY",
  },
};

const PLAN_SYSTEM = [
  "You fill California court forms from a case record.",
  "Available forms and the keys each one can fill:",
  ...Object.entries(KEY_HELP).map(([id, keys]) => `${id}:\n` + Object.entries(keys).map(([k, v]) => `  ${k} — ${v}`).join("\n")),
  'Reply with JSON only: {"form": "UD-105" or "FL-320", "values": {…}, "reason": "one sentence"}.',
  "Pick the form that fits: UD-105 for an eviction (unlawful detainer) answer, FL-320 for a response to a request for order or an order to show cause in a family law case.",
  "Include a key only when the record actually gives it. Never invent a name, case number, date, amount or address.",
  "Counties, case numbers and party names are the first things to look for: if the record says the case is in a county, fill county; if the papers show a case number, fill caseNumber; if the notice or complaint names the landlord and the tenant, fill plaintiff and defendant.",
  "Leave printName and signDate out unless the record names the person signing or the date of signing: the person signs this themselves.",
  "A blank left on the form is correct when the record does not answer it.",
].join("\n");

function parsePlan(text) {
  const s = String(text || "");
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("The form could not be planned.");
  const data = JSON.parse(s.slice(a, b + 1));
  const form = FORMS[data.form] ? data.form : "";
  const values = data.values && typeof data.values === "object" ? data.values : {};
  return { form, values, reason: String(data.reason || "").slice(0, 300) };
}

/** Fill one form and return its bytes. Unknown keys and empty values are skipped. */
async function fillForm(env, origin, formId, values) {
  const spec = FORMS[formId];
  const load = async (path) => {
    const url = new URL(path, origin);
    if (env.ASSETS && typeof env.ASSETS.fetch === "function") return env.ASSETS.fetch(url);
    // /forms/* is served straight from the built site, so this cannot loop back
    // into this Worker (only /api/* is sent here first).
    return fetch(url);
  };
  const [pdfRes, mapRes] = await Promise.all([load(`/forms/${spec.file}`), load(`/forms/${spec.map}`)]);
  if (!pdfRes.ok || !mapRes.ok) throw new Error(`The form file is missing from this site (${pdfRes.status}/${mapRes.status}).`);
  const map = await mapRes.json();
  const doc = await PDFDocument.load(await pdfRes.arrayBuffer(), { updateMetadata: false });
  const formDoc = doc.getForm();
  const filled = {};
  const missed = [];

  for (const [key, raw] of Object.entries(values || {})) {
    const target = map.keys[key];
    if (!target) continue;
    let value = typeof raw === "string" ? raw.trim() : raw;
    if (typeof value === "string" && /^(true|yes|checked|x)$/i.test(value) && target.type === "check") value = true;
    if (typeof value === "string" && /^(false|no|none|n\/a)$/i.test(value)) continue;
    if (value === "" || value === null || value === undefined || value === false) continue;
    try {
      if (target.type === "check") {
        if (value === true || /^(yes|true|checked|x)$/i.test(String(value))) {
          formDoc.getCheckBox(target.field).check();
          filled[key] = true;
        }
      } else {
        const text = String(value).slice(0, 600);
        formDoc.getTextField(target.field).setText(text);
        filled[key] = text;
      }
    } catch (err) {
      missed.push(`${key}: ${(err && err.message) || err}`);
    }
  }

  const bytes = await doc.save();
  return { bytes, filled, missed, title: map.title, map };
}

export async function handleJcf(request, env, body) {
  const origin = new URL(request.url).origin;

  // An open form-filling endpoint costs a model call each time it is used.
  const db = env.DB;
  if (db) {
    const day = new Date().toISOString().slice(0, 10);
    const ipHash = await sha256Hex(clientIp(request));
    const used = await db
      .prepare("SELECT COUNT(*) AS n FROM ai_usage WHERE day = ? AND ip_hash = ?")
      .bind(day, ipHash)
      .first();
    if (Number(used?.n || 0) >= Number(env.AI_DAILY_LIMIT || 20)) {
      return fail(429, "rate_limited", "Today's limit for filling forms is used up. Try again tomorrow.");
    }
    await db
      .prepare("INSERT INTO ai_usage (id, ip_hash, day, created_at) VALUES (?, ?, ?, ?)")
      .bind(crypto.randomUUID(), ipHash, day, new Date().toISOString())
      .run();
  }
  let formId = FORMS[body.form] ? body.form : "";
  let values = body.values && typeof body.values === "object" ? body.values : null;
  let reason = "";

  if (!values) {
    const description = String(body.description || "").slice(0, 4000);
    if (!description && !body.audit) return fail(400, "nothing_to_fill", "Describe the case first.");
    try {
      const reply = await askForJson(env, {
        audit: typeof body.audit === "string" ? body.audit.trim().slice(0, 120) : "",
        system: PLAN_SYSTEM,
        user: description || "Fill the form this case needs from the audit.",
        maxTokens: 2000,
      });
      const plan = parsePlan(reply);
      formId = formId || plan.form;
      values = plan.values;
      reason = plan.reason;
    } catch (err) {
      if (formId) values = {};
      else return fail(502, "plan_failed", (err && err.message) || "The form could not be planned.");
    }
  }

  if (!formId) return fail(400, "no_form", "No court form matched this case.");
  if (!FORMS[formId].file) return fail(400, "no_form", "No court form matched this case.");

  let out;
  try {
    out = await fillForm(env, origin, formId, values || {});
  } catch (err) {
    return fail(500, "fill_failed", (err && err.message) || "The form could not be filled.");
  }

  if (body.dry) {
    // What the record answered, and what only the person can answer: the client
    // turns the second list into cards so a blank is never a dead end.
    const blanks = Object.entries(out.map.keys)
      .filter(([key]) => !(key in out.filled))
      .map(([key, target]) => ({ key, label: target.label || key, type: target.type }));
    return json({
      form: formId,
      title: out.title,
      reason,
      values: values || {},
      filled: out.filled,
      blanks,
      missed: out.missed,
    });
  }

  const filename = `${formId.replace(/[^A-Za-z0-9]/g, "").toLowerCase()}-filled.pdf`;
  return new Response(out.bytes, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${filename}"`,
      "cache-control": "no-store",
      "x-form": formId,
      "x-form-file": filename,
      "x-form-title": encodeURIComponent(out.title || ""),
      "x-form-filled": String(Object.keys(out.filled).length),
    },
  });
}
