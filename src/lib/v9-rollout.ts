/**
 * V9 §32 — When tension exists between adding capability vs improving the visible product,
 * choose improvement (see `docs/v9.md` §32). Prefer these toggles over new Core surface flags.
 *
 * **Public env inventory (`NEXT_PUBLIC_V9_*`)** — each must default safe-on for Core (omit or non-`0`):
 * - `NEXT_PUBLIC_V9_INLINE_QUEUE_ACTIONS` — inline work/renewal row actions (see `v9InlineQueueActionsEnabled`).
 */
export const V9_ROLLOUT_PUBLIC_ENV_KEYS = ["NEXT_PUBLIC_V9_INLINE_QUEUE_ACTIONS"] as const;

/**
 * Safe-disable / kill-switch style toggles for higher-risk V9 UX (defaults on).
 * Set `NEXT_PUBLIC_V9_INLINE_QUEUE_ACTIONS=0` to hide inline queue affordances without removing routes.
 */
export function v9InlineQueueActionsEnabled(): boolean {
  if (typeof process === "undefined" || !process.env.NEXT_PUBLIC_V9_INLINE_QUEUE_ACTIONS) return true;
  return process.env.NEXT_PUBLIC_V9_INLINE_QUEUE_ACTIONS !== "0";
}
