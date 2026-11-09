import { useRef, useState } from "react";
import { Upload, Sparkles, Plus, ListPlus, ShieldCheck, AlertCircle, Check } from "lucide-react";
import { Reveal, Dialog, toast, cn } from "@wron/kit";
import { getCurrentDoc, isEmptyDoc } from "../templateStore";
import { prepareImage, IMAGE_ACCEPT } from "../imageTools";
import { scanWithAi, describeWithAi, linesToItems, newPoint, buildDoc } from "../recreate";
import { TextField, TextArea } from "../Field";
import Button from "../Button";
import ScanPlot from "./ScanPlot";
import PointList from "./PointList";
import { useDocActions } from "./actions";

const STEPS = ["Add", "Plot", "Use"];

function Steps({ current }) {
  return (
    <ol className="flex items-center gap-3 md:gap-4" aria-label="Three steps">
      {STEPS.map((s, i) => {
        const done = i < current;
        const on = i === current;
        return (
          <li key={s} className="flex items-center gap-2.5 md:gap-3 flex-1 last:flex-none" aria-current={on ? "step" : undefined}>
            <span
              className={cn(
                "w-8 h-8 shrink-0 rounded-full border text-[14px] font-semibold tabular-nums inline-flex items-center justify-center transition-colors duration-150",
                on || done ? "bg-primary border-primary text-primary-ink" : "bg-bg border-line text-muted"
              )}
            >
              {done ? <Check className="w-4 h-4" aria-hidden="true" /> : i + 1}
            </span>
            <span className={cn("text-[15px]", on ? "font-semibold text-ink" : "text-muted")}>{s}</span>
            {i < STEPS.length - 1 && <span className="h-px bg-line flex-1" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

const seg = (on) =>
  cn(
    "h-11 px-4 rounded-[6px] border text-[15px] transition-colors duration-150 active:translate-y-px",
    on ? "bg-primary border-primary text-primary-ink font-semibold" : "bg-bg border-line text-ink hover:border-primary/50"
  );

export default function Recreate() {
  const { openDoc } = useDocActions();
  const [mode, setMode] = useState("scan");
  const [img, setImg] = useState(null);
  const [desc, setDesc] = useState("");
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);
  const [pending, setPending] = useState(false);
  const fileRef = useRef(null);

  const hasSource = (mode === "scan" && !!img) || items.length > 0;
  const current = items.length > 0 ? 2 : hasSource ? 1 : 0;

  const load = async (file) => {
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const next = await prepareImage(file, 1600);
      setImg(next);
      setItems([]);
      setSelected(null);
      if (!title) setTitle(next.name);
    } catch (err) {
      setError(err?.message || "That picture could not be added.");
    } finally {
      setBusy(false);
    }
  };

  const apply = (result) => {
    setItems(result.items);
    if (result.title) setTitle(result.title);
    if (result.category) setCategory(result.category);
    setSelected(null);
  };

  const detect = async () => {
    setError("");
    setBusy(true);
    try {
      apply(await scanWithAi(img.src));
    } catch (err) {
      setError((err?.message || "Scanning did not work.") + " You can plot the points by hand instead.");
    } finally {
      setBusy(false);
    }
  };

  const draft = async () => {
    setError("");
    setBusy(true);
    try {
      apply(await describeWithAi(desc));
    } catch (err) {
      setError((err?.message || "Drafting did not work.") + " You can use each line as a field instead.");
    } finally {
      setBusy(false);
    }
  };

  const focusPoint = (id) => setTimeout(() => document.getElementById(`pt-${id}`)?.focus({ preventScroll: true }), 60);

  const place = (x, y) => {
    const p = newPoint(items.length + 1, x, y);
    setItems((l) => [...l, p]);
    setSelected(p.id);
    focusPoint(p.id);
  };
  const addBlank = () => {
    const p = newPoint(items.length + 1);
    setItems((l) => [...l, p]);
    setSelected(p.id);
    focusPoint(p.id);
  };
  const change = (id, patch) => setItems((l) => l.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const remove = (id) => setItems((l) => l.filter((i) => i.id !== id));

  const finish = () => {
    setPending(false);
    openDoc(buildDoc(items, { title, category }), "Your template is ready. Fill in the fields.");
  };
  const use = () => (isEmptyDoc(getCurrentDoc()) ? finish() : setPending(true));

  return (
    <section id="recreate" aria-labelledby="recreate-title" className="page-x max-w-[1600px] mx-auto pt-14 md:pt-20 pb-4 scroll-mt-24">
      <Reveal y={12}>
        <h2 id="recreate-title" className="t-section text-ink">Recreate any form</h2>
        <p className="mt-3 text-[16px] md:text-[18px] text-muted max-w-[52ch]">
          A court form, a letter, anything. Upload a scan or describe it, plot the points, and get a fill-in template.
        </p>
      </Reveal>

      <Reveal y={12} className="mt-8 md:mt-10">
        <div className="rounded-theme border border-line bg-bg">
          <div className="p-5 md:p-8 border-b border-line">
            <Steps current={current} />
          </div>

          {/* 1. Add */}
          <div className="p-5 md:p-8 border-b border-line">
            <h3 className="text-[20px] font-semibold tracking-[-0.02em] text-ink">1. Add the form</h3>
            <div className="mt-4 flex flex-wrap gap-2.5" role="group" aria-label="How to add the form">
              <button type="button" aria-pressed={mode === "scan"} onClick={() => setMode("scan")} className={seg(mode === "scan")}>
                Upload a scan
              </button>
              <button type="button" aria-pressed={mode === "describe"} onClick={() => setMode("describe")} className={seg(mode === "describe")}>
                Describe it
              </button>
            </div>

            {mode === "scan" ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                onDragLeave={() => setOver(false)}
                onDrop={(e) => { e.preventDefault(); setOver(false); load(e.dataTransfer.files?.[0]); }}
                className={cn(
                  "mt-5 rounded-theme border border-dashed px-5 py-9 md:py-12 text-center transition-colors duration-150",
                  over ? "border-primary bg-surface" : "border-primary/40 bg-surface/60"
                )}
              >
                <Upload className="w-7 h-7 mx-auto text-primary" aria-hidden="true" />
                <p className="mt-3 text-[17px] font-semibold text-ink">Drop a photo, scan or screenshot here.</p>
                <p className="mt-1 text-[15px] text-muted">JPG, PNG or WebP. For a PDF, screenshot the page.</p>
                <Button className="mt-5" onClick={() => fileRef.current?.click()} disabled={busy}>
                  {img ? "Choose another picture" : "Choose a picture"}
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept={IMAGE_ACCEPT}
                  className="sr-only"
                  tabIndex={-1}
                  aria-label="Choose a picture of the form"
                  onChange={(e) => { load(e.target.files?.[0]); e.target.value = ""; }}
                />
              </div>
            ) : (
              <div className="mt-5 max-w-[720px]">
                <TextArea
                  label="Describe the document"
                  rows={5}
                  value={desc}
                  maxLength={4000}
                  placeholder="A small claims form with the parties, case number, hearing date, what happened and what I am asking for."
                  onChange={(e) => setDesc(e.target.value)}
                />
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button onClick={draft} disabled={busy || !desc.trim()}>
                    <Sparkles className="w-4 h-4" aria-hidden="true" />
                    {busy ? "Drafting..." : "Draft with AI"}
                  </Button>
                  <Button variant="outline" disabled={busy || !desc.trim()} onClick={() => { setItems(linesToItems(desc)); setSelected(null); setError(""); }}>
                    <ListPlus className="w-4 h-4" aria-hidden="true" />
                    Use each line as a field
                  </Button>
                </div>
              </div>
            )}

            <p className="mt-5 flex items-start gap-2.5 text-[15px] text-muted max-w-[68ch]">
              <ShieldCheck className="w-5 h-5 mt-0.5 text-primary shrink-0" aria-hidden="true" />
              <span>
                Your picture and text stay in this browser. They leave only if you press the AI button, and then they go to the AI service to be read. Nothing goes to the community.
              </span>
            </p>
          </div>

          {/* 2. Plot */}
          {(hasSource || items.length > 0) && (
            <div className="p-5 md:p-8 border-b border-line">
              <h3 className="text-[20px] font-semibold tracking-[-0.02em] text-ink">2. Plot the points</h3>
              <div className="mt-5 grid lg:grid-cols-12 gap-8">
                {mode === "scan" && img && (
                  <div className="lg:col-span-5 min-w-0">
                    <ScanPlot img={img} items={items} selected={selected} onPlace={place} onSelect={(id) => { setSelected(id); focusPoint(id); }} />
                  </div>
                )}
                <div className={cn("min-w-0", mode === "scan" && img ? "lg:col-span-7" : "lg:col-span-12 max-w-[860px]")}>
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <p className="text-[15px] text-muted tabular-nums">{items.length} {items.length === 1 ? "point" : "points"}</p>
                    <div className="flex flex-wrap gap-2">
                      {mode === "scan" && img && (
                        <Button size="sm" onClick={detect} disabled={busy}>
                          <Sparkles className="w-4 h-4" aria-hidden="true" />
                          {busy ? "Reading..." : "Detect with AI"}
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={addBlank}>
                        <Plus className="w-4 h-4" aria-hidden="true" />
                        Add a point
                      </Button>
                    </div>
                  </div>
                  {busy && <p role="status" className="mb-4 text-[15px] text-ink">Reading the form. This can take a few seconds.</p>}
                  {error && (
                    <p role="alert" className="mb-4 flex items-start gap-2 text-[15px] text-ink">
                      <AlertCircle className="w-5 h-5 text-[#B42318] shrink-0" aria-hidden="true" />
                      {error}
                    </p>
                  )}
                  {items.length === 0 ? (
                    <div className="rounded-[6px] border border-line bg-surface/60 px-5 py-10 text-center text-[15px] text-muted">
                      No points yet. Click the scan where a blank or a heading sits, or press Add a point.
                    </div>
                  ) : (
                    <PointList items={items} selected={selected} onSelect={setSelected} onChange={change} onRemove={remove} />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 3. Use */}
          {items.length > 0 && (
            <div className="p-5 md:p-8">
              <h3 className="text-[20px] font-semibold tracking-[-0.02em] text-ink">3. Use it</h3>
              <div className="mt-5 grid sm:grid-cols-2 gap-5 max-w-[720px]">
                <TextField label="Template name" value={title} maxLength={140} autoComplete="off" onChange={(e) => setTitle(e.target.value)} />
                <TextField label="Category" hint="Optional" value={category} maxLength={60} autoComplete="off" placeholder="For example: Court forms" onChange={(e) => setCategory(e.target.value)} />
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <Button size="lg" onClick={use}>Open in the editor</Button>
                <p className="text-[15px] text-muted">Points keep their order on the page, top to bottom. Saved on this device only.</p>
              </div>
            </div>
          )}
        </div>
      </Reveal>

      <Dialog open={pending} onClose={() => setPending(false)} title="Replace the page in the editor?" panelClassName="bg-bg">
        <p className="text-[16px] text-muted">The editor holds work that is not saved as a template. Save it first if you want to keep it.</p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={() => setPending(false)}>Keep editing</Button>
          <Button onClick={finish}>Replace it</Button>
        </div>
      </Dialog>
    </section>
  );
}
