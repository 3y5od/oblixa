import { describe, expect, it } from "vitest";
import { UI_SURFACE_MANIFEST, getUiSurfaceByRoute } from "@/lib/qa/ui-surface-manifest";

describe("ui surface classification", () => {
  it("classifies representative public, authenticated, and external routes", () => {
    expect(getUiSurfaceByRoute("/dashboard")?.mode).toBe("authenticated");
    expect(getUiSurfaceByRoute("/login")?.shellFamily).toBe("auth");
    expect(getUiSurfaceByRoute("/")?.shellFamily).toBe("marketing");
    expect(getUiSurfaceByRoute("/external/[token]")?.mode).toBe("external");
  });

  it("keeps routes unique in the manifest", () => {
    const routes = UI_SURFACE_MANIFEST.map((entry) => entry.route);
    expect(new Set(routes).size).toBe(routes.length);
  });
});

