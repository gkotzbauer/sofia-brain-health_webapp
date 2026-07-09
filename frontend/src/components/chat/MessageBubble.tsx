import { ConversationTurn } from '../../api/client';

// Renders message text as React children (auto-escaped) instead of the
// legacy app's innerHTML string interpolation -- structurally eliminates
// that XSS bug class rather than patching it.
export function MessageBubble({ turn }: { turn: ConversationTurn }) {
  const isUser = turn.role === 'user';
  const isClinician = turn.role === 'clinician';
  const roleClass = isUser ? 'message-user' : isClinician ? 'message-clinician' : 'message-sofia';

  return (
    <div className={`message ${roleClass}`}>
      {!isUser && (
        <span className="message-avatar" aria-hidden="true">
          {isClinician ? '💬' : '🧭'}
        </span>
      )}
      <div>
        {isClinician && <p className="message-author-label">{turn.authorName || 'Your care team'}</p>}
        <div className="message-bubble" style={{ whiteSpace: 'pre-wrap' }}>
          {turn.content}
        </div>
      </div>
    </div>
  );
}
