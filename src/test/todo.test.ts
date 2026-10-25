import { describe, expect, it } from 'vitest';
import realExport from './fixtures/second-memory-export.sample.json?raw';
import { makeTask, occursOn } from '../lib/schedule';
import * as ops from '../lib/ops';
import { emptyForTest } from './helpers';
import { exportJSON, parseImport } from '../lib/storage';
import { parseDateWords } from '../lib/dateWords';
import {
  canSnooze, isOverdue, monthDays, needsAttention, reminderCount, reminderText, reorder, snoozeTo, sortTodos, stepTask,
} from '../lib/todo';
import { SM_PREFIX, extractTodos, planTodoCopy } from '../lib/secondMemoryImport';

// 2026-10-25 is a Sunday.
const TODAY = '2026-10-25';

describe('dates in plain words', () => {
  const p = (s: string) => parseDateWords(s, TODAY);
  it('reads words at the end', () => {
    expect(p('pay rent friday')).toEqual({ title: 'pay rent', date: '2026-10-30' });
    expect(p('call mom tomorrow')).toEqual({ title: 'call mom', date: '2026-10-26' });
    expect(p('renew in 2 weeks')).toEqual({ title: 'renew', date: '2026-11-08' });
    expect(p('dentist on oct 30')).toEqual({ title: 'dentist', date: '2026-10-30' });
    expect(p('file taxes by 3/15')).toEqual({ title: 'file taxes', date: '2027-03-15' }); // already past this year
    expect(p('plan trip next week')).toEqual({ title: 'plan trip', date: '2026-11-01' });
  });
  it('reads words at the start', () => {
    expect(p('tomorrow call mom')).toEqual({ title: 'call mom', date: '2026-10-26' });
    expect(p('oct 28 dentist')).toEqual({ title: 'dentist', date: '2026-10-28' });
  });
  it('a weekday means the next one coming, a week away if today is that day', () => {
    expect(p('x sunday')?.date).toBe('2026-11-01');
    expect(p('x monday')?.date).toBe('2026-10-26');
  });
  it('leaves ordinary text alone', () => {
    expect(p('The Monday meeting notes')).toBeNull(); // date words only count at the very start or end, not in the middle
    expect(p('Monday meeting notes')).toEqual({ title: 'meeting notes', date: '2026-10-26' }); // but at the very start they do
    expect(p('buy milk')).toBeNull();
    expect(p('tomorrow')).toBeNull(); // nothing left of the task
    expect(p('x feb 31')).toBeNull(); // not a real date
  });
});

describe('sorting the to-do list', () => {
  const t = (title: string, o: Partial<Parameters<typeof makeTask>[0]> = {}) => makeTask({ title, createdAt: '2026-10-01T00:00:00.000Z', ...o });
  const a = t('a', { date: '2026-10-28' }), b = t('b', { date: '2026-10-26' }), c = t('c'), d = t('d', { date: '2026-10-27', done: true });
  it('soonest first puts undated last and finished tasks at the very end', () => {
    expect(sortTodos([a, b, c, d], 'date_asc', TODAY).map((x) => x.title)).toEqual(['b', 'a', 'c', 'd']);
  });
  it('latest first still puts undated and finished last', () => {
    expect(sortTodos([a, b, c, d], 'date_desc', TODAY).map((x) => x.title)).toEqual(['a', 'b', 'c', 'd']);
  });
  it('my order uses the hand order first, unarranged tasks after', () => {
    const x = t('x', { order: 2000 }), y = t('y', { order: 1000 }), z = t('z');
    expect(sortTodos([z, x, y], 'manual', TODAY).map((i) => i.title)).toEqual(['y', 'x', 'z']);
  });
  it('a recurring task sorts by its next day', () => {
    const r = t('r', { date: '2026-10-01', recurrence: { freq: 'daily' } });
    expect(sortTodos([a, r], 'date_asc', TODAY).map((i) => i.title)).toEqual(['r', 'a']);
  });
});

