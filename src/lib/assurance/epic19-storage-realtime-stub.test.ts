import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Epic 19 — Full storage bucket / signed URL / Realtime subscribe probes require a Supabase integration harness.
 * Until then we anchor env documentation parity for public Supabase keys.
 */
describe("Epic 19 — storage / realtime assurance stub", () => {
  it("documents NEXT_PUBLIC Supabase keys in .env.example", () => {
    const example = fs.readFileSync(path.join(process.cwd(), ".env.example"), "utf8");
    expect(example).toContain("NEXT_PUBLIC_SUPABASE_URL=");
    expect(example).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY=");
  });
});
