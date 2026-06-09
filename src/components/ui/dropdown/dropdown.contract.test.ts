import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DIR = join(process.cwd(), "src/components/ui/dropdown");
const read = (f: string) => readFileSync(join(DIR, f), "utf8");

describe("dropdown subsystem contract", () => {
  it("option rows reserve a LEFT check slot, not a stranded far-right tick", () => {
    const row = read("dropdown-option-row.tsx");
    // The reserved-width check slot is the first child of the row (§10.9).
    expect(row).toContain("inline-flex h-4 w-4 shrink-0");
    // The check glyph is a real lucide icon (not a unicode char); it may now be
    // co-imported with the optional kind-icons (Paperclip / FileX).
    expect(row).toMatch(/import \{[^}]*\bCheck\b[^}]*\} from "lucide-react"/);
    // Trailing counts use tabular figures so digit columns don't dance (§10.11).
    expect(row).toContain("tabular-nums");
    // Optional leading kind-icons (e.g. a paperclip for a "has file" option).
    expect(row).toContain("Paperclip");
  });

  it("listbox is a real role=listbox with contained overscroll and no native select", () => {
    const listbox = read("dropdown-listbox.tsx");
    expect(listbox).toContain('role="listbox"');
    expect(listbox).toContain("overscroll-contain");
    expect(listbox).not.toMatch(/<select[\s>]/);
    // Banned by ui-quality-sweep — never width/height fit utilities (§11.11).
    expect(listbox).not.toMatch(/\b[wh]-fit\b/);
    expect(listbox).not.toContain("fit-content");
  });

  it("selected rows get an accent wash + inset rail, not a flat full-row slab", () => {
    const listbox = read("dropdown-listbox.tsx");
    expect(listbox).toContain("inset 2px 0 0 0 var(--accent-strong)");
  });

  it("zero-count options read quiet-but-available, never disabled (§2.11)", () => {
    const listbox = read("dropdown-listbox.tsx");
    expect(listbox).toContain("opt.count === 0");
    expect(listbox).toContain("opacity-55");
  });

  it("searchable lists fall back to a structured empty state", () => {
    const empty = read("dropdown-empty-state.tsx");
    expect(empty).toContain("No matches");
    expect(empty).toContain("SearchX");
  });

  it("keyboard helpers support both roving focus and the activedescendant index model", () => {
    const kb = read("dropdown-keyboard.ts");
    expect(kb).toContain("export function moveRovingFocus");
    expect(kb).toContain("export function nextActiveIndex");
  });
});
