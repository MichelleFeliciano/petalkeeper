import { describe, expect, it } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { STORAGE_KEY, loadData } from '../lib/storage';
import { addDays, todayISO } from '../lib/dates';
import { SECOND_MEMORY_TODOS_KEY } from '../lib/secondMemoryImport';

// jsdom's File has no text(); real browsers do. This gives it one for these tests.
if (!File.prototype.text) {
  File.prototype.text = function text(this: File) {
    return new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsText(this);
    });
  };
}

const setup = (hash = '#/seeds') => {
  window.location.hash = hash;
  return { user: userEvent.setup(), ...render(<App />) };
};
const saved = () => loadData();
const importCard = () => document.querySelector('section[aria-labelledby="smt-h"]') as HTMLElement;

describe('Seed Pouch as a to-do list', () => {
  it('adds a to-do from one line, reading date words, and says what it understood', async () => {
    const { user } = setup();
    await user.type(screen.getByPlaceholderText(/What needs doing/), 'send the card tomorrow');
    expect(within(screen.getByRole('form', { name: 'Add a to-do' })).getByRole('status')).toHaveTextContent(/“send the card” will be set for/);
    await user.click(within(screen.getByRole('form', { name: 'Add a to-do' })).getByRole('button', { name: 'Add' }));
    const t = saved().tasks.find((x) => x.title === 'send the card')!;
    expect(t.date).toBe(addDays(todayISO(), 1));
    expect(screen.getByText('send the card')).toBeInTheDocument();
  });

  it('a picked day wins over words in the text, and a repeat can be chosen', async () => {
    const { user } = setup();
    const form = screen.getByRole('form', { name: 'Add a to-do' });
    await user.type(within(form).getByPlaceholderText(/What needs doing/), 'pay rent friday');
    fireEvent.change(within(form).getByLabelText('Day (optional)'), { target: { value: '2030-01-15' } });
    await user.selectOptions(within(form).getByLabelText('Repeat'), 'monthly');
    await user.click(within(form).getByRole('button', { name: 'Add' }));
    const t = saved().tasks.find((x) => x.title.startsWith('pay rent'))!;
    expect(t.title).toBe('pay rent friday'); // the typed words stay when a day was picked by hand
    expect(t).toMatchObject({ date: '2030-01-15', recurrence: { freq: 'monthly' } });
  });

  it('renames in place, and Undo and Redo walk back and forward', async () => {
    const { user } = setup();
    await user.type(screen.getByPlaceholderText(/What needs doing/), 'first name');
    await user.click(within(screen.getByRole('form', { name: 'Add a to-do' })).getByRole('button', { name: 'Add' }));
    // changes made within a fraction of a second share one undo step, so let the add settle first
    await new Promise((r) => setTimeout(r, 400));
    await user.click(screen.getByRole('button', { name: 'Rename first name' }));
    const box = screen.getByRole('textbox', { name: 'Rename first name' });
    await user.clear(box);
    await user.type(box, 'second name{Enter}');
    expect(screen.getByText('second name')).toBeInTheDocument();
    const undo = screen.getByRole('button', { name: /Undo/ });
    const redo = screen.getByRole('button', { name: /Redo/ });
    await user.click(undo);
    expect(screen.getByText('first name')).toBeInTheDocument();
    await user.click(redo);
    expect(screen.getByText('second name')).toBeInTheDocument();
    await user.click(undo);
    await user.click(undo); // takes back the add itself
    expect(screen.queryByText('first name')).not.toBeInTheDocument();
    expect(redo).toBeEnabled();
  });

  it('puts a late to-do off until tomorrow', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...saved(),
      tasks: [{ id: 'late1', title: 'Late thing', notes: '', category: 'other', priority: 'normal', date: addDays(todayISO(), -2), subtasks: [], done: false, completions: [], skipped: [], subDone: {}, createdAt: '2026-01-01T00:00:00.000Z' }],
    }));
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Put off Late thing until tomorrow' }));
    expect(saved().tasks.find((t) => t.id === 'late1')!.date).toBe(addDays(todayISO(), 1));
    expect(screen.queryByRole('button', { name: 'Put off Late thing until tomorrow' })).not.toBeInTheDocument();
  });

  it('My order shows move buttons that save a hand order', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...saved(),
      tasks: ['One', 'Two', 'Three'].map((title, i) => ({ id: `o${i}`, title, notes: '', category: 'other', priority: 'normal', subtasks: [], done: false, completions: [], skipped: [], subDone: {}, createdAt: `2026-01-0${i + 1}T00:00:00.000Z` })),
    }));
    const { user } = setup();
    await user.selectOptions(screen.getByLabelText('Sort tasks'), 'manual');
    await user.click(screen.getByRole('button', { name: 'Move Three up' }));
    const order = saved().tasks.filter((t) => t.order !== undefined).sort((a, b) => a.order! - b.order!).map((t) => t.title);
    expect(order).toEqual(['One', 'Three', 'Two']);
    const rows = screen.getAllByRole('article').map((a) => a.querySelector('.t')?.textContent);
    expect(rows).toEqual(['One', 'Three', 'Two']);
  });
});

