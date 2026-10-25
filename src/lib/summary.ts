import { isDone, itemsOn } from './schedule';
import { progressOf, routinesFor } from './routines';
import type { AppData } from './types';

export interface WeekSummary {
  done: number;
  total: number;
  routineSteps: number;
  byCategory: Record<string, number>;
  message: string;
  /** how many days had a mood logged, and the most common one */
  moodDays: number;
  commonMood?: number;
  /** routines completed on the days they were scheduled */
  routinesComplete: number;
  routinesScheduled: number;
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
  const moods: Record<number, number> = {};
  let moodDays = 0;
  for (const date of dates) {
    const m = d.checkins[date]?.mood;
    if (m) {
      moodDays++;
      moods[m] = (moods[m] ?? 0) + 1;
    }
  }
  const commonMood = Number(Object.entries(moods).sort((a, b) => b[1] - a[1])[0]?.[0]) || undefined;
  let routinesComplete = 0;
  let routinesScheduled = 0;
  for (const date of dates) {
    for (const r of routinesFor(d, date)) {
      const pr = progressOf(d, r, date);
      if (pr.total === 0) continue;
      routinesScheduled++;
      if (pr.complete) routinesComplete++;
    }
  }
  const message =
    done + routineSteps === 0
      ? 'A quiet week. Your garden is patient and will be here whenever you are ready.'
      : 'Look at everything you tended to. Thank you for taking care of yourself.';
  return { done, total, routineSteps, byCategory, message, moodDays, commonMood, routinesComplete, routinesScheduled };
}
