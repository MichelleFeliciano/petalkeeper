import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import pkg from '../../package.json';
import swSource from '../../public/sw.js?raw';
import * as ops from '../lib/ops';
import { makeTask } from '../lib/schedule';
import { exportJSON, parseImport } from '../lib/storage';
import { CHANGELOG, releasesSince } from '../lib/changelog';
import { mergeImport, totalAdded } from '../lib/merge';
import { searchAll } from '../lib/search';
import { isBack, restoreInto, trashEntryFor } from '../lib/trash';
import { emptyForTest } from './helpers';

const KEY = 'petalkeeper.v1';
const seed = (d: ReturnType<typeof emptyForTest>) => localStorage.setItem(KEY, JSON.stringify(d));
// jsdom's File has no text(); real browsers do
const jsonFile = (text: string, name: string) => Object.assign(new File([text], name, { type: 'application/json' }), { text: async () => text });
const goto = async (user: ReturnType<typeof userEvent.setup>, name: RegExp) => user.click(screen.getByRole('button', { name }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('versions and the change log', () => {
  it('has notes for the version in package.json, newest first, with dates', () => {
    expect(CHANGELOG[0].version).toBe(pkg.version);
    expect(CHANGELOG.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.notes.length > 0)).toBe(true);
    const dates = CHANGELOG.map((r) => r.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('lists only what is newer than the version last seen', () => {
    expect(releasesSince(CHANGELOG[1].version).map((r) => r.version)).toEqual([CHANGELOG[0].version]);
    expect(releasesSince(null)).toHaveLength(1);
    expect(releasesSince('0.0.1')).toHaveLength(1);
  });

  it('names the offline cache after the app version', () => {
    expect(swSource).toContain("searchParams.get('v')");
    expect(swSource).toContain("'petalkeeper-v'");
  });
});

describe('backup files and importing', () => {
  const mine = ops.addTask(ops.addRoutine(emptyForTest(), 'morning', 'Wake-up'), makeTask({ title: 'Water ferns', date: '2026-03-03', start: '09:00' }));

  it('says which app and version made the file and still reads back', () => {
    const j = JSON.parse(exportJSON(mine));
    expect(j.app).toBe('petalkeeper');
    expect(j.version).toBe(1);
    expect(j.appVersion).toBe(pkg.version);
    expect(Number.isNaN(Date.parse(j.exportedAt))).toBe(false);
    expect(parseImport(exportJSON(mine)).ok).toBe(true);
  });

  it('adds only what is new, skips duplicates and never changes what is here', () => {
    const other = ops.addTask(ops.addRoutine(emptyForTest(), 'morning', 'Wake-up'), makeTask({ title: 'water FERNS', date: '2026-03-03', start: '09:00' }));
    const withNew = ops.addTask(other, makeTask({ title: 'Call the vet', date: '2026-03-04' }));
    const { data, report } = mergeImport(mine, withNew);
    expect(data.tasks.map((t) => t.title)).toEqual(['Water ferns', 'Call the vet']);
    expect(report.added.tasks).toBe(1);
    expect(report.skipped.tasks).toBe(1);
    expect(report.skipped.routines).toBe(1);
    expect(report.skippedNames).toContain('water FERNS');
    expect(data.routines).toHaveLength(1);
    // importing the same file again adds nothing
    expect(totalAdded(mergeImport(data, withNew).report)).toBe(0);
  });

  it('keeps check-offs for a routine that was skipped as already here', () => {
    const a = ops.addRoutine(emptyForTest(), 'morning', 'Wake-up');
    const b = { ...ops.addRoutine(emptyForTest(), 'morning', 'Wake-up') };
    b.routineLog = { '2026-03-01': { [b.routines[0].id]: { done: ['x'], skipped: [] } } };
    const { data } = mergeImport(a, b);
    expect(data.routines).toHaveLength(1);
    expect(data.routineLog['2026-03-01'][a.routines[0].id].done).toEqual(['x']);
  });
});

describe('search and the deleted list', () => {
  it('finds tasks, steps and journal notes, with every word needed', () => {
    let d = ops.addRoutine(emptyForTest(), 'morning', 'Wake-up');
    d = ops.addTask(d, makeTask({ title: 'Buy tomato seeds', notes: 'from the garden shop' }));
    d = { ...d, checkins: { '2026-03-03': { note: 'A calm day with tomato soup' } } };
    expect(searchAll(d, 'tomato').map((h) => h.kind).sort()).toEqual(['Journal', 'Task']);
    expect(searchAll(d, 'garden SEEDS').map((h) => h.title)).toEqual(['Buy tomato seeds']);
    expect(searchAll(d, 'zzz')).toEqual([]);
    expect(searchAll(d, '   ')).toEqual([]);
  });

  it('puts a deleted item in the bin and brings it back once', () => {
    const t = makeTask({ title: 'Old idea' });
    const d = ops.addTask(emptyForTest(), t);
    const entry = trashEntryFor(d, 'task', t.id)!;
    const gone = ops.deleteTask(d, t.id);
    expect(isBack(gone, entry)).toBe(false);
    const back = restoreInto(gone, entry);
    expect(back.tasks.map((x) => x.title)).toEqual(['Old idea']);
    expect(restoreInto(back, entry).tasks).toHaveLength(1);
  });
});

describe('the new screens', () => {
  it('shows a deleted task under Recently deleted and brings it back', async () => {
    const user = userEvent.setup();
    seed(ops.addTask(emptyForTest(), makeTask({ title: 'Water the ferns', category: 'chores' })));
    render(<App />);
    await goto(user, /Seed Pouch/);
    await user.click(await screen.findByRole('button', { name: 'Delete Water the ferns' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.queryByText('Water the ferns')).toBeNull();
    // the Undo toast is there for every delete
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    await goto(user, /Garden Shed/);
    const bin = screen.getByRole('region', { name: 'Recently deleted' });
    expect(within(bin).getByText(/Water the ferns/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Undo & history/ })).toHaveTextContent('Removed a task');
    await user.click(within(bin).getByRole('button', { name: 'Bring back Water the ferns' }));
    expect(within(bin).queryByText(/Water the ferns/)).toBeNull();
    await goto(user, /Seed Pouch/);
    expect(await screen.findByText('Water the ferns')).toBeInTheDocument();
  });

  it('asks before removing something from Recently deleted for good', async () => {
    const user = userEvent.setup();
    seed(ops.addTask(emptyForTest(), makeTask({ title: 'Water the ferns' })));
    render(<App />);
    await goto(user, /Seed Pouch/);
    await user.click(await screen.findByRole('button', { name: 'Delete Water the ferns' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await goto(user, /Garden Shed/);
    await user.click(screen.getByRole('button', { name: 'Remove Water the ferns for good' }));
    expect(screen.getByRole('dialog', { name: 'Remove for good?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(screen.getByRole('button', { name: 'Bring back Water the ferns' })).toBeInTheDocument();
  });

  it('checks an import first, then adds only what is new', async () => {
    const user = userEvent.setup();
    seed(ops.addTask(emptyForTest(), makeTask({ title: 'Water the ferns', date: '2026-03-03' })));
    const file = ops.addTask(ops.addTask(emptyForTest(), makeTask({ title: 'Water the ferns', date: '2026-03-03' })), makeTask({ title: 'Call the vet' }));
    render(<App />);
    await goto(user, /Garden Shed/);
    await user.upload(screen.getByLabelText('Import backup file'), jsonFile(exportJSON(file), 'mine.json'));
    const dlg = await screen.findByRole('dialog', { name: 'Check before importing' });
    expect(dlg).toHaveTextContent('Would add: 1 activity');
    expect(dlg).toHaveTextContent('Already here, so skipped: 1 activity');
    // nothing is saved until you confirm
    expect(JSON.parse(localStorage.getItem(KEY)!).tasks).toHaveLength(1);
    await user.click(within(dlg).getByRole('button', { name: "Add what's new" }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(KEY)!).tasks).toHaveLength(2));
    expect(screen.getByText(/Added 1 activity/)).toBeInTheDocument();
  });

  it('refuses a file made by a different app and leaves data alone', async () => {
    const user = userEvent.setup();
    seed(ops.addTask(emptyForTest(), makeTask({ title: 'Keep me' })));
    render(<App />);
    await goto(user, /Garden Shed/);
    await user.upload(screen.getByLabelText('Import backup file'), jsonFile(JSON.stringify({ app: 'caregiver', version: 1, people: [] }), 'x.json'));
    expect(await screen.findByText(/from caregiver, not Petalkeeper/)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(KEY)!).tasks).toHaveLength(1);
  });

  it('searches across the app and jumps to the result', async () => {
    const user = userEvent.setup();
    seed(ops.addRoutine(emptyForTest(), 'morning', 'Wake-up'));
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.type(screen.getByLabelText('Search everything'), 'wake');
    await user.click(await screen.findByRole('button', { name: /Routine.*Wake-up/ }));
    expect(screen.queryByRole('dialog', { name: 'Search' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Daily Rituals' })).toHaveAttribute('aria-current', 'page');
  });

  it('opens Help and can show the welcome again without offering to erase anything', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Help' }));
    expect(screen.getByRole('dialog', { name: 'Help' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show the welcome again' }));
    expect(await screen.findByRole('dialog', { name: 'Welcome to your garden' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start with an empty garden' })).toBeNull();
  });

  it('shows the settings check', async () => {
    const user = userEvent.setup();
    render(<App />);
    await goto(user, /Garden Shed/);
    const box = screen.getByRole('region', { name: 'Settings check' });
    for (const n of ['Sync', 'Backup', 'App lock', 'Works offline', 'Reminders', 'Storage']) expect(within(box).getByText(n)).toBeInTheDocument();
  });

  it('shows an Add one now button on empty screens', async () => {
    const user = userEvent.setup();
    seed(emptyForTest());
    render(<App />);
    await goto(user, /Seed Pouch/);
    await user.click(screen.getByRole('button', { name: 'Add one now' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});

describe('banners', () => {
  it('offers a new version on its own, and Later hides it', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ version: '9.9.9', build: '2099-01-01T00:00:00.000Z' }))));
    render(<App />);
    expect(await screen.findByText('A new version is ready', {}, { timeout: 7000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update now' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Later' }));
    expect(screen.queryByText('A new version is ready')).toBeNull();
  }, 15000);

  it('stays quiet when the published version is the one you have', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ version: pkg.version, build: __APP_BUILD__ }))));
    render(<App />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 4500));
    });
    expect(screen.queryByText('A new version is ready')).toBeNull();
  }, 15000);

  it('says what is new after an update, once', async () => {
    const user = userEvent.setup();
    localStorage.setItem('petalkeeper.seenVersion', CHANGELOG[1].version);
    render(<App />);
    expect(screen.getByText(/Petalkeeper updated to/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: "See what's new" }));
    expect(screen.getByRole('dialog', { name: "What's new" })).toHaveTextContent(CHANGELOG[0].notes[0]);
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(localStorage.getItem('petalkeeper.seenVersion')).toBe(pkg.version);
    expect(screen.queryByText(/Petalkeeper updated to/)).toBeNull();
  });

  it('does not announce an update on a first visit', () => {
    render(<App />);
    expect(screen.queryByText(/Petalkeeper updated to/)).toBeNull();
    expect(localStorage.getItem('petalkeeper.seenVersion')).toBe(pkg.version);
  });

  it('warns when browser storage is nearly full', async () => {
    Object.defineProperty(navigator, 'storage', { value: { estimate: async () => ({ usage: 90, quota: 100 }) }, configurable: true });
    render(<App />);
    try {
      expect(await screen.findByText(/storage is about 90% full/, {}, { timeout: 4000 })).toBeInTheDocument();
    } finally {
      delete (navigator as unknown as Record<string, unknown>).storage;
    }
  });
});
