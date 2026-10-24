import { makeTask, newId } from './schedule';
import { DEFAULT_SETTINGS, type AppData, type Routine } from './types';
import { addDays, todayISO } from './dates';

function routine(kind: Routine['kind'], name: string, steps: string[]): Routine {
  return { id: newId(), kind, name, steps: steps.map((title) => ({ id: newId(), title })) };
}

export function sampleRoutines(): Routine[] {
  return [
    routine('morning', 'Morning Routine', [
      'Get out of bed',
      'Shower',
      'Apply lotion and deodorant',
      'Get dressed',
      'Hair care',
      'Skin care',
      'Take morning medications (if you have any)',
      'Eat breakfast',
      'Brush teeth',
      "Review today's schedule",
    ]),
    routine('evening', 'Evening Routine', [
      'Prepare clothes and bag for tomorrow',
      'Tidy up for a few minutes',
      'Stretches or exercises',
      'Take evening medications (if you have any)',
      'Brush teeth',
      'Read or relax',
      'Prepare for bed',
    ]),
  ];
}

export function sampleTasks() {
  const t = todayISO();
  return [
    makeTask({ title: 'Team check-in', category: 'work', date: t, start: '10:00', end: '10:30' }),
    makeTask({ title: 'Grocery run', category: 'errands', date: t, duration: 45, priority: 'low' }),
    makeTask({
      title: 'Tidy the living room',
      category: 'chores',
      date: t,
      duration: 20,
      subtasks: ['Pick up clothes', 'Clear counters', 'Wash dishes', 'Take out trash'].map((title) => ({
        id: newId(),
        title,
        done: false,
      })),
    }),
    makeTask({
      title: 'Gentle walk',
      category: 'exercise',
      date: t,
      start: '17:30',
      duration: 30,
      recurrence: { freq: 'days', days: [1, 3, 5] },
    }),
    makeTask({ title: 'Dentist appointment', category: 'appointment', date: addDays(t, 2), start: '14:00', end: '15:00', priority: 'high' }),
    makeTask({ title: 'Plant something new', category: 'projects', notes: 'Someday idea — no rush.' }),
  ];
}

export function sampleData(): AppData {
  return {
    version: 1,
    tasks: sampleTasks(),
    routines: sampleRoutines(),
    routineLog: {},
    settings: { ...DEFAULT_SETTINGS },
    blooms: 0,
    templates: [],
  };
}
