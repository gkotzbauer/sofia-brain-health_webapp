interface QuickRepliesProps {
  options: string[];
  onSelect: (option: string) => void;
  disabled?: boolean;
}

// Renders Sofia's suggested next things to say/tap, from the trailing
// turn's quickReplies (see backend utils/llm/schema.js quick_replies).
// This is the core mechanic that makes the conversation feel facilitated --
// a concrete menu of next steps, not a blank box -- modeled on
// sofia-fixed(4).html's narrative-choice buttons. Free text is always still
// available via MessageInput alongside these.
export function QuickReplies({ options, onSelect, disabled }: QuickRepliesProps) {
  if (options.length === 0) return null;

  return (
    <div className="quick-replies" role="group" aria-label="Suggested replies">
      {options.map((option) => (
        <button key={option} type="button" className="pill quick-reply-btn" onClick={() => onSelect(option)} disabled={disabled}>
          {option}
        </button>
      ))}
    </div>
  );
}
