import { Link } from "react-router";
import { cn } from "@wron/kit";
import { SITE } from "../data/site";

// Shared layout for /privacy and /terms: title on the left, ruled rows on the right.
// rows: [{ heading, body, note? }] where note=true gives the lavender, violet-ruled treatment.
export default function LegalReport({ title, lead, rows = [], otherLink }) {
  return (
    <>
      <section className="page-x max-w-[1600px] mx-auto pt-14 md:pt-20 pb-16 md:pb-24">
        <div className="page-grid gap-y-10">
          <div className="col-span-12 lg:col-span-4">
            <h1 className="t-page text-ink">{title}</h1>
            {lead && <p className="mt-5 text-[17px] text-muted max-w-[36ch]">{lead}</p>}
          </div>
          <div className="col-span-12 lg:col-start-5 lg:col-span-7 border-t border-ink/80">
            {rows.map((r) => (
              <div key={r.heading} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2 sm:gap-8 py-6 md:py-8 border-b border-line">
                <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">{r.heading}</h2>
                <div
                  className={cn(
                    "text-[16px] leading-[1.6] text-ink",
                    r.note && "bg-surface border-l-2 border-primary pl-4 pr-3 py-3 rounded-r-[6px]"
                  )}
                >
                  {r.body}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <nav aria-label="More links" className="border-t border-line">
        <div className="page-x max-w-[1600px] mx-auto py-6 flex flex-wrap gap-x-8 gap-y-2 text-[15px]">
          <Link to="/#editor" className="text-primary font-semibold ui-link min-h-[44px] inline-flex items-center">Back to the editor</Link>
          {otherLink && <Link to={otherLink.to} className="text-ink ui-link min-h-[44px] inline-flex items-center">{otherLink.label}</Link>}
          <a href={SITE.url} className="text-ink ui-link min-h-[44px] inline-flex items-center">{SITE.domain}</a>
          <a href={SITE.phoneHref} className="text-ink ui-link tabular-nums min-h-[44px] inline-flex items-center">{SITE.phone}</a>
        </div>
      </nav>
    </>
  );
}
