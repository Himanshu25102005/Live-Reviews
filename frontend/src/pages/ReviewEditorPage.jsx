import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import ReviewForm from '../components/ReviewForm.jsx';
import { reviewsApi } from '../services/reviews.js';

function EditReview({ id }) {
  const [review, setReview] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    reviewsApi.get(id, controller.signal).then((result) => {
      if (!controller.signal.aborted) setReview(result);
    }).catch((error) => {
      if (!controller.signal.aborted) setError(error.message);
    });
    return () => controller.abort();
  }, [id]);

  if (error) {
    return (
      <div className="panel message">
        <p className="error" role="alert">{error}</p>
        <Link className="button" to="/">Back to reviews</Link>
      </div>
    );
  }
  return review ? <ReviewForm review={review} /> : <p className="panel message" role="status">Loading review…</p>;
}

export default function ReviewEditorPage() {
  const { id } = useParams();

  return (
    <>
      <div className="page-heading">
        <h1>{id ? 'Edit review' : 'New review'}</h1>
      </div>
      {id ? <EditReview key={id} id={id} /> : <ReviewForm />}
    </>
  );
}
