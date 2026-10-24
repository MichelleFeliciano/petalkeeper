import { describe, expect, it } from 'vitest';
import { findConflicts, isDone, itemsOn, makeTask, occursOn } from '../lib/schedule';
import * as ops from '../lib/ops';
import { emptyForTest } from './helpers';
import { exportJSON, parseImport, validateData } from '../lib/storage';
import { sampleData } from '../lib/seed';
import { addDays, startOfWeek } from '../lib/dates';

describe('recurrence', () => {
  it('daily repeats from the start date until the end date', () => {
    const t = makeTask({ title: 'x', date: '2026-03-02', recurrence: { freq: 'daily', until: '2026-03-04' } });
    expect(occursOn(t, '2026-03-01')).toBe(false);
    expect(occursOn(t, '2026-03-02')).toBe(true);
    expect(occursOn(t, '2026-03-04')).toBe(true);
    expect(occursOn(t, '2026-03-05')).toBe(false);
  });
  it('selected weekdays', () => {
    const t = makeTask({ title: 'x', date: '2026-03-02', recurrence: { freq: 'days', days: [1, 3] } }); // Mon, Wed
    expect(occursOn(t, '2026-03-02')).toBe(true); // Mon
    expect(occursOn(t, '2026-03-03')).toBe(false);
    expect(occursOn(t, '2026-03-04')).toBe(true); // Wed
  });
  it('weekly and monthly (clamped to month end)', () => {
    const w = makeTask({ title: 'w', date: '2026-03-02', recurrence: { freq: 'weekly' } });
    expect(occursOn(w, '2026-03-09')).toBe(true);
    expect(occursOn(w, '2026-03-10')).toBe(false);
    const m = makeTask({ title: 'm', date: '2026-01-31', recurrence: { freq: 'monthly' } });
    expect(occursOn(m, '2026-02-28')).toBe(true);
    expect(occursOn(m, '2026-02-27')).toBe(false);
    expect(occursOn(m, '2026-03-31')).toBe(true);
  });
  it('completing one occurrence does not complete others', () => {
    const t = makeTask({ title: 'x', date: '2026-03-02', recurrence: { freq: 'daily' } });
    const d = ops.toggleDone({ ...emptyForTest(), tasks: [t] }, t.id, '2026-03-02');
    const u = d.tasks[0];
    expect(isDone(u, '2026-03-02')).toBe(true);
    expect(isDone(u, '2026-03-03')).toBe(false);
  });
  it('deleting one occurrence leaves the rest of the series', () => {
    const t = makeTask({ title: 'x', date: '2026-03-02', recurrence: { freq: 'daily' } });
    const d = ops.deleteOccurrence({ ...emptyForTest(), tasks: [t] }, t.id, '2026-03-03');
    expect(occursOn(d.tasks[0], '2026-03-03')).toBe(false);
    expect(occursOn(d.tasks[0], '2026-03-04')).toBe(true);
  });
});

describe('conflicts', () => {
  it('flags overlaps, ignores back-to-back and finished items', () => {
    const a = makeTask({ title: 'a', date: '2026-03-02', start: '10:00', end: '11:00' });
    const b = makeTask({ title: 'b', date: '2026-03-02', start: '10:30', end: '11:30' });
    const c = makeTask({ title: 'c', date: '2026-03-02', start: '11:00', end: '12:00' });
    const items = itemsOn([a, b, c], '2026-03-02');
    const bad = findConflicts(items, 30);
    expect(bad.has(`${a.id}@2026-03-02`)).toBe(true);
    expect(bad.has(`${b.id}@2026-03-02`)).toBe(true);
    expect(findConflicts(itemsOn([a, c], '2026-03-02'), 30).size).toBe(0);
    expect(findConflicts(itemsOn([a, c], '2026-03-02'), 30, 15).size).toBe(2); // buffer warns
    const done = ops.toggleDone({ ...emptyForTest(), tasks: [a, b] }, b.id, '2026-03-02');
    expect(findConflicts(itemsOn(done.tasks, '2026-03-02'), 30).size).toBe(0);
  });
});

