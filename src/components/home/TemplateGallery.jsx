import { useMemo, useState } from "react";
import { Reveal, Dialog } from "@wron/kit";
import { STARTERS } from "../../data/starters";
import { getCurrentDoc, isEmptyDoc } from "../templateStore";
import DocPreview from "./DocPreview";
import Button from "../Button";
import { useDocActions } from "./actions";

export default function TemplateGallery() {
  const previews = useMemo(() => STARTERS.map((s) => s.build()), []);
  const { openDoc } = useDocActions();
  const [pending, setPending] = useState(null);

  const use = (s) => {
    setPending(null);
    openDoc(s.build(), `${s.name} is ready. Fill in the fields.`);
  };
  const choose = (s) => {
    if (isEmptyDoc(getCurrentDoc())) use(s);
    else setPending(s);
  };

  return (
    <section id="templates" aria-labelledby="templates-title" className="page-x max-w-[1600px] mx-auto pt-14 md:pt-20 pb-6 md:pb-10 scroll-mt-24">
      <Reveal y={12}>
        <h2 id="templates-title" className="t-section text-ink">Start from a template</h2>
        <p className="mt-3 text-[16px] md:text-[18px] text-muted">Real letter pages. Pick one, fill in the fields, download a PDF.</p>
      </Reveal>

      <ul className="mt-8 md:mt-10 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-8 md:gap-x-6 md:gap-y-10">
        {STARTERS.map((s, i) => (
          <li key={s.key} className="flex">
            <button
              type="button"
              onClick={() => choose(s)}
              aria-label={`Use the ${s.name} template`}
              className="group flex flex-col w-full text-left rounded-[6px] active:translate-y-px transition-transform duration-150"
            >
              <span className="block rounded-[6px] border border-line bg-surface p-3 md:p-4 transition-colors duration-150 group-hover:border-primary/60">
                <span aria-hidden="true" className="block aspect-[8.5/11] overflow-hidden">
                  <DocPreview doc={previews[i]} thumb />
                </span>
              </span>
              <span className="mt-3 block min-h-[3rem] text-[16px] font-semibold leading-6 text-ink group-hover:text-primary transition-colors duration-150">{s.name}</span>
              <span className="block t-meta text-muted">Use this template</span>
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={!!pending} onClose={() => setPending(null)} title="Replace the page in the editor?" panelClassName="bg-bg">
        <p className="text-[16px] text-muted">
          The editor holds work that is not saved as a template. Save it first if you want to keep it. Templates saved on this device are not affected.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={() => setPending(null)}>Keep editing</Button>
          <Button onClick={() => use(pending)}>Use {pending?.name}</Button>
        </div>
      </Dialog>
    </section>
  );
}
