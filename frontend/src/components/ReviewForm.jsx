import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { reviewsApi } from '../services/reviews.js';

export default function ReviewForm({ review }) {
  const initialTitle = review?.title ?? '';
  const initialContent = review?.content ?? '';
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [action, setAction] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function finish(actionName, mutation) {
    if (action) return;
    setAction(actionName);
    setError('');
    try {
      await mutation();
      navigate('/', { replace: true });
    } catch (error) {
      setError(error.message);
      setAction(null);
    }
  }

  function save(event) {
    event.preventDefault();
    const fields = { title: title.trim(), content: content.trim() };
    if (!fields.title || !fields.content) {
      setError('Title and content are required.');
      return;
    }
    finish('save', () => review ? reviewsApi.update(review.id, fields) : reviewsApi.create(fields));
  }

  function reset(event) {
    event.preventDefault();
    setTitle(initialTitle);
    setContent(initialContent);
    setError('');
  }

  return (
    <form className="review-form panel" onSubmit={save} onReset={reset}>
      {error && <p className="error" role="alert">{error}</p>}
      <fieldset disabled={Boolean(action)}>
        <div className="field">
          <label htmlFor="review-title">Title</label>
          <input id="review-title" name="title" value={title} onChange={(event) => setTitle(event.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="review-content">Content</label>
          <textarea id="review-content" name="content" rows={7} value={content} onChange={(event) => setContent(event.target.value)} required />
        </div>
        <div className="form-actions">
          <button className="button button-primary" type="submit">{action === 'save' ? 'Saving…' : 'Save'}</button>
          <button className="button" type="reset">Reset</button>
          {action ? <button className="button" type="button" disabled>Cancel</button> : <Link className="button" to="/">Cancel</Link>}
          {review && (
            <button className="button button-danger" type="button" onClick={() => finish('delete', () => reviewsApi.remove(review.id))}>
              {action === 'delete' ? 'Deleting…' : 'Delete'}
            </button>
          )}
        </div>
      </fieldset>
    </form>
  );
}
