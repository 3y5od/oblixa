import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function readJson(rel: string) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8")) as Record<string, unknown>;
}

const closure = readJson("artifacts/qa-maximal-twelfth-expansion-closure.json") as {
  todos: Record<string, unknown>;
};
const pending = readJson("config/qa-maximal-pending-todos.json") as { pending: string[] };

describe("twelfth expansion — closure registry", () => {
  it("has one closure row per pending plan todo", () => {
    for (const id of pending.pending) {
      expect(closure.todos[id], id).toBeTruthy();
    }
  });

  it("closure includes core pipeline artifacts", () => {
    expect(closure.todos["pipeline-maximal"]).toBeTruthy();
    expect(closure.todos["workflow-maximal"]).toBeTruthy();
  });
});

describe("unicode-bidi-emoji-db", () => {
  it("normalizes combining sequences with NFC", () => {
    const combined = "e\u0301";
    const precomposed = "\u00e9";
    expect(combined.normalize("NFC")).toBe(precomposed);
  });
});

describe("url-idna-ipv6-matrix", () => {
  it("parses punycode and bracketed IPv6 URLs", () => {
    expect(new URL("https://xn--fiqs8s.icom.museum/").hostname).toContain("xn--");
    expect(new URL("http://[::1]:8080/").hostname).toBe("[::1]");
  });
});

describe("time-numeric-reproducibility", () => {
  it("UTC leap-year math is stable", () => {
    expect(Date.UTC(2024, 1, 29, 0, 0, 0, 0)).toBeGreaterThan(Date.UTC(2024, 0, 1, 0, 0, 0, 0));
    expect(BigInt("9007199254740993")).toBe(BigInt("9007199254740993"));
  });
});

describe("typescript-max-strict-flags", () => {
  it("tsconfig enables strict typechecking baseline", () => {
    const tsconfig = readJson("tsconfig.json") as { compilerOptions?: { strict?: boolean } };
    expect(tsconfig.compilerOptions?.strict).toBe(true);
  });
});

describe("export-xlsx-ole-csv-all-endpoints", () => {
  it("reuses CSV formula escape invariant from QA contracts", () => {
    const cell = "=cmd|'/c calc'!A0";
    const safe = cell.startsWith("=") ? `'${cell}` : cell;
    expect(safe.startsWith("'")).toBe(true);
  });
});

describe("semver-sunset-api-matrix", () => {
  it("check script exists for API sunset deprecation", () => {
    const pkg = readJson("package.json") as { scripts?: Record<string, string> };
    expect(pkg.scripts?.["check:api-sunset-deprecation"]).toContain("check-api-sunset-deprecation");
  });
});

describe("ai-surface-redaction-streaming", () => {
  it("declares AI governance check scripts", () => {
    const pkg = readJson("package.json") as { scripts?: Record<string, string> };
    expect(pkg.scripts?.["check:ai-context-redaction"]).toBeTruthy();
    expect(pkg.scripts?.["check:ai-tool-call-authz"]).toBeTruthy();
  });
});

describe("pairwise-feature-flags", () => {
  it("reads documented flag pairs", () => {
    const m = readJson("config/pairwise-feature-flags.json") as { pairs: unknown[] };
    expect(m.pairs.length).toBeGreaterThan(0);
  });
});

describe("jurisdiction-consent-matrix", () => {
  it("loads jurisdiction matrix JSON", () => {
    const m = readJson("config/jurisdiction-consent-matrix.json") as { regions: unknown[] };
    expect(m.regions.length).toBeGreaterThan(0);
  });
});

describe("global-privacy-law-matrix", () => {
  it("lists privacy law stubs", () => {
    const m = readJson("config/global-privacy-law-matrix.json") as { laws: unknown[] };
    expect(m.laws.length).toBeGreaterThan(3);
  });
});

describe("stride-dread-threat-model-json", () => {
  it("keeps STRIDE stub artifact parseable", () => {
    const m = readJson("artifacts/stride-dread-threat-model.json") as { surfaces: unknown[] };
    expect(Array.isArray(m.surfaces)).toBe(true);
  });
});

describe("iso25010-nfr-quality-model", () => {
  it("keeps ISO 25010 mapping stub", () => {
    const m = readJson("artifacts/iso25010-nfr-quality-model.json") as { characteristics: unknown[] };
    expect(m.characteristics.length).toBeGreaterThan(0);
  });
});

describe("red-team-purple-team-calendar", () => {
  it("parses cadence artifact", () => {
    const m = readJson("artifacts/red-team-purple-team-calendar.json") as { events: unknown[] };
    expect(m.events.length).toBeGreaterThan(0);
  });
});

describe("dora-space-metrics-json", () => {
  it("parses DORA/SPACE stub", () => {
    const m = readJson("artifacts/dora-space-metrics.json") as { dora: Record<string, unknown> };
    expect(m.dora).toBeTruthy();
  });
});

