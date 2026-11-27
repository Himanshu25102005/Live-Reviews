export default function ReviewSnackbar({ entries, undo, undoError, dismissUndoError }) {
  if (!entries.size && !undoError) return null;

  return (
    <aside className="snackbars" aria-label="Review notifications">
      {[...entries].map(([token, { title }]) => (
        <div className="snackbar" key={token}>
          <span role="status">Deleted “{title}”.</span>
          <button className="button button-small" aria-label={`Undo deletion of ${title}`} onClick={() => undo(token)}>Undo</button>
        </div>
      ))}
      {undoError && (
        <div className="snackbar">
          <span role="alert">{undoError}</span>
          <button className="button button-small" onClick={dismissUndoError}>Dismiss</button>
        </div>
      )}
    </aside>
  );
}
