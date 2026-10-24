import { describe, expect, it } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { STORAGE_KEY } from '../lib/storage';

const setup = () => {
  window.location.hash = '';
  return { user: userEvent.setup(), ...render(<App />) };
};

describe('Petalkeeper app', () => {
  it('shows Today with sample data and all five sections', () => {
    setup();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    for (const n of ["Today's Garden", 'Daily Rituals', 'The Garden Path', 'Seed Pouch', 'Garden Shed']) {
      expect(screen.getByRole('button', { name: new RegExp(n) })).toBeInTheDocument();
    }
    expect(screen.getAllByText('Team check-in').length).toBeGreaterThan(0);
  });

  it('creates, completes, persists and deletes a task', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /Quick add/ }));
    await user.type(screen.getByPlaceholderText(/What would you like/), 'Water the ferns');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('Water the ferns')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /Mark done: Water the ferns/ }));
    expect(screen.getByRole('checkbox', { name: /Mark not done: Water the ferns/ })).toBeChecked();

    // persisted to localStorage, and restored on a fresh mount
    expect(localStorage.getItem(STORAGE_KEY)).toContain('Water the ferns');
    cleanup();
    setup();
    expect(screen.getByText('Water the ferns')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete Water the ferns' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.queryByText('Water the ferns')).not.toBeInTheDocument();
  });

  it('requires a name and rejects end before start', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /Quick add/ }));
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/name/i);
  });

  it('Adjust My Day moves a task to tomorrow only after confirming', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Adjust My Day' }));
    const dialog = screen.getByRole('dialog');
    const row = within(dialog).getByText('Grocery run').closest('li')!;
    await user.selectOptions(within(row).getByRole('combobox'), 'tomorrow');
    await user.click(within(dialog).getByRole('button', { name: /Apply 1 change/ }));
    expect(screen.queryByText('Grocery run')).not.toBeInTheDocument();
    // still exists in the pouch/week, not deleted
    expect(localStorage.getItem(STORAGE_KEY)).toContain('Grocery run');
  });

  it('routine steps can be checked and skipped', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /Daily Rituals/ }));
    const evening = new Date().getHours() >= 15;
    if (evening) await user.click(screen.getByRole('tab', { name: /Morning/ }));
    await user.click(screen.getByRole('checkbox', { name: /Get out of bed/ }));
    expect(screen.getByRole('checkbox', { name: /Get out of bed/ })).toBeChecked();
    await user.click(screen.getAllByRole('button', { name: 'Skip today' })[1]);
    expect(screen.getByText(/skipped for today/)).toBeInTheDocument();
  });

  it('works with fairy and garden decorations turned off', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /Garden Shed/ }));
    await user.click(screen.getByLabelText(/Show the garden fairy/));
    await user.click(screen.getByLabelText(/Show the little blooming garden/));
    await user.click(screen.getByRole('button', { name: /Today's Garden/ }));
    expect(document.querySelector('.fairy')).toBeNull();
    await user.click(screen.getByRole('checkbox', { name: /Mark done: Team check-in/ }));
    expect(screen.getByRole('checkbox', { name: /Mark not done: Team check-in/ })).toBeChecked();
  });

  it('survives corrupted storage without crashing', () => {
    localStorage.setItem(STORAGE_KEY, '{oops');
    setup();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY + '.corrupt')).toBe('{oops');
  });

  it('seed pouch shows unscheduled ideas and gentle empty state', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /Seed Pouch/ }));
    await user.click(screen.getByRole('button', { name: 'Unscheduled' }));
    expect(screen.getByText('Plant something new')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Overdue' }));
    expect(screen.getByText(/Your garden is at peace/)).toBeInTheDocument();
  });
});