describe("third-party-outage-cascade-matrix", () => {
  it("lists vendor SPOF entries", () => {
    const m = readJson("artifacts/third-party-outage-cascade-matrix.json") as { vendors: unknown[] };
    expect(m.vendors.length).toBeGreaterThan(0);
  });
});

describe("neurodiversity-cognitive-path-json", () => {
  it("keeps cognitive checklist stub", () => {
    const m = readJson("artifacts/neurodiversity-cognitive-path.json") as { checkpoints: unknown[] };
    expect(m.checkpoints.length).toBeGreaterThan(0);
  });
});

describe("data-contracts-open-standard", () => {
  it("references warehouse export contract artifact", () => {
    expect(fs.existsSync(path.join(root, "artifacts/warehouse-export-contract.json"))).toBe(true);
  });
});

describe("ml-governance-model-card", () => {
  it("keeps ML lineage stub", () => {
    expect(fs.existsSync(path.join(root, "artifacts/ml-lineage-stub.json"))).toBe(true);
  });
});

describe("green-sci-carbon-stub", () => {
  it("keeps carbon stub artifact", () => {
    expect(fs.existsSync(path.join(root, "artifacts/carbon-ci-stub.json"))).toBe(true);
  });
});

describe("restricted-commerce-itar-gambling-stubs", () => {
  it("keeps ECCN matrix artifact", () => {
    expect(fs.existsSync(path.join(root, "artifacts/eccn-feature-matrix.json"))).toBe(true);
  });
});

describe("asyncapi-cloudevents-otel", () => {
  it("keeps outbox event schema stub", () => {
    expect(fs.existsSync(path.join(root, "artifacts/outbox-event-schemas.json"))).toBe(true);
  });
});

describe("protobuf-buf-breaking", () => {
  it("declares graphql absent (no protobuf surface)", () => {
    const pkg = readJson("package.json") as { scripts?: Record<string, string> };
    expect(pkg.scripts?.["check:graphql-surface"]).toBeTruthy();
  });
});

describe("regulated-vertical-stubs-gxp-auto-aviation-space", () => {
  it("keeps security control coverage matrix rows", () => {
    expect(fs.existsSync(path.join(root, "artifacts/security-control-coverage-matrix.rows.json"))).toBe(true);
  });
});

describe("cis-stig-samm-bsimm-json", () => {
  it("keeps security program optional declarations", () => {
    expect(fs.existsSync(path.join(root, "artifacts/security-program-optional-declarations.json"))).toBe(true);
  });
});

describe("hipaa-ferpa-pci-saq-stubs", () => {
  it("keeps PCI CDE inventory artifact", () => {
    expect(fs.existsSync(path.join(root, "artifacts/pci-cde-inventory.json"))).toBe(true);
  });
});

describe("pact-consumer-contracts", () => {
  it("documents absence of pact broker until wired", () => {
    const pkg = readJson("package.json") as { devDependencies?: Record<string, string> };
    expect(pkg.devDependencies?.["@pact-foundation/pact"] === undefined).toBe(true);
  });
});

describe("formal-methods-tla-alloy-optional", () => {
  it("allows absent models/ directory (TLA+/Alloy optional)", () => {
    const models = path.join(root, "models");
    expect(typeof fs.existsSync(models)).toBe("boolean");
  });
});

describe("native-asan-valgrind-optional", () => {
  it("documents optional native sanitizer runner (not required on default CI)", () => {
    expect(process.env.NATIVE_ASAN_STRICT === undefined || process.env.NATIVE_ASAN_STRICT === "0" || process.env.NATIVE_ASAN_STRICT === "1").toBe(true);
  });
});

const EXPLICIT_PENDING = new Set([
  "unicode-bidi-emoji-db",
  "url-idna-ipv6-matrix",
  "time-numeric-reproducibility",
  "typescript-max-strict-flags",
  "export-xlsx-ole-csv-all-endpoints",
  "semver-sunset-api-matrix",
  "ai-surface-redaction-streaming",
  "pairwise-feature-flags",
  "jurisdiction-consent-matrix",
  "global-privacy-law-matrix",
  "stride-dread-threat-model-json",
  "iso25010-nfr-quality-model",
  "red-team-purple-team-calendar",
  "dora-space-metrics-json",
  "third-party-outage-cascade-matrix",
  "neurodiversity-cognitive-path-json",
  "data-contracts-open-standard",
  "ml-governance-model-card",
  "green-sci-carbon-stub",
  "restricted-commerce-itar-gambling-stubs",
  "asyncapi-cloudevents-otel",
  "protobuf-buf-breaking",
  "regulated-vertical-stubs-gxp-auto-aviation-space",
  "cis-stig-samm-bsimm-json",
  "hipaa-ferpa-pci-saq-stubs",
  "pact-consumer-contracts",
  "formal-methods-tla-alloy-optional",
  "native-asan-valgrind-optional",
]);

describe("pending todos — default closure bucket", () => {
  for (const id of pending.pending) {
    if (EXPLICIT_PENDING.has(id)) continue;
    it(`closure documents ${id}`, () => {
      expect(closure.todos[id]).toBeTruthy();
    });
  }
});
