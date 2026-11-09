// A small, dependency-free PDF writer. US Letter, real margins, Times or Helvetica.
// Line widths are measured with the same font stack the preview uses, so lines break where the preview breaks.
import { docLines } from "../templateStore";
import { dataUrlToBinary } from "../imageTools";

const INK = "0.078 0.063 0.149 rg";
const VIOLET = "0.357 0.239 0.961 rg";
const PAGE_W = 612;
const PAGE_H = 792;
const LEADING = 1.3;

const SPEC = { body: { s: 11, b: false }, bold: { s: 11, b: true }, heading: { s: 11, b: true }, name: { s: 22, b: true } };
const STACK = {
  serif: '"Times New Roman", Times, "Liberation Serif", serif',
  sans: 'Helvetica, Arial, "Liberation Sans", sans-serif',
};

function clean(s) {
  return String(s ?? "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u2022/g, "\x95")
    .replace(/\t/g, "    ")
    .replace(/[^\x0A\x20-\x7E\x95\xA0-\xFF]/g, "?");
}
const esc = (s) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

function makeMeasure(font) {
  let ctx = null;
  try {
    ctx = document.createElement("canvas").getContext("2d");
  } catch {
    ctx = null;
  }
  return (text, size, bold) => {
    const t = text.replace(/\x95/g, "\u2022");
    if (!ctx) return t.length * size * 0.5;
    ctx.font = `${bold ? "bold " : ""}${size}px ${STACK[font]}`;
    return ctx.measureText(t).width;
  };
}

function wrap(text, maxW, size, bold, measure) {
  const out = [];
  let cur = "";
  const words = text.split(/ +/);
  for (let word of words) {
    if (word === "" && !cur) { cur = ""; continue; }
    while (measure(word, size, bold) > maxW && word.length > 1) {
      if (cur) { out.push(cur); cur = ""; }
      let cut = word.length - 1;
      while (cut > 1 && measure(word.slice(0, cut), size, bold) > maxW) cut--;
      out.push(word.slice(0, cut));
      word = word.slice(cut);
    }
    const t = cur ? cur + " " + word : word;
    if (cur && measure(t, size, bold) > maxW) { out.push(cur); cur = word; } else cur = t;
  }
  out.push(cur);
  return out;
}

export function buildPdf(doc) {
  const font = doc?.font === "sans" ? "sans" : "serif";
  const M = (Number(doc?.margin) || 1) * 72;
  const maxW = PAGE_W - M * 2;
  const TOP = PAGE_H - M;
  const measure = makeMeasure(font);

  const pages = [];
  let ops = [];
  let y = TOP;
  const images = [];
  const newPage = () => { pages.push(ops); ops = []; y = TOP; };

  for (const l of docLines(doc)) {
    if (l.kind === "blank") { y -= SPEC.body.s * LEADING; continue; }
    if (l.kind === "rule") {
      if (y - 10 < M) newPage();
      y -= 4;
      ops.push(`0.07 0.06 0.15 RG 0.75 w ${M} ${y.toFixed(2)} m ${PAGE_W - M} ${y.toFixed(2)} l S`);
      y -= 6;
      continue;
    }
    if (l.kind === "image") {
      let idx = images.findIndex((im) => im.src === l.src);
      if (idx < 0) { images.push({ src: l.src, w: l.w, h: l.h }); idx = images.length - 1; }
      let w = (maxW * (l.pct || 60)) / 100;
      let h = (w * l.h) / l.w;
      const maxH = TOP - M;
      if (h > maxH) { w = (w * maxH) / h; h = maxH; }
      if (y - h < M) newPage();
      y -= h;
      ops.push(`q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${M} ${y.toFixed(2)} cm /Im${idx} Do Q`);
      y -= 8;
      continue;
    }
    const spec = SPEC[l.variant] || SPEC.body;
    const unfilled = l.kind === "field" && !l.filled;
    const isHeading = l.variant === "heading";
    if (isHeading) y -= 6;
    const lines = wrap(clean(l.text), maxW, spec.s, spec.b, measure);
    lines.forEach((text, n) => {
      const lh = spec.s * LEADING;
      if (y - lh < M) newPage();
      y -= lh;
      const w = measure(text, spec.s, spec.b);
      const x = l.align === "center" ? M + (maxW - w) / 2 : l.align === "right" ? M + (maxW - w) : M;
      const face = font === "serif" ? (spec.b ? "F2" : "F1") : spec.b ? "F2" : "F1";
      ops.push(`BT /${face} ${spec.s} Tf ${unfilled ? VIOLET : INK} ${x.toFixed(2)} ${(y + spec.s * 0.28).toFixed(2)} Td (${esc(text)}) Tj ET`);
      if (isHeading && n === lines.length - 1) {
        ops.push(`0.07 0.06 0.15 RG 0.5 w ${M} ${(y - 1.5).toFixed(2)} m ${PAGE_W - M} ${(y - 1.5).toFixed(2)} l S`);
        y -= 4;
      }
    });
  }
  pages.push(ops);

  const base = font === "serif" ? ["Times-Roman", "Times-Bold"] : ["Helvetica", "Helvetica-Bold"];
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "",
    `<< /Type /Font /Subtype /Type1 /BaseFont /${base[0]} /Encoding /WinAnsiEncoding >>`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /${base[1]} /Encoding /WinAnsiEncoding >>`,
  ];
  images.forEach((im) => {
    const bin = dataUrlToBinary(im.src);
    objs.push(
      `<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bin.length} >>\nstream\n${bin}\nendstream`
    );
  });
  const xo = images.length ? ` /XObject << ${images.map((_, i) => `/Im${i} ${5 + i} 0 R`).join(" ")} >>` : "";
  const kids = [];
  for (const p of pages) {
    const content = p.join("\n");
    const pageNum = objs.length + 1;
    const contentNum = objs.length + 2;
    objs.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xo} >> /Contents ${contentNum} 0 R >>`
    );
    objs.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    kids.push(`${pageNum} 0 R`);
  }
  objs[1] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${kids.length} >>`;

  let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out +=
    `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` +
    offsets.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("") +
    `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}

export function downloadPdf(doc) {
  const bytes = buildPdf(doc);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const name = (doc?.title || "document").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 60) || "document";
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
