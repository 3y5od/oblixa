import { ExternalSubmitForm } from "@/components/external/external-submit-form";

export default async function ExternalActionPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;

  return (
    <div className="min-h-screen bg-canvas px-4 py-16">
      <ExternalSubmitForm token={token} />
    </div>
  );
}
