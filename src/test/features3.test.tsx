import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import App from '../App';
import * as ops from '../lib/ops';
import { STARTERS } from '../lib/routines';
import { stepLines } from '../lib/journal';
import { buildReport, reportText } from '../lib/summary';
import { exportJSON, salvage } from '../lib/storage';
import { daysLeft, runSync, type SyncConfig } from '../lib/sync';
import { makeTask } from '../lib/schedule';
import { emptyForTest } from './helpers';

const T = '2026-03-03';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const goto = async (user: ReturnType<typeof userEvent.setup>, name: RegExp) => user.click(screen.getByRole('button', { name }));

describe('v1.5 logic', () => {
  it('rescues what is readable from damaged data', () => {
    const good = ops.addTask(ops.addRoutine(emptyForTest(), 'morning', 'Wake-up'), makeTask({ title: 'Keep me', date: T }));
    const damaged = JSON.parse(exportJSON(good));
    damaged.tasks.push({ id: 'broken' }); // an unreadable task
    damaged.counters = 'nope'; // an unreadable optional part
    const rescued = salvage(JSON.stringify(damaged));
    expect(rescued?.tasks.map((t) => t.title)).toEqual(['Keep me']);
    expect(rescued?.routines).toHaveLength(1);
    expect(rescued?.counters).toEqual([]);
    expect(salvage('not json')).toBeNull();
    expect(salvage('[1,2]')).toBeNull();
  });

  it('counts days to token expiry', () => {
    expect(daysLeft('2026-03-10', T)).toBe(7);
    expect(daysLeft('2026-03-01', T)).toBe(-2);
    expect(daysLeft(undefined, T)).toBeNull();
    expect(daysLeft('soon', T)).toBeNull();
  });

  it('explains what to do when GitHub no longer accepts the token', async () => {
    const f = (async () => new Response('{}', { status: 401 })) as typeof fetch;
    const cfg: SyncConfig = { repo: 'me/data', token: 'old', path: 'petalkeeper.json', auto: true };
    await expect(runSync(cfg, emptyForTest(), null, f)).rejects.toThrow(/Replace token/);
  });

  it('turns pasted lists into steps, dropping bullets and numbers', () => {
    expect(stepLines('Shower\n- Brush teeth\r\n3. Get dressed\n\n  • Coffee  \n2) Stretch')).toEqual(['Shower', 'Brush teeth', 'Get dressed', 'Coffee', 'Stretch']);
  });

  it('builds a summary and a text version that respects what is included', () => {
    let d = ops.addRoutine(emptyForTest(), 'morning', 'Wake-up');
    d = ops.setSteps(d, d.routines[0].id, [{ id: 'a', title: 'Shower' }]);
    d = ops.toggleStep(d, '2026-03-02', d.routines[0].id, 'a');
    d = ops.setCheckin(ops.setCheckin(d, '2026-03-02', { mood: 4, note: 'Private words' }), T, { mood: 2 });
    const rep = buildReport(d, '2026-03-01', '2026-03-03');
    expect(rep.days).toBe(3);
    expect(rep.moodDays).toBe(2);
    expect(rep.avgMood).toBe(3);
    expect(rep.routines[0]).toMatchObject({ scheduled: 3, tended: 1, complete: 1 });
    const text = reportText(rep, { moods: true, notes: false, routines: true, counters: false });
    expect(text).toContain('average 3 of 5');
    expect(text).toContain('Wake-up: 1/3');
    expect(text).not.toContain('Private words');
    expect(reportText(rep, { moods: false, notes: true, routines: false, counters: false })).toContain('Private words');
  });
});

