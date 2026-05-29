/** Dispatched on `window` to open the command palette with an optional seeded query (V7 §11 header search).
 *
 *  Surviving callers (search-page-maximal-pass T6.6):
 *  - `src/components/layout/command-palette-loader.tsx` — listens; opens overlay on receipt of the event or the ⌘K keydown.
 *  - `src/components/layout/command-palette.tsx`       — listens; same.
 *  - `src/app/(dashboard)/search/error.tsx`            — dispatches; "Open command palette" recovery action.
 *
 *  The chrome header form (`header.tsx`) NO LONGER dispatches this event;
 *  header Enter → `/search?q=…`. ⌘K continues to open the overlay via the
 *  loader's keydown handler. Document any new dispatcher here.
 */
export const COMMAND_PALETTE_OPEN_EVENT = "oblixa:command-palette-open";

export type CommandPaletteOpenDetail = {
  query?: string;
};
