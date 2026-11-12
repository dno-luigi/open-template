import { scrollToSection } from "@wron/kit";
import { PRIVACY_LINE } from "../../data/site";
import HeroScene from "./HeroScene";

const btn =
  "inline-flex items-center justify-center min-h-14 md:min-h-12 px-4 py-2 rounded-[6px] border text-[17px] md:text-[15px] font-[650] text-center leading-[1.2] " +
  "transition-colors duration-150 active:translate-y-px";

export default function Hero() {
  return (
    <section id="hero" className="relative border-b border-line overflow-hidden scroll-mt-16 md:scroll-mt-[72px]">
      <div className="page-x max-w-[1600px] mx-auto">
        <div className="lg:grid lg:grid-cols-12 lg:gap-6 lg:min-h-[600px] lg:items-center">
          <div className="lg:col-span-5 pt-10 pb-7 md:pt-14 lg:py-24 relative z-10">
            <h1 className="t-page text-ink text-[clamp(36px,10vw,48px)] md:text-[52px] lg:text-[56px] leading-[1.02] tracking-[-0.035em]">
              Need a form? We got you.
            </h1>
            <p className="mt-5 text-[19px] leading-7 md:text-[20px] text-ink max-w-[34ch]">
              Say what you need in one sentence. You get the page, ready to fill and download.
            </p>
            <p className="mt-3 text-[16px] leading-6 text-muted max-w-[38ch]">{PRIVACY_LINE}</p>
            <div className="mt-8 grid grid-cols-2 gap-3 max-w-[560px]">
              <button
                type="button"
                onClick={() => scrollToSection("recreate")}
                className={`${btn} bg-primary text-primary-ink border-primary hover:bg-[#0B5540] hover:border-[#0B5540]`}
              >
                Make my form
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("community")}
                className={`${btn} bg-bg text-primary border-primary/60 hover:border-primary hover:bg-surface`}
              >
                Browse community templates
              </button>
            </div>
            <p className="mt-5 text-[16px] leading-6 text-muted">
              Don&rsquo;t know where to start?{" "}
              <a href="https://i.nspired.cc/engine" className="font-semibold text-primary ui-link underline-offset-4 hover:underline">
                Start with a free audit
              </a>
              . It reads your docket first, then this page writes the form.
            </p>
          </div>
        </div>
      </div>

      <div
        className={
          "relative mx-5 md:mx-10 mb-8 aspect-[16/9] sm:aspect-[16/11] md:aspect-[16/10] rounded-theme border border-line bg-surface overflow-hidden " +
          "lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2 lg:m-0 lg:aspect-auto lg:rounded-none lg:border-0 lg:border-l"
        }
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_60%_40%,rgba(255,255,255,0.7),transparent_60%)]"
        />
        <HeroScene />
        <span className="sr-only">
          A letter on US Letter paper with a name and address at the top, a recipient block, body text and a signature line.
        </span>
      </div>
    </section>
  );
}