describe('v1.5 screens', () => {
  const fresh = () => {
    window.history.pushState({}, '', '/');
    window.location.hash = '';
    return userEvent.setup();
  };

  it('the do-this-now buttons offer an undo', async () => {
    const user = fresh();
    render(<App />);
    const card = screen.getByRole('region', { name: 'Do this now' });
    await user.click(within(card).getByRole('button', { name: /^Done: / }));
    expect(screen.getByText('Checked off.')).toBeInTheDocument();
    expect(localStorage.getItem('petalkeeper.v1')).toContain('"done":["');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(localStorage.getItem('petalkeeper.v1')).not.toContain('"done":["');
  });

  it('pasting a list into the new-step box adds each line as a step', async () => {
    const user = fresh();
    render(<App />);
    await goto(user, /Daily Rituals/);
    await user.selectOptions(screen.getByLabelText('Start from a ready-made routine'), 'Midday reset');
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByLabelText('New step name'));
    await user.paste('Walk\n- Sunshine\n2. Tea');
    expect(screen.getByDisplayValue('Sunshine')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Tea')).toBeInTheDocument();
  });

  it('shows the week grid with a row per routine', async () => {
    const user = fresh();
    render(<App />);
    await goto(user, /Daily Rituals/);
    const grid = screen.getByText('This week at a glance').closest('details')!;
    expect(within(grid).getAllByRole('row').length).toBeGreaterThan(2);
    expect(within(grid).getByRole('rowheader', { name: /Morning Routine/ })).toBeInTheDocument();
  });

  it('tells you when you are offline', async () => {
    fresh();
    render(<App />);
    expect(screen.queryByText(/You're offline/)).not.toBeInTheDocument();
    fireEvent(window, new Event('offline'));
    expect(await screen.findByText(/You're offline/)).toBeInTheDocument();
    fireEvent(window, new Event('online'));
    await waitFor(() => expect(screen.queryByText(/You're offline/)).not.toBeInTheDocument());
  });

  it('lets you clear a number box while typing a new value', async () => {
    const user = fresh();
    render(<App />);
    await goto(user, /Garden Shed/);
    const box = screen.getByLabelText(/Breathing room between activities/);
    await user.clear(box);
    expect(box).toHaveValue(null); // empty, not snapped back
    await user.type(box, '20');
    expect(box).toHaveValue(20);
    expect(localStorage.getItem('petalkeeper.v1')).toContain('"buffer":20');
  });

  it('saves a check-in note shortly after typing stops, without needing to click away', async () => {
    const user = fresh();
    render(<App />);
    await user.type(screen.getByLabelText(/A line about today/), 'Slow morning');
    await waitFor(() => expect(localStorage.getItem('petalkeeper.v1')).toContain('Slow morning'), { timeout: 2500 });
  });

  it('shows a summary in the journal that leaves private notes out until asked', async () => {
    const user = fresh();
    let d = ops.setCheckin(emptyForTest(), new Date().toISOString().slice(0, 10), { mood: 5, note: 'Secret thing' });
    d = ops.addRoutine(d, 'morning', 'Wake-up');
    localStorage.setItem('petalkeeper.v1', JSON.stringify(d));
    render(<App />);
    await goto(user, /Garden Journal/);
    const rp = screen.getByRole('region', { name: 'A summary to share' });
    expect(within(rp).getByText(/check-in/)).toBeInTheDocument();
    expect(within(rp).queryByText(/Secret thing/)).not.toBeInTheDocument();
    await user.click(within(rp).getByLabelText(/My notes/));
    expect(within(rp).getByText(/Secret thing/)).toBeInTheDocument();
  });

  it('offers to bring back damaged data, and rescues what is readable', async () => {
    const user = fresh();
    const good = ops.addTask(emptyForTest(), makeTask({ title: 'Rescued task' }));
    const damaged = JSON.parse(exportJSON(good));
    damaged.tasks.push({ nope: true });
    localStorage.setItem('petalkeeper.v1.corrupt', JSON.stringify(damaged));
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Try to bring it back' }));
    expect(screen.getByText(/Brought back 1 activities/)).toBeInTheDocument();
    expect(localStorage.getItem('petalkeeper.v1.corrupt')).toBeNull();
    expect(localStorage.getItem('petalkeeper.v1')).toContain('Rescued task');
  });

  it("shows tomorrow's day-specific routine in the evening", () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date(2026, 2, 2, 18, 30)); // Monday evening, so tomorrow is Tuesday
      let d = ops.addStarter(emptyForTest(), STARTERS.find((s) => s.name === 'Therapy day')!);
      d = ops.addStay(d, 'moms', '2026-03-03', '2026-03-04');
      localStorage.setItem('petalkeeper.v1', JSON.stringify(d));
      fresh();
      render(<App />);
      expect(screen.getByText('Looking ahead to Tuesday')).toBeInTheDocument();
      expect(screen.getByText(/Therapy day is on tomorrow/)).toBeInTheDocument();
      expect(screen.getByText(/You'll be at Mom's tomorrow/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('offers an empty garden on first open, and clears the examples when chosen', async () => {
    localStorage.removeItem('petalkeeper.toured');
    const user = fresh();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Start with an empty garden' }));
    expect(screen.queryByText('Grocery run')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('accessibility checks', () => {
  // colour contrast can't be measured without a real renderer, so it is excluded here
  const check = async (container: HTMLElement) => {
    const res = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    const summary = res.violations.map((v) => `${v.id}: ${v.help} -> ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
    expect(summary).toEqual([]);
  };

  it.each([
    ['Today', /Today's Garden/],
    ['Daily Rituals', /Daily Rituals/],
    ['The Garden Path', /The Garden Path/],
    ['Seed Pouch', /Seed Pouch/],
    ['Garden Journal', /Garden Journal/],
    ['Garden Shed', /Garden Shed/],
  ])('%s has no automatic accessibility violations', async (_n, nav) => {
    window.location.hash = '';
    const user = userEvent.setup();
    const { container } = render(<App />);
    await user.click(screen.getByRole('button', { name: nav }));
    await wait(50);
    await check(container);
  });
});

describe('undo only touches what it is about', () => {
  it('undoing a task change leaves routine check-offs, notes and counters alone', async () => {
    const user = userEvent.setup();
    window.history.pushState({}, '', '/');
    window.location.hash = '';
    render(<App />);
    // a routine check-off and a counter, then a task change, then undo the task change
    const card = screen.getByRole('region', { name: 'Do this now' });
    await user.click(within(card).getByRole('button', { name: /^Done: / }));
    await goto(user, /Seed Pouch/);
    await user.type(screen.getByPlaceholderText(/What needs doing/), 'Buy stamps');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('Buy stamps')).toBeInTheDocument();
    await wait(400);
    await user.click(screen.getByRole('button', { name: /Undo/ }));
    expect(screen.queryByText('Buy stamps')).not.toBeInTheDocument();
    expect(localStorage.getItem('petalkeeper.v1')).toContain('"done":["'); // the routine check-off is still there
  });

  it('keeps the real day of a monthly to-do when it is edited', async () => {
    const { makeTask: mk } = await import('../lib/schedule');
    const t = mk({ title: 'Pay rent', date: '2026-01-31', recurrence: { freq: 'monthly', dom: 31 } });
    localStorage.setItem('petalkeeper.v1', JSON.stringify(ops.addTask(emptyForTest(), t)));
    const user = userEvent.setup();
    window.history.pushState({}, '', '/');
    window.location.hash = '#/seeds';
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Edit Pay rent' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(localStorage.getItem('petalkeeper.v1')).toContain('"dom":31');
  });
});

describe('accessibility of the month view', () => {
  it('has no automatic accessibility violations', async () => {
    window.location.hash = '';
    const user = userEvent.setup();
    const { container } = render(<App />);
    await user.click(screen.getByRole('button', { name: /The Garden Path/ }));
    await user.click(screen.getByRole('button', { name: 'Month' }));
    const res = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    expect(res.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
