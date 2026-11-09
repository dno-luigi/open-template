import { Link } from "react-router";
import { SITE } from "../../data/site";
import SectionLink from "../SectionLink";

export default function PrivacyFooter() {
  const link = "text-[14px] text-muted hover:text-primary ui-link inline-flex items-center min-h-[44px]";
  return (
    <div className="mt-20 md:mt-28 pt-4 border-t border-line flex flex-wrap items-center justify-between gap-x-8 gap-y-1">
      <SectionLink id="editor" className={link}>Back to the editor</SectionLink>
      <div className="flex flex-wrap gap-x-8 gap-y-1">
        <Link to="/terms" className={link}>Terms</Link>
        <a href={SITE.url} className={link}>{SITE.domain}</a>
        <a href={SITE.phoneHref} className={`${link} tabular-nums`}>{SITE.phone}</a>
      </div>
    </div>
  );
}
