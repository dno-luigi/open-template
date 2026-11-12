import { forwardRef } from "react";
import { Link } from "react-router";
import { cn } from "@wron/kit";

// Buttons: violet primary, violet outline, quiet ghost, and danger for delete.
// 150ms fill/border change, press down by 1px.
const VARIANTS = {
  primary: "bg-primary text-primary-ink border border-primary hover:bg-[#0B5540] hover:border-[#0B5540]",
  outline: "bg-bg text-primary border border-primary/60 hover:border-primary hover:bg-surface",
  ghost: "bg-transparent text-ink border border-transparent hover:bg-surface",
  soft: "bg-surface text-ink border border-line hover:border-primary/40",
  danger: "bg-[#B42318] text-white border border-[#B42318] hover:bg-[#912018]",
};
const SIZES = {
  sm: "h-11 md:h-9 px-3.5 text-[14px] font-semibold",
  md: "h-12 px-5 t-btn",
  lg: "h-12 md:h-[50px] px-6 t-btn",
};

const Button = forwardRef(function Button(
  { variant = "primary", size = "md", to, href, className, children, type = "button", ...rest },
  ref
) {
  const cls = cn(
    "inline-flex items-center justify-center gap-2 rounded-[6px] whitespace-nowrap select-none",
    "transition-colors duration-150 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none",
    VARIANTS[variant],
    SIZES[size],
    className
  );
  if (to) return <Link ref={ref} to={to} className={cls} {...rest}>{children}</Link>;
  if (href) return <a ref={ref} href={href} className={cls} {...rest}>{children}</a>;
  return <button ref={ref} type={type} className={cls} {...rest}>{children}</button>;
});

export default Button;
