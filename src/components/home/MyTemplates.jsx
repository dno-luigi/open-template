import { useState } from "react";
import { Laptop } from "lucide-react";
import { Dialog, Reveal, toast } from "@wron/kit";
import { useDeviceTemplates, formatDate } from "../templateStore";
import Button from "../Button";
import { STATUS } from "../../data/site";
import { useDocActions } from "./actions";

export default function MyTemplates() {
  const { templates, remove } = useDeviceTemplates();
  const { openDoc, startEditing, pdfNow } = useDocActions();
  const [confirm, setConfirm] = useState(null);

  return (
    <section id="my-templates" aria-labelledby="my-title" className="page-x max-w-[1600px] mx-auto py-16 md:py-20 scroll-mt-24">
      <div className="grid lg:grid-cols-12 gap-8 lg:gap-6">
        <Reveal y={12} className="lg:col-span-4">
          <h2 id="my-title" className="t-section text-ink">My templates</h2>
          <p className="mt-3 flex items-center gap-2.5 text-[16px] md:text-[18px] text-muted">
            <Laptop className="w-5 h-5" aria-hidden="true" />
            {STATUS.device}
          </p>
        </Reveal>

        <div className="lg:col-span-8">
          {templates.length === 0 ? (
            <div className="rounded-theme border border-line bg-surface/60 min-h-[240px] flex flex-col items-center justify-center gap-5 py-16 px-6 text-center">
              <p className="text-[16px] md:text-[17px] text-muted">Nothing saved on this device yet.</p>
              <Button onClick={startEditing}>Create a template</Button>
            </div>
          ) : (
            <ul className="border-t border-line">
              {templates.map((t) => (
                <li key={t.id} className="border-b border-line py-4 md:py-5 grid md:grid-cols-[minmax(0,1fr)_auto] gap-3 md:gap-6 md:items-center">
                  <div className="min-w-0">
                    <p className="text-[17px] font-semibold text-ink truncate">{t.title?.trim() || "Untitled template"}</p>
                    <p className="t-meta text-muted mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      <span>{t.category || "No category"}</span>
                      {t.updatedAt && <span className="tabular-nums">Saved {formatDate(t.updatedAt)}</span>}
                      <span className="inline-flex items-center gap-1.5">
                        <Laptop className="w-3.5 h-3.5" aria-hidden="true" />
                        {STATUS.device}
                      </span>
                    </p>
                  </div>
                  <div className="grid grid-cols-2 md:flex md:items-center gap-2">
                    <Button size="sm" className="col-span-2 md:col-span-1 px-5" onClick={() => openDoc(t, "Opened in the editor")}>
                      Open
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => pdfNow(t)}>Download PDF</Button>
                    <Button size="sm" variant="soft" onClick={() => setConfirm(t)}>Delete</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Dialog open={!!confirm} onClose={() => setConfirm(null)} title="Delete this template from this device?" panelClassName="bg-bg">
        <p className="text-[16px] text-muted">{confirm?.title?.trim() || "Untitled template"}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={() => setConfirm(null)}>Keep it</Button>
          <Button
            variant="danger"
            onClick={() => {
              remove(confirm.id);
              setConfirm(null);
              toast("Deleted from this device");
            }}
          >
            Delete
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
