// Reading a PDF that may be encrypted.
//
// Judicial Council forms and most court packets are encrypted with an empty
// password. Until that password is removed nothing can walk the file, so an
// encrypted form is reported as encrypted rather than guessed at.
import { isEncrypted } from "./forms.js";

/**
 * A title worth showing. An encrypted form's metadata comes back garbled from a
 * reader that does not decrypt it, so anything unreadable is dropped rather than
 * putting mojibake on the page.
 */
export function readableTitle(value) {
  const text = String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  if (text.length < 3 || text.length > 160) return "";
  const printable = text.replace(/[^\x20-\x7E]/g, "").length / text.length;
  return printable > 0.9 && /[A-Za-z]{3}/.test(text) ? text : "";
}

/**
 * { encrypted, pages, title } for a PDF's bytes. pages and title are null/"" when
 * the file cannot be read, which for these forms means "still encrypted".
 * pdf-lib is imported lazily so a request that never touches a readable PDF does
 * not pay for it.
 */
export async function describePdf(bytes) {
  const encrypted = isEncrypted(bytes);
  if (encrypted) return { encrypted: true, pages: null, title: "" };
  try {
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    return { encrypted: false, pages: doc.getPageCount(), title: readableTitle(doc.getTitle()) };
  } catch {
    return { encrypted: false, pages: null, title: "" };
  }
}
