import { formatUnknownForServerLog } from "@/lib/observability/log-redaction";

function samplingKey(scope: string): string {
  const seed = process.env.E2E_RANDOM_SEED?.trim();
  return seed ? `${scope}:${seed}` : scope;
}

/** Minimal server logger for sweep / diagnostics (redacted unknown payloads). */
export function createSweepLogger(scope: string) {
  const key = samplingKey(scope);
  return {
    info(message: string, extra?: unknown) {
      if (extra === undefined) {
        console.info(`[${key}]`, message);
      } else {
        console.info(`[${key}]`, message, formatUnknownForServerLog(extra));
      }
    },
    error(message: string, extra?: unknown) {
      if (extra === undefined) {
        console.error(`[${key}]`, message);
      } else {
        console.error(`[${key}]`, message, formatUnknownForServerLog(extra));
      }
    },
  };
}
