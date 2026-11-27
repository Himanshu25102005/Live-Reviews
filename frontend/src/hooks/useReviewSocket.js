import { useEffect } from 'react';

const reviewEvents = new Set(['review:created', 'review:updated', 'review:deleted']);

export function useReviewSocket(onConnect, onEvent) {
  useEffect(() => {
    const url = new URL('/ws', window.location.origin);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    let socket;
    let retryDelay = 500;

    function onOpen() {
      retryDelay = 500;
      onConnect();
    }

    function onMessage({ data }) {
      let event;
      try {
        event = JSON.parse(data);
      } catch {
        return;
      }
      if (reviewEvents.has(event?.type)) onEvent(event);
    }

    function detach() {
      socket?.removeEventListener('open', onOpen);
      socket?.removeEventListener('message', onMessage);
      socket?.removeEventListener('close', onClose);
    }

    function onClose() {
      detach();
      retryTimer = window.setTimeout(connect, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 5_000);
    }

    function connect() {
      socket = new WebSocket(url);
      socket.addEventListener('open', onOpen);
      socket.addEventListener('message', onMessage);
      socket.addEventListener('close', onClose);
    }

    // Defer the first handshake so a development Strict Mode cleanup can cancel it.
    let retryTimer = window.setTimeout(connect, 0);
    return () => {
      window.clearTimeout(retryTimer);
      detach();
      socket?.close();
    };
  }, [onConnect, onEvent]);
}
