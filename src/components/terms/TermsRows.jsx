import { cn } from "@wron/kit";
import { LEGAL_NOTE_DEMAND } from "../../data/site";

const ROWS = [
  { title: "Using the tool", body: "Forms lets people create, save, copy and share document templates." },
  { title: "Community sharing", body: "Shared templates are available for others to copy into the editor. Remove personal details before sharing." },
  { title: "Demand letters", body: LEGAL_NOTE_DEMAND, note: true },
  { title: "Reports", body: "Report a community template from its Community list action." },
];

export default function TermsRows() {
  return (
    <div className="w-full">
      {ROWS.map((r) => (
        <section
          key={r.title}
          className={cn(
            "w-full border-b border-line",
            r.note && "bg-surface bg-[radial-gradient(circle_at_14%_50%,rgba(255,255,255,.95),transparent_34%)] shadow-[inset_6px_0_0_0_#0F6B4F]"
          )}
        >
          <div className="page-x max-w-[1600px] mx-auto w-full py-10 md:py-14">
            <div>
              <h2 className="t-section text-ink">{r.title}</h2>
              <p className="mt-4 max-w-[360px] text-lg leading-7 text-muted">{r.body}</p>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
