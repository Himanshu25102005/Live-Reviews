import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useReviewSocket } from '../hooks/useReviewSocket.js';
import { reviewsApi } from '../services/reviews.js';

const formatDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export default function ReviewsPage() {
  const [reviews, setReviews] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useReviewSocket(refresh);

  useEffect(() => {
    const controller = new AbortController();
    reviewsApi.list(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setReviews(result);
      setLoadError('');
    }).catch((error) => {
      if (!controller.signal.aborted) setLoadError(error.message);
    });
    return () => controller.abort();
  }, [revision]);

  async function remove(id) {
    if (deletingId) return;
    setDeletingId(id);
    setDeleteError('');
    try {
      await reviewsApi.remove(id);
      refresh();
    } catch (error) {
      setDeleteError(error.message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <div className="page-heading">
        <h1>Reviews</h1>
        <Link className="button button-primary" to="/new">New review</Link>
      </div>
      {loadError && (
        <div className="error notice" role="alert">
          <span>{loadError}</span>
          <button className="button button-small" onClick={refresh}>Retry</button>
        </div>
      )}
      {deleteError && <p className="error" role="alert">{deleteError}</p>}
      <div className="panel table-container" role="region" aria-label="Reviews table" tabIndex={0}>
        <table aria-label="Reviews">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Title</th>
              <th scope="col">Content</th>
              <th scope="col">Date-time</th>
              <th scope="col">Edit</th>
              <th scope="col">Delete</th>
            </tr>
          </thead>
          <tbody>
            {reviews === null && (
              <tr><td className="table-message" colSpan={6} role="status">{loadError ? 'Reviews unavailable.' : 'Loading reviews…'}</td></tr>
            )}
            {reviews?.length === 0 && (
              <tr><td className="table-message" colSpan={6}>No reviews yet.</td></tr>
            )}
            {reviews?.map((review, index) => (
              <tr key={review.id}>
                <td className="row-number">{index + 1}</td>
                <td className="review-title">{review.title}</td>
                <td className="review-content">{review.content}</td>
                <td className="review-date"><time dateTime={review.createdAt}>{formatDate.format(new Date(review.createdAt))}</time></td>
                <td><Link className="button button-small" to={`/${review.id}`} aria-label={`Edit ${review.title}`}>Edit</Link></td>
                <td>
                  <button className="button button-small button-danger" disabled={Boolean(deletingId)} aria-label={`Delete ${review.title}`} onClick={() => remove(review.id)}>
                    {deletingId === review.id ? 'Deleting…' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
