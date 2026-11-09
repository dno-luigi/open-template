import { useState } from "react";
import { Flag, Copy } from "lucide-react";
import { Dialog, toast, cn } from "@wron/kit";
import { docFromCommunity, formatDate } from "../templateStore";
import { authorName, logCopy, reportTemplate } from "../community";
import { TextArea } from "../Field";
import Button from "../Button";
import { useDocActions } from "./actions";

const HEADS = ["Title", "Category", "Shared by", "Date shared", "Uses", "Action"];
const RIGHT = new Set(["Date shared", "Uses"]);
const uses = (r) => (typeof r.uses === "number" ? r.uses : "");
const shared = (r) => formatDate(r.shared_on || r.created_at);

export default function CommunityTable({ rows, state, fresh }) {
  const { openDoc } = useDocActions();
  const [reporting, setReporting] = useState(null);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);

  const copy = (r) => {
    openDoc(docFromCommunity(r), "Copied to the editor. Fill it in and save it your way.");
    logCopy(r);
  };

  const sendReport = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await reportTemplate(reporting, reason);
      toast.success("Thanks. Your report was sent.");
      setReporting(null);
      setReason("");
    } catch {
      toast.error("The report could not be sent. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const reportBtn = (r) => (
    <button
      type="button"
      onClick={() => setReporting(r)}
      className="inline-flex items-center gap-1.5 min-h-11 md:min-h-9 px-2 rounded-[6px] text-[14px] font-medium text-muted hover:text-ink hover:bg-surface transition-colors duration-150"
    >
      <Flag className="w-4 h-4" aria-hidden="true" />
      Report
    </button>
  );

  return (
    <>
      {/* Desktop and tablet: table with a sticky header */}
      <div className="hidden md:block border border-line bg-bg max-h-[680px] overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-bg">
            <tr className="shadow-[inset_0_-1px_0_#E6E2F2]">
              {HEADS.map((h) => (
                <th key={h} scope="col" className={cn("px-5 h-12 t-meta text-muted font-medium", RIGHT.has(h) && "text-right")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state ? (
              <tr>
                <td colSpan={6}>{state}</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className={cn("border-b border-line last:border-b-0", fresh.has(String(r.id)) && "row-tint")}>
                  <td className="px-5 py-3.5 text-[15px] font-semibold text-ink max-w-[320px]">
                    <span className="line-clamp-2">{r.title || "Untitled template"}</span>
                  </td>
                  <td className="px-5 py-3.5 text-[15px] text-muted">{r.category || "No category"}</td>
                  <td className="px-5 py-3.5 text-[15px] text-ink">{authorName(r)}</td>
                  <td className="px-5 py-3.5 text-[15px] text-muted text-right tabular-nums whitespace-nowrap">{shared(r)}</td>
                  <td className="px-5 py-3.5 text-[15px] text-ink text-right tabular-nums">{uses(r)}</td>
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="outline" onClick={() => copy(r)}>
                        <Copy className="w-4 h-4" aria-hidden="true" />
                        Copy to editor
                      </Button>
                      {reportBtn(r)}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Phones: one card per template */}
      <div className="md:hidden border border-line bg-bg">
        {state ? (
          state
        ) : (
          <ul>
            {rows.map((r) => (
              <li key={r.id} className={cn("p-4 border-b border-line last:border-b-0", fresh.has(String(r.id)) && "row-tint")}>
                <p className="text-[17px] font-semibold text-ink">{r.title || "Untitled template"}</p>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[14px]">
                  <div><dt className="t-meta text-muted">Category</dt><dd className="text-ink">{r.category || "No category"}</dd></div>
                  <div><dt className="t-meta text-muted">Shared by</dt><dd className="text-ink">{authorName(r)}</dd></div>
                  <div><dt className="t-meta text-muted">Date shared</dt><dd className="text-ink tabular-nums">{shared(r)}</dd></div>
                  {uses(r) !== "" && (
                    <div><dt className="t-meta text-muted">Uses</dt><dd className="text-ink tabular-nums">{uses(r)}</dd></div>
                  )}
                </dl>
                <div className="mt-3 flex items-center gap-2">
                  <Button className="flex-1" onClick={() => copy(r)}>Copy to editor</Button>
                  {reportBtn(r)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={!!reporting} onClose={() => setReporting(null)} title="Report this template" panelClassName="bg-bg">
        <form onSubmit={sendReport} className="space-y-4">
          <p className="text-[15px] text-muted">{reporting?.title || "Untitled template"}</p>
          <TextArea
            label="What is wrong? (optional)"
            name="reason"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="outline" onClick={() => setReporting(null)}>Cancel</Button>
            <Button type="submit" disabled={sending}>{sending ? "Sending..." : "Send report"}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
