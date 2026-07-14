import { useEffect, useRef } from 'react';
import { useConversation } from '../../hooks/useConversation';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { SafetyBanner } from './SafetyBanner';
import { ContextCapNotice } from './ContextCapNotice';
import { QuickReplies } from './QuickReplies';
import { InlineAboutMePicker } from './InlineAboutMePicker';
import { InlinePendingConfirmation } from './InlinePendingConfirmation';
import { TextSizeControl } from '../layout/TextSizeControl';

export function ChatWindow() {
  const { messages, sendMessage, isLoading, isSending, error, lastSafety, state, connectFailed, retryConnect } = useConversation();
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
        <div className="chat-hero-row">
          <div className="chat-hero-title">
            <h1>🧭 Sofia</h1>
            <p>Your Cognitive Care Companion -- writing your brain health story together</p>
          </div>
          {/* Previously only reachable from the Profile page -- moved here too
              since chat is the surface people actually use most, and vision-
              related reading difficulty is one of the Lancet Commission's
              highest-leverage, most under-treated risk factors. */}
          <TextSizeControl className="on-hero" />
        </div>
      </div>
      <div className="chat-body">
        <div className="chat-log" ref={logRef} aria-live="polite" aria-relevant="additions">
          {isLoading && messages.length === 0 && <p className="chat-status">Sofia is getting ready...</p>}
          {/* Session creation failed even after automatic retries (see
              useConversation.ts's createSession mutation) -- e.g. a network
              blip, or the backend waking from a Render free-tier cold
              start. Distinct from the loading state above and from the
              gentler fallback below, which only shows once we're actually
              connected but the opening turn itself came back empty. */}
          {connectFailed && messages.length === 0 && (
            <div className="chat-status connect-error">
              <p role="alert">
                Sofia's having trouble connecting right now. This can happen if the server's just waking up -- it usually
                only takes a moment.
              </p>
              <button type="button" className="button-secondary" onClick={retryConnect}>
                Try again
              </button>
            </div>
          )}
          {/* Sofia normally speaks first -- her opening turn is generated
              server-side when the session is created (routes/sessions.js) and
              arrives as a real message in `messages`. This only shows once
              we're genuinely connected and that generation came back empty
              (e.g. the LLM provider isn't configured server-side yet). */}
          {!isLoading && !connectFailed && messages.length === 0 && (
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
          {/* Priority: a concrete proposal to confirm outranks the About Me
              picker, which outranks plain quick replies -- all three are
              mutually exclusive, trailing-turn-only facilitation controls. */}
          {showFacilitation && state?.pendingConfirmation && (
            <InlinePendingConfirmation confirmation={state.pendingConfirmation} onResolved={sendMessage} disabled={isSending} />
          )}
          {showFacilitation && !state?.pendingConfirmation && trailingTurn.inlinePicker && (
            <InlineAboutMePicker picker={trailingTurn.inlinePicker} onSubmit={sendMessage} disabled={isSending} />
          )}
          {showFacilitation &&
            !state?.pendingConfirmation &&
            !trailingTurn.inlinePicker &&
            trailingTurn.quickReplies &&
            trailingTurn.quickReplies.length > 0 && (
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
