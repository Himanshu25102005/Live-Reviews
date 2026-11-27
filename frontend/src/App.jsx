import { Route, Routes } from 'react-router';
import ReviewsPage from './pages/ReviewsPage.jsx';
import ReviewEditorPage from './pages/ReviewEditorPage.jsx';

export default function App() {
  return (
    <>
      <header className="site-header">
        <div className="container site-name">Live Reviews</div>
      </header>
      <main className="container page">
        <Routes>
          <Route path="/" element={<ReviewsPage />} />
          <Route path="/new" element={<ReviewEditorPage key="new" />} />
          <Route path="/:id" element={<ReviewEditorPage key="edit" />} />
        </Routes>
      </main>
    </>
  );
}