describe('overdue, attention and snooze rules', () => {
  const t = (title: string, o: Partial<Parameters<typeof makeTask>[0]> = {}) => makeTask({ title, ...o });
  it('overdue means open, one-off, and its day or due date has passed', () => {
    expect(isOverdue(t('x', { date: '2026-10-24' }), TODAY)).toBe(true);
    expect(isOverdue(t('x', { due: '2026-10-24' }), TODAY)).toBe(true);
    expect(isOverdue(t('x', { date: '2026-10-25' }), TODAY)).toBe(false);
    expect(isOverdue(t('x', { date: '2026-10-24', done: true }), TODAY)).toBe(false);
    expect(isOverdue(t('x', { date: '2026-10-24', recurrence: { freq: 'daily' } }), TODAY)).toBe(false);
  });
  it('needs attention: late ones and those in the next 7 days, soonest first', () => {
    const late = t('late', { date: '2026-10-20' }), today = t('today', { date: TODAY }), wk = t('wk', { date: '2026-11-01' });
    const far = t('far', { date: '2026-11-02' }), done = t('done', { date: TODAY, done: true }), none = t('none');
    const r = needsAttention([far, wk, late, today, done, none], TODAY, 7);
    expect(r.late.map((x) => x.title)).toEqual(['late']);
    expect(r.soon.map((x) => x.title)).toEqual(['today', 'wk']);
  });
  it('can snooze only what is late or due today', () => {
    expect(canSnooze(t('x', { date: '2026-10-24' }), TODAY)).toBe(true);
    expect(canSnooze(t('x', { date: TODAY }), TODAY)).toBe(true);
    expect(canSnooze(t('x', { date: '2026-10-26' }), TODAY)).toBe(false);
    expect(canSnooze(t('x', { date: TODAY, done: true }), TODAY)).toBe(false);
    expect(canSnooze(t('x'), TODAY)).toBe(false);
  });
  it('snoozes to tomorrow or a week from today', () => {
    expect(snoozeTo(TODAY, 'tomorrow')).toBe('2026-10-26');
    expect(snoozeTo(TODAY, 'week')).toBe('2026-11-01');
  });
  it('moving a one-off task also moves a due date that would still be late', () => {
    const task = t('x', { date: '2026-10-24', due: '2026-10-24' });
    const d = ops.snoozeTask({ ...emptyForTest(), tasks: [task] }, task.id, '2026-10-24', '2026-10-26');
    expect(d.tasks[0]).toMatchObject({ date: '2026-10-26', due: '2026-10-26' });
  });
  it('snoozing one day of a repeating task skips that day and makes a one-off copy', () => {
    const task = t('x', { date: '2026-10-01', recurrence: { freq: 'daily' } });
    const d = ops.snoozeTask({ ...emptyForTest(), tasks: [task] }, task.id, TODAY, '2026-10-26');
    expect(d.tasks).toHaveLength(2);
    expect(occursOn(d.tasks[0], TODAY)).toBe(false);
    expect(d.tasks[1]).toMatchObject({ date: '2026-10-26', recurrence: undefined });
  });
});

describe('reminder count', () => {
  it('counts open untimed one-off tasks due today or late', () => {
    const tasks = [
      makeTask({ title: 'a', date: TODAY }), makeTask({ title: 'b', date: '2026-10-01' }), makeTask({ title: 'c', due: TODAY }),
      makeTask({ title: 'timed', date: TODAY, start: '09:00' }), makeTask({ title: 'later', date: '2026-10-26' }), makeTask({ title: 'done', date: TODAY, done: true }),
    ];
    expect(reminderCount(tasks, TODAY)).toBe(3);
    expect(reminderText(1)).toBe('1 to-do needs a look today');
    expect(reminderText(3)).toBe('3 to-dos need a look today');
  });
});

describe('hand ordering', () => {
  it('moves a task and spaces the rest 1000 apart', () => {
    expect(reorder(['a', 'b', 'c'], 'c', 0)).toEqual([{ id: 'c', order: 1000 }, { id: 'a', order: 2000 }, { id: 'b', order: 3000 }]);
    expect(reorder(['a', 'b'], 'a', 0)).toEqual([]);
    expect(stepTask(['a', 'b'], 'a', -1)).toEqual([]);
  });
  it('setOrder saves the new places on the tasks', () => {
    const a = makeTask({ title: 'a' }), b = makeTask({ title: 'b' });
    const d = ops.setOrder({ ...emptyForTest(), tasks: [a, b] }, [{ id: b.id, order: 1000 }, { id: a.id, order: 2000 }]);
    expect(d.tasks.map((t) => t.order)).toEqual([2000, 1000]);
  });
});

