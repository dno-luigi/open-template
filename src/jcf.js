// The official Judicial Council form, planned and filled on the Worker.
//
// planCourtForm asks what the record can answer and what it cannot; the dialog
// turns the second list into cards. fillCourtForm returns the finished PDF.
import { apiBase, siteId } from "./wron-kit/runtime";

const endpoint = () => {
  if (!apiBase || !siteId) throw new Error("This site is not connected to its backend yet.");
  return `${apiBase}/api/site/${siteId}/jcf`;
};

async function post(body) {
  const res = await fetch(endpoint(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data && data.error && data.error.message) || "The court form could not be filled yet.");
  }
  return res;
}

export async function planCourtForm({ audit = "", description = "" } = {}) {
  const res = await post({ audit, description, dry: true });
  return res.json();
}

export async function fillCourtForm({ form, values = {} } = {}) {
  const res = await post({ form, values });
  const blob = await res.blob();
  const filename = res.headers.get("x-form-file") || "court-form.pdf";
  return {
    blob,
    url: URL.createObjectURL(blob),
    filename,
    form: res.headers.get("x-form") || form || "",
    filled: Number(res.headers.get("x-form-filled") || 0),
  };
}

/** Hand a blob to the browser's downloader. */
export function saveBlob(url, filename) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
