import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Laptop, Users, AlertCircle } from "lucide-react";
import { Reveal, cn } from "@wron/kit";
import { useCurrentDoc } from "../templateStore";
import { addMarkdownFiles } from "../markdownIntake";
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
        shared ? "text-[#9B2C1F]" : "text-muted",
        pulse > 0 && "status-pulse"
      )}
    >
      <Icon className={cn("w-5 h-5", shared ? "text-accent" : "text-muted")} aria-hidden="true" />
      {shared ? STATUS.shared : STATUS.device}
    </p>
  );
}

export default function Editor() {
  const { doc, setDoc } = useCurrentDoc();
  const ps = usePaperState();
  const reduce = useReducedMotion();
  const { saveNow, pdfNow, startShare } = useDocActions();
  const crossed = ps.crossing || ps.mode === "shared";
  const [shareLoaded, setShareLoaded] = useState(false);
  useEffect(() => {
    if (ps.crossing || ps.shareOpen) setShareLoaded(true);
  }, [ps.crossing, ps.shareOpen]);

  // Dropping Markdown anywhere on the editor appends it to the open template.
  // A counter rather than a flag: dragging over a child fires leave on the parent.
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const carriesFiles = (e) => Array.from(e.dataTransfer?.types || []).includes("Files");
  const onDragEnter = (e) => {
    if (!carriesFiles(e)) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  };
  const onDragOver = (e) => {
    if (!carriesFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };
  const onDragLeave = (e) => {
    if (!carriesFiles(e)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };
  const onDrop = (e) => {
    if (!carriesFiles(e)) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    addMarkdownFiles(e.dataTransfer.files, setDoc);
  };

  return (
    <section id="editor" aria-labelledby="editor-title" className="page-x max-w-[1200px] mx-auto pt-4 lg:pt-10 scroll-mt-20">
      <Reveal y={12}>
        <div
          className="relative rounded-[20px] border border-line bg-bg overflow-hidden"
          onDragEnter={onDragEnter}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          {dragging && (
            <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-bg/85 backdrop-blur-[2px]">
              <div className="rounded-[18px] border-2 border-dashed border-primary/60 px-8 py-10 text-center">
                <p className="text-[20px] font-semibold text-ink">Drop Markdown files</p>
                <p className="t-meta text-muted mt-2">
                  .md or .txt, up to 500 KB each. Headings, lists and [[Field]] lines map onto the page.
                </p>
              </div>
            </div>
          )}
          <div className="grid lg:grid-cols-12">
            <div className="lg:col-span-4 min-w-0">
              <EditorControls />
            </div>
            <div className="lg:col-span-8 relative bg-surface border-t lg:border-t-0 lg:border-l border-line px-7 py-8 md:p-10 overflow-hidden">
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

          {/* Toolbar */}
          <div className="md:border-t border-line md:px-6 md:py-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-0 md:gap-4">
              <div className="px-7 py-6 md:p-0 border-b border-line md:border-0">
                <Status mode={ps.mode} pulse={ps.pulse} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 md:flex md:flex-wrap items-center gap-3 px-7 py-6 md:p-0">
                <Button variant="outline" size="sm" className="md:h-10 px-4" onClick={saveNow}>Save to this device</Button>
                <Button size="sm" className="md:h-10 px-4" onClick={startShare}>Share with community</Button>
                <Button variant="outline" size="sm" className="md:h-10 px-4" onClick={() => pdfNow()}>Download PDF</Button>
              </div>
            </div>
            {ps.pdfError && (
              <div role="alert" className="px-6 pb-6 md:p-0 md:mt-4 flex flex-wrap items-center gap-3 text-[15px] text-ink">
                <AlertCircle className="w-5 h-5 text-[#9B2C1F]" aria-hidden="true" />
                <span>{PDF_FAIL}</span>
                <button type="button" onClick={() => pdfNow()} className="font-semibold text-primary ui-link min-h-11 md:min-h-0">
                  Try again
                </button>
              </div>
            )}
          </div>
        </div>
      </Reveal>
      {shareLoaded && (
        <Suspense fallback={null}>
          <SharePanel />
        </Suspense>
      )}
    </section>
  );
}
