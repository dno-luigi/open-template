// Markdown in and out. Import turns a .md or .txt file into document parts.
// Export writes the current document as Markdown, with unfilled fields as [[Field name]].
import { textBlock, fieldBlock, ruleBlock, docLines } from "./templateStore";

const clean = (s) =>
  s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/`([^`]+)`/g, "$1");

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
