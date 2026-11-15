import { useCallback, useEffect, useState } from "react";
import { Check, Eye, Lock, Loader2, RefreshCw, X } from "lucide-react";
import { Dialog, toast } from "@wron/kit";
import Button from "../Button";
import { TextField } from "../Field";
import { docFromCommunity, formatDate } from "../templateStore";
import { forgetOwnerPass, ownerPass, saveOwnerPass } from "../formLibrary";
import { pendingShares, publishShare, rejectShare } from "../moderate";
import DocPreview from "./DocPreview";

// Shares land in shared_templates and stay invisible until someone reads them. This is
// that reading, on the site, with the owner pass — no dashboard, no CLI.
export default function ReviewQueue() {
  const [unlocked, setUnlocked] = useState(() => !!ownerPass());
  const [pass, setPass] = useState("");
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [preview, setPreview] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await pendingShares();
      setRows(next.rows);
      setCounts(next.counts);
      setUnlocked(true);
    } catch (err) {
      if (/owner/i.test(String(err?.message || "")) || err?.status === 403) {
        forgetOwnerPass();
        setUnlocked(false);
        setError("That pass was not accepted.");
      } else {
        setError(err?.message || "The queue could not be read.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (unlocked) load();
  }, [unlocked, load]);

  const unlock = async (event) => {
    event.preventDefault();
    const value = pass.trim();
    if (!value) return;
    saveOwnerPass(value);
    setPass("");
    await load();
  };

  const decide = async (row, publish) => {
    setBusyId(row.id);
    setError("");
    try {
      if (publish) await publishShare(row.id);
      else await rejectShare(row.id);
      setRows((list) => list.filter((r) => r.id !== row.id));
      setCounts((c) => ({ ...c, [publish ? "published" : "rejected"]: Number(c[publish ? "published" : "rejected"] || 0) + 1 }));
      toast.success(publish ? "Published to the community" : "Rejected and kept out of the community");
    } catch (err) {
      setError(err?.message || "That decision did not go through.");
    } finally {
      setBusyId("");
    }
  };

  const pending = rows.length;
  const previewDoc = preview ? docFromCommunity(preview) : null;

  return (
    <section id="review" aria-labelledby="review-title" className="page-x max-w-[1600px] mx-auto py-16 md:py-20 scroll-mt-24">
      <div className="grid lg:grid-cols-12 gap-8 lg:gap-6">
        <div className="lg:col-span-4">
          <h2 id="review-title" className="t-section text-ink">
            Review queue
          </h2>
          <p className="mt-3 text-[16px] md:text-[18px] text-muted">
            {unlocked
              ? `${pending} waiting${counts.published ? ` · ${counts.published} published` : ""}${
                  counts.rejected ? ` · ${counts.rejected} rejected` : ""
                }`
              : "Shares wait here until you publish them."}
          </p>
          {unlocked && (
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="mt-4 inline-flex items-center gap-2 min-h-11 text-[15px] font-medium text-primary ui-link disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="w-4 h-4" aria-hidden="true" />}
              Refresh the queue
            </button>
          )}
        </div>

        <div className="lg:col-span-8">
          {!unlocked ? (
            <form onSubmit={unlock} className="rounded-theme border border-line bg-surface/60 p-5 md:p-6 space-y-4">
              <p className="flex items-center gap-2.5 text-[16px] text-ink">
                <Lock className="w-5 h-5 text-accent" aria-hidden="true" />
                Sign in as the owner
              </p>
              <TextField
                label="Owner pass"
                name="owner_pass"
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                hint="The same pass you use for mailed files. It stays on this device."
                autoComplete="current-password"
              />
              {error && <p role="alert" className="text-[15px] text-[#B42318]">{error}</p>}
              <Button type="submit" disabled={loading || !pass.trim()}>
                {loading ? "Checking..." : "Unlock the queue"}
              </Button>
            </form>
          ) : pending === 0 ? (
            <div className="rounded-theme border border-line bg-surface/60 min-h-[180px] flex items-center justify-center px-6 text-center">
              <p className="text-[16px] md:text-[17px] text-muted">
                {loading ? "Reading the queue..." : "Nothing waiting. New shares appear here."}
              </p>
            </div>
          ) : (
            <>
              {error && <p role="alert" className="mb-3 text-[15px] text-[#B42318]">{error}</p>}
              <ul className="border-t border-line">
                {rows.map((row) => (
                  <li
                    key={row.id}
                    className="border-b border-line py-4 md:py-5 grid md:grid-cols-[minmax(0,1fr)_auto] gap-3 md:gap-6 md:items-center"
                  >
                    <div className="min-w-0">
                      <p className="text-[17px] font-semibold text-ink truncate">{row.title || "Untitled template"}</p>
                      <p className="t-meta text-muted mt-1 flex flex-wrap gap-x-4 gap-y-1">
                        <span>{row.category || "No category"}</span>
                        <span>{row.author || "Anonymous"}</span>
                        {row.createdAt && <span className="tabular-nums">Shared {formatDate(row.createdAt)}</span>}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 md:flex md:items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => setPreview(row)}>
                        <Eye className="w-4 h-4" aria-hidden="true" />
                        Preview
                      </Button>
                      <Button size="sm" onClick={() => decide(row, true)} disabled={busyId === row.id}>
                        <Check className="w-4 h-4" aria-hidden="true" />
                        Publish
                      </Button>
                      <Button size="sm" variant="soft" onClick={() => decide(row, false)} disabled={busyId === row.id}>
                        <X className="w-4 h-4" aria-hidden="true" />
                        Reject
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <Dialog
        open={!!preview}
        onClose={() => setPreview(null)}
        title={preview?.title || "Unpublished share"}
        panelClassName="bg-bg max-w-[720px]"
      >
        <p className="t-meta text-muted mb-3">
          Submitted by {preview?.author || "Anonymous"} · {preview?.category || "No category"}
        </p>
        <div className="max-h-[60vh] overflow-y-auto bg-surface p-3 rounded-theme">
          {previewDoc && <DocPreview doc={previewDoc} />}
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <Button variant="soft" onClick={() => { const row = preview; setPreview(null); decide(row, false); }}>
            Reject
          </Button>
          <Button onClick={() => { const row = preview; setPreview(null); decide(row, true); }}>
            Publish
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
