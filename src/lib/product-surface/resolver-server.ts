import { isNotificationAllowed } from "@/lib/notification-policy";
import type { AdminClient } from "@/lib/v6/service";

export async function isNotificationCategoryAllowed(
  admin: AdminClient,
  input: { organizationId: string; channel: "email" | "slack"; notificationType: string }
): Promise<boolean> {
  return isNotificationAllowed(admin, input);
}
