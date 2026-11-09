import { Img, cn } from "@wron/kit";
import { docLines, isEmptyDoc } from "../templateStore";

// The live page: US Letter proportions, real margins, Times or Helvetica.
// Sizes scale with the page's own width, so 11pt text stays 11pt relative to the sheet.
export default function DocPreview({ doc, thumb = false }) {
  const empty = isEmptyDoc(doc);
  const lines = docLines(doc);
  const margin = Number(doc.margin) || 1;
  const pad = `${(margin / 8.5) * 100}cqw`;
  const region = thumb ? {} : { role: "region", "aria-label": "Document preview" };

  return (
    <div className={cn("sheet-wrap", thumb && "is-thumb")} {...region}>
      <div className={cn("sheet", doc.font === "sans" ? "sheet-sans" : "sheet-serif")} style={{ padding: pad }}>
        {empty ? (
          <p className="sl-hint">Your page appears here. Pick a template, or add a title and some text.</p>
        ) : (
          lines.map((l, i) => {
            if (l.kind === "blank") return <div key={i} className="sl-blank" aria-hidden="true" />;
            if (l.kind === "rule") return <hr key={i} className="sl-rule" />;
            if (l.kind === "image")
              return (
                <Img
                  key={i}
                  src={l.src}
                  alt="Picture you added"
                  ratio={l.w && l.h ? `${l.w}/${l.h}` : "4/3"}
                  className="block max-w-full my-2"
                  style={{ width: `${l.pct}%` }}
                />
              );
            return (
              <p
                key={i}
                className={cn("sl", `sl-${l.variant || "body"}`, l.kind === "field" && !l.filled && "sl-empty")}
                style={{ textAlign: l.align || "left" }}
              >
                {l.text}
              </p>
            );
          })
        )}
      </div>
    </div>
  );
}
