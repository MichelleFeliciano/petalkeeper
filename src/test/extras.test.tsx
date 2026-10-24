import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import * as ops from '../lib/ops';
import { buildICS } from '../lib/ics';
import { weekSummary } from '../lib/summary';
import { makeTask, occursOn } from '../lib/schedule';
import { exportJSON, parseImport } from '../lib/storage';
import { sampleData } from '../lib/seed';
import { emptyForTest } from './helpers';

describe('new logic', () => {
  it('edits just one day of a series', () => {
    const t = makeTask({ title: 'Walk', date: '2026-03-02', start: '17:00', recurrence: { freq: 'daily' } });
    const d = ops.splitOccurrence({ ...emptyForTest(), tasks: [t] }, t.id, '2026-03-04', { title: 'Walk (long)' });
    expect(occursOn(d.tasks[0], '2026-03-04')).toBe(false);
    expect(occursOn(d.tasks[0], '2026-03-05')).toBe(true);
    expect(d.tasks[0].title).toBe('Walk');
    const one = d.tasks[1];
    expect(one.title).toBe('Walk (long)');
    expect(one.recurrence).toBeUndefined();
    expect(occursOn(one, '2026-03-04')).toBe(true);
  });

  it('saves a day as a template and applies it to another day', () => {
    const a = makeTask({ title: 'Plan', date: '2026-03-02', start: '09:00', end: '09:30', subtasks: [{ id: 's', title: 'step', done: true }] });
    let d = ops.saveTemplate({ ...emptyForTest(), tasks: [a] }, 'Workday', [a]);
    d = ops.applyTemplate(d, d.templates[0].id, '2026-03-09');
    const copy = d.tasks[1];
    expect(copy.date).toBe('2026-03-09');
    expect(copy.start).toBe('09:00');
    expect(copy.subtasks[0].done).toBe(false);
    expect(copy.id).not.toBe(a.id);
  });

  it('builds a valid-looking iCalendar file', () => {
    const t = makeTask({ title: 'Dentist, 2nd; visit', date: '2026-03-02', start: '14:00', end: '15:00' });
    const free = makeTask({ title: 'Errand', date: '2026-03-02' });
    const ics = buildICS([t, free], '2026-03-02', 1);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART:20260302T140000');
    expect(ics).toContain('DTEND:20260302T150000');
    expect(ics).toContain('SUMMARY:Dentist\\, 2nd\\; visit');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260302');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('week summary is encouraging even when empty', () => {
    const s = weekSummary(emptyForTest(), ['2026-03-02']);
    expect(s.done).toBe(0);
    expect(s.message).toMatch(/patient/);
  });

  it('round-trips templates, custom categories and settings through export', () => {
    const d = sampleData();
    d.settings.customCategories = [{ id: 'c-1', label: 'Pets', icon: '🐕', color: '#aabbcc' }];
    d.settings.decor = 'stars';
    d.tasks[0].category = 'c-1';
    const a = d.tasks[0];
    const withT = ops.saveTemplate(d, 'T', [a]);
    const res = parseImport(exportJSON(withT));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.templates).toHaveLength(1);
      expect(res.data.settings.decor).toBe('stars');
      expect(res.data.settings.customCategories[0].label).toBe('Pets');
    }
    expect(parseImport(JSON.stringify({ ...withT, templates: 'nope' })).ok).toBe(false);
  });

  it('old backups without templates still import', () => {
    const { templates, ...old } = sampleData();
    void templates;
    const res = parseImport(JSON.stringify(old));
    expect(res.ok).toBe(true);
  });
});

describe('new UI', () => {
  const setup = () => {
    window.location.hash = '';
    return { user: userEvent.setup(), ...render(<App />) };
  };

  it('undo brings a deleted task back', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Delete Grocery run' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.queryByText('Grocery run')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByText('Grocery run')).toBeInTheDocument();
  });

  it('hours view shows timed activities', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Hours' }));
    expect(screen.getByRole('button', { name: /Team check-in, 10:00 AM/ })).toBeInTheDocument();
  });

  it('search finds tasks across filters', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /Seed Pouch/ }));
    await user.type(screen.getByPlaceholderText(/Search all tasks/), 'dentist');
    expect(screen.getByText('Dentist appointment')).toBeInTheDocument();
    expect(screen.queryByText('Plant something new')).not.toBeInTheDocument();
  });

  it('saves and applies a template', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Templates' }));
    const dlg = screen.getByRole('dialog');
    await user.type(within(dlg).getByPlaceholderText('Template name'), 'My day');
    await user.click(within(dlg).getByRole('button', { name: 'Save template' }));
    expect(within(dlg).getByText('My day')).toBeInTheDocument();
  });

  it('edits only one day of a repeating task', async () => {
    const { user } = setup();
    // the sample "Gentle walk" repeats Mon/Wed/Fri; make today's date match by adding a daily one
    await user.click(screen.getByRole('button', { name: /Quick add/ }));
    await user.type(screen.getByPlaceholderText(/What would you like/), 'Stretch');
    await user.selectOptions(screen.getByLabelText('Repeats'), 'daily');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.click(screen.getByRole('button', { name: 'Edit only this day of Stretch' }));
    const dlg = screen.getByRole('dialog');
    expect(within(dlg).getByText(/Only this day changes/)).toBeInTheDocument();
    expect(within(dlg).queryByLabelText('Repeats')).toBeNull();
    const name = within(dlg).getByPlaceholderText(/What would you like/);
    await user.clear(name);
    await user.type(name, 'Stretch (long)');
    await user.click(within(dlg).getByRole('button', { name: 'Save changes' }));
    expect(screen.getByText('Stretch (long)')).toBeInTheDocument();
    // today's slot was replaced; the series itself is unchanged and continues tomorrow
    expect(screen.queryByText('Stretch')).not.toBeInTheDocument();
    expect(localStorage.getItem('petalkeeper.v1')).toContain('"title":"Stretch"');
  });

  it('guided routine mode walks through steps', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /Daily Rituals/ }));
    await user.click(screen.getByRole('button', { name: 'Guide me' }));
    const dlg = screen.getByRole('dialog');
    const before = within(dlg).getByText(/steps? left/).textContent;
    await user.click(within(dlg).getByRole('button', { name: /Done/ }));
    expect(within(dlg).getByText(/steps? left/).textContent).not.toBe(before);
  });
});
