import { ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import { Img } from "@wron/kit";
import { TextField, TextArea, SelectField } from "../Field";

function IconBtn({ label, onClick, disabled, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center w-11 h-11 md:w-8 md:h-8 rounded-[6px] text-muted hover:text-primary hover:bg-surface transition-colors duration-150 active:translate-y-px disabled:opacity-30 disabled:pointer-events-none"
    >
      {children}
    </button>
  );
}

const STYLES = [
  { value: "body", label: "Body text" },
  { value: "bold", label: "Bold" },
  { value: "heading", label: "Section heading" },
  { value: "name", label: "Large name" },
];
const ALIGNS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

function StyleRow({ b, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <SelectField label="Style" value={b.variant || "body"} options={STYLES} onChange={(e) => onChange({ variant: e.target.value })} />
      <SelectField label="Align" value={b.align || "left"} options={ALIGNS} onChange={(e) => onChange({ align: e.target.value })} />
    </div>
  );
}

const KIND = { image: "Image", field: "Field", rule: "Divider line", text: "Text" };

export default function BlockEditor({ block: b, index: i, count, focusId, onMove, onRemove, onChange }) {
  return (
    <li className="rounded-[6px] border border-line bg-bg p-3">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="t-meta text-muted tabular-nums">
          {KIND[b.type] || "Text"} {i + 1}
        </span>
        <div className="flex items-center">
          <IconBtn label="Move up" onClick={() => onMove(-1)} disabled={i === 0}>
            <ArrowUp className="w-4 h-4" />
          </IconBtn>
          <IconBtn label="Move down" onClick={() => onMove(1)} disabled={i === count - 1}>
            <ArrowDown className="w-4 h-4" />
          </IconBtn>
          <IconBtn label="Remove" onClick={onRemove}>
            <Trash2 className="w-4 h-4" />
          </IconBtn>
        </div>
      </div>

      {b.type === "rule" ? (
        <p className="text-[14px] text-muted pb-1">A thin line across the page.</p>
      ) : b.type === "image" ? (
        <div className="grid gap-3">
          <Img
            src={b.src}
            alt={`Preview of ${b.name || "your picture"}`}
            ratio={b.width && b.height ? `${b.width}/${b.height}` : "4/3"}
            className="max-h-40 max-w-full rounded-[4px] border border-line bg-white overflow-hidden"
            imgClassName="object-contain"
            style={{ height: "10rem", width: "auto", maxWidth: "100%" }}
          />
          <SelectField
            label="Size on the page"
            hint="Not shared"
            value={String(b.pct || 60)}
            onChange={(e) => onChange({ pct: Number(e.target.value) })}
            options={[
              { value: "30", label: "Small" },
              { value: "60", label: "Medium" },
              { value: "80", label: "Large" },
              { value: "100", label: "Full width" },
            ]}
          />
        </div>
      ) : b.type === "field" ? (
        <div className="grid gap-3">
          <TextField
            label="Field name"
            value={b.label}
            maxLength={60}
            autoComplete="off"
            autoFocus={focusId === b.id}
            onFocus={(e) => focusId === b.id && e.target.select()}
            onChange={(e) => onChange({ label: e.target.value })}
          />
          <TextField
            label="Fill in"
            hint="Not shared"
            value={b.value}
            placeholder={b.label}
            onChange={(e) => onChange({ value: e.target.value })}
          />
          <StyleRow b={b} onChange={onChange} />
        </div>
      ) : (
        <div className="grid gap-3">
          <TextArea label="Text" rows={3} value={b.text} autoFocus={focusId === b.id} onChange={(e) => onChange({ text: e.target.value })} />
          <StyleRow b={b} onChange={onChange} />
        </div>
      )}
    </li>
  );
}
