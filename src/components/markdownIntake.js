// Markdown and text files in, as document blocks.
//
// One path for both ways a file arrives: the Import button in the editor and a
// file dropped on the page. Several files at once are fine — they are appended in
// the order they were chosen, and the first one names the template if it has no
// name yet.
import { toast } from "@wron/kit";
import { parseMarkdown } from "./mdTools";

const MAX_SIZE = 500 * 1024;
export const MD_ACCEPT = ".md,.markdown,.txt,.text,text/markdown,text/plain";

/** A .md / .markdown / .txt whether the browser filled in the type or not. */
export function isMarkdownFile(file) {
  if (!file) return false;
  return /\.(md|markdown|txt|text)$/i.test(file.name) || /^text\/(markdown|plain)$/i.test(file.type);
}

/**
 * Read files into blocks without touching the document.
 * Returns { blocks, title, added, skipped } where skipped holds a sentence per
 * file that could not be used, so the caller can say which one and why.
 */
export async function readMarkdownFiles(list) {
  const blocks = [];
  const added = [];
  const skipped = [];
  let title = "";

  for (const file of Array.from(list || [])) {
    if (!isMarkdownFile(file)) {
      skipped.push(`${file.name} is not a Markdown or text file.`);
      continue;
    }
    if (file.size > MAX_SIZE) {
      skipped.push(`${file.name} is over 500 KB.`);
      continue;
    }
    try {
      const parsed = parseMarkdown(await file.text());
      if (!parsed.length) {
        skipped.push(`${file.name} has no text to import.`);
        continue;
      }
      if (!title) title = file.name.replace(/\.[^.]+$/, "").slice(0, 140);
      blocks.push(...parsed);
      added.push(file.name);
    } catch {
      skipped.push(`${file.name} could not be read.`);
    }
  }

  return { blocks, title, added, skipped };
}

/**
 * Append Markdown/text files to the open document and report what happened.
 * The document is left alone when nothing usable was in the files.
 */
export async function addMarkdownFiles(list, setDoc) {
  const { blocks, title, added, skipped } = await readMarkdownFiles(list);

  if (blocks.length) {
    setDoc((d) => ({
      ...d,
      title: d.title || title,
      blocks: [...d.blocks, ...blocks],
    }));
    toast.success(
      added.length === 1 ? `${added[0]} imported` : `${added.length} files imported into this template`
    );
  }

  if (skipped.length) {
    const more = skipped.length > 1 ? ` (+${skipped.length - 1} more)` : "";
    toast.error(`${skipped[0]}${more}`);
  }
}
