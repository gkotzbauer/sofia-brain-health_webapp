import { useEffect, useRef } from 'react';
import { useConversation } from '../../hooks/useConversation';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { SafetyBanner } from './SafetyBanner';
import { ContextCapNotice } from './ContextCapNotice';

export function ChatWindow() {
  const { messages, sendMessage, isLoading, isSending, error, lastSafety, state } = useConversation();
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div className="chat-window">
      <div className="chat-log" ref={logRef} aria-live="polite" aria-relevant="additions">
        {isLoading && messages.length === 0 && <p className="chat-status">Sofia is getting ready...</p>}
        {/* Sofia normally speaks first -- her opening turn is generated
            server-side when the session is created (routes/sessions.js) and
            arrives as a real message in `messages`. This only shows if that
            generation failed (e.g. the LLM call errored) and the session
            genuinely has no messages yet. */}
        {!isLoading && messages.length === 0 && (
          <p className="chat-status">Hello, I'm Sofia. Whenever you're ready, tell me what's on your mind.</p>
        )}
        {messages.map((turn, index) => (
          <MessageBubble key={index} turn={turn} />
        ))}
        {isSending && (
          <p className="chat-status" aria-hidden="true">
            Sofia is thinking...
          </p>
        )}
      </div>
      {state?.contextCapped && <ContextCapNotice contextWindowSize={state.contextWindowSize} />}
      {lastSafety && <SafetyBanner riskLevel={lastSafety.riskLevel} clinicianNotified={lastSafety.clinicianNotified} />}
      {error && (
        <p className="chat-error" role="alert">
          {error}
        </p>
      )}
      <MessageInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
}
