import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ERROR_FILES = [
  "src/app/(auth)/error.tsx",
  "src/app/(dashboard)/error.tsx",
  "src/app/external/error.tsx",
  "src/app/global-error.tsx",
  "src/app/error.tsx",
];

describe("App Router error boundaries", () => {
  it.each(ERROR_FILES)("%s exists", (rel) => {
    const abs = path.join(process.cwd(), rel);
    expect(fs.existsSync(abs)).toBe(true);
  });
});
