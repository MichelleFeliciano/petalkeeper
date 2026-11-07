import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import * as ops from '../lib/ops';
import { buildICS, foldLine } from '../lib/ics';
import { buildRoutineICS } from '../lib/routines';
import { makeTask } from '../lib/schedule';
import { exportJSON, parseImport } from '../lib/storage';
import { forCloud, mergeData } from '../lib/sync';
import { loadRecentSearches, rememberSearch } from '../lib/search';
import { emptyForTest } from './helpers';

const KEY = 'petalkeeper.v1';
const D = '2026-03-02';
const bytes = (s: string) => new TextEncoder().encode(s).length;

afterEach(() => {
  vi.useRealTimers();
});

describe('blooms and routine timing', () => {
  it('earns a bloom once per finished thing, however often it is ticked on and off', () => {
    const t = makeTask({ title: 'a', date: D });
    let d = ops.addTask(emptyForTest(), t);
    for (let i = 0; i < 4; i++) d = ops.toggleDone(d, t.id, D);
    expect(d.blooms).toBe(1);
    expect(d.tasks[0].done).toBe(false);
  });

  it('a repeating task earns one bloom per day', () => {
    const t = makeTask({ title: 'daily', date: D, recurrence: { freq: 'daily' } });
    let d = ops.addTask(emptyForTest(), t);
    d = ops.toggleDone(ops.toggleDone(ops.toggleDone(d, t.id, D), t.id, D), t.id, D);
    d = ops.toggleDone(d, t.id, '2026-03-03');
    expect(d.blooms).toBe(2);
  });

  it('a copy of a finished task can earn its own bloom', () => {
    const t = makeTask({ title: 'a', date: D });
    let d = ops.toggleDone(ops.addTask(emptyForTest(), t), t.id, D);
    d = ops.duplicateTask(d, t.id);
    const copy = d.tasks[1];
    expect(copy.bloomed).toBeUndefined();
    expect(ops.toggleDone(d, copy.id, D).blooms).toBe(2);
  });

  it('a routine step earns one bloom, and ticking it keeps the Start and Finished times', () => {
    let d = ops.addRoutine(emptyForTest(), 'morning', 'Wake-up');
    const rid = d.routines[0].id;
    d = ops.setSteps(d, rid, [{ id: 's1', title: 'Shower' }]);
    d = ops.finishRoutine(ops.startRoutine(d, D, rid, '2026-03-02T08:00:00.000Z'), D, rid, '2026-03-02T08:20:00.000Z');
    d = ops.toggleStep(ops.toggleStep(ops.toggleStep(d, D, rid, 's1'), D, rid, 's1'), D, rid, 's1');
    expect(d.blooms).toBe(1);
    expect(d.routineLog[D][rid].start).toBe('2026-03-02T08:00:00.000Z');
    expect(d.routineLog[D][rid].end).toBe('2026-03-02T08:20:00.000Z');
    d = ops.toggleSkipStep(d, D, rid, 's1');
    expect(d.routineLog[D][rid].start).toBe('2026-03-02T08:00:00.000Z');
  });

  it('keeps the bloom record through saving and reading back', () => {
    const t = makeTask({ title: 'a', date: D });
    const d = ops.toggleDone(ops.addTask(emptyForTest(), t), t.id, D);
    const back = parseImport(exportJSON(d));
    expect(back.ok && back.data.tasks[0].bloomed).toEqual(['once']);
  });
});

describe('calendar files', () => {
  it('wraps long lines and every line stays within 75 bytes', () => {
    const note = 'A very long note, with commas; and émoji 🌸 and more words '.repeat(8);
    const text = buildICS([makeTask({ title: 'Plan', date: D, start: '09:00', notes: note })], D, 1);
    expect(text.split('\r\n').every((l) => bytes(l) <= 75)).toBe(true);
    // unfolding gets the note back
    expect(text.replace(/\r\n /g, '')).toContain('DESCRIPTION:' + note.split(',').join('\\,').split(';').join('\\;'));
  });

  it('leaves short lines alone and folds routine nudges too', () => {
    expect(foldLine('SUMMARY:Short')).toBe('SUMMARY:Short');
    const d = ops.addRoutine(emptyForTest(), 'morning', 'x'.repeat(120));
    const { text } = buildRoutineICS(ops.setRoutineRemind(d, d.routines[0].id, '08:00').routines, D);
    expect(text.split('\r\n').every((l) => bytes(l) <= 75)).toBe(true);
  });
});

describe('syncing and files', () => {
  it('keeps where you are separate on each device', () => {
    const base = emptyForTest();
    const local = ops.updateSettings(base, { place: 'moms' });
    const remote = ops.updateSettings(base, { place: 'vacation' });
    expect(mergeData(base, local, remote).settings.place).toBe('moms');
    expect(forCloud(local).settings.place).toBe(forCloud(remote).settings.place);
  });

  it('says so when a backup comes from a newer version', () => {
    const r = parseImport(JSON.stringify({ version: 2, tasks: [] }));
    expect(!r.ok && r.error).toMatch(/newer version/);
  });
});

describe('search extras', () => {
  it('remembers recent searches, newest first, without repeats', () => {
    rememberSearch('ferns');
    rememberSearch('vet');
    rememberSearch('FERNS');
    rememberSearch('a');
    expect(loadRecentSearches()).toEqual(['FERNS', 'vet']);
  });

  it('opens search with the slash key, but not while typing in a box', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.keyboard('/');
    expect(screen.getByRole('dialog', { name: 'Search' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Search everything'), '/ok');
    expect(screen.getByLabelText('Search everything')).toHaveValue('/ok');
  });

  it('shows recent searches when the box is empty', async () => {
    const user = userEvent.setup();
    rememberSearch('ferns');
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.click(screen.getByRole('button', { name: 'ferns' }));
    expect(screen.getByLabelText('Search everything')).toHaveValue('ferns');
  });
});

describe('weekly look back', () => {
  // 2026-03-08 is a Sunday: the last day of a week that starts on Monday
  const onSunday = () => vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 2, 8, 10, 0, 0) });

  it('offers to put late to-dos off for a week, once', async () => {
    onSunday();
    const user = userEvent.setup({ advanceTimers: () => {} });
    const done = { ...makeTask({ title: 'Done thing', date: '2026-03-04' }), done: true };
    const late = makeTask({ title: 'Late thing', date: '2026-03-03' });
    localStorage.setItem(KEY, JSON.stringify({ ...emptyForTest(), tasks: [done, late] }));
    render(<App />);
    expect(screen.getByRole('heading', { name: 'A look at this week' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Put it off for a week' }));
    expect(screen.queryByRole('heading', { name: 'A look at this week' })).toBeNull();
    const saved = JSON.parse(localStorage.getItem(KEY)!);
    expect(saved.tasks.find((t: { title: string }) => t.title === 'Late thing').date).toBe('2026-03-15');
  });

  it('stays away midweek', () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 2, 4, 10, 0, 0) });
    localStorage.setItem(KEY, JSON.stringify({ ...emptyForTest(), tasks: [{ ...makeTask({ title: 'Done thing', date: '2026-03-04' }), done: true }] }));
    render(<App />);
    expect(screen.queryByRole('heading', { name: /A look at/ })).toBeNull();
  });
});
