import { Img, cn } from "@wron/kit";
import { docLines, isEmptyDoc } from "../templateStore";

// The live page: US Letter proportions, real margins, Times or Helvetica.
// Sizes scale with the page's own width, so 11pt text stays 11pt relative to the sheet.
//
// Pass `onEdit(blockId, patch)` and the page becomes the editor: you click a line
// on the document and type into it, the way you would on the paper you print.
export default function DocPreview({ doc, thumb = false, onEdit, onTitle }) {
  const empty = isEmptyDoc(doc);
  const lines = docLines(doc);
  const live = !thumb && typeof onEdit === "function";
  const margin = Number(doc.margin) || 1;
  const pad = `${(margin / 8.5) * 100}cqw`;
  const region = thumb ? {} : { role: "region", "aria-label": "Document preview" };

  const read = (e) =>
    e.currentTarget.textContent.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/^\n+|\n+$/g, "");
  const onKey = (e) => {
    if (e.key === "Escape") e.currentTarget.blur();
  };

  return (
    <div className={cn("sheet-wrap", thumb && "is-thumb")} {...region}>
      <div
        className={cn("sheet", doc.font === "sans" ? "sheet-sans" : "sheet-serif", live && "is-live")}
        style={{ padding: pad }}
      >
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

            if (l.kind === "field") {
              const commitValue = (e) => {
                const v = read(e);
                if (v !== (l.filled ? l.text : "")) onEdit(l.blockId, { value: v });
              };
              const commitLabel = (e) => {
                const v = read(e).trim();
                if (v && v !== (l.label || "Field")) onEdit(l.blockId, { label: v });
              };
              return (
                <div key={i} className="sl-field" style={{ textAlign: l.align || "left" }}>
                  {!l.filled && (
                    <span
                      className={cn("sl-field-label", live && "sl-edit")}
                      contentEditable={live}
                      suppressContentEditableWarning
                      spellCheck={false}
                      onBlur={live ? commitLabel : undefined}
                      onKeyDown={live ? onKey : undefined}
                    >
                      {l.label || "Field"}
                    </span>
                  )}
                  <span
                    className={cn("sl-field-value", !l.filled && "is-empty", live && "sl-edit")}
                    data-ph={l.label || "Field"}
                    contentEditable={live}
                    suppressContentEditableWarning
                    spellCheck={false}
                    onBlur={live ? commitValue : undefined}
                    onKeyDown={live ? onKey : undefined}
                  >
                    {l.filled ? l.text : ""}
                  </span>
                </div>
              );
            }

            if (l.kind === "title") {
              const commitTitle = (e) => {
                const v = read(e).trim();
                if (v && v !== doc.title && typeof onTitle === "function") onTitle(v);
              };
              return (
                <p
                  key={i}
                  className={cn("sl sl-name", live && "sl-edit")}
                  contentEditable={live}
                  suppressContentEditableWarning
                  spellCheck={live}
                  onBlur={live ? commitTitle : undefined}
                  onKeyDown={live ? onKey : undefined}
                >
                  {l.text}
                </p>
              );
            }

            const commit = (e) => {
              const text = e.currentTarget.textContent.replace(/\u00a0/g, " ");
              const block = (doc.blocks || []).find((b) => b.id === l.blockId);
              if (!block) return;
              const parts = String(block.text || "").split("\n");
              if (parts[l.part] === text) return;
              parts[l.part] = text;
              onEdit(l.blockId, { text: parts.join("\n") });
            };
            return (
              <p
                key={i}
                className={cn("sl", `sl-${l.variant || "body"}`, live && "sl-edit")}
                style={{ textAlign: l.align || "left" }}
                contentEditable={live}
                suppressContentEditableWarning
                spellCheck={live}
                onBlur={live ? commit : undefined}
                onKeyDown={live ? onKey : undefined}
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
