import { FileText } from "lucide-react";
import type { ContractFile } from "@/lib/types";

function shortFileType(fileType: string): string {
  const t = fileType.toLowerCase();
  if (t.includes("pdf")) return "PDF";
  if (t.includes("wordprocessing") || t.includes("docx") || t.includes("msword")) return "DOCX";
  if (t.includes("csv")) return "CSV";
  if (t.includes("png")) return "PNG";
  if (t.includes("jpeg") || t.includes("jpg")) return "JPG";
  const tail = fileType.split("/").pop() ?? fileType;
  return tail.slice(0, 4).toUpperCase();
}

/** Informational file strip for the source preview. The schema stores one
 *  combined `search_document` per contract (no per-file text), so these chips
 *  label/locate the attached files but do NOT switch the preview content — the
 *  caption makes the combined nature explicit rather than implying a per-file
 *  switch that the data can't honor. */
export function ReviewFileSwitcher({ files }: { files: ContractFile[] }) {
  if (files.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="-mx-0.5 flex flex-nowrap items-center gap-1.5 overflow-x-auto px-0.5 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {files.map((file, index) => (
          <span
            key={file.id}
            title={file.file_name}
            className={`inline-flex max-w-[12rem] shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[10.5px] leading-none ${
              index === 0
                ? "border-[color:color-mix(in_oklab,var(--accent)_24%,var(--border-card))] bg-[color:color-mix(in_oklab,var(--accent-soft)_16%,var(--surface-raised))] text-[var(--text-primary)]"
                : "border-[var(--border-card)] bg-[var(--surface-raised)] text-[var(--text-secondary)]"
            }`}
          >
            <FileText className="h-3 w-3 shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.85} aria-hidden />
            <span className="truncate font-mono">{file.file_name}</span>
            <span className="ui-caps-3 shrink-0 text-[9px] text-[var(--text-tertiary)]">
              {shortFileType(file.file_type)}
            </span>
          </span>
        ))}
      </div>
      {files.length > 1 ? (
        <p className="text-[10.5px] leading-snug text-[var(--text-tertiary)]">
          <span className="font-mono tabular-nums text-[var(--text-secondary)]">{files.length}</span> files attached —
          preview shows combined extracted text.
        </p>
      ) : null}
    </div>
  );
}
