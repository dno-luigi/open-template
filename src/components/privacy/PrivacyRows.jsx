import { SITE } from "../../data/site";

const ROWS = [
  { h: "On this device", t: "Saved templates, pictures you add, drafts, the last category filter and the last save choice stay on this device." },
  { h: "When you share", t: "Sharing is optional. A shared template includes its title, category, text and optional name. Pictures are never shared. Remove personal details first." },
  { h: "Scans and descriptions", t: "A picture or description you add to recreate a form stays in this browser. It is sent to an AI service only when you press Detect with AI or Draft with AI, so it can be read. It is never shared with the community." },
  { h: "Community", t: "No account is required to share. Community templates can be reported." },
  { h: "Contact", phone: true },
];

export default function PrivacyRows() {
  return (
    <div className="mt-14 md:mt-24 w-full border-t border-line">
      {ROWS.map((r) => (
        <section key={r.h} className="grid grid-cols-1 md:grid-cols-[320px_minmax(0,1fr)] gap-5 md:gap-16 py-10 border-b border-line">
          <h2 className="t-section text-ink text-[28px] leading-tight md:text-[42px] md:leading-none">{r.h}</h2>
          {r.phone ? (
            <a href={SITE.phoneHref} className="text-[16px] md:text-[18px] text-muted hover:text-primary ui-link tabular-nums inline-flex items-center min-h-[44px] md:min-h-0 self-start">
              {SITE.phone}
            </a>
          ) : (
            <p className="text-lg leading-7 text-muted max-w-xl">{r.t}</p>
          )}
        </section>
      ))}
    </div>
  );
}
