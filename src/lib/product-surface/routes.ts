import type { WorkspaceProductMode } from "@/lib/product-surface/types";
import {
  minWorkspaceModeForRegistryPath,
  workspaceModeAtLeast,
} from "@/lib/product-surface/feature-registry";

/** Longest-prefix wins. Returns null when path is not gated by product mode (Core always ok). */
export function minWorkspaceModeForPath(pathname: string): WorkspaceProductMode | null {
  return minWorkspaceModeForRegistryPath(pathname);
}

export function isPathAllowedForWorkspaceMode(
  pathname: string,
  workspaceMode: WorkspaceProductMode
): boolean {
  const min = minWorkspaceModeForPath(pathname);
  if (!min) return true;
  return workspaceModeAtLeast(workspaceMode, min);
}
