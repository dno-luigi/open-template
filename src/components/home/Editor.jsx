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
  const { doc } = useCurrentDoc();
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
      <div>
        <div className="rounded-theme border border-line bg-bg">
          <div className="grid lg:grid-cols-12">
            {/* On a phone the page comes first: the workspace is the document, the
                block list is the workshop behind it. */}
            <div className="lg:col-span-4 min-w-0 order-2 lg:order-1">
              <EditorControls />
            </div>
            <div className="lg:col-span-8 relative bg-surface border-b lg:border-b-0 lg:border-l border-line overflow-hidden order-1 lg:order-2">
              {/* The page presented as a workspace: what it is, what it is called,
                  one action, then the sheet itself. */}
              <div className="px-7 pt-7 md:px-10 md:pt-9">
                <p className="text-[11px] md:text-[12px] font-semibold tracking-[0.22em] text-primary">
                  DOCUMENT WORKSPACE
                </p>
                <h3 className="mt-2 font-serif text-[25px] md:text-[30px] leading-[1.15] text-ink break-words">
                  {doc.title?.trim() || "Untitled page"}
                </h3>
                <p className="mt-1.5 text-[14px] md:text-[15px] text-muted">
                  Editable — changes stay in this browser until you print or save it.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button
                    size="sm"
                    className="!bg-accent !text-ink !border-accent hover:!bg-[#D9A600] hover:!border-[#D9A600]"
                    onClick={() => pdfNow()}
                  >
                    <Printer className="w-4 h-4" aria-hidden="true" />
                    Print / Save as PDF
                  </Button>
                </div>
              </div>
              <div className="px-7 pb-8 pt-6 md:p-10 overflow-hidden">
              <div
                aria-hidden="true"
                className={cn(
                  "absolute top-5 bottom-5 left-5 md:top-8 md:bottom-8 md:left-8 w-[2px] bg-accent transition-opacity duration-150",
                  crossed ? "opacity-100" : "opacity-0"
                )}
              />
              <motion.div
                className="lg:sticky lg:top-24 w-[calc(100%-1rem)] md:w-[calc(100%-2rem)] lg:w-[calc(100%-3rem)] max-w-[600px] mx-auto"
                animate={{ x: crossed ? 32 : 0 }}
                transition={reduce ? { duration: 0 } : { duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <DocPreview doc={doc} />
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
