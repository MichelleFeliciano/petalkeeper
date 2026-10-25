import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import * as ops from '../lib/ops';
import { buildRoutineICS, historyFor, isPaused, nextUp, progressOf, recentTended, routinesFor, STARTERS, stepsFor } from '../lib/routines';
import { checkPin, hasPin, setPin, validPin } from '../lib/device';
import { exportJSON, parseImport } from '../lib/storage';
import { mergeData } from '../lib/sync';
import { PARTS } from '../lib/types';
import { emptyForTest } from './helpers';

const T = '2026-03-03'; // a Tuesday
const withRoutine = () => {
  let d = ops.addRoutine(emptyForTest(), 'morning', 'Wake-up');
  const id = d.routines[0].id;
  d = ops.setSteps(d, id, [
    { id: 'a', title: 'Shower', essential: true },
    { id: 'b', title: 'Get dressed' },
    { id: 'c', title: 'Open curtains', optional: true },
    { id: 'v', title: 'Vitamins', days: [1, 4] },
  ]);
  return { d, id };
};

describe('routine logic', () => {
  it('applies step weekdays, gentle days and optional steps', () => {
    const { d, id } = withRoutine();
    const r = d.routines[0];
    expect(stepsFor(r, T, false).map((s) => s.id)).toEqual(['a', 'b', 'c']); // Vitamins is Mon/Thu
    expect(stepsFor(r, '2026-03-02', false).map((s) => s.id)).toContain('v');
    expect(stepsFor(r, T, true).map((s) => s.id)).toEqual(['a']); // essentials only
    let x = ops.toggleStep(d, T, id, 'a');
    x = ops.toggleStep(x, T, id, 'b');
    expect(progressOf(x, r, T).complete).toBe(true); // the optional step never blocks
    expect(progressOf(d, r, T).complete).toBe(false);
  });

  it('pauses routines without marking anything missed', () => {
    const { d } = withRoutine();
    const p = ops.updateSettings(d, { pausedFrom: T, pausedUntil: '2026-03-05' });
    expect(isPaused(p.settings, T)).toBe(true);
    expect(routinesFor(p, T)).toHaveLength(0);
    expect(routinesFor(p, '2026-03-06')).toHaveLength(1);
  });

  it('finds the next step, preferring the current part of the day', () => {
    let { d } = withRoutine();
    d = ops.addRoutine(d, 'evening', 'Wind-down');
    d = ops.setSteps(d, d.routines[1].id, [{ id: 'e', title: 'Tidy' }]);
    const order = PARTS.map((p) => p.id);
    expect(nextUp(d, T, 'morning', order)?.step.id).toBe('a');
    expect(nextUp(d, T, 'evening', order)?.step.id).toBe('e');
  });

  it('shows a gentle history with no penalties', () => {
    const { d, id } = withRoutine();
    const x = ops.toggleStep(d, T, id, 'a');
    const dates = ['2026-03-02', T];
    const marks = historyFor(x, x.routines[0], dates);
    expect(marks).toEqual(['none', 'some']);
    expect(recentTended(x, x.routines[0], T, 7).tended).toBe(1);
  });

  it('adds starters, duplicates and reorders routines', () => {
    let d = ops.addStarter(emptyForTest(), STARTERS[0]);
    expect(d.routines[0].steps.length).toBeGreaterThan(2);
    expect(d.routines[0].steps.some((s) => s.optional)).toBe(true);
    d = ops.addStarter(d, STARTERS.find((s) => s.name === 'Therapy day')!);
    expect(d.routines[1].days).toEqual([2]);
    d = ops.duplicateRoutine(d, d.routines[0].id);
    expect(d.routines[1].name).toBe('Wake-up (copy)');
    expect(d.routines[1].steps[0].id).not.toBe(d.routines[0].steps[0].id);
    const before = d.routines.map((r) => r.id);
    d = ops.moveRoutine(d, d.routines[0].id, 1);
    expect(d.routines[0].id).toBe(before[1]);
  });

  it('exports calendar nudges only for routines that have a time', () => {
    let d = ops.addStarter(emptyForTest(), STARTERS.find((s) => s.name === 'Laundry day')!);
    expect(buildRoutineICS(d.routines, T).count).toBe(0);
    d = ops.setRoutineRemind(d, d.routines[0].id, '09:30');
    const { text, count } = buildRoutineICS(d.routines, T);
    expect(count).toBe(1);
    expect(text).toContain('RRULE:FREQ=WEEKLY;BYDAY=SU');
    expect(text).toContain('DTSTART:20260308T093000'); // first Sunday on or after the export date
    expect(text).toContain('BEGIN:VALARM');
  });
});

