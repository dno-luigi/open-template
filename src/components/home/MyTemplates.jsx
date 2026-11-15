import { useState } from "react";
import { Laptop, ShieldAlert, CheckCircle2, CircleAlert } from "lucide-react";
import { Dialog, Reveal, toast } from "@wron/kit";
import { useDeviceTemplates, formatDate } from "../templateStore";
import Button from "../Button";
import { Checkbox, TextField } from "../Field";
import { STATUS } from "../../data/site";
import { shareTemplates, templateProblem } from "../community";
import { useDocActions } from "./actions";

export default function MyTemplates() {
  const { templates, remove } = useDeviceTemplates();
  const { openDoc, startEditing, pdfNow } = useDocActions();
  const [confirm, setConfirm] = useState(null);

  // Publishing several at once: a folder of imported pages is dozens of documents,
  // and one share dialog each is not a workflow.
  const [picked, setPicked] = useState([]);
  const [publishOpen, setPublishOpen] = useState(false);
  const [name, setName] = useState("");
  const [cleared, setCleared] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");

  const toggle = (id) =>
    setPicked((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  const chosen = templates.filter((t) => picked.includes(t.id));
  const openPublish = () => {
    setResults(null);
    setError("");
    setCleared(false);
    setProgress("");
    setPublishOpen(true);
  };

  const publish = async () => {
    setError("");
    if (!cleared) {
      setError("Please confirm you removed personal details.");
      return;
    }
    setSending(true);
    setProgress(`Sending 1 of ${chosen.length}...`);
    try {
      const out = await shareTemplates(chosen, {
        name,
        confirmed: true,
        onProgress: (done, total) => setProgress(`Sent ${done} of ${total}...`),
      });
      setResults(out);
      const ok = out.filter((r) => r.ok).length;
      if (ok) {
        toast.success(`${ok} template${ok === 1 ? "" : "s"} sent to the community queue.`);
        setPicked([]);
      }
    } catch (err) {
      setError(err?.message || "Sharing did not work. Please try again.");
    } finally {
      setSending(false);
      setProgress("");
    }
  };

  return (
    <section id="my-templates" aria-labelledby="my-title" className="page-x max-w-[1600px] mx-auto py-16 md:py-20 scroll-mt-24">
      <div className="grid lg:grid-cols-12 gap-8 lg:gap-6">
        <Reveal y={12} className="lg:col-span-4">
          <h2 id="my-title" className="t-section text-ink">My templates</h2>
          <p className="mt-3 flex items-center gap-2.5 text-[16px] md:text-[18px] text-muted">
            <Laptop className="w-5 h-5" aria-hidden="true" />
            {STATUS.device}
          </p>
          {templates.length > 1 && (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="text-[15px] font-medium text-primary ui-link min-h-11 md:min-h-0"
                onClick={() => setPicked(picked.length === templates.length ? [] : templates.map((t) => t.id))}
              >
                {picked.length === templates.length ? "Clear selection" : "Select all"}
              </button>
              {picked.length > 0 && <span className="t-meta text-muted">{picked.length} selected</span>}
            </div>
          )}
        </Reveal>

        <div className="lg:col-span-8">
          {templates.length === 0 ? (
            <div className="rounded-theme border border-line bg-surface/60 min-h-[240px] flex flex-col items-center justify-center gap-5 py-16 px-6 text-center">
              <p className="text-[16px] md:text-[17px] text-muted">Nothing saved on this device yet.</p>
              <Button onClick={startEditing}>Create a template</Button>
            </div>
          ) : (
            <>
              {picked.length > 0 && (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-theme border border-line bg-surface px-4 py-3">
                  <p className="text-[15px] text-ink">
                    {picked.length} template{picked.length === 1 ? "" : "s"} selected
                  </p>
                  <Button size="sm" onClick={openPublish}>
                    Publish to community
                  </Button>
                </div>
              )}
              <ul className="border-t border-line">
                {templates.map((t) => {
                  const problem = templateProblem(t);
                  return (
                    <li key={t.id} className="border-b border-line py-4 md:py-5 grid md:grid-cols-[auto_minmax(0,1fr)_auto] gap-3 md:gap-6 md:items-center">
                      <Checkbox
                        label={<span className="sr-only">Select {t.title?.trim() || "untitled template"}</span>}
                        checked={picked.includes(t.id)}
                        onChange={() => toggle(t.id)}
                      />
                      <div className="min-w-0">
                        <p className="text-[17px] font-semibold text-ink truncate">{t.title?.trim() || "Untitled template"}</p>
                        <p className="t-meta text-muted mt-1 flex flex-wrap gap-x-4 gap-y-1">
                          <span>{t.category || "No category"}</span>
                          {t.updatedAt && <span className="tabular-nums">Saved {formatDate(t.updatedAt)}</span>}
                          <span className="inline-flex items-center gap-1.5">
                            <Laptop className="w-3.5 h-3.5" aria-hidden="true" />
                            {STATUS.device}
                          </span>
                          {problem && <span className="text-[#B42318]">{problem}</span>}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 md:flex md:items-center gap-2">
                        <Button size="sm" className="col-span-2 md:col-span-1 px-5" onClick={() => openDoc(t, "Opened in the editor")}>
                          Open
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => pdfNow(t)}>Download PDF</Button>
                        <Button size="sm" variant="soft" onClick={() => setConfirm(t)}>Delete</Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </div>

      <Dialog open={!!confirm} onClose={() => setConfirm(null)} title="Delete this template from this device?" panelClassName="bg-bg">
        <p className="text-[16px] text-muted">{confirm?.title?.trim() || "Untitled template"}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={() => setConfirm(null)}>Keep it</Button>
          <Button
            variant="danger"
            onClick={() => {
              remove(confirm.id);
              setConfirm(null);
              toast("Deleted from this device");
            }}
          >
            Delete
          </Button>
        </div>
      </Dialog>

      <Dialog open={publishOpen} onClose={() => (sending ? null : setPublishOpen(false))} title="Publish to the community" panelClassName="bg-bg">
        {results ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              {results.every((r) => r.ok) ? (
                <CheckCircle2 className="w-6 h-6 text-primary shrink-0" aria-hidden="true" />
              ) : (
                <CircleAlert className="w-6 h-6 text-accent shrink-0" aria-hidden="true" />
              )}
              <p className="text-[16px] text-ink">
                {results.filter((r) => r.ok).length} of {results.length} sent. They appear in the community after a quick
                check.
              </p>
            </div>
            <ul className="max-h-56 overflow-y-auto divide-y divide-line border-y border-line">
              {results.map((r) => (
                <li key={r.title} className="py-2 flex items-start gap-2 text-[15px]">
                  <span className={r.ok ? "text-primary" : "text-[#B42318]"} aria-hidden="true">{r.ok ? "✓" : "✗"}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-ink">{r.title}</span>
                    {!r.ok && <span className="t-meta text-[#B42318]">{r.error}</span>}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex justify-end">
              <Button onClick={() => setPublishOpen(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-[16px] text-ink">
              {chosen.length} template{chosen.length === 1 ? "" : "s"} will be sent for review.
            </p>
            <ul className="max-h-40 overflow-y-auto text-[15px] text-muted border-y border-line divide-y divide-line">
              {chosen.map((t) => (
                <li key={t.id} className="py-1.5 truncate">{t.title?.trim() || "Untitled template"}</li>
              ))}
            </ul>
            <p className="flex items-start gap-2.5 text-[15px] text-ink">
              <ShieldAlert className="w-5 h-5 mt-0.5 text-accent shrink-0" aria-hidden="true" />
              <span>Text and imported pages are shared. Answers typed into fields stay on this device.</span>
            </p>
            <TextField
              label="Name (optional)"
              name="author_name"
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              hint="Shown as Anonymous if blank"
            />
            <Checkbox label="I removed personal details from all of these" checked={cleared} onChange={(e) => setCleared(e.target.checked)} />
            {error && <p role="alert" className="text-[15px] text-[#B42318]">{error}</p>}
            {progress && <p role="status" className="t-meta text-muted">{progress}</p>}
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="outline" onClick={() => setPublishOpen(false)} disabled={sending}>
                Cancel
              </Button>
              <Button onClick={publish} disabled={sending || !cleared || !chosen.length}>
                {sending ? "Publishing..." : `Publish ${chosen.length || ""}`}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </section>
  );
}