describe('month grid', () => {
  it('pads to the first weekday and lists every day', () => {
    const cells = monthDays(2026, 9, 1); // October 2026 starts on a Thursday; weeks start Monday
    expect(cells.slice(0, 3)).toEqual([null, null, null]);
    expect(cells[3]).toBe('2026-10-01');
    expect(cells.filter(Boolean)).toHaveLength(31);
    expect(monthDays(2026, 9, 0).slice(0, 4)).toEqual([null, null, null, null]); // Sunday start
  });
});

describe('monthly repeat on a fixed day', () => {
  it('keeps repeating on the 31st after a shortened month', () => {
    const t = makeTask({ title: 'x', date: '2026-02-28', recurrence: { freq: 'monthly', dom: 31 } });
    expect(occursOn(t, '2026-03-31')).toBe(true);
    expect(occursOn(t, '2026-03-28')).toBe(false);
    expect(occursOn(t, '2026-04-30')).toBe(true);
  });
});

describe('saving and loading the new fields', () => {
  it('keeps order, dom and the to-do reminder time through export and import', () => {
    const task = makeTask({ title: 'x', date: '2026-02-28', order: 3000, recurrence: { freq: 'monthly', dom: 31 } });
    const base = emptyForTest();
    const res = parseImport(exportJSON({ ...base, tasks: [task], settings: { ...base.settings, todoRemindAt: '08:30' } }));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.tasks[0]).toMatchObject({ order: 3000, recurrence: { freq: 'monthly', dom: 31 } });
      expect(res.data.settings.todoRemindAt).toBe('08:30');
    }
  });
  it('rejects a bad order or day-of-month, and ignores a bad reminder time', () => {
    const base = emptyForTest();
    const bad1 = { ...base, tasks: [{ ...makeTask({ title: 'x' }), order: 'first' }] };
    const bad2 = { ...base, tasks: [makeTask({ title: 'x', date: '2026-02-28', recurrence: { freq: 'monthly', dom: 40 } })] };
    expect(parseImport(JSON.stringify(bad1)).ok).toBe(false);
    expect(parseImport(JSON.stringify(bad2)).ok).toBe(false);
    const res = parseImport(JSON.stringify({ ...base, settings: { ...base.settings, todoRemindAt: '25:99' } }));
    expect(res.ok && res.data.settings.todoRemindAt).toBeFalsy();
  });
});

