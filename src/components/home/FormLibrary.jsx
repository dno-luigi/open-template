import { useCallback, useEffect, useState } from "react";
import { Loader2, Lock, Mail, PencilLine, RefreshCw, Trash2, Unlock } from "lucide-react";
import { Dialog, toast } from "@wron/kit";
import Button from "../Button";
import { useCurrentDoc } from "../templateStore";
import { parseMarkdown } from "../mdTools";
import {
  fetchDocumentText,
  forgetForm,
  forgetOwnerPass,
  formatRevision,
  formatSize,
  listForms,
  ownerPass,
  pullForm,
  saveOwnerPass,
} from "../formLibrary";

// Status reads as a stamp on a filing, not a badge: one all-caps element on the
// page, because a stamped form is the one thing here that really is all caps.
const STAMP = {
  stored: "On file",
  encrypted: "Encrypted",
  decrypted: "Decrypted",
  fillable: "Fillable",
  superseded: "Superseded",
};

const iconBtn =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-theme border border-line text-ink " +
  "hover:border-primary hover:text-primary transition-colors duration-150 disabled:opacity-40";

function Stamp({ row }) {
  const label = STAMP[row.status] || row.status;
  if (!label) return null;
  const warn = row.status === "superseded" || row.status === "encrypted";
  return (
    <span
      className={
        "ml-2 inline-block border px-1.5 py-px text-[10px] uppercase tracking-[0.12em] align-[2px] " +
        (warn ? "border-accent/60 text-accent" : "border-line text-muted")
      }
    >
      {label}
    </span>
  );
}

function Meta({ row }) {
  const parts = [
    row.source === "email" ? "Mailed in" : null,
    formatRevision(row.revision) && `Rev. ${formatRevision(row.revision)}`,
    row.pages && `${row.pages} ${row.pages === 1 ? "page" : "pages"}`,
    formatSize(row.bytes),
  ].filter(Boolean);
  return (
    <p className="t-meta text-muted mt-1">
      {parts.join("  ·  ")}
      <Stamp row={row} />
    </p>
  );
}

