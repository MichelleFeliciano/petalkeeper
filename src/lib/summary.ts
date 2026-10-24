import { isDone, itemsOn } from './schedule';
import type { AppData } from './types';

export interface WeekSummary {
  done: number;
  total: number;
  routineSteps: number;
  byCategory: Record<string, number>;
  message: string;
}

/** A kind look back. No scores, no streaks. */
export function weekSummary(d: AppData, dates: string[]): WeekSummary {
  let done = 0;
  let total = 0;
  const byCategory: Record<string, number> = {};
  for (const date of dates) {
    for (const o of itemsOn(d.tasks, date)) {
      total++;
      if (isDone(o.task, o.date)) {
        done++;
        byCategory[o.task.category] = (byCategory[o.task.category] ?? 0) + 1;
      }
    }
  }
  let routineSteps = 0;
  for (const date of dates) for (const day of Object.values(d.routineLog[date] ?? {})) routineSteps += day.done.length;
  const message =
    done + routineSteps === 0
      ? 'A quiet week. Your garden is patient and will be here whenever you are ready.'
      : 'Look at everything you tended to. Thank you for taking care of yourself.';
  return { done, total, routineSteps, byCategory, message };
}
