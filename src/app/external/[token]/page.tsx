import { ExternalSubmitForm } from "@/components/external/external-submit-form";

export default async function ExternalActionPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-12 sm:px-6 sm:py-16">
      <ExternalSubmitForm token={token} />
    </div>
  );
}
