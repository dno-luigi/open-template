import { useEffect, useMemo, useRef, useState } from "react";
import { Search, AlertCircle, X } from "lucide-react";
import { Reveal, useTable, scrollToSection, cn } from "@wron/kit";
import { useLastFilter } from "../templateStore";
import { categoryChips, authorName } from "../community";
import { TABLES, ALL_CATEGORIES } from "../../data/site";
import CommunityTable from "./CommunityTable";
import { focusTitle } from "./actions";

const sortKey = (r) => String(r.shared_on || r.created_at || "");

export default function Community() {
  const { rows, loading, error, reload } = useTable(TABLES.community, { orderBy: "created_at", desc: true, limit: 200 });
  const [filter, setFilter] = useLastFilter();
  const [q, setQ] = useState("");
  const all = useMemo(() => [...(rows || [])].sort((a, b) => sortKey(b).localeCompare(sortKey(a))), [rows]);
  const chips = categoryChips(all);
  const active = chips.includes(filter) ? filter : ALL_CATEGORIES;

  // Rows that change while the page is open get a brief lavender tint.
  const seen = useRef(null);
  const [fresh, setFresh] = useState(() => new Set());
  useEffect(() => {
    if (!rows) return;
    const sig = new Map(rows.map((r) => [String(r.id), `${r.updated_at || ""}|${r.uses ?? ""}`]));
    if (seen.current) {
      const changed = new Set();
      sig.forEach((v, k) => { if (seen.current.get(k) !== v) changed.add(k); });
      if (changed.size) setFresh(changed);
    }
    seen.current = sig;
  }, [rows]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter(
      (r) =>
        (active === ALL_CATEGORIES || r.category === active) &&
        (!needle || `${r.title || ""} ${r.category || ""} ${authorName(r)}`.toLowerCase().includes(needle))
    );
  }, [all, active, q]);

  const shareFirst = () => {
    scrollToSection("editor");
    focusTitle();
  };
  const clear = () => { setQ(""); setFilter(ALL_CATEGORIES); };

  const message = (text, action, onAction) => (
    <div className="py-14 md:py-20 px-6 text-center">
      <p className="text-[15px] text-muted">{text}</p>
      {action && (
        <button type="button" onClick={onAction} className="mt-2 min-h-11 md:min-h-0 text-[15px] font-semibold text-primary ui-link">
          {action}
        </button>
      )}
    </div>
  );

  let state = null;
  if (loading && all.length === 0) {
    state = (
      <div className="px-5 py-6" role="status">
        <p className="text-[15px] text-muted mb-4">Loading community templates...</p>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 mb-2 rounded-[4px] bg-surface animate-pulse" />
        ))}
      </div>
    );
  } else if (error && all.length === 0) {
    state = (
      <div className="py-14 md:py-20 px-6 text-center" role="alert">
        <p className="inline-flex items-start gap-2 text-[15px] text-ink">
          <AlertCircle className="w-5 h-5 text-[#B42318] shrink-0" aria-hidden="true" />
          The community cannot load right now. Your device templates still work.
        </p>
        <div className="mt-4">
          <button
            type="button"
            onClick={reload}
            className="h-11 px-5 rounded-[6px] border border-primary/60 text-primary t-btn hover:border-primary hover:bg-surface transition-colors duration-150 active:translate-y-px"
          >
            Retry
          </button>
        </div>
      </div>
    );
  } else if (all.length === 0) {
    state = message("Nothing has been shared yet.", "Share the first template.", shareFirst);
  } else if (list.length === 0) {
    state = q.trim()
      ? message("No templates match this search.", "Clear filters", clear)
      : message(`Nothing has been shared in ${active} yet.`, "Share the first template.", shareFirst);
  }

  return (
    <section id="community" aria-labelledby="community-title" className="bg-surface border-y border-line scroll-mt-24">
      <div className="page-x max-w-[1600px] mx-auto py-16 md:py-24">
        <Reveal y={12}>
          <h2 id="community-title" className="t-section text-ink">Community templates</h2>
          <p className="mt-3 text-[16px] md:text-[18px] text-muted">Copy a template, fill it in and save it your way.</p>
        </Reveal>

        <div className="mt-8 md:mt-10">
          <label htmlFor="community-search" className="sr-only">Search community templates</label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted pointer-events-none" aria-hidden="true" />
            <input
              id="community-search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search community templates"
              className="w-full h-12 md:h-[52px] pl-12 pr-12 rounded-[6px] border border-line bg-bg text-[16px] text-ink placeholder:text-muted transition-colors duration-150 hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="Clear search"
                className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 inline-flex items-center justify-center text-muted hover:text-primary"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2.5" role="group" aria-label="Filter by category">
            {chips.map((c) => {
              const on = c === active;
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFilter(c)}
                  className={cn(
                    "h-11 px-5 rounded-full border text-[15px] transition-colors duration-150 active:translate-y-px",
                    on ? "bg-primary border-primary text-primary-ink font-semibold" : "bg-bg border-line text-ink hover:border-primary/50"
                  )}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        {error && all.length > 0 && (
          <p role="alert" className="mt-6 flex flex-wrap items-center gap-2 text-[15px] text-ink">
            <AlertCircle className="w-4 h-4 text-[#B42318]" aria-hidden="true" />
            The community list could not refresh.
            <button type="button" onClick={reload} className="font-semibold text-primary ui-link min-h-11 md:min-h-0">Retry</button>
          </p>
        )}

        <div className="mt-8">
          <CommunityTable rows={state ? [] : list} state={state} fresh={fresh} />
        </div>
      </div>
    </section>
  );
}
