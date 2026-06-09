/**
 * Pure keyboard helpers shared by every dropdown variant. Extracted from the
 * seven hand-rolled implementations so roving focus and index math live in one
 * place. No React — just DOM + arithmetic.
 */

/**
 * Move DOM focus among the focusable items inside `container` in response to an
 * arrow/Home/End key. Used by the roving-focus model (listbox without search,
 * action menus) where the active item IS the focused element. Returns `true`
 * when the key was handled so the caller can `preventDefault()`.
 *
 * Works even when focus currently sits on the trigger (current index -1):
 * ArrowDown → first item, ArrowUp → last item — matching the prior UiSelect
 * behaviour where pressing ArrowDown on a focused trigger jumps into the menu.
 */
export function moveRovingFocus(
  container: HTMLElement | null,
  key: string,
  selector = '[role="option"]:not([disabled]),[role="menuitem"]:not([disabled])'
): boolean {
  if (!container) return false;
  const items = Array.from(container.querySelectorAll<HTMLElement>(selector));
  if (items.length === 0) return false;
  const current = items.indexOf(document.activeElement as HTMLElement);
  let next: HTMLElement | undefined;
  switch (key) {
    case "ArrowDown":
      next = items[current + 1] ?? items[0];
      break;
    case "ArrowUp":
      next = items[current - 1] ?? items[items.length - 1];
      break;
    case "Home":
      next = items[0];
      break;
    case "End":
      next = items[items.length - 1];
      break;
    default:
      return false;
  }
  next?.focus();
  return true;
}

/**
 * Next highlighted index for the search-driven combobox model (aria-active-
 * descendant), where DOM focus stays in the search input and only an index
 * moves. Returns `null` when the key is not a navigation key (or the list is
 * empty), so the caller can fall through to other handling (e.g. Enter).
 */
export function nextActiveIndex(
  key: string,
  current: number,
  count: number
): number | null {
  if (count === 0) return null;
  switch (key) {
    case "ArrowDown":
      return Math.min(count - 1, current + 1);
    case "ArrowUp":
      return Math.max(0, current - 1);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}
