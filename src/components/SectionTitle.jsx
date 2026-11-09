import { cn } from "@wron/kit";

// Section heading: 38px desktop / 29px mobile, optional one short line under it.
export default function SectionTitle({ title, line, as: Tag = "h2", id, className, children }) {
  return (
    <div className={cn("max-w-[34ch]", className)}>
      <Tag id={id} className="t-section text-ink">{title}</Tag>
      {line && <p className="mt-3 text-[16px] text-muted">{line}</p>}
      {children}
    </div>
  );
}
