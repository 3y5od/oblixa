/**
 * Client-safe upload limits.
 *
 * The contract-file limit MUST stay in sync with the server-enforced
 * `MAX_FILE_SIZE` literal in `src/actions/contracts.ts` — that literal is kept
 * inline (not imported) because `scripts/check-upload-security-guards.mjs`
 * pins it as a security marker. This module is the single source for the
 * client validation + display copy.
 */
export const CONTRACT_FILE_MAX_BYTES = 25 * 1024 * 1024; // 25 MB
export const CONTRACT_FILE_MAX_MB_LABEL = "25 MB";
