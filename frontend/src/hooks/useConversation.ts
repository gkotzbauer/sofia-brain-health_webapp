import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ChatTurnResponse, ConversationState, SofiaSession } from '../api/client';

const SESSION_ID_KEY = 'sofia_active_session_id';
// 1 initial attempt + 2 retries -- a network blip or a Render free-tier
// cold start (which can take 10-50+ seconds to wake) shouldn't permanently
// strand the person on a blank chat.
const MAX_CONNECT_ATTEMPTS = 3;

type ConnectStatus = 'idle' | 'connecting' | 'error';

function retryDelayFor(attempt: number): number {
  return Math.min(1000 * 2 ** (attempt - 1), 8000);
}

// sessionStorage, not localStorage: a session should represent one occasion
// of using the app (survives client-side navigation and a manual refresh
// within the same tab, but starts fresh when the tab/browser is reopened
// later) -- that's what makes "Sofia speaks first" (routes/sessions.js
// POST /sessions) actually fire again each time someone genuinely reopens
// the app, rather than silently resuming the same open-ended session
// forever and never generating a new greeting.
export function useConversation() {
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState<string | null>(() => sessionStorage.getItem(SESSION_ID_KEY));
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSafety, setLastSafety] = useState<ChatTurnResponse['safety'] | null>(null);
  // Real, user-visible connection status -- see attemptCreateSession below.
  const [connectStatus, setConnectStatus] = useState<ConnectStatus>('idle');
  // Guards against React 18 StrictMode's dev-only double-invoke of the
  // effect below firing two concurrent creates. Deliberately NOT built on
  // top of react-query's useMutation here: under StrictMode, a mutate()
  // call started from the transient first mount keeps running in the
  // background and its onError/onSettled callbacks do fire, but its
  // observer subscription gets torn down by the simulated unmount, so the
  // *second* (real, displayed) mount's useMutation instance never learns
  // the outcome -- confirmed directly (added temporary logging, watched
  // onSettled fire while the component never re-rendered). Plain useState
  // setters don't have that observer-subscription indirection, so a
  // hand-rolled retry loop sidesteps the issue entirely.
  const isCreatingSessionRef = useRef(false);

  const sessionQuery = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => api.getSession(sessionId as string),
    enabled: !!sessionId,
    retry: false,
    // Polls (only while the tab is focused -- react-query's default) so a
    // care-team message sent from the clinician view shows up here without
    // the user needing to send a message themselves first.
    refetchInterval: 20_000
  });

  const attemptCreateSession = useCallback(async () => {
    isCreatingSessionRef.current = true;
    setConnectStatus('connecting');

    for (let attempt = 1; attempt <= MAX_CONNECT_ATTEMPTS; attempt++) {
      try {
        const session = await api.createSession();
        // Seed the query cache directly -- the session Sofia just created
        // already carries her proactive opening turn (see backend
        // routes/sessions.js), so this avoids an extra round-trip/flash of
        // "loading" before that greeting appears.
        queryClient.setQueryData(['session', session.id], session);
        sessionStorage.setItem(SESSION_ID_KEY, session.id);
        setSessionId(session.id);
        setConnectStatus('idle');
        isCreatingSessionRef.current = false;
        return;
      } catch {
        if (attempt === MAX_CONNECT_ATTEMPTS) {
          setConnectStatus('error');
          isCreatingSessionRef.current = false;
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, retryDelayFor(attempt)));
      }
    }
  }, [queryClient]);

  useEffect(() => {
    // No session yet, or the stored id no longer resolves (e.g. it belonged
    // to a previous account) -- start a fresh one.
    if ((!sessionId || (sessionQuery.isError && !sessionQuery.isFetching)) && !isCreatingSessionRef.current) {
      attemptCreateSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, sessionQuery.isError, sessionQuery.isFetching]);

  function retryConnect() {
    if (isCreatingSessionRef.current) return;
    attemptCreateSession();
  }

  const messages = sessionQuery.data?.conversation_log || [];
  const state: ConversationState | undefined = sessionQuery.data?.state;

  const sendMessage = useCallback(
    async (message: string) => {
      if (!sessionId) return;
      setIsSending(true);
      setError(null);
      try {
        const response = await api.sendMessage(sessionId, message);
        setLastSafety(response.safety);
        queryClient.setQueryData<SofiaSession | undefined>(['session', sessionId], (prev) => {
          const now = new Date().toISOString();
          return {
            ...(prev as SofiaSession),
            conversation_log: [
              ...((prev?.conversation_log as SofiaSession['conversation_log']) || []),
              { role: 'user', content: message, timestamp: now },
              {
                role: 'assistant',
                content: response.reply,
                timestamp: now,
                storyMoment: response.storyMoment,
                quickReplies: response.quickReplies,
                inlinePicker: response.inlinePicker
              }
            ],
            state: response.state
          };
        });
        return response;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to send message');
        throw err;
      } finally {
        setIsSending(false);
      }
    },
    [sessionId, queryClient]
  );

  return {
    sessionId,
    messages,
    state,
    sendMessage,
    lastSafety,
    // True both while fetching an existing session AND while creating a new
    // one (including automatic retries) -- either way, there's nothing to
    // show yet and no fallback text should render.
    isLoading: sessionQuery.isLoading || connectStatus === 'connecting',
    // True only once creation has failed and exhausted its automatic
    // retries -- a real "we couldn't connect" state, distinct from still
    // loading and distinct from "connected fine, opening turn came back
    // empty" (e.g. the LLM provider isn't configured server-side).
    connectFailed: connectStatus === 'error',
    retryConnect,
    isSending,
    error
  };
}