describe('Swipe on a touch screen', () => {
  const seed = () => window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    ...saved(),
    tasks: [{ id: 'sw1', title: 'Swipe me', notes: '', category: 'other', priority: 'normal', date: todayISO(), subtasks: [], done: false, completions: [], skipped: [], subDone: {}, createdAt: '2026-01-01T00:00:00.000Z' }],
  }));
  const swipe = (el: HTMLElement, dx: number, dy = 0) => {
    fireEvent.touchStart(el, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchEnd(el, { changedTouches: [{ clientX: 200 + dx, clientY: 100 + dy }] });
  };
  it('a swipe right ticks it off', () => {
    seed();
    setup();
    swipe(screen.getByRole('article'), 120);
    expect(saved().tasks[0].done).toBe(true);
  });
  it('a swipe left removes it, and Undo brings it back', async () => {
    seed();
    const { user } = setup();
    swipe(screen.getByRole('article'), -120);
    expect(saved().tasks).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Undo', hidden: false }));
    expect(saved().tasks).toHaveLength(1);
  });
  it('a short or mostly-vertical swipe does nothing', () => {
    seed();
    setup();
    swipe(screen.getByRole('article'), 40);
    swipe(screen.getByRole('article'), 150, 90);
    expect(saved().tasks[0].done).toBe(false);
  });
});

describe('Month calendar', () => {
  it('shows a month with a dot on days with something to do and lists the tapped day', async () => {
    const day = addDays(todayISO(), 0);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...saved(),
      tasks: [{ id: 'm1', title: 'Calendar thing', notes: '', category: 'other', priority: 'normal', date: day, subtasks: [], done: false, completions: [], skipped: [], subDone: {}, createdAt: '2026-01-01T00:00:00.000Z' }],
    }));
    const { user } = setup('#/path');
    await user.click(screen.getByRole('button', { name: 'Month' }));
    expect(screen.getByRole('region', { name: 'Month calendar' })).toBeInTheDocument();
    const cell = screen.getByRole('button', { name: new RegExp(`${Number(day.slice(8))}.*open`, 'i') });
    await user.click(cell);
    expect(within(screen.getByRole('region', { name: 'Month calendar' })).getByText('Calendar thing')).toBeInTheDocument();
  });
});

describe('Bringing in to-dos from Second Memory (screen)', () => {
  it('previews then adds them, leaving existing tasks alone, and a second time adds nothing', async () => {
    const sm = { collections: { todos: [{ id: 'a1', task: 'Imported one', completed: false, repeat: '', dueDate: '2030-05-01' }, { id: 'a2', task: 'Imported two', completed: true }] } };
    const before = saved().tasks.length;
    const { user } = setup('#/shed');
    const input = document.querySelector('section[aria-labelledby="smt-h"] input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File([JSON.stringify(sm)], 'export.json', { type: 'application/json' }));
    expect(await within(importCard()).findByRole('status')).toHaveTextContent(/2 to-dos to bring in/);
    await user.click(screen.getByRole('button', { name: /Bring in 2 to-dos/ }));
    const after = saved().tasks;
    expect(after.length).toBe(before + 2);
    expect(after.find((t) => t.id === 'sm-a1')).toMatchObject({ title: 'Imported one', date: '2030-05-01', done: false });
    expect(after.find((t) => t.id === 'sm-a2')).toMatchObject({ done: true });
    await user.upload(input, new File([JSON.stringify(sm)], 'export.json', { type: 'application/json' }));
    expect(await within(importCard()).findByRole('status')).toHaveTextContent(/0 to-dos to bring in.*2 already here/);
    expect(saved().tasks.length).toBe(before + 2);
  });

  it('refuses a file that is not a Second Memory export and changes nothing', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved())); // fix the starting data so it can be compared
    const before = JSON.stringify(saved().tasks);
    const { user } = setup('#/shed');
    const input = document.querySelector('section[aria-labelledby="smt-h"] input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File([JSON.stringify({ hello: 'world' })], 'x.json', { type: 'application/json' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/doesn’t look like a Second Memory export/);
    expect(JSON.stringify(saved().tasks)).toBe(before);
  });

  it('offers the to-dos found in this browser', async () => {
    window.localStorage.setItem(SECOND_MEMORY_TODOS_KEY, JSON.stringify([{ id: 'b1', task: 'Local one', completed: false }]));
    const { user } = setup('#/shed');
    await user.click(screen.getByRole('button', { name: /Use the 1 to-do found in this browser/ }));
    expect(within(importCard()).getByRole('status')).toHaveTextContent(/1 to-do to bring in/);
  });
});
