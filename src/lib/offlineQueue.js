// Wraps Supabase save calls with localStorage persistence + retry/backoff so a
// tap isn't silently lost when a save fails (flaky wifi/4G at a bar).
// Supports multiple concurrent save "keys" (e.g. host tapping several players'
// cards from one browser tab).
const BACKOFFS = [2000, 5000, 10000, 30000];

export function createRetryingSaver({ save, onChange }) {
  const state = new Map(); // key -> { timer, attempt, pending }

  function getState(key) {
    if (!state.has(key)) state.set(key, { timer: null, attempt: 0, pending: null });
    return state.get(key);
  }
  function persist(key, payload) {
    try {
      localStorage.setItem(key, JSON.stringify(payload));
    } catch {}
  }
  function clearPersisted(key) {
    try {
      localStorage.removeItem(key);
    } catch {}
  }
  function notify() {
    onChange?.(hasPending());
  }

  async function attemptSave(key, payload) {
    try {
      const { error } = await save(key, payload);
      if (error) throw error;
      const s = getState(key);
      if (s.pending === payload) s.pending = null;
      s.attempt = 0;
      clearPersisted(key);
      notify();
    } catch {
      scheduleRetry(key, payload);
      notify();
    }
  }

  function scheduleRetry(key, payload) {
    const s = getState(key);
    clearTimeout(s.timer);
    const delay = BACKOFFS[Math.min(s.attempt, BACKOFFS.length - 1)];
    s.attempt++;
    s.timer = setTimeout(() => attemptSave(key, payload), delay);
  }

  function push(key, payload) {
    const s = getState(key);
    s.pending = payload;
    persist(key, payload);
    clearTimeout(s.timer);
    s.attempt = 0;
    notify();
    attemptSave(key, payload);
  }

  function retryAll() {
    for (const [key, s] of state) {
      if (s.pending) {
        clearTimeout(s.timer);
        s.attempt = 0;
        attemptSave(key, s.pending);
      }
    }
  }

  function restore(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const payload = JSON.parse(raw);
        getState(key).pending = payload;
        attemptSave(key, payload);
      }
    } catch {}
  }

  function hasPending() {
    for (const [, s] of state) if (s.pending) return true;
    return false;
  }

  return { push, retryAll, restore, hasPending };
}
