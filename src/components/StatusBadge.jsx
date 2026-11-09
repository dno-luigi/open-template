import { Laptop, Users } from "lucide-react";
import { cn } from "@wron/kit";
import { STATUS } from "../data/site";

// Privacy label: "On this device only" (violet) or "Shared with community" (coral edge).
// Pass pulse={n} (a changing number) to play the one violet pulse after a local save.
export default function StatusBadge({ status = "device", pulse, className }) {
  const shared = status === "shared";
  const Icon = shared ? Users : Laptop;
  return (
    <span
      key={pulse}
      className={cn(
        "inline-flex items-center gap-2 t-meta text-ink rounded-full",
        pulse ? "status-pulse" : "",
        className
      )}
    >
      <Icon className={cn("w-[18px] h-[18px]", shared ? "text-[#C2410C]" : "text-primary")} aria-hidden="true" />
      {shared ? STATUS.shared : STATUS.device}
    </span>
  );
}
