import { useEffect, useRef } from 'react';
import { useConversation } from '../../hooks/useConversation';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { SafetyBanner } from './SafetyBanner';
import { ContextCapNotice } from './ContextCapNotice';
import { QuickReplies } from './QuickReplies';
import { InlineAboutMePicker } from './InlineAboutMePicker';

export function ChatWindow() {
  const { messages, sendMessage, isLoading, isSending, error, lastSafety, state } = useConversation();
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  // Facilitation controls (quick-reply buttons, the inline About Me picker)
  // only ever apply to the trailing message -- once the person replies
  // (their message becomes the new trailing entry), the previous prompt's
  // controls naturally stop showing, matching sofia-fixed(4).html's
  // behavior of only ever offering choices for the latest bot message.
  const trailingTurn = messages[messages.length - 1];
  const showFacilitation = trailingTurn?.role === 'assistant' && !isSending;

  return (
    <div className="chat-window">
      <div className="chat-hero">
        <h1>🧭 Sofia</h1>
        <p>Your Cognitive Care Companion -- writing your brain health story together</p>
      </div>
      <div className="chat-body">
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
          {showFacilitation && trailingTurn.inlinePicker && (
            <InlineAboutMePicker picker={trailingTurn.inlinePicker} onSubmit={sendMessage} disabled={isSending} />
          )}
          {showFacilitation && !trailingTurn.inlinePicker && trailingTurn.quickReplies && trailingTurn.quickReplies.length > 0 && (
            <QuickReplies options={trailingTurn.quickReplies} onSelect={sendMessage} disabled={isSending} />
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
    </div>
  );
}
