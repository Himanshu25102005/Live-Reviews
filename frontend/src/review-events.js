export const highlightDuration = 3_000;

export function recordReviewHighlight(event, highlights) {
  if (event.restored) {
    highlights.remove(event.review.id);
    return;
  }

  const kind = event.type.slice('review:'.length);
  if (event.review) highlights.set(event.review.id, { kind, review: event.review });
}

export function applyReviewEvent(reviews, event) {
  if (reviews === null) return null;
  if (event.type === 'review:deleted') return reviews.filter(({ id }) => id !== event.id);
  const review = event.review;
  return [...reviews.filter(({ id }) => id !== review.id), review];
}

export function reviewRows(reviews, highlights) {
  if (reviews === null) return null;

  const activeIds = new Set(reviews.map(({ id }) => id));
  const rows = reviews.map((review) => {
    const kind = highlights.get(review.id)?.kind;
    return { ...review, highlight: kind === 'deleted' ? undefined : kind };
  });

  for (const { kind, review } of highlights.values()) {
    if (kind === 'deleted' && !activeIds.has(review.id)) rows.push({ ...review, highlight: kind });
  }
  return rows;
}
