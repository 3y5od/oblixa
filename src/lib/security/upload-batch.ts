type ValidUploadedFileEntry = {
  file: Pick<File, "size" | "type">;
  validation: { ok: true; safeName: string };
};

export function uploadedFileDuplicateKey(file: Pick<File, "size" | "type">, safeName: string): string {
  return [safeName.normalize("NFC").toLowerCase(), file.type.toLowerCase(), String(file.size)].join("\0");
}

export function dedupeValidatedUploadedFiles<T extends ValidUploadedFileEntry>(
  entries: readonly T[]
): { files: T[]; duplicateCount: number; duplicateKeys: string[] } {
  const seen = new Set<string>();
  const files: T[] = [];
  const duplicateKeys: string[] = [];
  for (const entry of entries) {
    const key = uploadedFileDuplicateKey(entry.file, entry.validation.safeName);
    if (seen.has(key)) {
      duplicateKeys.push(key);
      continue;
    }
    seen.add(key);
    files.push(entry);
  }
  return { files, duplicateCount: duplicateKeys.length, duplicateKeys };
}
