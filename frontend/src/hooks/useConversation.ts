import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ChatTurnResponse, ConversationState, SofiaSession } from '../api/client';

const SESSION_ID_KEY = 'sofia_active_session_id';

export function useConversation() {
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState<string | null>(() => localStorage.getItem(SESSION_ID_KEY));
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSafety, setLastSafety] = useState<ChatTurnResponse['safety'] | null>(null);

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

  useEffect(() => {
    // No session yet, or the stored id no longer resolves (e.g. it belonged
    // to a previous account) -- start a fresh one.
    if (!sessionId || (sessionQuery.isError && !sessionQuery.isFetching)) {
      api.createSession().then((session) => {
        // Seed the query cache directly -- the session Sofia just created
        // already carries her proactive opening turn (see backend
        // routes/sessions.js), so this avoids an extra round-trip/flash of
        // "loading" before that greeting appears.
        queryClient.setQueryData(['session', session.id], session);
        localStorage.setItem(SESSION_ID_KEY, session.id);
        setSessionId(session.id);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, sessionQuery.isError, sessionQuery.isFetching]);

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
    isLoading: sessionQuery.isLoading,
    isSending,
    error
  };
}