describe('bringing in to-dos from Second Memory', () => {
  // A made-up export with the same shape as Second Memory's "Export data" file.
  const sm = {
    collections: {
      todos: [
        { id: 't1', task: 'Pay rent', completed: false, repeat: 'monthly', dueDate: '2026-11-01', sortOrder: 2000, dateAdded: '2026-09-01T10:00:00.000Z' },
        { id: 't2', task: 'Pay rent', completed: true, repeat: 'monthly', dueDate: '2026-10-01', spawnedId: 't1', dateAdded: '2026-08-01T10:00:00.000Z' },
        { id: 't3', task: 'Pay the 31st bill', completed: false, repeat: 'monthly', dueDate: '2026-02-28', repeatDay: 31 },
        { id: 't4', task: 'Call mom', completed: false, repeat: '', dueDate: null },
        { id: 't5', task: 'Old', deleted: true },
        { id: 't6', task: '   ' },
        { id: 't7', task: 'Water plants', completed: false, repeat: 'daily', dueDate: '2026-10-25' },
      ],
      shoppingList: [{ id: 's1', item: 'never read as a to-do' }],
      notes: [{ id: 'n1', title: 'private' }],
    },
    local: { journal: [{ text: 'never read' }] },
  };
  const records = extractTodos(sm)!;
  it('reads only the to-do list', () => {
    expect(records).toHaveLength(7);
    expect(extractTodos({ collections: { books: [] } })).toBeNull();
    expect(extractTodos('nope')).toBeNull();
  });
  const plan = planTodoCopy(records, [], new Date('2026-10-25T00:00:00Z'));
  it('keeps the day, the repeat, finished state, order and the date added', () => {
    expect(plan.fresh.map((t) => t.title)).toEqual(['Pay rent', 'Pay rent', 'Pay the 31st bill', 'Call mom', 'Water plants']);
    expect(plan.unreadable).toEqual(['(a to-do with no text)']);
    const [open, finished, monthly31, undated, daily] = plan.fresh;
    expect(open).toMatchObject({ id: `${SM_PREFIX}t1`, date: '2026-11-01', done: false, recurrence: { freq: 'monthly' }, order: 2000, createdAt: '2026-09-01T10:00:00.000Z' });
    expect(finished).toMatchObject({ id: `${SM_PREFIX}t2`, date: '2026-10-01', done: true });
    expect(finished.recurrence).toBeUndefined(); // its repeat moved on to t1
    expect(monthly31.recurrence).toEqual({ freq: 'monthly', dom: 31 });
    expect(undated.date).toBeUndefined();
    expect(undated.done).toBe(false);
    expect(daily.recurrence).toEqual({ freq: 'daily' });
  });
  it('a copied monthly task on the 31st lands on month ends', () => {
    expect(occursOn(plan.fresh[2], '2026-03-31')).toBe(true);
    expect(occursOn(plan.fresh[2], '2026-04-30')).toBe(true);
  });
  it('copying twice adds nothing the second time and never changes tasks already here', () => {
    const second = planTodoCopy(records, plan.fresh.map((t) => t.id));
    expect(second.fresh).toHaveLength(0);
    expect(second.alreadyHere).toBe(5);
    const mine = makeTask({ title: 'Mine', date: TODAY });
    const d = ops.importTasks({ ...emptyForTest(), tasks: [mine] }, plan.fresh);
    expect(d.tasks[0]).toBe(mine);
    expect(d.tasks).toHaveLength(6);
    expect(ops.importTasks(d, plan.fresh)).toBe(d); // nothing new: the very same data comes back
  });
  it('the result passes the app’s own file check', () => {
    const d = ops.importTasks(emptyForTest(), plan.fresh);
    expect(parseImport(exportJSON(d)).ok).toBe(true);
  });
  it('never carries anything from other lists', () => {
    const json = JSON.stringify(plan.fresh);
    expect(json).not.toContain('never read');
    expect(json).not.toContain('private');
  });
});

// A REAL export written by Second Memory version 82 (made with its own add functions; sample data only).
describe('a real Second Memory v82 export', () => {
  const real = JSON.parse(realExport);
  const records = extractTodos(real)!;
  const plan = planTodoCopy(records, [], new Date('2026-10-25T20:00:00Z'));
  it('brings in all five to-dos (open, finished, repeating, late and undated)', () => {
    expect(records).toHaveLength(5);
    expect(plan.unreadable).toEqual([]);
    expect(plan.fresh).toHaveLength(5);
    const rent = plan.fresh.find((t) => t.title === 'Pay rent')!;
    expect(rent).toMatchObject({ date: '2026-10-28', done: false, recurrence: { freq: 'monthly' } });
    const call = plan.fresh.find((t) => t.title === 'Call mom')!;
    expect(call).toMatchObject({ date: '2026-10-24', done: false });
    expect(call.recurrence).toBeUndefined();
    expect(plan.fresh.find((t) => t.title === 'No date task')!.date).toBeUndefined();
  });
  it('a finished repeating to-do stays finished, and its next one repeats', () => {
    const water = plan.fresh.filter((t) => t.title === 'Water plants');
    expect(water).toHaveLength(2);
    const [finished, open] = [water.find((t) => t.done)!, water.find((t) => !t.done)!];
    expect(finished).toMatchObject({ date: '2026-10-25', done: true });
    expect(finished.recurrence).toBeUndefined();
    expect(open).toMatchObject({ date: '2026-10-26', done: false, recurrence: { freq: 'daily' } });
  });
  it('the late one is flagged overdue and can be put off', () => {
    const call = plan.fresh.find((t) => t.title === 'Call mom')!;
    expect(isOverdue(call, '2026-10-25')).toBe(true);
    expect(canSnooze(call, '2026-10-25')).toBe(true);
  });
  it('is accepted by the app, and importing again adds nothing', () => {
    const d = ops.importTasks(emptyForTest(), plan.fresh);
    expect(parseImport(exportJSON(d)).ok).toBe(true);
    expect(planTodoCopy(records, d.tasks.map((t) => t.id)).fresh).toHaveLength(0);
  });
});
