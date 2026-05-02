/** Branded integer minor units (e.g. USD cents) — avoid floating currency. */
export type Cents = number & { readonly __brand: "Cents" };

export function toCentsFromDecimalString(amount: string): Cents {
  const n = Number(amount);
  if (!Number.isFinite(n)) throw new Error("invalid amount");
  return Math.round(n * 100) as Cents;
}

export function formatCentsUsd(c: Cents): string {
  return (c / 100).toFixed(2);
}
