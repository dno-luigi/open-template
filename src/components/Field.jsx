import { useId } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@wron/kit";

const control =
  "w-full rounded-[6px] border border-line bg-bg px-3.5 text-[16px] text-ink placeholder:text-muted/80 " +
  "transition-colors duration-150 hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

function Label({ htmlFor, children, hint }) {
  return (
    <label htmlFor={htmlFor} className="flex items-baseline justify-between gap-2 mb-2 md:mb-1.5 text-[16px] md:text-[14px] font-medium text-ink">
      <span>{children}</span>
      {hint && <span className="t-meta text-muted font-normal">{hint}</span>}
    </label>
  );
}

export function TextField({ label, hint, className, inputClassName, id, ...rest }) {
  const auto = useId();
  const fid = id || auto;
  return (
    <div className={className}>
      <Label htmlFor={fid} hint={hint}>{label}</Label>
      <input id={fid} className={cn(control, "h-14 md:h-11", inputClassName)} {...rest} />
    </div>
  );
}

export function TextArea({ label, hint, className, inputClassName, id, rows = 5, ...rest }) {
  const auto = useId();
  const fid = id || auto;
  return (
    <div className={className}>
      <Label htmlFor={fid} hint={hint}>{label}</Label>
      <textarea id={fid} rows={rows} className={cn(control, "py-2.5 leading-[1.5] resize-y", inputClassName)} {...rest} />
    </div>
  );
}

// options: array of strings or { value, label }
export function SelectField({ label, hint, className, id, options = [], placeholder, ...rest }) {
  const auto = useId();
  const fid = id || auto;
  return (
    <div className={className}>
      <Label htmlFor={fid} hint={hint}>{label}</Label>
      <div className="relative">
        <select id={fid} className={cn(control, "h-14 md:h-11 appearance-none pr-10")} {...rest}>
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => {
            const v = typeof o === "string" ? o : o.value;
            const l = typeof o === "string" ? o : o.label;
            return <option key={v} value={v}>{l}</option>;
          })}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" aria-hidden="true" />
      </div>
    </div>
  );
}

export function Checkbox({ label, className, id, ...rest }) {
  const auto = useId();
  const fid = id || auto;
  return (
    <label htmlFor={fid} className={cn("flex items-start gap-3 min-h-[44px] py-2 cursor-pointer text-[15px] text-ink", className)}>
      <input id={fid} type="checkbox" className="mt-0.5 w-5 h-5 shrink-0 accent-[#0F6B4F]" {...rest} />
      <span>{label}</span>
    </label>
  );
}
