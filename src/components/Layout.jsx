import { useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router";
import { Menu, X, ShieldCheck } from "lucide-react";
import { Sheet, useDisclosure, scrollToSection, CookieSettingsLink } from "@wron/kit";
import SectionLink from "./SectionLink";
import { SITE, NAV, PRIVACY_SHORT } from "../data/site";

function Wordmark({ onClick }) {
  return (
    <Link
      to="/"
      onClick={onClick}
      aria-label={`${SITE.name}, home`}
      className="font-display text-[clamp(21px,6vw,26px)] md:text-[22px] font-semibold tracking-[-0.02em] text-ink leading-none"
    >
      {SITE.name}
    </Link>
  );
}

function Header() {
  const menu = useDisclosure();
  return (
    <>
    <header className="sticky top-0 inset-x-0 z-50 flex h-16 md:h-[72px] shrink-0 bg-white border-b border-line">
      <div className="page-x w-full h-full flex items-center justify-between gap-4 max-w-[1600px] mx-auto">
        <Wordmark />
        <nav aria-label="Sections" className="hidden md:flex items-center gap-4 lg:gap-8">
          {NAV.map((n) => (
            <SectionLink
              key={n.id}
              id={n.id}
              className="text-[15px] font-medium text-ink/80 hover:text-primary transition-colors duration-150 ui-link"
            >
              {n.label}
            </SectionLink>
          ))}
        </nav>
        <Link
          to="/privacy"
          className="hidden lg:inline-flex items-center gap-1.5 text-[15px] text-muted hover:text-primary transition-colors duration-150 ui-link"
        >
          Privacy first
        </Link>
        <button
          type="button"
          onClick={menu.onOpen}
          aria-label="Open menu"
          className="md:hidden inline-flex items-center justify-center w-11 h-11 -mr-2 rounded-theme text-ink hover:bg-surface active:translate-y-px transition-colors duration-150"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      <Sheet open={menu.open} onClose={menu.onClose} side="right" panelClassName="bg-bg w-[86vw] max-w-sm">
        <div className="flex flex-col h-full p-5">
          <div className="flex items-center justify-between h-[52px]">
            <span className="font-semibold text-ink">Menu</span>
            <button
              type="button"
              onClick={menu.onClose}
              aria-label="Close menu"
              className="inline-flex items-center justify-center w-11 h-11 -mr-2 rounded-theme hover:bg-surface"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <nav aria-label="Sections" className="mt-4 flex flex-col border-t border-line">
            {NAV.map((n) => (
              <SectionLink
                key={n.id}
                id={n.id}
                onClick={menu.onClose}
                className="py-4 border-b border-line text-[18px] font-medium text-ink hover:text-primary"
              >
                {n.label}
              </SectionLink>
            ))}
            <Link to="/privacy" onClick={menu.onClose} className="py-4 border-b border-line text-[18px] font-medium text-ink hover:text-primary">
              Privacy
            </Link>
            <Link to="/terms" onClick={menu.onClose} className="py-4 border-b border-line text-[18px] font-medium text-ink hover:text-primary">
              Terms
            </Link>
          </nav>
          <p className="mt-auto flex items-start gap-2 text-[15px] text-muted">
            <ShieldCheck className="w-5 h-5 text-primary shrink-0" aria-hidden="true" />
            {PRIVACY_SHORT}
          </p>
        </div>
      </Sheet>
    </header>
    </>
  );
}

function Footer() {
  const link = "text-[15px] text-ink hover:text-primary ui-link inline-flex items-center min-h-[44px] md:min-h-0";
  return (
    <footer className="border-t border-line bg-bg">
      <div className="page-x max-w-[1600px] mx-auto py-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 lg:items-start gap-x-10 gap-y-3 lg:gap-y-4">
        <div>
          <p className="font-semibold text-[17px] tracking-[-0.01em] text-ink">{SITE.name}</p>
          <p className="text-[15px] text-muted mt-1 max-w-[34ch]">{PRIVACY_SHORT}</p>
        </div>
        <div className="flex flex-col lg:justify-self-center">
          <a href={SITE.url} className={link}>{SITE.domain}</a>
          <a href={SITE.phoneHref} className={`${link} tabular-nums`}>{SITE.phone}</a>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 sm:col-span-2 lg:col-span-1 lg:justify-self-end">
          <Link to="/privacy" className={link}>Privacy</Link>
          <Link to="/terms" className={link}>Terms</Link>
          <CookieSettingsLink className={link}>Cookie settings</CookieSettingsLink>
        </div>
      </div>
    </footer>
  );
}

export default function Layout() {
  const { pathname, hash } = useLocation();

  // A fresh page without a #section starts at the top, below the fixed header.
  useEffect(() => {
    if (hash) return;
    const toTop = () => {
      try {
        window.scrollTo(0, 0);
      } catch {
        /* ignore */
      }
    };
    toTop();
    const t = setTimeout(toTop, 60);
    return () => clearTimeout(t);
  }, [pathname, hash]);

  // Arriving at /#section from another page: scroll there once the page has rendered.
  useEffect(() => {
    if (!hash) return;
    const id = hash.slice(1);
    const t = setTimeout(() => scrollToSection(id), 80);
    return () => clearTimeout(t);
  }, [pathname, hash]);

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip flex flex-col bg-bg text-ink font-body">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-primary focus:text-primary-ink focus:px-4 focus:py-2 focus:rounded-theme">
        Skip to content
      </a>
      <Header />
      <div id="main" className="flex-1">
        <Outlet />
      </div>
      {pathname !== "/privacy" && pathname !== "/terms" && <Footer />}
    </div>
  );
}
