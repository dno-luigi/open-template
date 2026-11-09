import { Link } from "react-router";
import { SITE } from "../../data/site";

export default function TermsFooter() {
  const link = "text-[15px] text-muted hover:text-primary ui-link inline-flex items-center min-h-[44px]";
  return (
    <div className="border-t border-line">
      <div className="page-x max-w-[1600px] mx-auto py-6 flex flex-wrap items-center justify-between gap-x-8 gap-y-1">
        <Link to="/" className={link}>Back to the editor</Link>
        <div className="flex flex-wrap gap-x-8 gap-y-1">
          <Link to="/privacy" className={link}>Privacy</Link>
          <a href={SITE.url} className={link}>{SITE.domain}</a>
          <a href={SITE.phoneHref} className={`${link} tabular-nums`}>{SITE.phone}</a>
        </div>
      </div>
    </div>
  );
}
