import { afterEach, describe, expect, it } from "vitest";
import { splitTextIntoExtractionChunks } from "@/lib/extraction/chunk-text";
import { applyGroundingToFields } from "@/lib/extraction/grounding";
import {
  mergeFieldRowsAcrossChunks,
  mergeToAllFieldNames,
  type ExtractedFieldResult,
} from "@/lib/extraction/extract-fields";
import {
  EXTRACTION_CHUNK_CHUNK_SIZE,
  EXTRACTION_CHUNK_THRESHOLD_CHARS,
  getExtractionChunkConcurrency,
} from "@/lib/extraction/constants";

describe("splitTextIntoExtractionChunks", () => {
  it("returns a single chunk when under threshold", () => {
    const t = "a".repeat(EXTRACTION_CHUNK_THRESHOLD_CHARS);
    expect(splitTextIntoExtractionChunks(t)).toHaveLength(1);
  });

  it("splits long text into multiple overlapping chunks", () => {
    const t = "b".repeat(EXTRACTION_CHUNK_THRESHOLD_CHARS + 10_000);
    const chunks = splitTextIntoExtractionChunks(t);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].length).toBeLessThanOrEqual(EXTRACTION_CHUNK_CHUNK_SIZE);
  });
});

describe("applyGroundingToFields", () => {
  const doc = "The counterparty is Acme Corp for this agreement.";

  it("keeps fields whose snippet appears in the document", () => {
    const fields: ExtractedFieldResult[] = [
      {
        field_name: "counterparty",
        field_value: "Acme Corp",
        source_snippet: "Acme Corp",
        confidence: 0.9,
      },
    ];
    const { fields: out, droppedCount } = applyGroundingToFields(doc, fields);
    expect(droppedCount).toBe(0);
    expect(out[0].field_value).toBe("Acme Corp");
  });

  it("clears values when snippet is not in the document", () => {
    const fields: ExtractedFieldResult[] = [
      {
        field_name: "counterparty",
        field_value: "Fake Inc",
        source_snippet: "Fake Inc",
        confidence: 0.9,
      },
    ];
    const { fields: out, droppedCount } = applyGroundingToFields(doc, fields);
    expect(droppedCount).toBe(1);
    expect(out[0].field_value).toBeNull();
    expect(out[0].confidence).toBe(0);
  });
});

describe("mergeFieldRowsAcrossChunks", () => {
  it("prefers higher confidence per field", () => {
    const low: ExtractedFieldResult[] = mergeToAllFieldNames([
      {
        field_name: "counterparty",
        field_value: "A",
        source_snippet: "A",
        confidence: 0.2,
      },
    ]);
    const high: ExtractedFieldResult[] = mergeToAllFieldNames([
      {
        field_name: "counterparty",
        field_value: "B",
        source_snippet: "B",
        confidence: 0.9,
      },
    ]);
    const merged = mergeFieldRowsAcrossChunks([low, high]);
    const cp = merged.find((f) => f.field_name === "counterparty");
    expect(cp?.field_value).toBe("B");
    expect(cp?.confidence).toBe(0.9);
  });
});

describe("getExtractionChunkConcurrency", () => {
  const orig = process.env.EXTRACTION_CHUNK_CONCURRENCY;

  afterEach(() => {
    if (orig === undefined) {
      delete process.env.EXTRACTION_CHUNK_CONCURRENCY;
    } else {
      process.env.EXTRACTION_CHUNK_CONCURRENCY = orig;
    }
  });

  it("defaults to 3", () => {
    delete process.env.EXTRACTION_CHUNK_CONCURRENCY;
    expect(getExtractionChunkConcurrency()).toBe(3);
  });

  it("clamps to 8", () => {
    process.env.EXTRACTION_CHUNK_CONCURRENCY = "99";
    expect(getExtractionChunkConcurrency()).toBe(8);
  });

  it("respects minimum 1", () => {
    process.env.EXTRACTION_CHUNK_CONCURRENCY = "0";
    expect(getExtractionChunkConcurrency()).toBe(3);
  });

  it("accepts valid values in range", () => {
    process.env.EXTRACTION_CHUNK_CONCURRENCY = "1";
    expect(getExtractionChunkConcurrency()).toBe(1);
    process.env.EXTRACTION_CHUNK_CONCURRENCY = "5";
    expect(getExtractionChunkConcurrency()).toBe(5);
  });
});
