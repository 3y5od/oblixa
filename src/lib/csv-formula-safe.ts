/**
 * Escape a single CSV field for spreadsheet export (formula-injection mitigation).
 * Prefix cells that begin with formula triggers (=, +, -, @, tab, CR) with a single quote
 * per common CSV/Excel conventions, then apply standard quoting for commas and quotes.
 */
export function stripCsvBidiControlCharacters(value: string): string {
  return value.replace(/[\u202a-\u202e\u2066-\u2069]/g, "");
}

export function escapeCsvCellForSpreadsheet(value: string | null | undefined): string {
  if (value == null || value === "") return "";
  let t = stripCsvBidiControlCharacters(String(value));
  const trimmedStart = t.trimStart();
  if (/^[\t\r]/.test(t) || /^[=+\-@]/.test(trimmedStart)) {
    t = `'${t}`;
  }
  if (/[",\n\r]/.test(t)) {
    return `"${t.replace(/"/g, '""')}"`;
  }
  return t;
}
