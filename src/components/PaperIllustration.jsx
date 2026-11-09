import { cn } from "@wron/kit";
import { docLines } from "./templateStore";

// Static CSS paper: the fallback when WebGL is unavailable and the reduced-motion version.
// Pass doc to show the visitor's live content; without it, neutral rules and brackets.
export default function PaperIllustration({ doc, status = "device", flat = false, className }) {
  const lines = doc ? docLines(doc).slice(0, 14) : null;
  return (
    <div className={cn("relative flex items-center justify-center", className)} aria-hidden="true">
      <div
        className={cn(
          "relative bg-white w-[62%] max-w-[340px] aspect-[8.5/11] rounded-[4px] border border-line",
          "shadow-[0_30px_60px_-25px_rgba(60,40,160,0.35),0_8px_20px_-10px_rgba(20,16,38,0.15)]",
          !flat && "rotate-[8deg] skew-y-[-2deg]",
          status === "shared" ? "border-l-[3px] border-l-accent" : "border-l-[3px] border-l-primary"
        )}
      >
        {!flat && (
          <span className="absolute top-0 right-0 w-[18%] aspect-square bg-gradient-to-bl from-[#ECE8FA] to-white rounded-bl-[6px] shadow-[-3px_3px_6px_rgba(20,16,38,0.08)]" />
        )}
        <div className="p-[9%] space-y-[6%] text-ink">
          {lines && lines.length ? (
            lines.map((l, i) =>
              l.kind === "blank" ? (
                <div key={i} className="h-2" />
              ) : (
                <p
                  key={i}
                  className={cn(
                    "truncate leading-tight",
                    l.kind === "title" ? "text-[clamp(11px,1.3vw,17px)] font-semibold" : "text-[clamp(8px,0.8vw,11px)]",
                    l.kind === "field" && !l.filled && "text-primary/70"
                  )}
                >
                  {l.text}
                </p>
              )
            )
          ) : (
            <>
              <p className="text-[clamp(11px,1.3vw,17px)] font-semibold">Document title</p>
              <div className="h-px bg-line" />
              <p className="text-[clamp(8px,0.8vw,11px)] text-muted">[ Your name ]</p>
              <p className="text-[clamp(8px,0.8vw,11px)] text-muted">[ Date ]</p>
              <div className="h-px bg-primary/40" />
              <p className="text-[clamp(8px,0.8vw,11px)] text-primary/80">[ Section title ]</p>
              <div className="space-y-[7%] pt-1">
                {[100, 92, 96, 70].map((w, i) => (
                  <div key={i} className="h-px bg-primary/30" style={{ width: `${w}%` }} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
