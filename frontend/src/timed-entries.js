export function createTimedEntries(duration, onChange) {
  const entries = new Map();
  const publish = () => onChange(new Map([...entries].map(([key, entry]) => [key, entry.value])));

  function remove(key) {
    const entry = entries.get(key);
    if (!entry) return;
    clearTimeout(entry.timer);
    entries.delete(key);
    publish();
  }

  return {
    set(key, value) {
      clearTimeout(entries.get(key)?.timer);
      const entry = { value, expiresAt: Date.now() + duration };
      entry.timer = setTimeout(() => {
        if (entries.get(key) === entry) remove(key);
      }, duration);
      entries.set(key, entry);
      publish();
    },
    remove,
    take(key) {
      const entry = entries.get(key);
      remove(key);
      if (entry && Date.now() < entry.expiresAt) return entry.value;
    },
    clear() {
      for (const entry of entries.values()) clearTimeout(entry.timer);
      entries.clear();
    },
  };
}
