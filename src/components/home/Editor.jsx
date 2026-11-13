import { lazy, Suspense, useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Laptop, Users, AlertCircle, Printer } from "lucide-react";
import { cn } from "@wron/kit";
import { useCurrentDoc } from "../templateStore";
import Button from "../Button";
import { STATUS, LEGAL_NOTE_DEMAND } from "../../data/site";
import EditorControls from "./EditorControls";
import DocPreview from "./DocPreview";
import { usePaperState } from "./paperState";
import { useDocActions, PDF_FAIL } from "./actions";

const SharePanel = lazy(() => import("./SharePanel"));

function Status({ mode, pulse }) {
  const shared = mode === "shared";
  const Icon = shared ? Users : Laptop;
  return (
    <p
      key={pulse}
      role="status"
      className={cn(
        "inline-flex items-center gap-2.5 rounded-full pr-3 py-1 text-[18px] md:text-[15px]",
        shared ? "text-[#B4441A]" : "text-muted",
        pulse > 0 && "status-pulse"
      )}
    >
      <Icon className={cn("w-5 h-5", shared ? "text-accent" : "text-muted")} aria-hidden="true" />
      {shared ? STATUS.shared : STATUS.device}
    </p>
  );
}

export default function Editor() {
  const { doc, update, updateBlock } = useCurrentDoc();
  const ps = usePaperState();
  const reduce = useReducedMotion();
  const { saveNow, pdfNow, startShare } = useDocActions();
  const crossed = ps.crossing || ps.mode === "shared";
  const [shareLoaded, setShareLoaded] = useState(false);
  useEffect(() => {
    if (ps.crossing || ps.shareOpen) setShareLoaded(true);
  }, [ps.crossing, ps.shareOpen]);

  return (
    <section id="editor" aria-labelledby="editor-title" className="page-x max-w-[1600px] mx-auto pt-4 lg:pt-10 scroll-mt-20">
      <div className="ws-backdrop rounded-theme">
        <div className="editor-shell rounded-theme border border-line bg-bg overflow-hidden">
          <div className="grid lg:grid-cols-12">
            {/* On a phone the page comes first: the workspace is the document, the
                block list is the workshop behind it. */}
            <div className="lg:col-span-4 min-w-0 order-2 lg:order-1">
              <EditorControls />
            </div>
            <div className="lg:col-span-8 relative bg-surface border-b lg:border-b-0 lg:border-l border-line overflow-hidden order-1 lg:order-2">
              {/* The page presented as a workspace: what it is, what it is called,
                  one action, then the sheet itself. */}
              <div className="ws-head px-6 pt-6 md:px-8 md:pt-7">
                <p className="ws-label">DOCUMENT WORKSPACE</p>
                <p className="ws-sub mt-2">
                  {doc.title?.trim() || "Untitled page"} — editable template. Changes stay in this browser until
                  printed or saved as PDF.
                </p>
                <button type="button" className="ws-print" onClick={() => pdfNow()}>
                  <Printer className="w-[18px] h-[18px]" aria-hidden="true" />
                  Print Document / Save as PDF
                </button>
              </div>
              <div className="ws-divider" />
              <div className="ws-deck px-3 sm:px-6 pb-8 pt-6 md:p-8 overflow-hidden">
              <div
                aria-hidden="true"
                className={cn(
                  "absolute top-5 bottom-5 left-5 md:top-8 md:bottom-8 md:left-8 w-[2px] bg-accent transition-opacity duration-150",
                  crossed ? "opacity-100" : "opacity-0"
                )}
              />
              <motion.div
                className="lg:sticky lg:top-24 w-full md:w-[calc(100%-2rem)] lg:w-[calc(100%-3rem)] max-w-[600px] mx-auto"
                animate={{ x: crossed ? 32 : 0 }}
                transition={reduce ? { duration: 0 } : { duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <DocPreview doc={doc} onEdit={updateBlock} onTitle={(title) => update({ title })} />
                {doc.category === "Demand letters" && (
                  <p className="mt-3 t-meta text-muted">{LEGAL_NOTE_DEMAND}</p>
                )}
              </motion.div>
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="md:border-t border-line md:px-6 md:py-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-0 md:gap-4">
              <div className="px-7 py-6 md:p-0 border-b border-line md:border-0">
                <Status mode={ps.mode} pulse={ps.pulse} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 md:flex md:flex-wrap items-center gap-3 px-7 py-6 md:p-0">
                <Button variant="outline" size="sm" className="md:h-10 px-4" onClick={saveNow}>Save to this device</Button>
                <Button size="sm" className="md:h-10 px-4" onClick={startShare}>Share with community</Button>
                <Button variant="outline" size="sm" className="md:h-10 px-4" onClick={() => pdfNow()}>Download the page</Button>
              </div>
            </div>
            {ps.pdfError && (
              <div role="alert" className="px-6 pb-6 md:p-0 md:mt-4 flex flex-wrap items-center gap-3 text-[15px] text-ink">
                <AlertCircle className="w-5 h-5 text-[#B42318]" aria-hidden="true" />
                <span>{PDF_FAIL}</span>
                <button type="button" onClick={() => pdfNow()} className="font-semibold text-primary ui-link min-h-11 md:min-h-0">
                  Try again
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {shareLoaded && (
        <Suspense fallback={null}>
          <SharePanel />
        </Suspense>
      )}
    </section>
  );
}
