import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import * as ops from '../lib/ops';
import { parseDateWords } from '../lib/dateWords';
import { linkify } from '../lib/journal';
import { makeTask } from '../lib/schedule';
import { exportJSON, validateData } from '../lib/storage';
import { mergeData } from '../lib/sync';
import { emptyForTest } from './helpers';

const T = '2026-03-03';

describe('review fixes: logic', () => {
  it('only reads real month names as dates', () => {
    expect(parseDateWords('buy marble 5', T)).toBeNull();
    expect(parseDateWords('move the decor 3', T)).toBeNull();
    expect(parseDateWords('dentist oct 20', T)?.date).toBe('2026-10-20');
    expect(parseDateWords('dentist on October 20th', T)?.date).toBe('2026-10-20');
    expect(parseDateWords('book flights sept 9', T)?.date).toBe('2026-09-09');
  });

  it('rejects a task whose per-day list of finished steps is damaged', () => {
    const d = ops.addTask(emptyForTest(), makeTask({ title: 'Water ferns' }));
    const raw = JSON.parse(exportJSON(d));
    expect(validateData(raw).ok).toBe(true);
    raw.tasks[0].subDone = { [T]: 'oops' };
    expect(validateData(raw).ok).toBe(false);
  });

  it('clears a setting everywhere when one device cleared it', () => {
    const base = ops.updateSettings(emptyForTest(), { pausedFrom: T, pausedUntil: '2026-03-09', todoRemindAt: '09:00' });
    const resumedElsewhere = ops.updateSettings(base, { pausedFrom: undefined, pausedUntil: undefined });
    const merged = mergeData(base, base, resumedElsewhere);
    expect(merged.settings.pausedFrom).toBeUndefined();
    expect(merged.settings.pausedUntil).toBeUndefined();
    // a setting nobody touched stays
    expect(merged.settings.todoRemindAt).toBe('09:00');
    // a setting only this device changed still wins
    const here = ops.updateSettings(base, { todoRemindAt: '18:00' });
    expect(mergeData(base, here, base).settings.todoRemindAt).toBe('18:00');
  });

  it('keeps notification settings per device while merging', () => {
    const base = emptyForTest();
    const local = ops.updateSettings(base, { notifications: true });
    expect(mergeData(base, local, base).settings.notifications).toBe(true);
  });

  it('links phone numbers but not dates or lists of small numbers', () => {
    const links = (s: string) => linkify(s).filter((p) => p.href).map((p) => p.href);
    expect(links('call 555-123-4567 today')).toEqual(['tel:5551234567']);
    expect(links('saw it on 2026-11-07')).toEqual([]);
    expect(links('sizes 12 15 20 25 30')).toEqual([]);
    expect(linkify('saw it on 2026-11-07').map((p) => p.text).join('')).toBe('saw it on 2026-11-07');
  });
});

describe('review fixes: styles and screens', () => {
  // read the stylesheet as text (tests run from the project folder); the module name is built at run time so the type checker doesn't need node types
  const readCss = async () => {
    const name = 'node:fs';
    const { readFileSync } = (await import(/* @vite-ignore */ name)) as { readFileSync: (p: string, enc: string) => string };
    return readFileSync('src/styles.css', 'utf8');
  };

  it("does not reuse the tick-box, routine-history or hour-block class names for other things", async () => {
    const css = await readCss();
    expect(css.length).toBeGreaterThan(1000);
    expect(css).not.toMatch(/\.check\s*\{[^}]*list-style/);
    expect(css).not.toMatch(/\.history\s*\{[^}]*padding-left/);
    expect(css).not.toMatch(/\.block\s*\{\s*display:\s*block;?\s*\}/);
    expect(css).toMatch(/\.status-list\b/);
  });

  it('asks before disconnecting sync', async () => {
    const user = userEvent.setup();
    localStorage.setItem('petalkeeper.sync', JSON.stringify({ repo: 'me/data', token: 'x', path: 'petalkeeper.json', auto: false }));
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Garden Shed/ }));
    await user.click(screen.getByRole('button', { name: 'Disconnect this device' }));
    expect(screen.getByRole('dialog', { name: 'Disconnect this device?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Stay connected' }));
    expect(localStorage.getItem('petalkeeper.sync')).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Disconnect this device' }));
    await user.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect(localStorage.getItem('petalkeeper.sync')).toBeNull();
  });
});
