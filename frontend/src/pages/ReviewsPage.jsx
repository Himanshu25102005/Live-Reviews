import { useState } from 'react';
import { Link } from 'react-router';
import { selectReviews } from '../review-list.js';

const formatDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export default function ReviewsPage({ reviews, loadError, refresh, onDelete, search, onSearchChange, sort, onSortChange }) {
  const [deleteError, setDeleteError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  async function remove(review) {
    if (deletingId) return;
    setDeletingId(review.id);
    setDeleteError('');
    try {
      await onDelete(review);
    } catch (error) {
      setDeleteError(error.message);
    } finally {
      setDeletingId(null);
    }
  }

  const visibleReviews = reviews && selectReviews(reviews, search, sort);

  return (
    <>
      <div className="page-heading">
        <h1>Reviews</h1>
        <Link className="button button-primary" to="/new">New review</Link>
      </div>
      <div className="review-controls">
        <div className="field review-search">
          <label htmlFor="review-search">Search reviews</label>
          <input
            id="review-search"
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search by title or content"
          />
        </div>
        <div className="field">
          <label htmlFor="review-sort">Sort reviews</label>
          <select id="review-sort" value={sort} onChange={(event) => onSortChange(event.target.value)}>
            <option value="newest">Date-time: Newest First</option>
            <option value="oldest">Date-time: Oldest First</option>
            <option value="titleAsc">Title: A–Z</option>
            <option value="titleDesc">Title: Z–A</option>
          </select>
        </div>
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
            {visibleReviews?.length === 0 && (
              <tr><td className="table-message" colSpan={6}>{search.trim() ? 'No reviews match your search.' : 'No reviews yet.'}</td></tr>
            )}
            {visibleReviews?.map((review, index) => (
              <tr key={review.id} className={review.highlight ? `review-${review.highlight}` : undefined}>
                <td className="row-number">{index + 1}</td>
                <td className="review-title">{review.title}</td>
                <td className="review-content">{review.content}</td>
                <td className="review-date"><time dateTime={review.createdAt}>{formatDate.format(new Date(review.createdAt))}</time></td>
                <td>
                  {review.highlight === 'deleted'
                    ? <button className="button button-small" disabled>Edit</button>
                    : <Link className="button button-small" to={`/${review.id}`} aria-label={`Edit ${review.title}`}>Edit</Link>}
                </td>
                <td>
                  <button className="button button-small button-danger" disabled={Boolean(deletingId) || review.highlight === 'deleted'} aria-label={`Delete ${review.title}`} onClick={() => remove(review)}>
                    {review.highlight === 'deleted' ? 'Deleted' : deletingId === review.id ? 'Deleting…' : 'Delete'}
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
