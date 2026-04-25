export default function OnboardingCalibrationLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading calibration. Wizard steps and workspace defaults will appear shortly.
      </div>
      <div className="ui-page-stack mx-auto max-w-lg px-4" aria-hidden aria-busy="true">
        <div className="ui-skeleton h-4 w-24 rounded" />
        <div className="ui-page-shell mt-4 space-y-4 bg-surface p-6">
          <div className="ui-skeleton h-5 max-w-md rounded" />
          <div className="ui-skeleton h-4 w-full rounded" />
          <div className="ui-skeleton h-10 w-full rounded-lg" />
          <div className="ui-skeleton h-10 w-full rounded-lg" />
          <div className="ui-skeleton h-10 w-full rounded-lg" />
        </div>
      </div>
    </>
  );
}
