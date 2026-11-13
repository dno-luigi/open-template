import { useEffect, useState } from "react";
import { Dialog, toast } from "@wron/kit";
import { FileText, Check } from "lucide-react";
import Button from "../Button";
import { planCourtForm, fillCourtForm, saveBlob } from "../../jcf";

// What each blank on the form is called in a sentence, and how to ask for it.
// Only these are offered as cards: the rest stay blank on the form for the
// person to fill with a pen, which is normal on a filing.
const CARDS = {
  county: { ask: "Which county is the case in?", hint: "The court on the papers, e.g. Los Angeles" },
  courtAddress: { ask: "What is the court's street address?", hint: "Leave blank if you don't know it" },
  courtCityZip: { ask: "Court city and ZIP?", hint: "e.g. 111 N. Hill St., Los Angeles 90012" },
  courtBranch: { ask: "Which branch or courthouse?", hint: "e.g. Stanley Mosk Courthouse" },
  caseNumber: { ask: "What is the case number?", hint: "Printed at the top of the papers you were served" },
  plaintiff: { ask: "Who is the plaintiff?", hint: "The landlord or person suing" },
  defendant: { ask: "Who is the defendant?", hint: "The tenant being sued — you, if you were served" },
  defendantList: { ask: "Every defendant this answer covers", hint: "Names, separated by commas" },
  generalDenial: { ask: "Do you deny the whole complaint?", hint: "Yes, if you disagree with all of it", check: true },
  specificDenials: { ask: "Do you deny particular statements?", hint: "Yes, if only some parts are wrong", check: true },
  defenseFacts: { ask: "What facts support your answer?", hint: "Dates, amounts and what happened, in your own words", area: true },
  petitioner: { ask: "Who is the petitioner?", hint: "The person who filed" },
  respondent: { ask: "Who is the respondent?", hint: "The person who has to respond — you" },
  otherParty: { ask: "Any other parent or party?", hint: "Leave blank if none" },
  hearingDate: { ask: "When is the hearing?", hint: "MM/DD/YYYY" },
  hearingTime: { ask: "What time is the hearing?", hint: "e.g. 8:30 AM" },
  department: { ask: "Which department or room?", hint: "Printed on the notice of hearing" },
  facts: { ask: "What facts support your declaration?", hint: "What happened, in order, with dates", area: true },
  printName: { ask: "How should your name be printed?", hint: "Your full legal name" },
  signDate: { ask: "What date will you sign?", hint: "MM/DD/YYYY" },
};

const field =
  "w-full mt-1 rounded-[6px] border border-line bg-bg px-3 py-2.5 text-[16px] md:text-[15px] text-ink " +
  "placeholder:text-muted/70 focus:outline-none focus:border-primary";

export default function CourtFormDialog({ open, onClose, audit = "", description = "" }) {
  const [plan, setPlan] = useState(null);
  const [status, setStatus] = useState("planning");
  const [answers, setAnswers] = useState({});
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setPlan(null);
    setAnswers({});
    setSaved(null);
    setStatus("planning");
    planCourtForm({ audit, description })
      .then((data) => {
        if (!live) return;
        setPlan(data);
        setStatus("ready");
      })
      .catch((err) => {
        if (!live) return;
        setStatus("error");
        setPlan({ error: err?.message || "The form could not be planned." });
      });
    return () => {
      live = false;
    };
  }, [open, audit, description]);

  const cards = (plan?.blanks || []).filter((b) => CARDS[b.key]);
  const filledKeys = Object.keys(plan?.filled || {});

  const download = async () => {
    setStatus("filling");
    try {
      const values = { ...(plan?.values || {}) };
      for (const [k, v] of Object.entries(answers)) {
        if (v === "" || v === false) delete values[k];
        else values[k] = v;
      }
      const out = await fillCourtForm({ form: plan.form, values });
      saveBlob(out.url, out.filename);
      setSaved(out);
      setStatus("ready");
      toast.success(`${out.form} saved, ${out.filled} parts filled. Check it, then sign it.`);
    } catch (err) {
      setStatus("ready");
      toast.error(err?.message || "The form could not be filled.");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Your court form" panelClassName="bg-bg max-h-[85vh] overflow-y-auto">
      {status === "planning" && (
        <div className="flex items-center gap-3 text-[16px] text-muted">
          <FileText className="w-5 h-5 text-primary" aria-hidden="true" />
          Reading the audit and filling what it already answers…
        </div>
      )}

      {status === "error" && <p className="text-[16px] text-ink">{plan?.error}</p>}

      {status !== "planning" && status !== "error" && plan?.form && (
        <div className="space-y-5">
          <div>
            <p className="text-[19px] font-semibold text-ink">
              {plan.form} · {plan.title}
            </p>
            <p className="mt-1 text-[15px] text-muted">
              {filledKeys.length
                ? `Filled from your audit: ${filledKeys.length} part${filledKeys.length === 1 ? "" : "s"}.`
                : "Nothing in the audit fitted the form directly, so the answers below matter."}
              {cards.length ? ` ${cards.length} question${cards.length === 1 ? "" : "s"} left.` : " Every field this form tracks is answered."}
            </p>
          </div>

          {filledKeys.length > 0 && (
            <div className="rounded-[6px] border border-line bg-surface px-3 py-2.5">
              <p className="text-[13px] font-semibold text-ink">Already on the form</p>
              <ul className="mt-1.5 space-y-1">
                {filledKeys.map((k) => (
                  <li key={k} className="flex items-start gap-2 text-[14px] text-muted">
                    <Check className="w-4 h-4 mt-0.5 text-primary shrink-0" aria-hidden="true" />
                    <span className="min-w-0 break-words">
                      <span className="text-ink">{CARDS[k]?.ask || k}: </span>
                      {String(plan.filled[k]).slice(0, 180)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {cards.length > 0 && (
            <div className="space-y-3">
              <p className="text-[13px] font-semibold text-ink">Answer these and they go straight onto the form</p>
              {cards.map((b) => {
                const c = CARDS[b.key];
                return (
                  <label key={b.key} className="block rounded-[6px] border border-line bg-surface px-3 py-2.5">
                    <span className="text-[15px] text-ink">{c.ask}</span>
                    <span className="block text-[13px] text-muted">{c.hint}</span>
                    {c.check ? (
                      <input
                        type="checkbox"
                        className="mt-2 w-5 h-5 accent-[rgb(15,107,79)]"
                        checked={!!answers[b.key]}
                        onChange={(e) => setAnswers((a) => ({ ...a, [b.key]: e.target.checked }))}
                      />
                    ) : c.area ? (
                      <textarea
                        rows={3}
                        className={field}
                        value={answers[b.key] || ""}
                        onChange={(e) => setAnswers((a) => ({ ...a, [b.key]: e.target.value }))}
                      />
                    ) : (
                      <input
                        className={field}
                        value={answers[b.key] || ""}
                        onChange={(e) => setAnswers((a) => ({ ...a, [b.key]: e.target.value }))}
                      />
                    )}
                  </label>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
            <Button variant="outline" onClick={onClose}>
              Keep it blank for now
            </Button>
            <Button onClick={download} disabled={status === "filling"}>
              {status === "filling" ? "Filling…" : saved ? "Download it again" : "Download the filled form"}
            </Button>
          </div>
          {saved && (
            <p className="text-[14px] text-muted">
              Saved as {saved.filename}. The form is free: open it, check every line, then sign and file it. The packet — exhibits, tabs and service proof — is $39 at EZXHIBITZ.
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
