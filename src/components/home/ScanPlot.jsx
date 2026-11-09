import { Img, cn } from "@wron/kit";

// The scan with numbered points on it. Click or tap the scan to drop a point where a blank or a heading sits.
export default function ScanPlot({ img, items, selected, onPlace, onSelect }) {
  const place = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (!r.width || !r.height) return;
    onPlace((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  };
  return (
    <div>
      <div className="relative max-w-[560px] border border-line bg-white rounded-[6px] overflow-hidden">
        <Img src={img.src} alt="Your scan of the form" ratio={`${img.width}/${img.height}`} imgClassName="object-contain" />
        <div onClick={place} className="absolute inset-0" aria-hidden="true" />
        {items.map((it, i) =>
          it.x == null || it.y == null ? null : (
            <button
              key={it.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(it.id);
              }}
              aria-label={`Point ${i + 1}: ${it.label || "no name yet"}`}
              style={{ left: `${it.x * 100}%`, top: `${it.y * 100}%` }}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full border text-[13px] font-semibold tabular-nums",
                "before:absolute before:-inset-2 before:content-['']",
                "transition-colors duration-150 active:scale-[0.98]",
                it.id === selected
                  ? "bg-primary border-primary text-primary-ink shadow-[0_0_0_3px_rgba(91,61,245,0.25)]"
                  : "bg-white border-primary text-primary hover:bg-surface"
              )}
            >
              {i + 1}
            </button>
          )
        )}
      </div>
      <p className="mt-2 t-meta text-muted">Click the scan to add a point. Select a number to rename it.</p>
    </div>
  );
}
