import { useEffect } from 'react';
import { subscribeToSession } from '../api/client.js';

/**
 * Subscribes to SSE events for a session and dispatches them to a handler.
 * Automatically unsubscribes when the component unmounts or sessionId changes.
 */
export function useSessionEvents(sessionId, onEvent) {
  useEffect(() => {
    if (!sessionId) return;
    const unsubscribe = subscribeToSession(sessionId, onEvent);
    return unsubscribe;
  }, [sessionId, onEvent]);
}
