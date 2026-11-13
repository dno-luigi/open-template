import { Dialog } from "@wron/kit";
import { Download, ArrowUpRight } from "lucide-react";
import Button from "../Button";

// The path for someone who needs the form and cannot pay for the packet. It is a
// quiet link, not a banner: no one should have to announce that money is short.
// The form is free at any price; a single packet is $8 instead of the $39 set;
// and the first packet is free for anyone who still cannot pay.
export default function MoneyPath({ open, onClose, onGetForm, auditQuery = "" }) {
  const single = auditQuery ? `${auditQuery}&packet=single&price=8` : "?packet=single&price=8";
  const first = auditQuery ? `${auditQuery}&packet=first&price=0` : "?packet=first&price=0";
  return (
    <Dialog open={open} onClose={onClose} title="If money is tight" panelClassName="bg-bg max-h-[85vh] overflow-y-auto">
      <div className="space-y-5">
        <p className="text-[16px] text-ink">
          Cost is not a reason to go into court without your paperwork. Take the form now, and take the cheaper packet.
        </p>

        <div className="rounded-[6px] border border-line bg-surface px-3 py-3">
          <p className="text-[15px] font-semibold text-ink">1. The form is free</p>
          <p className="mt-1 text-[14px] text-muted">
            Your answer, filled from the audit, on the court's own form. No payment, no account.
          </p>
          <Button size="sm" className="mt-3" onClick={onGetForm}>
            <Download className="w-4 h-4" aria-hidden="true" />
            Get the form
          </Button>
        </div>

        <div className="rounded-[6px] border border-line bg-surface px-3 py-3">
          <p className="text-[15px] font-semibold text-ink">2. One packet is $8, not $39</p>
          <p className="mt-1 text-[14px] text-muted">
            At EZXHIBITZ, choose the single packet instead of the full set. Same exhibits, one packet, $8.
          </p>
          <Button size="sm" variant="outline" className="mt-3" href={`https://ezxhibitz.nspired.cc/${single}`}>
            Go to EZXHIBITZ
            <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="rounded-[6px] border border-line px-3 py-3">
          <p className="text-[15px] font-semibold text-ink">3. If $8 is still too much, the first one is free</p>
          <p className="mt-1 text-[14px] text-muted">
            Take your first packet at no cost. No code, no questions, no card. Come back for the next one when you can.
          </p>
          <Button size="sm" variant="outline" className="mt-3" href={`https://ezxhibitz.nspired.cc/${first}`}>
            Take the first packet free
            <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
          </Button>
          <p className="mt-3 text-[13px] text-muted">
            And your court's self-help center files with you for free:{' '}
          </p>
          <a
            className="-mt-2 inline-block text-[14px] font-semibold text-primary underline underline-offset-2"
            href="https://selfhelp.courts.ca.gov/"
            target="_blank"
            rel="noreferrer"
          >
            selfhelp.courts.ca.gov
          </a>
        </div>
      </div>
    </Dialog>
  );
}
