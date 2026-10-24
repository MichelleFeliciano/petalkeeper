import { useEffect, useState } from 'react';
import { StoreProvider, useStore } from './store';
import { UIProvider } from './ui';
import { Today } from './pages/Today';
import { Rituals } from './pages/Rituals';
import { Path } from './pages/Path';
import { Seeds } from './pages/Seeds';
import { Shed } from './pages/Shed';

const PAGES = [
  { id: 'today', label: "Today's Garden", sub: 'Your day', icon: '🌼' },
  { id: 'rituals', label: 'Daily Rituals', sub: 'Routines', icon: '🌿' },
  { id: 'path', label: 'The Garden Path', sub: 'Week', icon: '🗓️' },
  { id: 'seeds', label: 'Seed Pouch', sub: 'Tasks', icon: '🌱' },
  { id: 'shed', label: 'Garden Shed', sub: 'Settings', icon: '🧺' },
] as const;
type PageId = (typeof PAGES)[number]['id'];

const fromHash = (): PageId | null => {
  const h = window.location.hash.replace('#/', '').replace('#', '');
  return PAGES.find((p) => p.id === h)?.id ?? null;
};

function Shell() {
  const { data } = useStore();
  const [page, setPage] = useState<PageId>(() => fromHash() ?? data.settings.defaultPage);

  useEffect(() => {
    const on = () => setPage(fromHash() ?? data.settings.defaultPage);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, [data.settings.defaultPage]);

  const go = (id: PageId) => {
    window.location.hash = '#/' + id;
    setPage(id);
    window.scrollTo?.(0, 0);
  };

  return (
    <div className="app">
      <a href="#main" className="skip">Skip to content</a>
      <aside className="side">
        <div className="brand">
          <svg viewBox="0 0 32 32" width="34" height="34" aria-hidden="true">
            <g fill="#E8B8C4">
              <circle cx="16" cy="8" r="5" /><circle cx="24" cy="16" r="5" /><circle cx="16" cy="24" r="5" /><circle cx="8" cy="16" r="5" />
            </g>
            <circle cx="16" cy="16" r="4" fill="#C9B8D9" />
          </svg>
          <div>
            <b>Petalkeeper</b>
            <small>Tend to what matters.</small>
          </div>
        </div>
        <nav aria-label="Main">
          {PAGES.map((p) => (
            <button key={p.id} className={'nav-item' + (page === p.id ? ' on' : '')} aria-current={page === p.id ? 'page' : undefined} onClick={() => go(p.id)}>
              <span aria-hidden="true" className="ic">{p.icon}</span>
              <span className="lbl">{p.label}<small>{p.sub}</small></span>
            </button>
          ))}
        </nav>
      </aside>
      <main id="main" tabIndex={-1}>
        {page === 'today' && <Today />}
        {page === 'rituals' && <Rituals />}
        {page === 'path' && <Path />}
        {page === 'seeds' && <Seeds />}
        {page === 'shed' && <Shed />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <UIProvider>
        <Shell />
      </UIProvider>
    </StoreProvider>
  );
}
