import { useEffect, useState } from "react";
import { X, ShieldAlert, CheckCircle2 } from "lucide-react";
import { Sheet } from "@wron/kit";
import { useCurrentDoc } from "../templateStore";
import { TextField, Checkbox } from "../Field";
import Button from "../Button";
import { shareTemplate, SHARE_SENT } from "../community";
import { LEGAL_NOTE_DEMAND } from "../../data/site";
import { usePaperState } from "./paperState";
import { useDocActions } from "./actions";

export default function SharePanel() {
  const ps = usePaperState();
  const { doc } = useCurrentDoc();
  const { closeShare } = useDocActions();
  const [name, setName] = useState("");
  const [ok, setOk] = useState(false);
  const [trap, setTrap] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (ps.shareOpen) {
      setSent(false);
      setError("");
      setOk(false);
    }
  }, [ps.shareOpen]);

  const close = () => closeShare(sent);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (trap) { setSent(true); return; }
    if (!ok) { setError("Please confirm you removed personal details."); return; }
    setSending(true);
    try {
      await shareTemplate(doc, { name, confirmed: ok });
      setSent(true);
    } catch (err) {
      setError(err?.message || "Sharing did not work. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={ps.shareOpen} onClose={close} side="right" panelClassName="bg-bg w-full sm:max-w-[440px]">
      <div className="flex flex-col h-full">
        <div className="h-[2px] bg-accent" aria-hidden="true" />
        <div className="flex items-center justify-between px-5 md:px-6 h-16 border-b border-line">
          <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-ink">Share with community</h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="inline-flex items-center justify-center w-11 h-11 -mr-2 rounded-[6px] hover:bg-surface transition-colors duration-150"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 md:px-6 py-6">
          {sent ? (
            <div role="status" className="space-y-5">
              <CheckCircle2 className="w-8 h-8 text-primary" aria-hidden="true" />
              <p className="text-[17px] text-ink">{SHARE_SENT}</p>
              <p className="text-[15px] text-muted">Your own copy is still in the editor.</p>
              <Button onClick={close}>Back to the editor</Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5" noValidate>
              <div className="rounded-[6px] border border-line bg-surface px-4 py-3">
                <p className="text-[16px] font-semibold text-ink truncate">{doc.title || "Untitled template"}</p>
                <p className="t-meta text-muted mt-0.5">{doc.category || "No category"}</p>
              </div>

              <p className="flex items-start gap-2.5 text-[16px] text-ink">
                <ShieldAlert className="w-5 h-5 mt-0.5 text-accent shrink-0" aria-hidden="true" />
                <span>
                  Remove personal details first.
                  <span className="block text-[15px] text-muted mt-1">
                    Text you wrote is shared. Answers typed into fields and pictures stay on this device.
                  </span>
                </span>
              </p>
              {doc.category === "Demand letters" && <p className="t-meta text-muted">{LEGAL_NOTE_DEMAND}</p>}

              <TextField
                label="Name (optional)"
                name="author_name"
                value={name}
                maxLength={60}
                autoComplete="nickname"
                onChange={(e) => setName(e.target.value)}
                hint="Shown as Anonymous if blank"
              />

              <div aria-hidden="true" className="absolute -left-[9999px] w-px h-px overflow-hidden">
                <label htmlFor="share-website">Website</label>
                <input id="share-website" name="website" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
              </div>

              <Checkbox label="I removed personal details" checked={ok} onChange={(e) => setOk(e.target.checked)} />

              {error && (
                <p role="alert" className="text-[15px] text-[#B42318]">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={sending || !ok}>
                {sending ? "Sharing..." : "Share template"}
              </Button>
              <p className="t-meta text-muted text-center">No account needed.</p>
            </form>
          )}
        </div>
      </div>
    </Sheet>
  );
}
