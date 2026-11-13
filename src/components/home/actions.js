// Actions shared by the editor, the phone bar, My templates and the community list.
import { useCallback } from "react";
import { toast, scrollToSection } from "@wron/kit";
import { useCurrentDoc, useDeviceTemplates, useSaveChoice, getCurrentDoc, isEmptyDoc } from "../templateStore";
import { paperState } from "./paperState";

export const PDF_FAIL = "PDF could not be created. Try again. Your work is still saved.";

const reduced = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function focusTitle() {
  setTimeout(() => document.getElementById("doc-title")?.focus({ preventScroll: true }), 650);
}

export function useDocActions() {
  const { setDoc, reset } = useCurrentDoc();
  const { save } = useDeviceTemplates();
  const [, setChoice] = useSaveChoice();

  const saveNow = useCallback(() => {
    const doc = getCurrentDoc();
    if (isEmptyDoc(doc)) {
      toast.error("Add a title or some text first.");
      return;
    }
    const saved = save(doc);
    setDoc((d) => ({ ...d, id: saved.id, updatedAt: saved.updatedAt }));
    setChoice("device");
    paperState.set((s) => ({ mode: "device", pulse: s.pulse + 1 }));
    toast.success("Saved on this device");
  }, [save, setDoc, setChoice]);

  const pdfNow = useCallback(async (given) => {
    const doc = given || getCurrentDoc();
    if (isEmptyDoc(doc)) {
      toast.error("Add a title or some text first.");
      return;
    }
    // A page of empty default points ("Field 1", "Field 2" ...) prints as
    // "[ Field 1 ] [ Field 2 ]" and nothing else. That is not a document, so it
    // is not offered as one.
    const blocks = doc.blocks || [];
    const placeholderOnly =
      blocks.length > 0 &&
      blocks.every(
        (b) =>
          (b.type === "field" && !String(b.value || "").trim() && /^Field \d+$/.test(String(b.label || ""))) ||
          (b.type === "rule") ||
          (b.type === "text" && !String(b.text || "").trim())
      );
    if (placeholderOnly) {
      toast.error("There is nothing to print yet. Write something, or use the court form.");
      return;
    }
    try {
      const { downloadPdf } = await import("./pdf");
      downloadPdf(doc);
      paperState.set({ pdfError: false });
    } catch {
      paperState.set({ pdfError: true });
      toast.error(PDF_FAIL);
    }
  }, []);

  const startEditing = useCallback(() => {
    scrollToSection("editor");
    focusTitle();
  }, []);

  const newDocument = useCallback(() => {
    reset();
    paperState.set({ mode: "device", crossing: false });
    scrollToSection("editor");
    focusTitle();
  }, [reset]);

  const openDoc = useCallback(
    (doc, message) => {
      setDoc(doc);
      paperState.set({ mode: "device", crossing: false });
      scrollToSection("editor");
      if (message) toast(message);
    },
    [setDoc]
  );

  const startShare = useCallback(() => {
    const doc = getCurrentDoc();
    if (!doc?.title?.trim() || !(doc.blocks || []).some((b) => b.type !== "image")) {
      toast.error("Add a title and some text or a field before sharing.");
      return;
    }
    paperState.set({ crossing: true });
    setTimeout(() => paperState.set({ shareOpen: true }), reduced() ? 0 : 320);
  }, []);

  const closeShare = useCallback((shared) => {
    paperState.set((s) => ({ shareOpen: false, crossing: false, mode: shared ? "shared" : s.mode }));
    if (shared) setChoice("shared");
  }, [setChoice]);

  return { saveNow, pdfNow, startEditing, newDocument, openDoc, startShare, closeShare };
}
