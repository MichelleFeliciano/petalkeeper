export type Category =
  | 'morning'
  | 'evening'
  | 'work'
  | 'appointment'
  | 'chores'
  | 'errands'
  | 'health'
  | 'exercise'
  | 'projects'
  | 'relax'
  | 'other';

export const CATEGORIES: { id: Category; label: string; icon: string }[] = [
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

export interface Routine {
  id: string;
  kind: 'morning' | 'evening';
  name: string;
  steps: RoutineStep[];
}

export interface RoutineStep {
  id: string;
  title: string;
  minutes?: number;
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
  theme: 'light' | 'dark';
  defaultPage: 'today' | 'rituals' | 'path' | 'seeds';
  showFairy: boolean;
  showGarden: boolean;
}

export interface AppData {
  version: 1;
  tasks: Task[];
  routines: Routine[];
  routineLog: RoutineLog;
  settings: Settings;
  /** lifetime count of little completions; only ever grows */
  blooms: number;
}

export const DEFAULT_SETTINGS: Settings = {
  weekStart: 1,
  defaultDuration: 30,
  buffer: 0,
  theme: 'light',
  defaultPage: 'today',
  showFairy: true,
  showGarden: true,
};
