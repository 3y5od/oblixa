/**
 * V9 §32 — When tension exists between adding capability vs improving the visible product,
 * choose improvement (see `v9 spec` §32). Prefer these toggles over new Core surface flags.
 *
 * **Public env inventory** — each must default safe-on for Core (omit or non-`0`):
 * - `NEXT_PUBLIC_INLINE_QUEUE_ACTIONS` — inline work/renewal row actions.
 * - `NEXT_PUBLIC_V9_INLINE_QUEUE_ACTIONS` — legacy fallback accepted during compatibility.
 */
export const ROLLOUT_PUBLIC_ENV_KEYS = ["NEXT_PUBLIC_INLINE_QUEUE_ACTIONS"] as const;
export const V9_ROLLOUT_PUBLIC_ENV_KEYS = ["NEXT_PUBLIC_V9_INLINE_QUEUE_ACTIONS"] as const;

/**
 * Safe-disable / kill-switch style toggles for higher-risk V9 UX (defaults on).
 * Set `NEXT_PUBLIC_INLINE_QUEUE_ACTIONS=0` to hide inline queue affordances without removing routes.
 */
export function inlineQueueActionsEnabled(): boolean {
  if (typeof process === "undefined") return true;
  const configured = process.env.NEXT_PUBLIC_INLINE_QUEUE_ACTIONS ?? process.env.NEXT_PUBLIC_V9_INLINE_QUEUE_ACTIONS;
  return configured == null || configured !== "0";
}

/** @deprecated Use inlineQueueActionsEnabled. */
export function v9InlineQueueActionsEnabled(): boolean {
  return inlineQueueActionsEnabled();
}
