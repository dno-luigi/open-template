import { Trash2, ChevronDown } from "lucide-react";
import { cn } from "@wron/kit";
import { KINDS, KIND_LABEL } from "../recreate";

const control =
  "h-11 rounded-[6px] border border-line bg-bg px-3 text-[15px] text-ink transition-colors duration-150 " +
  "hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export default function PointList({ items, selected, onSelect, onChange, onRemove }) {
  return (
    <ol className="space-y-2" aria-label="Points on the form">
      {items.map((it, i) => (
        <li
          key={it.id}
          onFocusCapture={() => onSelect(it.id)}
          className={cn(
            "grid grid-cols-[28px_minmax(0,1fr)_44px] sm:grid-cols-[28px_minmax(0,1fr)_170px_44px] items-center gap-x-2 gap-y-2 rounded-[6px] border p-2 transition-colors duration-150",
            it.id === selected ? "border-primary/60 bg-surface" : "border-line bg-bg"
          )}
        >
          <span className="w-7 h-7 rounded-full bg-surface border border-line text-[13px] font-semibold text-primary tabular-nums inline-flex items-center justify-center">
            {i + 1}
          </span>
          {it.kind === "rule" ? (
            <span className="text-[15px] text-muted px-1">A thin line across the page</span>
          ) : (
            <input
              id={`pt-${it.id}`}
              value={it.label}
              maxLength={200}
              aria-label={`Name of point ${i + 1}`}
              autoComplete="off"
              onChange={(e) => onChange(it.id, { label: e.target.value })}
              className={cn(control, "w-full min-w-0")}
            />
          )}
          <div className="relative col-span-3 col-start-1 sm:col-span-1 sm:col-start-auto order-last sm:order-none">
            <select
              value={it.kind}
              aria-label={`Type of point ${i + 1}`}
              onChange={(e) => onChange(it.id, { kind: e.target.value })}
              className={cn(control, "w-full appearance-none pr-9")}
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>{KIND_LABEL[k]}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" aria-hidden="true" />
          </div>
          <button
            type="button"
            onClick={() => onRemove(it.id)}
            aria-label={`Remove point ${i + 1}`}
            className="inline-flex items-center justify-center w-11 h-11 rounded-[6px] text-muted hover:text-primary hover:bg-surface transition-colors duration-150 active:translate-y-px"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </li>
      ))}
    </ol>
  );
}
