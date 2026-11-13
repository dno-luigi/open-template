// Everything saved ON THIS DEVICE (no account, nothing sent anywhere):
// saved templates, the current draft, the last category filter and the last save choice.
// Also one shared "current document" so the editor, the 3D paper and the phone bar stay in step.
import { useEffect, useState, useCallback } from "react";
import { storage } from "@wron/kit";

const KEYS = {
  templates: "otl-templates",
  draft: "otl-draft",
  filter: "otl-last-filter",
  saveChoice: "otl-last-save-choice",
};

function read(key, fallback) {
  try {
    const v = storage.get(key);
    if (v == null) return fallback;
    if (typeof v === "string") {
      try { return JSON.parse(v); } catch { return v; }
    }
    return v;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try { storage.set(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// ---------- Document model ----------
// doc = { id, title, category, blocks: [{ id, type: "text", text } | { id, type: "field", label, value }], source?, updatedAt }
export function newDoc(partial = {}) {
  // font: "serif" (Times style) or "sans" (Helvetica style). margin: "1" or "0.75" inches.
  // printTitle: older drafts have no value and print the title, as before.
  return { id: uid(), title: "", category: "", blocks: [], source: null, updatedAt: null, font: "serif", margin: "1", printTitle: true, ...partial };
}
export const VARIANTS = ["body", "bold", "heading", "name", "label"];
export const ALIGNS = ["left", "center", "right"];
const pickVariant = (v) => (VARIANTS.includes(v) ? v : "body");
const pickAlign = (a) => (ALIGNS.includes(a) ? a : "left");
export const textBlock = (text = "", o = {}) => ({ id: uid(), type: "text", text, variant: pickVariant(o.variant), align: pickAlign(o.align) });
export const fieldBlock = (label = "Field", value = "", o = {}) => ({ id: uid(), type: "field", label, value, variant: pickVariant(o.variant), align: pickAlign(o.align) });
export const ruleBlock = () => ({ id: uid(), type: "rule" });
// A picture the person added. Kept on this device only, never shared. pct = width on the page.
export const imageBlock = ({ src, width, height, name }) => ({ id: uid(), type: "image", src, width, height, name: name || "Image", pct: 60 });

// Copy a community template (content json) into a fresh device document.
export function docFromCommunity(row) {
  const content = typeof row?.content === "string" ? safeParse(row.content) : row?.content;
  const blocks = Array.isArray(content?.blocks) ? content.blocks : [];
  return newDoc({
    title: row?.title || "",
    category: row?.category || "",
    font: content?.font === "sans" ? "sans" : "serif",
    margin: content?.margin === "0.75" ? "0.75" : "1",
    printTitle: content?.printTitle !== false,
    blocks: blocks.map((b) =>
      b.type === "field"
        ? fieldBlock(b.label || "Field", "", b)
        : b.type === "rule"
        ? ruleBlock()
        : textBlock(b.text || "", b)
    ),
    source: row?.id ? { id: row.id, title: row.title } : null,
  });
}
// Shareable content: text kept, field values removed (they may hold personal details).
export function contentForSharing(doc) {
  return {
    font: doc.font === "sans" ? "sans" : "serif",
    margin: doc.margin === "0.75" ? "0.75" : "1",
    printTitle: doc.printTitle !== false,
    blocks: (doc.blocks || [])
      .filter((b) => b.type !== "image")
      .map((b) =>
        b.type === "field"
          ? { type: "field", label: b.label, variant: b.variant, align: b.align }
          : b.type === "rule"
          ? { type: "rule" }
          : { type: "text", text: b.text, variant: b.variant, align: b.align }
      ),
  };
}
function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }

// Plain lines of the finished document, for the preview, the 3D paper texture and the PDF.
// Each line: { kind: "title" | "text" | "field" | "blank", text, filled }
export function docLines(doc) {
  const lines = [];
  if (doc?.title?.trim() && doc.printTitle !== false) lines.push({ kind: "title", text: doc.title, filled: true, variant: "name", align: "left" });
  for (const b of doc?.blocks || []) {
    const variant = pickVariant(b.variant);
    const align = pickAlign(b.align);
    if (b.type === "image") {
      if (b.src) lines.push({ kind: "image", src: b.src, w: b.width || 1, h: b.height || 1, pct: b.pct || 60, filled: true, text: "" });
    } else if (b.type === "rule") {
      lines.push({ kind: "rule", text: "", filled: true });
    } else if (b.type === "field") {
      const filled = !!(b.value && b.value.trim());
      lines.push({ kind: "field", text: filled ? b.value : "", filled, label: b.label, blockId: b.id, variant, align });
    } else {
      const parts = String(b.text || "").split("\n");
      parts.forEach((p, part) =>
        lines.push(
          p.trim()
            ? { kind: "text", text: p, filled: true, part, blockId: b.id, variant, align }
            : { kind: "blank", text: "", filled: false }
        )
      );
    }
  }
  return lines;
}
export const isEmptyDoc = (doc) => !doc?.title?.trim() && !(doc?.blocks || []).length;

// ---------- Tiny shared store helper ----------
function createStore(initial) {
  let state = initial;
  const subs = new Set();
  return {
    get: () => state,
    set: (next) => { state = typeof next === "function" ? next(state) : next; subs.forEach((f) => f(state)); },
    sub: (f) => { subs.add(f); return () => subs.delete(f); },
  };
}
function useStore(store, load) {
  const [s, setS] = useState(store.get());
  useEffect(() => {
    load?.();
    setS(store.get());
    return store.sub(setS);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return s;
}

// ---------- Saved templates on this device ----------
const templatesStore = createStore([]);
let templatesLoaded = false;
function loadTemplates() {
  if (templatesLoaded) return;
  templatesLoaded = true;
  const list = read(KEYS.templates, []);
  templatesStore.set(Array.isArray(list) ? list : []);
}

export function useDeviceTemplates() {
  const templates = useStore(templatesStore, loadTemplates);
  const save = useCallback((doc) => {
    loadTemplates();
    const saved = { ...doc, id: doc.id || uid(), updatedAt: new Date().toISOString() };
    templatesStore.set((list) => {
      const rest = list.filter((t) => t.id !== saved.id);
      const next = [saved, ...rest];
      write(KEYS.templates, next);
      return next;
    });
    return saved;
  }, []);
  const remove = useCallback((id) => {
    templatesStore.set((list) => {
      const next = list.filter((t) => t.id !== id);
      write(KEYS.templates, next);
      return next;
    });
  }, []);
  const get = useCallback((id) => templatesStore.get().find((t) => t.id === id) || null, []);
  // Sorted newest first
  const sorted = [...templates].sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  return { templates: sorted, save, remove, get };
}

// ---------- The document being edited (draft autosaves on this device) ----------
const docStore = createStore(newDoc());
let docLoaded = false;
let draftTimer = null;
function loadDraft() {
  if (docLoaded) return;
  docLoaded = true;
  const d = read(KEYS.draft, null);
  if (d && typeof d === "object" && Array.isArray(d.blocks)) docStore.set(d);
}

export function useCurrentDoc() {
  const doc = useStore(docStore, loadDraft);
  const setDoc = useCallback((next) => {
    docStore.set(next);
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => write(KEYS.draft, docStore.get()), 300);
  }, []);
  const update = useCallback((patch) => setDoc((d) => ({ ...d, ...patch })), [setDoc]);
  const updateBlock = useCallback(
    (id, patch) => setDoc((d) => ({ ...d, blocks: d.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) })),
    [setDoc]
  );
  const addBlock = useCallback((block) => setDoc((d) => ({ ...d, blocks: [...d.blocks, block] })), [setDoc]);
  const removeBlock = useCallback((id) => setDoc((d) => ({ ...d, blocks: d.blocks.filter((b) => b.id !== id) })), [setDoc]);
  const moveBlock = useCallback(
    (id, dir) =>
      setDoc((d) => {
        const i = d.blocks.findIndex((b) => b.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= d.blocks.length) return d;
        const blocks = [...d.blocks];
        [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
        return { ...d, blocks };
      }),
    [setDoc]
  );
  const reset = useCallback(() => setDoc(newDoc()), [setDoc]);
  return { doc, setDoc, update, updateBlock, addBlock, removeBlock, moveBlock, reset };
}

// Read the current document without re-rendering (e.g. inside a 3D useFrame).
export const getCurrentDoc = () => docStore.get();
export const subscribeCurrentDoc = (f) => docStore.sub(f);

// ---------- Preferences remembered between visits ----------
function usePref(key, fallback) {
  const [v, setV] = useState(fallback);
  useEffect(() => { setV(read(key, fallback)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const set = useCallback((next) => { setV(next); write(key, next); }, [key]);
  return [v, set];
}
// Last community category filter ("All categories" by default)
export const useLastFilter = () => usePref(KEYS.filter, "All categories");
// Last save choice: "device" (default, private) or "shared"
export const useSaveChoice = () => usePref(KEYS.saveChoice, "device");

// ---------- Dates ----------
export function formatDate(value) {
  if (!value) return "";
  const d = new Date(value.length === 10 ? value + "T12:00:00" : value);
  if (isNaN(d)) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
