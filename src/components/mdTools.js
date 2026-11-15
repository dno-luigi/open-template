// Documents in and out. Import turns a .md, .txt or a saved .html page into
// document parts. Export writes the current document as Markdown, with unfilled
// fields as [[Field name]].
//
// The HTML path exists because templates made elsewhere are often a whole page:
// a <style>, a <main id="doc">, and blank fields in spans. Read as Markdown, that
// is a wall of source on the page; read as HTML, it is the document it already was.
import { textBlock, fieldBlock, ruleBlock, docLines } from "./templateStore";

const clean = (s) =>
  s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/`([^`]+)`/g, "$1");

/** A whole page rather than some Markdown: a doctype, or a body soon after the top. */
export function isHtmlDocument(src) {
  const head = String(src || "").slice(0, 4000);
  return /^\s*(?:<!doctype\s+html|<html[\s>])/i.test(head) || /<body[\s>]/i.test(head);
}

const tidy = (s) => String(s || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

/** "[Full legal name]" -> "Full legal name". The brackets are the placeholder. */
const unplacehold = (s) => tidy(s).replace(/^[\s[]+/, "").replace(/[\s\]]+$/, "").replace(/:$/, "").trim();

const SKIP = "script, style, noscript, button, select, textarea, input, .bar, .tip, [hidden]";
const FIELDISH = ".fill, .sig, .blk";

/**
 * The blocks a saved HTML page describes: headings, paragraphs, list items, rules,
 * and one blank per field span. Its own CSS is dropped (the page draws the sheet);
 * so are toolbars and tap-to-type hints, which are not part of the document.
 */
function htmlToBlocks(root) {
  const out = [];
  const push = (block) => {
    if (block && out.length < 400) out.push(block);
  };
  // A <br> is a space in a sentence, not nothing: clone, swap, then read the text.
  const textOf = (el) => {
    const copy = el.cloneNode(true);
    for (const br of copy.querySelectorAll("br")) br.replaceWith(" ");
    return tidy(copy.textContent);
  };

  const fieldFor = (el, label) => {
    const own = unplacehold(textOf(el));
    push(fieldBlock(label || own || "Field", ""));
  };

  const visit = (el) => {
    if (!el || el.nodeType !== 1 || el.matches(SKIP)) return;
    const tag = el.tagName.toLowerCase();

    if (/^h[1-6]$/.test(tag)) {
      const text = textOf(el);
      if (text) {
        const variant = tag === "h1" ? "name" : tag === "h2" ? "heading" : "bold";
        push(textBlock(text.toUpperCase() === text ? text : text, { variant, align: tag === "h1" ? "center" : "left" }));
      }
      return;
    }
    if (tag === "p") {
      const text = textOf(el);
      if (text) push(textBlock(text));
      return;
    }
    if (tag === "li") {
      const text = textOf(el);
      if (text) push(textBlock(`• ${text}`));
      return;
    }
    if (tag === "hr") {
      push(ruleBlock());
      return;
    }
    if (tag === "table") {
      for (const row of el.querySelectorAll("tr")) {
        const cells = [...row.children].map(textOf).filter(Boolean);
        if (cells.length) push(textBlock(cells.join("   ")));
      }
      return;
    }
    // "Name: [blank]" is a labelled blank, not a sentence with a hole in it.
    if (el.matches(".row") && el.querySelector(FIELDISH)) {
      const label = el.querySelector(".lbl");
      fieldFor(el.querySelector(FIELDISH), unplacehold(textOf(label || el.querySelector(FIELDISH))));
      return;
    }
    if (el.matches(FIELDISH)) {
      fieldFor(el);
      return;
    }
    // Anything left with no children of its own is a line of the document.
    if (!el.children.length) {
      const text = textOf(el);
      if (text) push(textBlock(text));
      return;
    }
    for (const child of el.children) visit(child);
  };

  visit(root);
  return out;
}

/**
 * { title, blocks } for either format. A saved page's own <title> is a better name
 * for the document than its file name.
 */
export function parseDocument(src) {
  const source = String(src || "");
  if (isHtmlDocument(source)) {
    try {
      const doc = new DOMParser().parseFromString(source, "text/html");
      const root = doc.querySelector("#doc, main, body") || doc.body;
      const heading = doc.querySelector("h1");
      const title = tidy(doc.querySelector("title")?.textContent) || tidy(heading?.textContent);
      const blocks = htmlToBlocks(root);
      if (blocks.length) {
        // The page's own <h1> is the same words as its <title>; the sheet already
        // prints that name above the page, so the heading would say it twice.
        const same = (a, b) =>
          String(a).toLowerCase().replace(/[^a-z0-9]+/g, "") === String(b).toLowerCase().replace(/[^a-z0-9]+/g, "");
        const first = blocks[0];
        if (first && first.type === "text" && first.variant === "name" && same(first.text, title)) blocks.shift();
        return { title: title.slice(0, 120), blocks };
      }
    } catch {
      // Not parseable as HTML after all: fall through and read it as text.
    }
  }
  return { title: "", blocks: parseMarkdown(source) };
}

export function parseMarkdown(src) {
  const blocks = [];
  let para = [];
  const flush = () => {
    if (!para.length) return;
    blocks.push(textBlock(para.join("\n")));
    blocks.push(textBlock(""));
    para = [];
  };
  for (const raw of String(src).replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) { flush(); continue; }
    let m;
    if ((m = line.match(/^#\s+(.*)$/))) { flush(); blocks.push(textBlock(clean(m[1]), { variant: "name" })); continue; }
    if ((m = line.match(/^#{2,6}\s+(.*)$/))) { flush(); blocks.push(textBlock(clean(m[1]), { variant: "heading" })); continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) { flush(); blocks.push(ruleBlock()); continue; }
    if ((m = line.trim().match(/^(?:\{\{(.+?)\}\}|\[\[(.+?)\]\])$/))) { flush(); blocks.push(fieldBlock((m[1] || m[2]).trim())); continue; }
    if ((m = line.match(/^\s*[-*+]\s+(.*)$/))) { para.push("• " + clean(m[1])); continue; }
    para.push(clean(line));
  }
  flush();
  while (blocks.length && blocks[blocks.length - 1].type === "text" && !blocks[blocks.length - 1].text) blocks.pop();
  return blocks.slice(0, 400);
}

export function toMarkdown(doc) {
  const out = [];
  for (const l of docLines(doc)) {
    if (l.kind === "image") continue;
    if (l.kind === "blank") { out.push(""); continue; }
    if (l.kind === "rule") { out.push("---"); continue; }
    const text = l.kind === "field" && !l.filled ? `[[${l.label || "Field"}]]` : l.text;
    if (l.variant === "name") out.push(`# ${text}`);
    else if (l.variant === "heading") out.push(`## ${text}`);
    else if (l.variant === "bold") out.push(`**${text}**`);
    else out.push(text);
  }
  return out.join("\n") + "\n";
}

export function downloadMarkdown(doc) {
  const blob = new Blob([toMarkdown(doc)], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const name = (doc?.title || "document").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 60) || "document";
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
