// Checks models.txt before a deploy.
//
// The list used to live as one long comma-separated line in wrangler.jsonc, and a
// lost comma fused two ids into one that no provider answers to. One model per
// line makes that impossible to do by accident, and this check catches a line
// that is not a vendor/model slug (a bare name, a stray comma, a space).
import { readFileSync } from "node:fs";

const file = new URL("../models.txt", import.meta.url);
const raw = readFileSync(file, "utf8");

const problems = [];
const seen = new Map();

raw.split("\n").forEach((line, i) => {
  const text = line.replace(/#.*$/, "").trim();
  if (!text) return;
  const where = `models.txt:${i + 1}`;

  if (text.includes(",")) {
    problems.push(`${where}: "${text}" has a comma — one model per line, please`);
    return;
  }
  const slashes = (text.match(/\//g) || []).length;
  if (slashes !== 1) {
    problems.push(`${where}: "${text}" needs exactly one slash (vendor/model), found ${slashes}`);
    return;
  }
  if (/\s/.test(text)) {
    problems.push(`${where}: "${text}" has a space`);
    return;
  }
  if (seen.has(text)) {
    problems.push(`${where}: "${text}" is already on line ${seen.get(text)}`);
    return;
  }
  seen.set(text, i + 1);
});

if (problems.length) {
  console.error(`models.txt has ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

if (!seen.size) {
  console.error("models.txt lists no models; the site would fall back to its built-in defaults.");
  process.exit(1);
}

console.log(`models.txt: ${seen.size} models, all vendor/model.`);
