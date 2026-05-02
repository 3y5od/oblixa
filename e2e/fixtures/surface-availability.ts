import raw from "./surface-availability.json";

type SurfaceAvailability = {
  marketingPaths?: string[];
  apiHealthPaths?: string[];
  /** Path prefixes where a 404 is treated as an optional matrix / fixture gap (not a hard failure). */
  optional404Prefixes?: string[];
};

const surface = raw as SurfaceAvailability;

/**
 * When true, Playwright may skip the test on 404 instead of failing hard.
 */
export function shouldTreat404AsOptionalMatrix(path: string): boolean {
  const prefixes = surface.optional404Prefixes ?? [];
  return prefixes.some((p) => path === p || path.startsWith(`${p}/`));
}