describe('rescheduling', () => {
  it('moves a one-off task without recreating it', () => {
    const t = makeTask({ title: 'a', date: '2026-03-02', start: '10:00', end: '11:00' });
    const d = ops.moveOccurrence({ ...emptyForTest(), tasks: [t] }, t.id, '2026-03-02', { date: '2026-03-03' });
    expect(d.tasks).toHaveLength(1);
    expect(d.tasks[0].id).toBe(t.id);
    expect(d.tasks[0].date).toBe('2026-03-03');
    expect(d.tasks[0].start).toBe('10:00');
  });
  it('"leave for another day" unschedules but keeps the task', () => {
    const t = makeTask({ title: 'a', date: '2026-03-02', start: '10:00', end: '11:00' });
    const d = ops.moveOccurrence({ ...emptyForTest(), tasks: [t] }, t.id, '2026-03-02', {});
    expect(d.tasks[0].date).toBeUndefined();
    expect(d.tasks[0].start).toBeUndefined();
  });
  it('moving one occurrence of a series skips it and creates a one-off', () => {
    const t = makeTask({ title: 'a', date: '2026-03-02', recurrence: { freq: 'daily' } });
    const d = ops.moveOccurrence({ ...emptyForTest(), tasks: [t] }, t.id, '2026-03-03', { date: '2026-03-10' });
    expect(d.tasks).toHaveLength(2);
    expect(occursOn(d.tasks[0], '2026-03-03')).toBe(false);
    expect(occursOn(d.tasks[0], '2026-03-04')).toBe(true);
    expect(occursOn(d.tasks[1], '2026-03-10')).toBe(true);
    expect(d.tasks[1].recurrence).toBeUndefined();
  });
  it('blooms only grow when finishing, and never shrink on un-checking', () => {
    const t = makeTask({ title: 'a', date: '2026-03-02' });
    let d = ops.toggleDone({ ...emptyForTest(), tasks: [t] }, t.id, '2026-03-02');
    expect(d.blooms).toBe(1);
    d = ops.toggleDone(d, t.id, '2026-03-02');
    expect(d.blooms).toBe(1);
  });
});

describe('routines', () => {
  it('progress is per date so a new day starts fresh', () => {
    let d = sampleData();
    const r = d.routines[0];
    d = ops.toggleStep(d, '2026-03-02', r.id, r.steps[0].id);
    expect(ops.routineDay(d, '2026-03-02', r.id).done).toEqual([r.steps[0].id]);
    expect(ops.routineDay(d, '2026-03-03', r.id).done).toEqual([]);
  });
  it('skipping keeps the step', () => {
    let d = sampleData();
    const r = d.routines[0];
    d = ops.toggleSkipStep(d, '2026-03-02', r.id, r.steps[1].id);
    expect(ops.routineDay(d, '2026-03-02', r.id).skipped).toHaveLength(1);
    expect(d.routines[0].steps).toHaveLength(r.steps.length);
  });
});

describe('backup and import', () => {
  it('round-trips exported data', () => {
    const d = sampleData();
    const res = parseImport(exportJSON(d));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.tasks).toEqual(d.tasks);
  });
  it('rejects malformed imports', () => {
    expect(parseImport('not json').ok).toBe(false);
    expect(parseImport('{"version":1}').ok).toBe(false);
    expect(validateData({ ...sampleData(), tasks: [{ id: 1 }] }).ok).toBe(false);
    expect(validateData({ ...sampleData(), version: 99 }).ok).toBe(false);
    const bad = sampleData();
    bad.tasks[0] = { ...bad.tasks[0], date: '2026-13-45' };
    expect(validateData(bad).ok).toBe(false);
  });
});

describe('dates', () => {
  it('computes week starts', () => {
    expect(startOfWeek('2026-03-04', 1)).toBe('2026-03-02'); // Wed -> Mon
    expect(startOfWeek('2026-03-04', 0)).toBe('2026-03-01'); // Sun
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });
});
