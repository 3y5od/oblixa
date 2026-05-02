import {
  featureFamilyForApiPath,
  featureFamilyForPath,
  type FeatureFamilyKey,
} from "@/lib/product-surface/feature-registry";
import {
  resolveActionExemptSurface,
  resolveApiExemptSurface,
  resolvePageExemptSurface,
  type V8ExemptSurfaceClass,
} from "@/lib/product-surface/v8-exempt-surfaces";

export type V8SurfaceType = "page" | "api" | "server_action";

export type V8SurfaceMapping =
  | {
      status: "mapped";
      featureFamily: FeatureFamilyKey;
      surfaceType: V8SurfaceType;
      identifier: string;
    }
  | {
      status: "exempt";
      exemptClass: V8ExemptSurfaceClass;
      reason: string;
      surfaceType: V8SurfaceType;
      identifier: string;
    }
  | {
      status: "unmapped";
      surfaceType: V8SurfaceType;
      identifier: string;
    };

export function resolveFeatureMappingForPagePath(pathname: string): V8SurfaceMapping {
  const mapped = featureFamilyForPath(pathname);
  if (mapped) {
    return {
      status: "mapped",
      featureFamily: mapped,
      surfaceType: "page",
      identifier: pathname,
    };
  }
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return {
      status: "mapped",
      featureFamily: "contracts",
      surfaceType: "page",
      identifier: pathname,
    };
  }
  const exempt = resolvePageExemptSurface(pathname);
  if (exempt) {
    return {
      status: "exempt",
      exemptClass: exempt.class,
      reason: exempt.reason,
      surfaceType: "page",
      identifier: pathname,
    };
  }
  return {
    status: "unmapped",
    surfaceType: "page",
    identifier: pathname,
  };
}

export function resolveFeatureMappingForApiPath(pathname: string): V8SurfaceMapping {
  const mapped = featureFamilyForApiPath(pathname);
  if (mapped) {
    return {
      status: "mapped",
      featureFamily: mapped,
      surfaceType: "api",
      identifier: pathname,
    };
  }
  const exempt = resolveApiExemptSurface(pathname);
  if (exempt) {
    return {
      status: "exempt",
      exemptClass: exempt.class,
      reason: exempt.reason,
      surfaceType: "api",
      identifier: pathname,
    };
  }
  return {
    status: "unmapped",
    surfaceType: "api",
    identifier: pathname,
  };
}

export function resolveFeatureMappingForAction(actionIdentifier: string): V8SurfaceMapping {
  const normalized = actionIdentifier.trim();
  const featureHint = inferFeatureFamilyFromActionIdentifier(normalized);
  if (featureHint) {
    return {
      status: "mapped",
      featureFamily: featureHint,
      surfaceType: "server_action",
      identifier: normalized,
    };
  }

  const actionBase = actionFileBaseName(normalized);
  const exempt = resolveActionExemptSurface(actionBase);
  if (exempt) {
    return {
      status: "exempt",
      exemptClass: exempt.class,
      reason: exempt.reason,
      surfaceType: "server_action",
      identifier: normalized,
    };
  }

  return {
    status: "unmapped",
    surfaceType: "server_action",
    identifier: normalized,
  };
}

function actionFileBaseName(actionIdentifier: string): string {
  const fileSegment = actionIdentifier.split(":")[0] ?? actionIdentifier;
  const withoutPath = fileSegment.split("/").pop() ?? fileSegment;
  return withoutPath.replace(/\.ts$/, "");
}

function inferFeatureFamilyFromActionIdentifier(
  actionIdentifier: string
): FeatureFamilyKey | null {
  const normalized = actionIdentifier.toLowerCase();
  const base = actionFileBaseName(normalized);

  const byFileName: Record<string, FeatureFamilyKey> = {
    mfa: "settings",
    sessions: "settings",
    contracts: "contracts",
    "v10-bulk-compatible-work": "work",
    tasks: "work",
    obligations: "work",
    approvals: "work",
    "field-comments": "work",
    notes: "contracts",
    watchlists: "watchlists",
    maintenance: "maintenance",
    settings: "settings",
    "workflow-config": "settings",
    "saved-views": "reports",
    dashboard: "reports",
    automation: "autopilot",
    "renewal-playbook": "renewals",
    "onboarding-calibration": "settings",
    "product-surface-settings": "settings",
    exceptions: "exceptions",
  };
  if (byFileName[base]) return byFileName[base];

  if (normalized.includes("contracts")) return "contracts";
  if (normalized.includes("obligations")) return "work";
  if (normalized.includes("approvals")) return "work";
  if (normalized.includes("tasks")) return "work";
  if (normalized.includes("notes")) return "contracts";
  if (normalized.includes("saved-views")) return "reports";
  if (normalized.includes("watchlists")) return "watchlists";
  if (normalized.includes("maintenance")) return "maintenance";
  if (normalized.includes("settings")) return "settings";
  if (normalized.includes("workflow-config")) return "settings";
  if (normalized.includes("onboarding-calibration")) return "settings";
  if (normalized.includes("renewal")) return "renewals";
  if (normalized.includes("exceptions")) return "exceptions";
  if (normalized.includes("dashboard")) return "reports";
  if (normalized.includes("automation")) return "autopilot";
  if (normalized.includes("v4")) return "work";
  if (normalized.includes("field-comments")) return "work";
  return null;
}
