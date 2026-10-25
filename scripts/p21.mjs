import { sub } from './lib.mjs';

/* ---- nav: short labels for the phone bar, full names stay as the accessible name ---- */
const A = 'src/App.tsx';
sub(A, "{ id: 'today', label: \"Today's Garden\", sub: 'Your day', icon: '🌼' },", "{ id: 'today', label: \"Today's Garden\", short: 'Today', sub: 'Your day', icon: '🌼' },");
sub(A, "{ id: 'rituals', label: 'Daily Rituals', sub: 'Routines', icon: '🌿' },", "{ id: 'rituals', label: 'Daily Rituals', short: 'Routines', sub: 'Routines', icon: '🌿' },");
sub(A, "{ id: 'path', label: 'The Garden Path', sub: 'Week', icon: '🗓️' },", "{ id: 'path', label: 'The Garden Path', short: 'Week', sub: 'Week', icon: '🗓️' },");
sub(A, "{ id: 'seeds', label: 'Seed Pouch', sub: 'Tasks', icon: '🌱' },", "{ id: 'seeds', label: 'Seed Pouch', short: 'Tasks', sub: 'Tasks', icon: '🌱' },");
sub(A, "{ id: 'journal', label: 'Garden Journal', sub: 'Moods & notes', icon: '📖' },", "{ id: 'journal', label: 'Garden Journal', short: 'Journal', sub: 'Moods & notes', icon: '📖' },");
sub(A, "{ id: 'shed', label: 'Garden Shed', sub: 'Settings', icon: '🧺' },", "{ id: 'shed', label: 'Garden Shed', short: 'Settings', sub: 'Settings', icon: '🧺' },");
sub(A, "aria-current={page === p.id ? 'page' : undefined} onClick={() => go(p.id)}>\n              <span aria-hidden=\"true\" className=\"ic\">{p.icon}</span>\n              <span className=\"lbl\">{p.label}<small>{p.sub}</small></span>",
  "aria-current={page === p.id ? 'page' : undefined} aria-label={p.label} onClick={() => go(p.id)}>\n              <span aria-hidden=\"true\" className=\"ic\">{p.icon}</span>\n              <span className=\"lbl\" aria-hidden=\"true\">\n                <span className=\"full\">{p.label}</span>\n                <span className=\"short\">{p.short}</span>\n                <small>{p.sub}</small>\n              </span>");

/* ---- sync pill: one in the side menu (desktop), one at the top of the page (phone) ---- */
sub(A, "function SyncChip({ onOpen }: { onOpen: () => void }) {", "function SyncChip({ onOpen, variant }: { onOpen: () => void; variant: 'side' | 'top' }) {");
sub(A, "className={'sync-chip' + (sync.status === 'error' || expiring ? ' bad' : '')}", "className={'sync-chip ' + variant + (sync.status === 'error' || expiring ? ' bad' : '')}");
sub(A, "        <SyncChip onOpen={() => go('shed')} />\n      </aside>", "        <SyncChip variant=\"side\" onOpen={() => go('shed')} />\n      </aside>");
sub(A, "      <main id=\"main\" tabIndex={-1}>\n        <OfflineNote />", "      <main id=\"main\" tabIndex={-1}>\n        <SyncChip variant=\"top\" onOpen={() => go('shed')} />\n        <OfflineNote />");

/* ---- empty add-a-thing cards become one-line rows on the phone ---- */
const D = 'src/components/DailyExtras.tsx';
sub(D, "      <section className=\"card\" aria-label=\"Little counters\">", "      <section className=\"card compact\" aria-label=\"Little counters\">");
sub(D, "      <section className=\"card\" aria-label=\"Coming up\">", "      <section className=\"card compact\" aria-label=\"Coming up\">");
sub(D, "    <section className=\"card\" aria-labelledby=\"an-h\">", "    <section className={'card' + (data.needed.length === 0 && !adding ? ' compact' : '')} aria-labelledby=\"an-h\">");
