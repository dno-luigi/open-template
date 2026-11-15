// Judicial Council forms, by number.
//
// Every California Judicial Council form sits at a predictable address:
//
//   https://www.courts.ca.gov/documents/fl320.pdf    (lowercase, no dash)
//
// which redirects twice (www -> courts.ca.gov -> /system/files?file=2025-07/fl320.pdf).
// Following it gives the PDF and, in that last path segment, the month the form
// was last revised: "2025-07". That is the signal for "this form changed since
// you pulled it", which matters more for court forms than for anything else here.
//
// A number with a single-letter prefix (D-046, R-052) is a local court form, not a
// Judicial Council one, and is not published at this address.

const DOCS = "https://www.courts.ca.gov/documents/";
const FORM_PAGE = "https://selfhelp.courts.ca.gov/jcc-form/";
// The revision month shows up in two shapes, depending on where the court files
// the form: /system/files?file=2025-07/fl320.pdf and
// /sites/default/files/courts/default/2024-11/fl150.pdf
const REVISION_IN_PATH = /(?:[?&]file=|\/default\/)(\d{4})-(\d{2})\//;

export class FormError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.name = "FormError";
    this.code = code;
    this.status = status;
  }
}

/**
 * "fl 320" / "FL-320" / "fl320" -> { display: "FL-320", id: "fl320", local: false }
 * Returns null for anything that is not shaped like a form number.
 */
export function normalizeFormNumber(input) {
  const raw = String(input == null ? "" : input)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  const match = /^([A-Z]{1,5})(\d{1,4})([A-Z]?)$/.exec(raw);
  if (!match) return null;
  const [, prefix, digits, suffix] = match;
  return {
    display: `${prefix}-${digits}${suffix}`,
    id: `${prefix}${digits}${suffix}`.toLowerCase(),
    local: prefix.length === 1,
  };
}

export function formUrl(id) {
  return `${DOCS}${id}.pdf`;
}

function hasMarker(bytes, marker) {
  const needle = [...marker].map((c) => c.charCodeAt(0));
  const last = bytes.length - needle.length;
  outer: for (let i = 0; i <= last; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (bytes[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

/**
 * Whether the PDF carries an /Encrypt dictionary. Every Judicial Council form
 * does: an empty password, but the object streams are ciphertext, so nothing can
 * read the pages or the fields until it is removed. Cheaper than letting a
 * parser fail over the whole file, and it keeps the Worker log readable.
 */
export function isEncrypted(bytes) {
  return hasMarker(bytes, "/Encrypt");
}

function decodeEntities(value) {
  return String(value)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * The form's own page on the court's self-help site: the name of the form in
 * words, and the date it took effect. Read from the page rather than the PDF's
 * metadata, which is encrypted along with everything else in the file.
 * Best effort: a title the page did not give is simply not used.
 */
export async function fetchFormPage(display) {
  try {
    const response = await fetch(`${FORM_PAGE}${encodeURIComponent(display)}`, {
      headers: { accept: "text/html" },
      cf: { cacheEverything: true, cacheTtl: 86400 },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { title: "", effective: "" };
    const html = await response.text();
    const heading = /<h1[^>]*>([\s\S]{1,400}?)<\/h1>/i.exec(html);
    const title = heading
      ? decodeEntities(heading[1].replace(/<[^>]+>/g, ""))
          .replace(/\s+/g, " ")
          .trim()
          .replace(/\s*\(\s*[A-Z]{1,5}-?\d{1,4}[A-Z]?\s*\)\s*$/, "")
      : "";
    const effective = /Effective:\s*([A-Z][a-z]+ \d{1,2}, \d{4})/.exec(html);
    return { title, effective: effective ? effective[1] : "" };
  } catch {
    return { title: "", effective: "" };
  }
}

function looksLikePdf(bytes) {
  const magic = "%PDF-";
  if (!bytes || bytes.length < magic.length) return false;
  for (let i = 0; i < magic.length; i++) {
    if (bytes[i] !== magic.charCodeAt(i)) return false;
  }
  return true;
}

/** The revision month the redirect lands on, e.g. "2025-07", or null. */
export function revisionFromUrl(url) {
  const match = REVISION_IN_PATH.exec(String(url || ""));
  return match ? `${match[1]}-${match[2]}` : null;
}

/**
 * Fetch the official PDF for a normalized form id.
 * Returns { bytes, sourceUrl, revision }; throws FormError with a sentence a
 * visitor can act on, because "fetch failed" tells nobody anything.
 */
export async function fetchFormPdf(id) {
  const url = formUrl(id);
  let response;
  try {
    response = await fetch(url, {
      redirect: "follow",
      headers: {
        accept: "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
        "user-agent": "OpenTemplateLibrary/1.0 (+https://templates.nspired.cc)",
      },
      cf: { cacheEverything: true, cacheTtl: 86400 },
    });
  } catch {
    throw new FormError("unreachable", "courts.ca.gov could not be reached from here. Try again in a moment.");
  }

  if (response.status === 404) {
    throw new FormError(
      "form_not_found",
      `courts.ca.gov has no form numbered ${id.toUpperCase()}. Check the number, or upload that file instead.`,
      404
    );
  }
  if (!response.ok) {
    throw new FormError("upstream", `courts.ca.gov answered ${response.status}. Try again in a moment.`);
  }

  let bytes;
  try {
    bytes = new Uint8Array(await response.arrayBuffer());
  } catch {
    throw new FormError("upstream", "courts.ca.gov sent a file that could not be read. Try again.");
  }

  if (!looksLikePdf(bytes)) {
    // A form whose PDF was withdrawn often redirects to an HTML notice instead.
    throw new FormError("not_a_pdf", `The address for ${id.toUpperCase()} did not return a PDF. That form may have been withdrawn.`);
  }

  return {
    bytes,
    sourceUrl: response.url || url,
    revision: revisionFromUrl(response.url || ""),
  };
}
