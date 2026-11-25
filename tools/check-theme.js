#!/usr/bin/env node
// Agent Swapfume's safety check for a weekly artist theme.
// Run from the swapfume folder:  node tools/check-theme.js
// Exits with code 1 (and lists every problem) if the theme must NOT be pushed.
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const problems = [], notes = [];
const fail = (m) => problems.push(m);

// ---------- 1. css/theme.css ----------
const css = read("css/theme.css");
if (css.length > 40000) fail(`css/theme.css is ${css.length} bytes (limit 40000).`);
if (!/SWAPFUME THEME:/.test(css)) fail('css/theme.css must start with the "SWAPFUME THEME: <artist>" header comment.');
for (const m of css.matchAll(/@import\s+url\(["']?([^"')]+)/g))
  if (!m[1].startsWith("https://fonts.googleapis.com/")) fail(`@import is only allowed for Google Fonts, found: ${m[1]}`);
for (const m of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
  const u = m[1];
  if (u.startsWith("https://fonts.googleapis.com/") || u.startsWith("data:image/svg+xml")) continue;
  if (!u.startsWith("../icons/theme/")) { fail(`url() may only point to ../icons/theme/… or be an inline SVG, found: ${u}`); continue; }
  const file = path.join(root, "icons/theme", u.slice("../icons/theme/".length).split("?")[0]);
  if (!fs.existsSync(file)) fail(`Missing theme file: ${path.relative(root, file)}`);
  else if (fs.statSync(file).size > 250000) fail(`${path.relative(root, file)} is over 250 KB.`);
}
// Things a theme must never do (they would hide or break parts of the site).
const banned = [
  [/display\s*:\s*none/i, "display: none (themes may not hide anything)"],
  [/visibility\s*:\s*hidden/i, "visibility: hidden"],
  [/\[hidden\]/, "[hidden] rules"],
  [/pointer-events\s*:\s*none/i, "pointer-events: none (only allowed on body::before / body::after)"],
  [/position\s*:\s*(fixed|sticky)/i, "position: fixed/sticky (only allowed on body::before / body::after)"],
  [/font-size\s*:\s*(0|[0-9]px|1[0-1]px|0?\.[0-6]\d*rem)/i, "font sizes smaller than 12px"],
  [/expression\(|javascript:|behavior\s*:/i, "script in CSS"],
];
const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
const outsideBodyPseudo = cssNoComments.replace(/body::(before|after)\s*\{[^}]*\}/g, "");
for (const [re, label] of banned) if (re.test(outsideBodyPseudo)) fail(`css/theme.css uses ${label}.`);

// Tokens: the last value set in a :root block wins (dark-mode blocks are checked separately).
function tokens(block) {
  const t = {};
  for (const m of block.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) t[m[1]] = m[2].trim();
  return t;
}
const rootBlocks = [...cssNoComments.matchAll(/(@media[^{]*\{\s*)?:root[^{]*\{([^}]*)\}/g)];
const base = {}, dark = {};
for (const m of rootBlocks) Object.assign(/prefers-color-scheme:\s*dark/.test(m[1] || "") ? dark : base, tokens(m[2]));
const required = ["bg", "surface", "surface-2", "ink", "muted", "line", "accent", "accent-fill", "accent-ink", "accent-soft", "teal", "gold", "gold-soft", "gold-ink", "ok", "ok-soft", "warn", "warn-soft", "danger", "ring", "field", "field-line"];
for (const k of required) if (!base[k]) fail(`css/theme.css must set --${k} in :root.`);

function hex(c) {
  if (!c) return null;
  c = c.trim();
  let m = c.match(/^#([0-9a-f]{3,8})$/i);
  if (m) {
    let h = m[1];
    if (h.length <= 4) h = [...h].map((x) => x + x).join("");
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  m = c.match(/^rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/i);
  return m ? [+m[1], +m[2], +m[3]] : null;
}
const lum = (rgb) => rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
  .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// Text colour → backgrounds it sits on, and the minimum contrast (WCAG AA).
const pairs = [
  ["ink", ["bg", "surface", "surface-2", "field"], 4.5],
  ["muted", ["bg", "surface", "surface-2"], 4.5],
  ["accent", ["bg", "surface", "accent-soft"], 4.5],
  ["accent-ink", ["accent-fill"], 4.5],
  ["teal", ["bg", "surface"], 4.5],
  ["gold", ["bg", "surface"], 3],
  ["gold-ink", ["gold-soft"], 4.5],
  ["ok", ["ok-soft"], 4.5],
  ["warn", ["warn-soft"], 4.5],
  ["danger", ["surface", "bg"], 4.5],
  ["ring", ["bg", "surface"], 3],
  ["field-line", ["field"], 1.6],
];
function checkSet(t, label) {
  for (const [fg, bgs, min] of pairs) for (const bg of bgs) {
    const a = hex(t[fg]), b = hex(t[bg]);
    if (!a || !b) { notes.push(`${label}: could not read --${fg} or --${bg} as a plain colour (use #hex), skipped.`); continue; }
    const r = ratio(a, b);
    if (r < min) fail(`${label}: --${fg} ${t[fg]} on --${bg} ${t[bg]} is ${r.toFixed(2)}:1, needs ${min}:1.`);
  }
}
checkSet(base, "Main colours");
if (Object.keys(dark).length) checkSet({ ...base, ...dark }, "Dark-mode colours");

// ---------- 2. js/theme-art.js ----------
const artSrc = read("js/theme-art.js");
if (artSrc.length > 60000) fail(`js/theme-art.js is ${artSrc.length} bytes (limit 60000).`);
const sandbox = { window: {} };
try { new Function("window", artSrc)(sandbox.window); } catch (e) { fail(`js/theme-art.js does not run: ${e.message}`); }
const T = sandbox.window.SwapfumeTheme;
if (!T) fail("js/theme-art.js must set window.SwapfumeTheme.");
else {
  if (!T.id || !/^[a-z0-9-]+$/.test(T.id)) fail("SwapfumeTheme.id must be a short lowercase id like \"van-gogh\".");
  if (!T.name) fail("SwapfumeTheme.name (the artist's name) is missing.");
  const ids = [];
  for (const k of ["avatarLeft", "avatarRight", "bottleLeft", "bottleRight"]) {
    const s = T[k];
    if (typeof s !== "string" || !s.trim().startsWith("<svg")) { fail(`SwapfumeTheme.${k} must be an inline <svg>…</svg> string.`); continue; }
    if (!/aria-hidden="true"/.test(s)) fail(`SwapfumeTheme.${k} needs aria-hidden="true".`);
    if (/<script|<foreignObject|\son\w+\s*=|javascript:|<image|href="http/i.test(s)) fail(`SwapfumeTheme.${k} contains scripts, external images or links.`);
    if (k.startsWith("avatar") && !/class="avatar"/.test(s)) fail(`SwapfumeTheme.${k} needs class="avatar" on the <svg>.`);
    for (const m of s.matchAll(/\sid="([^"]+)"/g)) ids.push(m[1]);
  }
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  if (dup.length) fail(`Duplicate SVG ids across the theme art (they clash on the page): ${[...new Set(dup)].join(", ")}`);
}
if (/fetch\(|XMLHttpRequest|localStorage|document\.|eval\(|import\(/.test(artSrc)) fail("js/theme-art.js may only define window.SwapfumeTheme (no fetch, document, storage or eval).");

// ---------- 3. index.html points at the files ----------
const html = read("index.html");
if (!/css\/theme\.css\?v=\d+/.test(html)) fail("index.html must load css/theme.css?v=<number>.");
if (!/js\/theme-art\.js\?v=\d+/.test(html)) fail("index.html must load js/theme-art.js?v=<number>.");
if (T && T.id && !css.includes(`Theme id: ${T.id}`)) fail(`css/theme.css header must say "Theme id: ${T.id}" (same as js/theme-art.js).`);

// ---------- Report ----------
for (const n of notes) console.log("note:", n);
if (problems.length) {
  console.log(`\n✗ Theme check FAILED (${problems.length} problem${problems.length > 1 ? "s" : ""}):`);
  for (const p of problems) console.log("  - " + p);
  process.exit(1);
}
console.log(`✓ Theme check passed: ${T.name} (${T.id}).`);
