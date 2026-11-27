import { useEffect, useState } from 'react';
import { createTimedEntries } from '../timed-entries.js';

export function useTimedEntries(duration) {
  const [entries, setEntries] = useState(() => new Map());
  const [actions] = useState(() => createTimedEntries(duration, setEntries));
  useEffect(() => actions.clear, [actions]);
  return { entries, ...actions };
}
