import { useCallback, useEffect, useRef, useState } from 'react';
import { applyReviewEvent, highlightDuration, recordReviewHighlight, reviewRows } from '../review-events.js';
import { reviewsApi } from '../services/reviews.js';
import { useReviewSocket } from './useReviewSocket.js';
import { useTimedEntries } from './useTimedEntries.js';

export function useLiveReviews() {
  const [reviews, setReviews] = useState(null);
  const [loadError, setLoadError] = useState('');
  const pendingRequest = useRef();
  const { entries, set, remove } = useTimedEntries(highlightDuration);

  const refresh = useCallback(async () => {
    pendingRequest.current?.abort();
    const controller = new AbortController();
    pendingRequest.current = controller;
    try {
      const result = await reviewsApi.list(controller.signal);
      if (controller.signal.aborted) return;
      setReviews(result);
      setLoadError('');
    } catch (error) {
      if (!controller.signal.aborted) setLoadError(error.message);
    }
  }, []);

  useEffect(() => {
    refresh();
    return () => pendingRequest.current?.abort();
  }, [refresh]);

  const onEvent = useCallback((event) => {
    setReviews((current) => applyReviewEvent(current, event));
    recordReviewHighlight(event, { set, remove });
    refresh();
  }, [set, remove, refresh]);
  useReviewSocket(refresh, onEvent);

  return { reviews: reviewRows(reviews, entries), loadError, refresh };
}
