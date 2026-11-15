import { scrollToSection } from "@wron/kit";
import { PRIVACY_LINE } from "../../data/site";
import HeroScene from "./HeroScene";

const btn =
  "inline-flex items-center justify-center min-h-12 px-6 rounded-theme text-[15px] font-medium text-center leading-none " +
  "transition-colors duration-150 active:translate-y-px";

export default function Hero() {
  return (
    <section id="hero" className="relative border-b border-line overflow-hidden scroll-mt-16 md:scroll-mt-[72px]">
      <div className="page-x max-w-[1200px] mx-auto">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-center py-12 md:py-16 lg:py-20">
          <div className="lg:col-span-5 relative z-10">
            <p className="eyebrow text-muted">California forms, filled in</p>
            <h1 className="t-hero text-ink mt-3 max-w-[15ch]">
              Turn any form into a template
            </h1>
            <p className="mt-5 text-[18px] md:text-[19px] leading-[1.55] text-muted max-w-[38ch]">{PRIVACY_LINE}</p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 max-w-[560px]">
              <button
                type="button"
                onClick={() => scrollToSection("recreate")}
                className={`${btn} bg-primary text-primary-ink hover:bg-primary-dark`}
              >
                Recreate a form
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("community")}
                className={`${btn} border border-line bg-transparent text-ink hover:border-primary hover:text-primary`}
              >
                Browse community templates
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 min-w-0">
            <div className="relative aspect-[16/10] sm:aspect-[16/9] lg:aspect-[5/4] rounded-theme border border-line bg-surface overflow-hidden">
              <HeroScene />
              <div className="pointer-events-none absolute inset-x-4 bottom-3 z-10 flex items-center justify-between font-mono text-[10px] tracking-[0.02em] text-muted">
                <span>8.5 by 11 in.</span>
                <span>Live preview</span>
              </div>
              <span className="sr-only">
                A letter on US Letter paper with a name and address at the top, a recipient block, body text and a signature line.
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
