import { createAdminClient } from "@/lib/supabase/server";

const PIXEL_GIF_BASE64 = "R0lGODlhAQABAIABAP///wAAACwAAAAAAQABAAACAkQBADs=";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token || token.length < 8) {
    return new Response(Buffer.from(PIXEL_GIF_BASE64, "base64"), {
      headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" },
      status: 200,
    });
  }
  const admin = await createAdminClient();
  const nowIso = new Date().toISOString();
  await admin
    .from("report_run_recipients")
    .update({
      opened_at: nowIso,
      delivery_status: "opened",
    })
    .eq("engagement_token", token)
    .is("opened_at", null);

  return new Response(Buffer.from(PIXEL_GIF_BASE64, "base64"), {
    headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" },
    status: 200,
  });
}
