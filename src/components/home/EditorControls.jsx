import { useEffect, useRef, useState } from "react";
import { Type, Brackets, ImagePlus, Minus, Scale, FilePlus2, Upload, Download, FileText } from "lucide-react";
import { Dialog, toast } from "@wron/kit";
import { useCurrentDoc, textBlock, fieldBlock, imageBlock, ruleBlock, isEmptyDoc } from "../templateStore";
import { prepareImage, IMAGE_ACCEPT } from "../imageTools";
import { parseMarkdown, downloadMarkdown } from "../mdTools";
import { TextField, SelectField, Checkbox } from "../Field";
import Button from "../Button";
import BlockEditor from "./BlockEditor";
import { CATEGORIES, LEGAL_NOTE_DEMAND } from "../../data/site";
import { useDocActions } from "./actions";
import CourtFormDialog from "./CourtFormDialog";
import MoneyPath from "./MoneyPath";

const OTHER = "__other";

const addBtn =
  "w-full h-16 md:h-11 flex items-center gap-4 md:gap-3.5 px-5 md:px-4 rounded-[6px] border border-line bg-surface text-[18px] md:text-[15px] font-medium text-ink " +
  "hover:border-primary/40 transition-colors duration-150 active:translate-y-px";

export default function EditorControls() {
  const { doc, setDoc, update, updateBlock, addBlock, removeBlock, moveBlock } = useCurrentDoc();
  const { newDocument, pdfNow, saveNow } = useDocActions();
  // Carry the audit through the funnel, so payment knows exactly what it is selling.
  const auditQuery = (() => {
    if (typeof window === "undefined") return "";
    const id = new URLSearchParams(window.location.search).get("audit");
    return id ? `?audit=${encodeURIComponent(id)}` : "";
  })();
  const [focusId, setFocusId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [moneyOpen, setMoneyOpen] = useState(false);
  const [other, setOther] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);

  useEffect(() => setOther(false), [doc.id]);

  const isCustom = other || (!!doc.category && !CATEGORIES.includes(doc.category));
  const selectValue = isCustom ? OTHER : doc.category || "";

  const add = (block) => {
    addBlock(block);
    setFocusId(block.id);
  };

  const fileRef = useRef(null);
  const mdRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const pickImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      add(imageBlock(await prepareImage(file)));
      toast.success("Picture added. It stays on this device.");
    } catch (err) {
      toast.error(err?.message || "That picture could not be added.");
    } finally {
      setBusy(false);
    }
  };

  const importText = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 500 * 1024) {
      toast.error("That file is too large. Choose a text or Markdown file under 500 KB.");
      return;
    }
    try {
      const blocks = parseMarkdown(await file.text());
      if (!blocks.length) {
        toast.error("That file has no text to import.");
        return;
      }
      const name = file.name.replace(/\.[^.]+$/, "").slice(0, 80);
      setDoc((d) => ({ ...d, title: d.title || name, blocks: [...d.blocks, ...blocks] }));
      toast.success("File imported. Check the page and adjust it.");
    } catch {
      toast.error("That file could not be read. Try a .md or .txt file.");
    }
  };

  // What the audit and this page say, so the form can be planned before it opens.
  const formDescription = [
    doc.title || "",
    ...(doc.blocks || []).filter((b) => b.kind === "text" || b.kind === "heading").map((b) => b.label || ""),
  ]
    .join("\n")
    .slice(0, 3000);

  const exportMd = () => {
    if (isEmptyDoc(doc)) {
      toast.error("Add a title or some text first.");
      return;
    }
    downloadMarkdown(doc);
  };

  return (
    <div className="p-7 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="editor-title" className="text-[30px] md:text-[26px] font-semibold tracking-[-0.02em] leading-tight text-ink">
            Editor
          </h2>
          <p className="mt-1 text-[18px] md:text-[15px] text-muted truncate">{doc.title?.trim() || "Untitled template"}</p>
          {doc.source && <p className="t-meta text-muted mt-1">Copied from the community</p>}
          {!isEmptyDoc(doc) && (
            <div className="mt-4">
              <div className="flex flex-wrap gap-2.5">
                <Button size="sm" onClick={() => setFormOpen(true)}>
                  <FileText className="w-4 h-4" aria-hidden="true" />
                  Official court form
                </Button>
                <Button size="sm" href={`https://ezxhibitz.nspired.cc/${auditQuery}`}>
                  Build the packet · $39
                </Button>
                <Button size="sm" variant="outline" onClick={() => pdfNow()}>
                  <Download className="w-4 h-4" aria-hidden="true" />
                  Download PDF
                </Button>
                <Button size="sm" variant="ghost" onClick={saveNow}>
                  Save to this device
                </Button>
              </div>
              <p className="mt-2 t-meta text-muted">
                This form is free. The packet — exhibits, tabs and service proof — is $39 at EZXHIBITZ, and the first three are free.
              </p>
              <button
                type="button"
                onClick={() => setMoneyOpen(true)}
                className="mt-1.5 text-[14px] font-semibold text-primary underline underline-offset-2 hover:text-ink"
              >
                Money is tight? There is a cheaper path
              </button>
            </div>
          )}
        </div>
        {!isEmptyDoc(doc) && (
          <button
            type="button"
            onClick={() => setConfirmNew(true)}
            className="shrink-0 inline-flex items-center gap-1.5 min-h-11 md:min-h-9 px-2.5 rounded-[6px] text-[14px] font-semibold text-primary hover:bg-surface transition-colors duration-150"
          >
            <FilePlus2 className="w-4 h-4" aria-hidden="true" />
            New
          </button>
        )}
      </div>

      <div className="mt-7 md:mt-6 space-y-7 md:space-y-5">
        <TextField
          id="doc-title"
          label="Template name"
          value={doc.title}
          maxLength={140}
          autoComplete="off"
          onChange={(e) => update({ title: e.target.value })}
        />
        <SelectField
          label="Category"
          placeholder="Choose category"
          options={[...CATEGORIES, { value: OTHER, label: "Other" }]}
          value={selectValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v === OTHER) {
              setOther(true);
              update({ category: "" });
            } else {
              setOther(false);
              update({ category: v });
            }
          }}
        />
        {isCustom && (
          <TextField
            label="Category name"
            value={doc.category}
            maxLength={60}
            autoComplete="off"
            placeholder="For example: Invoices"
            onChange={(e) => update({ category: e.target.value })}
          />
        )}
        {doc.category === "Demand letters" && (
          <p className="flex items-start gap-2 text-[14px] text-ink bg-surface border border-line rounded-[6px] px-3 py-2.5">
            <Scale className="w-4 h-4 mt-0.5 text-primary shrink-0" aria-hidden="true" />
            {LEGAL_NOTE_DEMAND}
          </p>
        )}
      </div>

      <fieldset className="mt-6 pt-5 border-t border-line">
        <legend className="sr-only">Page setup</legend>
        <p className="text-[14px] font-semibold text-ink mb-3">Page setup, US Letter</p>
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Typeface"
            value={doc.font === "sans" ? "sans" : "serif"}
            options={[
              { value: "serif", label: "Times style" },
              { value: "sans", label: "Helvetica style" },
            ]}
            onChange={(e) => update({ font: e.target.value })}
          />
          <SelectField
            label="Margins"
            value={doc.margin === "0.75" ? "0.75" : "1"}
            options={[
              { value: "1", label: "1 inch" },
              { value: "0.75", label: "0.75 inch" },
            ]}
            onChange={(e) => update({ margin: e.target.value })}
          />
        </div>
        <Checkbox
          className="mt-1"
          label="Print the template name at the top of the page"
          checked={doc.printTitle !== false}
          onChange={(e) => update({ printTitle: e.target.checked })}
        />
      </fieldset>

      <hr className="my-5 border-line" />

      <div className="space-y-3">
        <button type="button" className={addBtn} onClick={() => add(textBlock(""))}>
          <Type className="w-[18px] h-[18px] text-primary" aria-hidden="true" />
          Add text
        </button>
        <button type="button" className={addBtn} onClick={() => add(fieldBlock("Field"))}>
          <Brackets className="w-[18px] h-[18px] text-primary" aria-hidden="true" />
          Add field
        </button>
        <button type="button" className={addBtn} onClick={() => add(ruleBlock())}>
          <Minus className="w-[18px] h-[18px] text-primary" aria-hidden="true" />
          Add divider line
        </button>
        <button type="button" className={addBtn} onClick={() => fileRef.current?.click()} disabled={busy}>
          <ImagePlus className="w-[18px] h-[18px] text-primary" aria-hidden="true" />
          {busy ? "Adding picture..." : "Upload image"}
        </button>
        <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} onChange={pickImage} className="sr-only" tabIndex={-1} aria-label="Choose an image to upload" />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button variant="outline" size="sm" className="md:h-10" onClick={() => mdRef.current?.click()}>
          <Upload className="w-4 h-4" aria-hidden="true" />
          Import file
        </Button>
        <Button variant="outline" size="sm" className="md:h-10" onClick={exportMd}>
          <Download className="w-4 h-4" aria-hidden="true" />
          Export .md
        </Button>
        <input
          ref={mdRef}
          type="file"
          accept=".md,.markdown,.txt,text/markdown,text/plain"
          onChange={importText}
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose a Markdown or text file to import"
        />
      </div>
      <p className="mt-2 t-meta text-muted">Markdown and text files. Headings, lines, lists and [[Field]] lines map onto the page.</p>

      {doc.blocks.length > 0 && (
        <ol className="mt-6 space-y-3" aria-label="Document parts">
          {doc.blocks.map((b, i) => (
            <BlockEditor
              key={b.id}
              block={b}
              index={i}
              count={doc.blocks.length}
              focusId={focusId}
              onMove={(dir) => moveBlock(b.id, dir)}
              onRemove={() => removeBlock(b.id)}
              onChange={(patch) => updateBlock(b.id, patch)}
            />
          ))}
        </ol>
      )}

      <MoneyPath
        open={moneyOpen}
        onClose={() => setMoneyOpen(false)}
        auditQuery={auditQuery}
        onGetForm={() => {
          setMoneyOpen(false);
          setFormOpen(true);
        }}
      />

      <CourtFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        audit={new URLSearchParams(typeof window === "undefined" ? "" : window.location.search).get("audit") || ""}
        description={formDescription}
      />

      <Dialog open={confirmNew} onClose={() => setConfirmNew(false)} title="Start a new document?" panelClassName="bg-bg">
        <p className="text-[16px] text-muted">The editor will be cleared. Templates you saved on this device stay saved.</p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={() => setConfirmNew(false)}>Keep editing</Button>
          <Button
            onClick={() => {
              setConfirmNew(false);
              newDocument();
              toast("Started a new document");
            }}
          >
            Start new
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
