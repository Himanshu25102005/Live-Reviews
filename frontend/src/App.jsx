import { useState } from 'react';
import { Route, Routes } from 'react-router';
import ReviewsPage from './pages/ReviewsPage.jsx';
import ReviewEditorPage from './pages/ReviewEditorPage.jsx';
import { useLiveReviews } from './hooks/useLiveReviews.js';
import { useReviewUndo } from './hooks/useReviewUndo.js';
import ReviewSnackbar from './components/ReviewSnackbar.jsx';

export default function App() {
  const { reviews, loadError, refresh } = useLiveReviews();
  const { deleteReview, ...snackbar } = useReviewUndo(refresh);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  return (
    <>
      <header className="site-header">
        <div className="container site-name">Live Reviews</div>
      </header>
      <main className="container page">
        <Routes>
          <Route path="/" element={
            <ReviewsPage
              reviews={reviews}
              loadError={loadError}
              refresh={refresh}
              onDelete={deleteReview}
              search={search}
              onSearchChange={setSearch}
              sort={sort}
              onSortChange={setSort}
            />
          } />
          <Route path="/new" element={<ReviewEditorPage key="new" onChange={refresh} />} />
          <Route path="/:id" element={<ReviewEditorPage key="edit" onChange={refresh} onDelete={deleteReview} />} />
        </Routes>
      </main>
      <ReviewSnackbar {...snackbar} />
    </>
  );
}
