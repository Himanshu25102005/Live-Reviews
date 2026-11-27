import { reviewsApi } from './services/reviews.js';

export const undoDuration = 5_000;

export async function undoReview(takeDeletion, token) {
  const deletion = takeDeletion(token);
  if (deletion) return reviewsApi.restore(deletion.id, token);
}
