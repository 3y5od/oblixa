// One-shot mechanical zinc utility classes to semantic tokens in src. Run: node scripts/zinc-sweep-tokens.mjs
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const T = {
  text900: "text-[var(--text-primary)]",
  text800: "text-[var(--text-primary)]",
  text700: "text-[var(--text-secondary)]",
  text600: "text-[var(--text-secondary)]",
  text500: "text-[var(--text-tertiary)]",
  text400: "text-[var(--text-tertiary)]",
  text300: "text-[var(--text-tertiary)]",
  border: "border-[var(--border-subtle)]",
  borderStrong: "border-[var(--border-strong)]",
  bgSubtle: "bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))]",
  bgSubtle2: "bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))]",
  /** Section tint without forcing border-b (unlike .ui-surface-tint) */
  bgMutedBar: "bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,var(--canvas))]",
  btnDark: "bg-[var(--text-primary)]",
  textInverse: "text-[var(--text-inverse)]",
  darkBgOverlay: "dark:bg-[color:color-mix(in_oklab,var(--surface-raised)_35%,transparent)]",
};

/** Longest / most specific first */
const REPLACEMENTS = [
  // divides & rings
  [/\bdivide-zinc-100\b/g, "divide-[var(--border-subtle)]"],
  [/\bdivide-zinc-200\b/g, "divide-[var(--border-subtle)]"],
  [/\bring-zinc-300\b/g, "ring-[var(--border-strong)]"],
  [/\bring-zinc-200\b/g, "ring-[var(--border-subtle)]"],
  // borders with opacity
  [/\bborder-zinc-200\/90\b/g, T.border],
  [/\bborder-zinc-200\/80\b/g, T.border],
  [/\bborder-zinc-200\/60\b/g, T.border],
  [/\bhover:border-zinc-300\b/g, "hover:border-[var(--border-strong)]"],
  [/\bborder-zinc-300\b/g, T.borderStrong],
  [/\bborder-zinc-200\b/g, T.border],
  [/\bborder-zinc-100\b/g, T.border],
  [/\bborder-t border-zinc-100\b/g, "border-t border-[var(--border-subtle)]"],
  // background mixes (light)
  [/\bbg-zinc-50\/80\b/g, T.bgSubtle],
  [/\bbg-zinc-50\/60\b/g, T.bgMutedBar],
  [/\bbg-zinc-50\/50\b/g, T.bgSubtle2],
  [/\bbg-zinc-50\/40\b/g, T.bgSubtle2],
  [/\bhover:bg-zinc-100\/80\b/g, "hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_65%,var(--canvas))]"],
  [/\bhover:bg-zinc-100\b/g, "hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_72%,var(--canvas))]"],
  [/\bhover:bg-zinc-50\b/g, "hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_50%,var(--canvas))]"],
  [/\bbg-zinc-100\b/g, "bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))]"],
  [/\bbg-zinc-50\b/g, T.bgSubtle],
  // dark mode overlays (replace zinc with surface mix)
  [/\bdark:bg-zinc-900\/30\b/g, T.darkBgOverlay],
  [/\bdark:bg-zinc-900\/20\b/g, T.darkBgOverlay],
  // text
  [/\btext-zinc-900\b/g, T.text900],
  [/\btext-zinc-800\b/g, T.text800],
  [/\btext-zinc-700\b/g, T.text700],
  [/\btext-zinc-600\b/g, T.text600],
  [/\btext-zinc-500\b/g, T.text500],
  [/\btext-zinc-400\b/g, T.text400],
  [/\btext-zinc-300\b/g, T.text300],
  // hover text
  [/\bhover:text-zinc-700\b/g, "hover:text-[var(--text-secondary)]"],
  [/\bhover:text-zinc-900\b/g, "hover:text-[var(--text-primary)]"],
  // stroke (icons)
  [/\bstroke-zinc-400\b/g, "stroke-[var(--text-tertiary)]"],
  [/\bstroke-zinc-500\b/g, "stroke-[var(--text-tertiary)]"],
  // common button / focus (skip link–style)
  [/\bbg-zinc-900\b/g, T.btnDark],
  [/\bfocus:bg-zinc-900\b/g, "focus:bg-[var(--text-primary)]"],
  [/\bfocus:text-white\b/g, "focus:text-[var(--text-inverse)]"],
  // pre / code blocks
  [/\bbg-zinc-950\b/g, "bg-[var(--surface-inset)]"],
];

async function walk(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next") continue;
      await walk(p, out);
    } else if (/\.(tsx|ts)$/.test(e.name)) out.push(p);
  }
  return out;
}

async function main() {
  const root = join(process.cwd(), "src");
  const files = await walk(root);
  let n = 0;
  for (const file of files) {
    let s = await readFile(file, "utf8");
    const orig = s;
    for (const [re, to] of REPLACEMENTS) {
      s = s.replace(re, to);
    }
    if (s !== orig) {
      await writeFile(file, s, "utf8");
      n++;
    }
  }
  console.log(`Updated ${n} files.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
