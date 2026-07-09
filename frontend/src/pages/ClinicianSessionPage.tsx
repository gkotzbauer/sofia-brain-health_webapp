import { FormEvent, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useClinicianSession } from '../hooks/useClinicianSession';
import { MessageBubble } from '../components/chat/MessageBubble';

export function ClinicianSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { session, isLoading, error, sendMessage, isSending } = useClinicianSession(sessionId);
  const [draft, setDraft] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    await sendMessage(draft.trim());
    setDraft('');
  }

  return (
    <div className="clinician-session-page">
      <Link to="/clinician" className="back-link">
        &larr; Back to alerts
      </Link>
      <h1>{session ? `${session.user_name}'s conversation` : 'Conversation'}</h1>
      <p className="section-intro">
        Messages you send here appear in the person's conversation, clearly labeled as coming from their care team --
        never disguised as Sofia.
      </p>

      {isLoading && <p>Loading conversation...</p>}
      {error && (
        <p className="form-error" role="alert">
          Could not load this conversation.
        </p>
      )}

      {session && (
        <>
          <div className="clinician-transcript" aria-label="Conversation transcript">
            {session.conversation_log.length === 0 ? (
              <p className="empty-state">No messages yet.</p>
            ) : (
              session.conversation_log.map((turn, index) => <MessageBubble key={index} turn={turn} />)
            )}
          </div>

          <form className="clinician-message-form" onSubmit={handleSubmit}>
            <label htmlFor="clinician-message">Send a message as the care team</label>
            <textarea
              id="clinician-message"
              rows={3}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Write a message to send into this person's conversation..."
            />
            <button type="submit" disabled={isSending || !draft.trim()}>
              {isSending ? 'Sending...' : 'Send message'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