describe('counters and check-ins', () => {
  it('counts up, never below zero, and survives export', () => {
    let d = ops.addCounter(emptyForTest(), 'Water', '💧', 8);
    const id = d.counters[0].id;
    d = ops.bumpCounter(d, T, id, -1);
    expect(d.counterLog[T]?.[id]).toBe(0);
    d = ops.bumpCounter(ops.bumpCounter(d, T, id, 1), T, id, 1);
    expect(d.counterLog[T][id]).toBe(2);
    const res = parseImport(exportJSON(d));
    expect(res.ok && res.data.counterLog[T][id]).toBe(2);
    expect(ops.deleteCounter(d, id).counters).toHaveLength(0);
  });

  it('stores a mood and note, and clears an empty check-in', () => {
    let d = ops.setCheckin(emptyForTest(), T, { mood: 4, note: 'Slow but good' });
    expect(d.checkins[T]).toEqual({ mood: 4, note: 'Slow but good' });
    const res = parseImport(exportJSON(d));
    expect(res.ok && res.data.checkins[T].mood).toBe(4);
    d = ops.setCheckin(ops.setCheckin(d, T, { mood: undefined }), T, { note: '' });
    expect(d.checkins[T]).toBeUndefined();
  });

  it('merges counters and check-ins from two devices', () => {
    const base = ops.addCounter(emptyForTest(), 'Water', '💧', 8);
    const id = base.counters[0].id;
    const phone = ops.bumpCounter(ops.bumpCounter(base, T, id, 1), T, id, 1);
    const computer = ops.setCheckin(ops.bumpCounter(base, T, id, 1), T, { mood: 5 });
    const m = mergeData(base, phone, computer);
    expect(m.counterLog[T][id]).toBe(2); // the higher tally wins
    expect(m.checkins[T].mood).toBe(5);
    expect(m.counters).toHaveLength(1);
  });

  it('rejects malformed new fields on import', () => {
    const d = ops.addCounter(emptyForTest(), 'Water', '💧', 8);
    expect(parseImport(JSON.stringify({ ...d, counters: [{ id: 'x' }] })).ok).toBe(false);
    const { d: r } = withRoutine();
    expect(parseImport(JSON.stringify({ ...r, routines: [{ ...r.routines[0], remindAt: 'soon' }] })).ok).toBe(false);
    expect(parseImport(JSON.stringify({ ...r, routines: [{ ...r.routines[0], steps: [{ id: 'a', title: 'x', days: [8] }] }] })).ok).toBe(false);
  });
});

describe('device PIN', () => {
  it('only accepts 4–8 digits and checks them', () => {
    expect(validPin('123')).toBe(false);
    expect(validPin('12ab')).toBe(false);
    expect(validPin('1234')).toBe(true);
    setPin('4821');
    expect(hasPin()).toBe(true);
    expect(checkPin('4821')).toBe(true);
    expect(checkPin('1111')).toBe(false);
    setPin(null);
    expect(hasPin()).toBe(false);
  });
});

describe('new screens', () => {
  const open = async (name: RegExp) => {
    window.location.hash = '';
    const user = userEvent.setup();
    render(<App />);
    if (name) await user.click(screen.getByRole('button', { name }));
    return user;
  };

  it('the Do-this-now card completes a step with one tap', async () => {
    window.location.hash = '';
    const user = userEvent.setup();
    render(<App />);
    const card = screen.getByRole('region', { name: 'Do this now' });
    const label = within(card).getByRole('button', { name: /^Done: / }).getAttribute('aria-label')!;
    await user.click(within(card).getByRole('button', { name: label }));
    expect(localStorage.getItem('petalkeeper.v1')).toContain('"done":["');
  });

  it('a gentle day and a pause hide routines on Today', async () => {
    window.location.hash = '';
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText(/Gentle day/));
    expect(screen.getByText(/Gentle day: only the essentials/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Pause routines'), 'open');
    expect(screen.getByText(/Routines are resting/, { selector: 'p' })).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Resume routines' })[0]);
    expect(screen.queryByRole('button', { name: 'Resume routines' })).not.toBeInTheDocument();
  });

  it('counts a counter and records a mood', async () => {
    window.location.hash = '';
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Add a counter/ }));
    await user.type(screen.getByLabelText('Counter name'), 'Water');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.click(screen.getByRole('button', { name: 'One more Water' }));
    expect(screen.getByText('Water').parentElement).toHaveTextContent('Water 1');
    await user.click(screen.getByRole('button', { name: 'Good' }));
    expect(screen.getByRole('button', { name: 'Good' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('starts a routine from a ready-made one', async () => {
    const user = await open(/Daily Rituals/);
    await user.selectOptions(screen.getByLabelText('Start from a ready-made routine'), 'Bedtime');
    expect(screen.getByRole('tab', { name: /Bedtime \(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Bedtime' })).toBeInTheDocument();
  });

  it('shows the welcome tour once and the PIN gate when a PIN exists', async () => {
    localStorage.removeItem('petalkeeper.toured');
    window.location.hash = '';
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    expect(screen.getByRole('dialog', { name: /Welcome/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Keep the examples|Got it/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    unmount();
    setPin('2468');
    render(<App />);
    await user.type(screen.getByLabelText('PIN'), '0000');
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/not it/);
    await user.type(screen.getByLabelText('PIN'), '2468');
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});
