interface SafetyBannerProps {
  riskLevel: string;
  clinicianNotified: boolean;
}

// A pure renderer of the API's real clinicianNotified/riskLevel fields --
// it never claims a clinician was notified unless that field says so, and
// never invents copy the backend can't actually back up.
export function SafetyBanner({ riskLevel, clinicianNotified }: SafetyBannerProps) {
  if (riskLevel !== 'high' && riskLevel !== 'critical') return null;

  return (
    <div className="safety-banner" role="alert">
      <p>
        {clinicianNotified
          ? "I've let your care team know you may need some extra support right now."
          : 'It sounds like this might be a hard moment.'}
      </p>
      <p>
        If you are in immediate danger, please call <strong>911</strong>. You can also reach the 988 Suicide &amp;
        Crisis Lifeline any time, day or night, by calling or texting <strong>988</strong>.
      </p>
    </div>
  );
}
