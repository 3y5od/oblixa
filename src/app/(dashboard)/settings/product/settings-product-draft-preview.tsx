"use client";

import { useEffect, useMemo, useState } from "react";
import { NAV_ITEMS } from "@/lib/navigation";
import { buildProductSurfaceContext } from "@/lib/product-surface/context";
import { isNavItemVisibleForSurface, toNavSurfaceInput } from "@/lib/product-surface/nav-visibility";
import { notificationTypesBlockedByMode } from "@/lib/notification-product-tier";
import { NOTIFICATION_TAXONOMY } from "@/lib/notification-taxonomy";
import type { WorkspaceRole } from "@/lib/navigation";
import type { WorkspaceProductMode } from "@/lib/product-surface/types";
import {
  ALL_ADVANCED_NAV_MODULE_KEYS,
  ALL_ASSURANCE_NAV_MODULE_KEYS,
  ALL_UTILITY_MODULE_KEYS,
  WORKSPACE_NAV_ROLE_ORDER,
} from "@/lib/product-surface/workspace-module-keys";

type PreviewState = {
  mode: WorkspaceProductMode;
  searchScope: "match_mode" | "core_only";
  navLabels: string[];
  enabledNotificationTypes: string[];
};

const EMAIL_MUTE_KEYS = ["reminder_due", "saved_view_summary", "automation_rule"] as const;

function parseMode(raw: FormDataEntryValue | null, fallback: WorkspaceProductMode): WorkspaceProductMode {
  const value = String(raw ?? "").trim();
  if (value === "core" || value === "advanced" || value === "assurance") return value;
  return fallback;
}

function toHiddenSet<T extends string>(
  formData: FormData,
  prefix: string,
  keys: readonly T[]
): T[] {
  return keys.filter((key) => formData.get(`${prefix}${key}`) === "on");
}

function toRoleList(
  formData: FormData,
  customizeKey: string,
  rolePrefix: string
): WorkspaceRole[] | undefined {
  if (formData.get(customizeKey) !== "on") return undefined;
  return WORKSPACE_NAV_ROLE_ORDER.filter((role) => formData.get(`${rolePrefix}${role}`) === "on");
}

export function deriveProductSettingsDraftPreviewState(input: {
  formData: FormData;
  orgId: string;
  featureFlags: Record<string, boolean>;
  initialBlockedTypes: string[];
  baseMode: WorkspaceProductMode;
}): PreviewState {
  const mode = parseMode(input.formData.get("workspace_mode"), input.baseMode);
  const searchScope =
    input.formData.get("search_scope") === "core_only" ? "core_only" : "match_mode";
  const advancedNavRoles = toRoleList(input.formData, "customize_advanced_nav_roles", "adv_nav_");
  const assuranceNavRoles =
    mode === "assurance"
      ? toRoleList(input.formData, "customize_assurance_nav_roles", "asm_nav_")
      : undefined;
  const advancedHidden = toHiddenSet(input.formData, "hide_", ALL_ADVANCED_NAV_MODULE_KEYS);
  const assuranceHidden = toHiddenSet(input.formData, "hide_assurance_", ALL_ASSURANCE_NAV_MODULE_KEYS);
  const utilityHidden = toHiddenSet(input.formData, "hide_utility_", ALL_UTILITY_MODULE_KEYS);

  const mutedKnown = EMAIL_MUTE_KEYS.filter((key) => input.formData.get(`mute_email_${key}`) === "on");
  const otherBlocked = input.initialBlockedTypes.filter((t) => !EMAIL_MUTE_KEYS.includes(t as (typeof EMAIL_MUTE_KEYS)[number]));
  const emailBlocked = new Set([...otherBlocked, ...mutedKnown]);
  const blockedByMode = new Set(notificationTypesBlockedByMode(mode));
  const enabledNotificationTypes = NOTIFICATION_TAXONOMY.filter(
    (row) => !blockedByMode.has(row.notificationType) && !emailBlocked.has(row.notificationType)
  ).map((row) => row.notificationType);

  const productSurface = buildProductSurfaceContext({
    orgId: input.orgId,
    role: "admin",
    v6: {
      workspace_mode: mode,
      search_scope: searchScope,
      advanced_modules_hidden: advancedHidden,
      assurance_modules_hidden: assuranceHidden,
      utility_modules_hidden: utilityHidden,
      advanced_nav_roles: advancedNavRoles,
      assurance_nav_roles: assuranceNavRoles,
    },
    featureFlags: input.featureFlags as never,
  });
  const navSurface = toNavSurfaceInput(productSurface);
  const navLabels = NAV_ITEMS.filter(
    (item) =>
      (item.section === "primary" || item.section === "workspace") &&
      isNavItemVisibleForSurface(item, navSurface)
  ).map((item) => item.name);

  return {
    mode,
    searchScope,
    navLabels,
    enabledNotificationTypes,
  };
}

export function SettingsProductDraftPreview(props: {
  formId: string;
  orgId: string;
  featureFlags: Record<string, boolean>;
  initialBlockedTypes: string[];
  initialMode: WorkspaceProductMode;
}) {
  const [preview, setPreview] = useState<PreviewState>({
    mode: props.initialMode,
    searchScope: "match_mode",
    navLabels: [],
    enabledNotificationTypes: [],
  });

  const seed = useMemo(
    () => ({
      orgId: props.orgId,
      featureFlags: props.featureFlags,
      initialBlockedTypes: props.initialBlockedTypes,
      baseMode: props.initialMode,
    }),
    [props.featureFlags, props.initialBlockedTypes, props.initialMode, props.orgId]
  );

  useEffect(() => {
    const form = document.getElementById(props.formId) as HTMLFormElement | null;
    if (!form) return;
    const sync = () => {
      const formData = new FormData(form);
      setPreview(deriveProductSettingsDraftPreviewState({ ...seed, formData }));
    };
    sync();
    form.addEventListener("input", sync);
    form.addEventListener("change", sync);
    return () => {
      form.removeEventListener("input", sync);
      form.removeEventListener("change", sync);
    };
  }, [props.formId, seed]);

  return (
    <section className="ui-card p-6 md:p-8">
      <p className="ui-label-caps">Draft preview (unsaved)</p>
      <p className="ui-muted-tight mt-2 text-[13px]">
        This preview updates as you change the form, before you click save.
      </p>
      <p className="ui-muted-tight mt-4 text-[13px]">Draft mode and search scope:</p>
      <p className="mt-1 text-sm text-[var(--text-primary)]">
        {preview.mode} mode · {preview.searchScope === "core_only" ? "core-only search scope" : "search follows workspace mode"}
      </p>
      <p className="ui-muted-tight mt-4 text-[13px]">Visible primary and workspace nav items:</p>
      <p className="mt-1 text-sm text-[var(--text-primary)]">{preview.navLabels.join(", ") || "None"}</p>
      <p className="ui-muted-tight mt-4 text-[13px]">
        Notification types enabled by draft mode + draft email mutes:
      </p>
      <p className="mt-1 text-sm text-[var(--text-primary)]">
        {preview.enabledNotificationTypes.join(", ") || "No delivery categories enabled"}
      </p>
    </section>
  );
}
