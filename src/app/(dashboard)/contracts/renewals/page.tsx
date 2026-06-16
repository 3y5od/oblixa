import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createContractTask } from "@/actions/tasks";
import { updateRenewalCheckpointStatus } from "@/actions/renewal-playbook";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { canEditContracts } from "@/lib/permissions";
import { isAdvancedModuleHidden, loadProductSurfaceContext } from "@/lib/product-surface";
import { loadRenewalsPageModel } from "@/lib/renewals/model";
import { RENEWALS_PAGE_TITLE } from "@/lib/renewals/spec-strings";
import { getAuthContext } from "@/lib/supabase/server";
import type { WorkspaceRole } from "@/lib/navigation";
import type { OrgRole } from "@/lib/types";
import { RenewalsPageView } from "./renewals-page-view";

export const metadata = { title: RENEWALS_PAGE_TITLE };

type RenewalsSearchParams = {
  window?: string | string[];
  horizon?: string | string[];
  owner?: string | string[];
  counterparty?: string | string[];
  status?: string | string[];
  review?: string | string[];
  sort?: string | string[];
  create?: string | string[];
  contract?: string | string[];
  error?: string | string[];
};

async function createRenewalTaskAction(formData: FormData) {
  "use server";

  const contractId = stringFromForm(formData, "contractId");
  const title = stringFromForm(formData, "title");
  const details = stringFromForm(formData, "details");
  const assigneeId = stringFromForm(formData, "assigneeId") || null;
  const dueDate = stringFromForm(formData, "dueDate") || null;

  const result = await createContractTask({
    contractId,
    title,
    details,
    assigneeId,
    dueDate,
    teamKey: "renewal_checkpoint",
    createdVia: "manual",
  });

  if ("error" in result && result.error) {
    redirect(`/renewals?create=1&error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath("/renewals");
  revalidatePath("/contracts/renewals");
  redirect("/renewals");
}

async function updateRenewalAction(formData: FormData) {
  "use server";

  const checkpointId = stringFromForm(formData, "checkpointId");
  const status = stringFromForm(formData, "status");
  const returnTo = safeRenewalsReturnTo(stringFromForm(formData, "returnTo"));
  const result = await updateRenewalCheckpointStatus({
    checkpointId,
    status: status === "pending" ? "pending" : "completed",
  });

  if ("error" in result && result.error) {
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath("/renewals");
  revalidatePath("/contracts/renewals");
  redirect(returnTo);
}

export default async function RenewalsPage(props: {
  searchParams: Promise<RenewalsSearchParams>;
}) {
  const searchParams = await props.searchParams;
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;

  const productSurface = await loadProductSurfaceContext(
    ctx.admin,
    ctx.orgId,
    ctx.role as WorkspaceRole
  );
  const model = await loadRenewalsPageModel(ctx.admin, ctx.orgId, {
    userId: ctx.user.id,
    role: ctx.role,
    workspaceMode: productSurface.mode,
    window: firstParam(searchParams.window),
    horizon: firstParam(searchParams.horizon),
    owner: firstParam(searchParams.owner),
    counterparty: firstParam(searchParams.counterparty),
    status: firstParam(searchParams.status),
    review: firstParam(searchParams.review),
    sort: firstParam(searchParams.sort),
    create: firstParam(searchParams.create),
    contract: firstParam(searchParams.contract),
  });
  const showDecisionsCta =
    (productSurface.mode === "advanced" || productSurface.mode === "assurance") &&
    !isAdvancedModuleHidden(productSurface, "decisions");

  return (
    <RenewalsPageView
      model={model}
      canMutate={canEditContracts(ctx.role as OrgRole)}
      showDecisionsCta={showDecisionsCta}
      error={firstParam(searchParams.error)}
      createRenewalTaskAction={createRenewalTaskAction}
      updateRenewalAction={updateRenewalAction}
    />
  );
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function stringFromForm(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function safeRenewalsReturnTo(value: string) {
  if (value.startsWith("/renewals") || value.startsWith("/contracts/renewals")) return value;
  return "/renewals";
}
