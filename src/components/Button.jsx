import { forwardRef } from "react";
import { Link } from "react-router";
import { cn } from "@wron/kit";

// Buttons: deep green primary, fine-line outline, quiet ghost, and danger for delete.
// 150ms fill/border change, press down by 1px.
const VARIANTS = {
  primary: "bg-primary text-primary-ink border border-transparent hover:bg-primary-dark",
  outline: "bg-transparent text-ink border border-line hover:border-primary hover:text-primary",
  ghost: "bg-transparent text-ink border border-transparent hover:bg-surface",
  soft: "bg-surface text-ink border border-transparent hover:border-primary/25",
  danger: "bg-danger text-white border border-transparent hover:bg-[#7F241A]",
};
const SIZES = {
  sm: "h-10 px-4 text-[13.5px] font-medium",
  md: "h-11 px-5 text-[14.5px] font-medium",
  lg: "h-12 px-6 text-[15px] font-medium",
};

const Button = forwardRef(function Button(
  { variant = "primary", size = "md", to, href, className, children, type = "button", ...rest },
  ref
) {
  const cls = cn(
    "inline-flex items-center justify-center gap-2 rounded-theme whitespace-nowrap select-none",
    "transition-[background-color,border-color,color,transform] duration-150 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none",
    VARIANTS[variant],
    SIZES[size],
    className
  );
  if (to) return <Link ref={ref} to={to} className={cls} {...rest}>{children}</Link>;
  if (href) return <a ref={ref} href={href} className={cls} {...rest}>{children}</a>;
  return <button ref={ref} type={type} className={cls} {...rest}>{children}</button>;
});

export default Button;
