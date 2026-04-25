/**
 * Escape a single CSV field for spreadsheet export (formula-injection mitigation).
 * Prefix cells that begin with formula triggers (=, +, -, @, tab, CR) with a single quote
 * per common CSV/Excel conventions, then apply standard quoting for commas and quotes.
 */
export function escapeCsvCellForSpreadsheet(value: string | null | undefined): string {
  if (value == null || value === "") return "";
  let t = String(value);
  if (/^[=+\-@\t\r]/.test(t)) {
    t = `'${t}`;
  }
  if (/[",\n\r]/.test(t)) {
    return `"${t.replace(/"/g, '""')}"`;
  }
  return t;
}
