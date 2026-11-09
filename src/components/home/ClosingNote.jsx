import { Reveal } from "@wron/kit";

export default function ClosingNote() {
  return (
    <section aria-label="A short note" className="page-x max-w-[1600px] mx-auto pt-20 pb-16 md:pt-32 md:pb-24">
      <Reveal y={12}>
        <p className="text-[28px] md:text-[44px] font-medium tracking-[-0.025em] leading-[1.15] text-ink max-w-[24ch]">
          Simple. Tiny. One of the best things ever since sliced bread.
        </p>
      </Reveal>
      <div className="mt-10 md:mt-12 h-px w-full bg-line" aria-hidden="true" />
    </section>
  );
}
