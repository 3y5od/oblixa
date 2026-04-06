import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { getAppBaseUrl } from "@/lib/app-url";

export async function POST() {
  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: membership } = await admin
    .from("organization_members")
    .select("role, organizations(stripe_customer_id)")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (membership?.role !== "admin") {
    return NextResponse.json({ error: "Only admins can manage billing" }, { status: 403 });
  }

  const customerId = (
    membership?.organizations as unknown as { stripe_customer_id: string | null } | null
  )?.stripe_customer_id;

  if (!customerId) {
    return NextResponse.json({ error: "No billing account" }, { status: 400 });
  }

  const appUrl = getAppBaseUrl();

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/settings/billing`,
  });

  return NextResponse.json({ url: session.url });
}
