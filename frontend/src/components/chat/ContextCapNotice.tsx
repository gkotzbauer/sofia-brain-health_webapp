interface ContextCapNoticeProps {
  contextWindowSize?: number;
}

// Distinct from SafetyBanner on purpose -- this is an operational notice
// (cost/context-window management), not a safety escalation, and shouldn't
// be styled or worded like one.
export function ContextCapNotice({ contextWindowSize }: ContextCapNoticeProps) {
  return (
    <div className="context-cap-notice" role="status">
      <p>
        This conversation has grown quite long, so Sofia's replies are now based on your most recent
        {contextWindowSize ? ` ${Math.floor(contextWindowSize / 2)} exchanges` : ' messages'} rather than everything
        from the very start. Your full conversation is still saved, and a member of your care team has been notified
        in case you'd like extra support.
      </p>
    </div>
  );
}
