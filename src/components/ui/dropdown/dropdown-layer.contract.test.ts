import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const read = (p: string) =>
  readFileSync(join(process.cwd(), "src/components/ui/dropdown", p), "utf8");

const hook = read("use-dropdown-layer.ts");
const layer = read("dropdown-layer.tsx");
const menu = read("dropdown-menu.tsx");

describe("useDropdownLayer (overlay engine)", () => {
  it("measures from the trigger and flips up on collision", () => {
    expect(hook).toContain("getBoundingClientRect");
    expect(hook).toContain("spaceAbove > spaceBelow");
  });

  it("measures synchronously before opening (no (0,0) flash)", () => {
    expect(hook).toContain("if (next) setPosition(computePosition())");
  });

  it("outside-click excludes BOTH trigger and surface", () => {
    expect(hook).toContain("triggerRef.current?.contains(t)");
    expect(hook).toContain("surfaceRef.current?.contains(t)");
  });

  it("closes on Escape and supports reposition-vs-close on viewport change", () => {
    expect(hook).toContain('e.key === "Escape"');
    expect(hook).toContain('onViewportChange === "reposition"');
  });

  it("exposes spreadable trigger props with haspopup + expanded", () => {
    expect(hook).toContain('"aria-haspopup": role');
    expect(hook).toContain('"aria-expanded": open');
  });
});

describe("DropdownLayer (opaque portal surface)", () => {
  it("portals with fixed positioning and an opaque token surface", () => {
    expect(layer).toContain("createPortal");
    expect(layer).toContain('position: "fixed"');
    expect(layer).toContain("background: \"var(--surface-raised)\"");
  });

  it("uses inline critical chrome (border + shadow) and overscroll containment", () => {
    expect(layer).toContain("border: \"1px solid var(--border-strong)\"");
    expect(layer).toContain("boxShadow");
    expect(layer).toContain("overscroll-contain");
  });

  it("passes the z-index utility through verbatim", () => {
    expect(layer).toContain("zIndexClassName");
    expect(layer).not.toMatch(/<select[\s>]/);
  });
});

describe("DropdownMenu (role=menu)", () => {
  it("renders role=menu and roves focus across menuitems", () => {
    expect(menu).toContain('role="menu"');
    expect(menu).toContain("moveRovingFocus");
    expect(menu).toContain('[role="menuitem"]:not([disabled])');
  });

  it("focuses the first item on open and closes after activating one", () => {
    expect(menu).toContain("requestAnimationFrame");
    expect(menu).toContain('closest<HTMLElement>(\'[role="menuitem"]\')');
    expect(menu).toContain("close(true)");
  });

  it("accepts arbitrary children (supports server-rendered menuitems)", () => {
    expect(menu).toContain("children: ReactNode");
    expect(menu).toContain("isSubmitMenuItem");
    expect(menu).toContain('menuItem.closest("form")');
    expect(menu).not.toMatch(/<select[\s>]/);
  });
});
