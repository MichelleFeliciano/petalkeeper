import { useEffect, useRef } from 'react';

/** Saves a text value shortly after typing stops, when the page is hidden, and when the field goes away. */
export function useAutosave(value: string, saved: string, save: (v: string) => void, delay = 800) {
  const latest = useRef({ value, saved, save });
  latest.current = { value, saved, save };
  useEffect(() => {
    if (value === saved) return;
    const t = setTimeout(() => save(value), delay);
    return () => clearTimeout(t);
  }, [value, saved, delay]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const flush = () => {
      const c = latest.current;
      if (c.value !== c.saved) c.save(c.value);
    };
    const hidden = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', hidden);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      flush();
    };
  }, []);
}
