import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";
import {
  KNOWN_HEADERS,
  MAX_CSV_BYTES,
  REQUIRED_HEADERS,
  TEMPLATE_HEADERS,
  type CsvCheck,
  type ImportApiBody,
} from "./bulk-upload-form-types";

export function isFile(value: FormDataEntryValue | null): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

export function importErrorMessage(body: ImportApiBody | null, fallback: string): string {
  return describeRecoverableMutationError(
    body?.details?.v10?.user_visible_message ??
      body?.v10?.user_visible_message ??
      body?.error ??
      fallback
  );
}

export function isCsvFile(file: File): boolean {
  return (
    file.type === "text/csv" ||
    file.type === "application/vnd.ms-excel" ||
    file.name.toLowerCase().endsWith(".csv")
  );
}

export function isPdfOrDocx(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    file.type === "application/pdf" ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".pdf") ||
    name.endsWith(".docx")
  );
}

export async function inspectCsv(file: File): Promise<CsvCheck> {
  const tooLarge = file.size > MAX_CSV_BYTES;
  let text = "";
  try {
    text = await file.text();
  } catch {
    return { rows: 0, missingHeaders: [...REQUIRED_HEADERS], ignoredHeaders: [], tooLarge, empty: true };
  }

  const lines = text.split(/\r\n|\r|\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { rows: 0, missingHeaders: [...REQUIRED_HEADERS], ignoredHeaders: [], tooLarge, empty: true };
  }

  const headers = lines[0]
    .split(",")
    .map((cell) => cell.trim().replace(/^"+|"+$/g, "").toLowerCase());
  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  const ignoredHeaders = headers.filter(
    (header) => header.length > 0 && !KNOWN_HEADERS.has(header)
  );

  return {
    rows: Math.max(0, lines.length - 1),
    missingHeaders,
    ignoredHeaders,
    tooLarge,
    empty: lines.length < 2,
  };
}

export function downloadTemplate() {
  const example: Record<string, string> = {
    title: "Acme Master Services Agreement",
    counterparty: "Acme Corporation",
    owner_email: "owner@yourteam.com",
    contract_type: "MSA",
    region: "North America",
    source_system: "Salesforce",
    external_reference_id: "CW-00481",
  };
  const csv = `${TEMPLATE_HEADERS.join(",")}\n${TEMPLATE_HEADERS.map((header) => example[header] ?? "").join(",")}\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "oblixa-contract-import-template.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