export default function FormLibrary() {
  const { setDoc } = useCurrentDoc();
  const [number, setNumber] = useState("");
  const [rows, setRows] = useState([]);
  const [owner, setOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [pass, setPass] = useState("");
  const [unlocked, setUnlocked] = useState(() => !!ownerPass());

  const reload = useCallback(async () => {
    try {
      const next = await listForms();
      setRows(next.rows);
      setOwner(next.owner);
      setError(null);
    } catch (err) {
      setError(err?.message || "Couldn't load the library.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function submit(event) {
    event.preventDefault();
    const wanted = number.trim();
    if (!wanted || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { row, cached, warning } = await pullForm(wanted);
      setNumber("");
      if (warning) setError(warning);
      toast.success(cached ? `${row.formNumber} is already on file` : `Pulled ${row.formNumber} from courts.ca.gov`);
      await reload();
    } catch (err) {
      setError(err?.message || "That form could not be pulled.");
    } finally {
      setBusy(false);
    }
  }

  async function unlock(event) {
    event.preventDefault();
    const value = pass.trim();
    if (!value) return;
    saveOwnerPass(value);
    setBusy(true);
    setError(null);
    try {
      const next = await listForms();
      setRows(next.rows);
      setOwner(next.owner);
      if (next.owner) {
        setUnlocked(true);
        setPass("");
        toast.success("Your mailed files are shown");
      } else {
        forgetOwnerPass();
        setError("That pass was not accepted.");
      }
    } catch (err) {
      forgetOwnerPass();
      setError(err?.message || "That pass was not accepted.");
    } finally {
      setBusy(false);
    }
  }

  function lock() {
    forgetOwnerPass();
    setUnlocked(false);
    setOwner(false);
    reload();
  }

  async function openAsTemplate(row) {
    setBusy(true);
    setError(null);
    try {
      const blocks = parseMarkdown(await fetchDocumentText(row.url));
      if (!blocks.length) {
        setError("That file has no text to open.");
        return;
      }
      setDoc((d) => ({ ...d, title: d.title || row.title, blocks: [...d.blocks, ...blocks] }));
      toast.success(`${row.title} opened in the editor`);
      document.getElementById("editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      setError(err?.message || "That file could not be opened.");
    } finally {
      setBusy(false);
    }
  }

  async function refresh(row) {
    setBusy(true);
    setError(null);
    try {
      const { warning } = await pullForm(row.formNumber, { refresh: true });
      if (warning) setError(warning);
      else toast.success(`${row.formNumber} is the current revision`);
      await reload();
    } catch (err) {
      setError(err?.message || "Couldn't check that form.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row) {
    try {
      await forgetForm(row.id);
      setConfirm(null);
      toast(`${row.formNumber || row.title} removed`);
      await reload();
    } catch (err) {
      setError(err?.message || "Couldn't remove that form.");
    }
  }

  return (
    <section id="forms" aria-labelledby="forms-title" className="page-x max-w-[1200px] mx-auto py-16 md:py-24 scroll-mt-24">
      <div className="grid lg:grid-cols-12 gap-10 lg:gap-14">
        <div className="lg:col-span-5">
          <h2 id="forms-title" className="t-section text-ink">
            Court forms
          </h2>
          <p className="mt-4 text-[16px] md:text-[17px] leading-[1.6] text-muted max-w-[44ch]">
            Type a Judicial Council form number. It is fetched from courts.ca.gov and kept in this site's storage, not on this phone.
          </p>

          <form onSubmit={submit} className="mt-8">
            <label htmlFor="form-number" className="t-meta text-muted block">
              Form number
            </label>
            <div className="mt-2 flex items-stretch gap-2">
              <input
                id="form-number"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="FL-320"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className="h-11 w-[136px] rounded-theme border border-line bg-bg px-3 font-mono text-[15px] uppercase tracking-[0.06em] text-ink placeholder:text-muted/60 focus:border-primary focus:outline-none"
              />
              <Button type="submit" className="h-11 px-5" disabled={busy || !number.trim()}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : "Add form"}
              </Button>
            </div>
          </form>

          <div className="mt-8 border-t border-line pt-5">
            {unlocked && owner ? (
              <div className="flex items-start justify-between gap-4">
                <p className="text-[15px] leading-relaxed text-ink inline-flex items-start gap-2">
                  <Unlock className="w-4 h-4 mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                  <span>Files you mail in are shown. Only you can see them.</span>
                </p>
                <button type="button" onClick={lock} className="shrink-0 t-meta text-primary ui-link hover:underline">
                  Lock
                </button>
              </div>
            ) : (
              <form onSubmit={unlock}>
                <label htmlFor="owner-pass" className="text-[15px] leading-relaxed text-ink inline-flex items-start gap-2">
                  <Lock className="w-4 h-4 mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                  <span>Files you mail in stay private. Enter your pass to see them.</span>
                </label>
                <div className="mt-3 flex items-stretch gap-2">
                  <input
                    id="owner-pass"
                    type="password"
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    placeholder="Owner pass"
                    autoComplete="current-password"
                    className="h-10 flex-1 min-w-[120px] rounded-theme border border-line bg-bg px-3 text-[15px] text-ink placeholder:text-muted/60 focus:border-primary focus:outline-none"
                  />
                  <Button type="submit" variant="outline" className="h-10 px-4" disabled={busy || !pass.trim()}>
                    Unlock
                  </Button>
                </div>
              </form>
            )}
          </div>

          <p className="mt-8 text-[13.5px] leading-relaxed text-muted max-w-[46ch]">
            FL-100, FL-150, DV-100 and the rest of the family-law set. Local forms such as San Diego's D-046 are not on courts.ca.gov — upload those, or mail them in.
          </p>
          <p className="mt-3 inline-flex items-start gap-2 text-[13.5px] leading-relaxed text-muted max-w-[46ch]">
            <Mail className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
            Mail a .md, .txt or .pdf to the library address and it appears here once unlocked.
          </p>
        </div>

        <div className="lg:col-span-7 lg:pl-2">
          {error && (
            <p role="alert" className="mb-4 border-l-2 border-danger bg-surface px-4 py-3 text-[15px] text-ink">
              {error}
            </p>
          )}

          {loading ? (
            <div className="min-h-[180px] flex items-center gap-3 t-meta text-muted border-t border-line pt-5">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              Loading the library
            </div>
          ) : rows.length === 0 ? (
            <div className="border-t border-line pt-6">
              <p className="text-[17px] text-ink">Nothing on file yet.</p>
              <p className="mt-2 text-[15px] leading-relaxed text-muted max-w-[40ch]">
                Add a form by number and it is listed here with the revision the court published.
              </p>
            </div>
          ) : (
            <ul className="border-t border-line">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="grid grid-cols-[72px_minmax(0,1fr)] md:grid-cols-[76px_minmax(0,1fr)_auto] gap-x-4 gap-y-2 border-b border-line py-4"
                >
                  <span className="font-mono text-[12.5px] leading-6 text-ink/80 pt-px">
                    {row.formNumber || "—"}
                  </span>

                  <div className="min-w-0">
                    <h3 className="t-card text-[17px] leading-snug text-ink">
                      {row.title?.trim() || "Untitled form"}
                    </h3>
                    <Meta row={row} />
                  </div>

                  <div className="col-start-2 md:col-start-3 flex items-center gap-1.5 md:pl-2">
                    {row.kind === "markdown" ? (
                      <button
                        type="button"
                        onClick={() => openAsTemplate(row)}
                        disabled={busy}
                        className="t-meta inline-flex h-9 items-center gap-1.5 border border-line px-2.5 text-ink hover:border-primary hover:text-primary transition-colors duration-150 disabled:opacity-40"
                      >
                        <PencilLine className="w-3.5 h-3.5" aria-hidden="true" />
                        Open
                      </button>
                    ) : (
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noreferrer"
                        className="t-meta inline-flex h-9 items-center border border-line px-2.5 text-ink hover:border-primary hover:text-primary transition-colors duration-150"
                      >
                        Open
                      </a>
                    )}
                    {row.formNumber && (
                      <button
                        type="button"
                        className={iconBtn}
                        onClick={() => refresh(row)}
                        disabled={busy}
                        aria-label={`Check ${row.formNumber} for a newer revision`}
                      >
                        <RefreshCw className="w-4 h-4" aria-hidden="true" />
                      </button>
                    )}
                    <button
                      type="button"
                      className={iconBtn}
                      onClick={() => setConfirm(row)}
                      aria-label={`Delete ${row.formNumber || row.title}`}
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-5 text-[13px] leading-relaxed text-muted max-w-[52ch]">
            Forms come from courts.ca.gov. The revision date is the one the court published — check it is current, and your court's local rules, before filing.
          </p>
        </div>
      </div>

      <Dialog open={!!confirm} onClose={() => setConfirm(null)} title="Remove this form?" panelClassName="bg-bg">
        <p className="text-[16px] text-muted">
          {confirm?.formNumber ? `${confirm.formNumber} — ` : ""}
          {confirm?.title?.trim() || "Untitled form"}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirm(null)}>Keep it</Button>
          <Button variant="danger" onClick={() => remove(confirm)}>Remove</Button>
        </div>
      </Dialog>
    </section>
  );
}
