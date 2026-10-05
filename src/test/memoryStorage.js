/**
 * Minimal in-memory stand-in for window.localStorage, for tests.
 */
export function createMemoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: key => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => {
      data.set(key, String(value));
    },
    removeItem: key => {
      data.delete(key);
    },
  };
}
