import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { V10_SPEC_TRACE } from "./v10-spec-trace-map";
import { buildV10DocRuntimeProofRows, validateV10DocRuntimeProofRows } from "./v10-traceability-ledger";

function numberedSectionsFromV10Doc(): Set<string> {
  const text = readFileSync(join(process.cwd(), "docs/v10.md"), "utf8");
  const keys = new Set<string>();
  for (const line of text.split(/\n/)) {
    const top = /^## (\d+)\.\s/.exec(line);
    if (top) keys.add(top[1]);
    const sub = /^### (\d+(?:\.\d+)+)\s/.exec(line);
    if (sub) keys.add(sub[1]);
  }
  return keys;
}

describe("docs/v10.md ↔ V10_SPEC_TRACE parity", () => {
  it("maps every numbered spec heading to exactly one trace key and back", () => {
    const docKeys = numberedSectionsFromV10Doc();
    const traceKeys = new Set(Object.keys(V10_SPEC_TRACE));

    const missingInTrace = [...docKeys].filter((k) => !traceKeys.has(k));
    const orphanTraceKeys = [...traceKeys].filter((k) => !docKeys.has(k));

    expect(missingInTrace, `docs/v10.md sections missing from V10_SPEC_TRACE: ${missingInTrace.join(", ")}`).toEqual([]);
    expect(orphanTraceKeys, `V10_SPEC_TRACE keys not present in docs/v10.md: ${orphanTraceKeys.join(", ")}`).toEqual([]);
  });

  it("keeps doc runtime proof rows valid (ledger + acceptance + CI + evidence)", () => {
    expect(validateV10DocRuntimeProofRows(buildV10DocRuntimeProofRows())).toEqual([]);
  });
});
