/**
 * Prefix cells that start with formula triggers so spreadsheets do not execute them as formulas.
 */
export function guardCsvCell(value: string): string {
  const t = value.trimStart();
  if (/^[=+\-@]/.test(t)) {
    return `'${value}`;
  }
  return value;
}

/** SYLK streams often start with `ID;` — treat as formula-like when exporting tabular text. */
export function guardSpreadsheetCell(value: string): string {
  const t = value.trimStart();
  if (/^ID;/i.test(t)) {
    return `'${value}`;
  }
  return guardCsvCell(value);
}
