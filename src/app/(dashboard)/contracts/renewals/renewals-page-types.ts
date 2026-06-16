import type { loadRenewalsPageModel } from "@/lib/renewals/model";

export type RenewalsPageModel = Awaited<ReturnType<typeof loadRenewalsPageModel>>;
export type RenewalFormAction = (formData: FormData) => void | Promise<void>;
