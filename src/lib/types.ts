/** built-in ids plus any custom category id */
export type Category = string;

export interface CategoryDef {
  id: Category;
  label: string;
  icon: string;
  color?: string;
}

export const CATEGORIES: CategoryDef[] = [
  { id: 'morning', label: 'Morning routine', icon: '🌅' },
  { id: 'evening', label: 'Evening routine', icon: '🌙' },
  { id: 'work', label: 'Work', icon: '💼' },
  { id: 'appointment', label: 'Appointments', icon: '📅' },
  { id: 'chores', label: 'Household chores', icon: '🧺' },
  { id: 'errands', label: 'Errands', icon: '🛍️' },
  { id: 'health', label: 'Health & self-care', icon: '🌿' },
  { id: 'exercise', label: 'Exercise', icon: '🧘' },
  { id: 'projects', label: 'Personal projects', icon: '✏️' },
  { id: 'relax', label: 'Relaxation & free time', icon: '🍃' },
  { id: 'other', label: 'Other', icon: '🌸' },
];

export function allCategories(s: Settings): CategoryDef[] {
  return [...CATEGORIES, ...s.customCategories];
}

export function categoryOf(s: Settings, id: Category): CategoryDef {
  return allCategories(s).find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}

export type Priority = 'low' | 'normal' | 'high';

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export type RecurFreq = 'daily' | 'days' | 'weekly' | 'monthly';

export interface Recurrence {
  freq: RecurFreq;
  /** for 'days': weekdays 0=Sunday..6=Saturday */
  days?: number[];
  /** inclusive last date, YYYY-MM-DD */
  until?: string;
}

export interface Task {
  id: string;
  title: string;
  notes: string;
  category: Category;
  priority: Priority;
  /** scheduled date (first occurrence for recurring), YYYY-MM-DD */
  date?: string;
  /** HH:MM, 24h */
  start?: string;
  end?: string;
  /** estimated minutes */
  duration?: number;
  due?: string;
  subtasks: Subtask[];
  recurrence?: Recurrence;
  /** completion for one-off tasks */
  done: boolean;
  /** dates a recurring task was completed on */
  completions: string[];
  /** dates a recurring task has been skipped/moved away from */
  skipped: string[];
  /** per-date subtask completion for recurring tasks */
  subDone: Record<string, string[]>;
  createdAt: string;
}

/** Routines belong to a part of the day, not a clock time: "first thing", "winding down"… */
export const PARTS = [
  { id: 'morning', label: 'Morning', icon: '🌅', hint: 'First thing, when you wake up' },
  { id: 'midday', label: 'Midday', icon: '☀️', hint: 'Around lunch' },
  { id: 'afternoon', label: 'Afternoon', icon: '🌤️', hint: 'The middle stretch of the day' },
  { id: 'evening', label: 'Evening', icon: '🌙', hint: 'Winding down after the day' },
  { id: 'bedtime', label: 'Bedtime', icon: '🛏️', hint: 'Last thing before sleep' },
] as const;
export type PartOfDay = (typeof PARTS)[number]['id'];
export const partOf = (id: string) => PARTS.find((p) => p.id === id) ?? PARTS[0];
/** which part of the day it is right now */
export const currentPart = (hour: number): PartOfDay =>
  hour < 11 ? 'morning' : hour < 14 ? 'midday' : hour < 18 ? 'afternoon' : hour < 21 ? 'evening' : 'bedtime';

export interface Routine {
  id: string;
  kind: PartOfDay;
  name: string;
  steps: RoutineStep[];
  /** weekdays it belongs to (0 = Sunday … 6 = Saturday). Empty or missing means every day. */
  days?: number[];
  /** time (HH:MM) for a phone-calendar nudge when exported as .ics */
  remindAt?: string;
}

export interface RoutineStep {
  id: string;
  title: string;
  minutes?: number;
  /** kept on gentle days, when only the essentials are shown */
  essential?: boolean;
  /** a nice-to-have: never counts against finishing the routine */
  optional?: boolean;
  /** weekdays this step applies to (0 = Sunday); missing means every day the routine runs */
  days?: number[];
}

/** progress is keyed by date, so a new day automatically starts fresh */
export interface RoutineDay {
  done: string[];
  skipped: string[];
}
export type RoutineLog = Record<string, Record<string, RoutineDay>>; // date -> routineId -> day

export interface Settings {
  weekStart: 0 | 1;
  defaultDuration: number;
  buffer: number;
  theme: 'light' | 'dark' | 'system';
  defaultPage: 'today' | 'rituals' | 'path' | 'seeds';
  showFairy: boolean;
  showGarden: boolean;
  notifications: boolean;
  /** minutes before a timed activity to send a reminder */
  notifyLead: number;
  decor: 'blooms' | 'mushrooms' | 'butterflies' | 'stars';
  customCategories: CategoryDef[];
  /** ISO date of last export, for the gentle backup nudge */
  lastBackup?: string;
  /** hide the backup nudge until this ISO date */
  backupSnooze?: string;
  /** routines are resting from this date through pausedUntil (inclusive) */
  pausedFrom?: string;
  pausedUntil?: string;
  /** gentle (essentials-only) mode is on for this ISO date, and switches itself off the next day */
  gentleOn?: string;
}

export interface TemplateItem {
  title: string;
  notes: string;
  category: Category;
  priority: Priority;
  start?: string;
  end?: string;
  duration?: number;
  subtasks: string[];
}

export interface Template {
  id: string;
  name: string;
  items: TemplateItem[];
}

export interface Counter {
  id: string;
  label: string;
  icon: string;
  /** daily target; reaching it is a nice moment, never a requirement */
  goal: number;
}
export type Mood = 1 | 2 | 3 | 4 | 5;
export interface Checkin {
  mood?: Mood;
  note?: string;
}
export const MOODS: { id: Mood; icon: string; label: string }[] = [
  { id: 1, icon: '😔', label: 'Heavy' },
  { id: 2, icon: '😕', label: 'Low' },
  { id: 3, icon: '😐', label: 'Okay' },
  { id: 4, icon: '🙂', label: 'Good' },
  { id: 5, icon: '😊', label: 'Bright' },
];

export interface AppData {
  version: 1;
  tasks: Task[];
  routines: Routine[];
  routineLog: RoutineLog;
  settings: Settings;
  /** lifetime count of little completions; only ever grows */
  blooms: number;
  templates: Template[];
  counters: Counter[];
  /** date -> counter id -> count */
  counterLog: Record<string, Record<string, number>>;
  /** date -> how the day felt; private and optional */
  checkins: Record<string, Checkin>;
}

export const DEFAULT_SETTINGS: Settings = {
  weekStart: 1,
  defaultDuration: 30,
  buffer: 0,
  theme: 'light',
  defaultPage: 'today',
  showFairy: true,
  showGarden: true,
  notifications: false,
  notifyLead: 10,
  decor: 'blooms',
  customCategories: [],
};
