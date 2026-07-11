import { ConversationTurn } from '../../api/client';

// Renders message text as React children (auto-escaped) instead of the
// legacy app's innerHTML string interpolation -- structurally eliminates
// that XSS bug class rather than patching it.
export function MessageBubble({ turn }: { turn: ConversationTurn }) {
  const isUser = turn.role === 'user';
  const isClinician = turn.role === 'clinician';
  const roleClass = isUser ? 'message-user' : isClinician ? 'message-clinician' : 'message-sofia';
  const storyMomentClass = turn.storyMoment ? ' story-moment' : '';

  return (
    <div className={`message ${roleClass}${storyMomentClass}`}>
      {/* Sofia's own messages drop the avatar -- role is conveyed by bubble
          color/alignment instead (matching sofia-enhanced-narrative.html).
          Clinician messages keep one: a real person breaking into the log
          is a rarer, meaningfully different event worth a visual marker. */}
      {isClinician && (
        <span className="message-avatar" aria-hidden="true">
          💬
        </span>
      )}
      <div>
        {isClinician && <p className="message-author-label">{turn.authorName || 'Your care team'}</p>}
        {turn.storyMoment && <p className="story-moment-badge">🌟 A meaningful moment</p>}
        <div className="message-bubble" style={{ whiteSpace: 'pre-wrap' }}>
          {turn.content}
        </div>
      </div>
    </div>
  );
}
