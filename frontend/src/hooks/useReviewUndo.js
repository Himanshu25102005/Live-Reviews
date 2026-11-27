import { useState } from 'react';
import { undoDuration, undoReview } from '../review-undo.js';
import { reviewsApi } from '../services/reviews.js';
import { useTimedEntries } from './useTimedEntries.js';

export function useReviewUndo(refresh) {
  const { entries, set, take } = useTimedEntries(undoDuration);
  const [undoError, setUndoError] = useState('');

  async function deleteReview({ id, title }) {
    const token = await reviewsApi.remove(id);
    if (token) set(token, { id, title });
    setUndoError('');
    refresh();
  }

  async function undo(token) {
    setUndoError('');
    try {
      if (await undoReview(take, token)) refresh();
    } catch (error) {
      setUndoError(`Could not restore review. ${error.message}`);
    }
  }

  return { deleteReview, undo, entries, undoError, dismissUndoError: () => setUndoError('') };
}
