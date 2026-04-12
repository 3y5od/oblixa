/** Dispatched on `window` to open the command palette with an optional seeded query (V7 §11 header search). */
export const COMMAND_PALETTE_OPEN_EVENT = "oblixa:command-palette-open";

export type CommandPaletteOpenDetail = {
  query?: string;
};
