import { addDays, fromISO, isISODate } from './dates';

/**
 * Dates in plain words: "pay rent friday", "call mom tomorrow", "dentist on oct 20", "renew in 2 weeks" and
 * "3/15 file taxes" become a task title plus a date. The date words must be at the very start or very end of the text,
 * so "Monday meeting notes" is only changed when "Monday" really comes last or first.
 */

const WEEKDAYS = [
  ['sunday', 'sun'], ['monday', 'mon'], ['tuesday', 'tues', 'tue'], ['wednesday', 'wed'],
  ['thursday', 'thurs', 'thur', 'thu'], ['friday', 'fri'], ['saturday', 'sat'],
];
const MONTH_WORDS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// One date phrase (no anchors): today, tomorrow, next week, in N days/weeks, a weekday, "oct 20", or "3/15".
const DATE_PHRASE = [
  'today', 'tonight', 'tomorrow', 'tmrw', 'next\\s+week',
  'in\\s+\\d{1,3}\\s+(?:days?|weeks?)',
  `(?:next\\s+)?(?:${WEEKDAYS.flat().sort((a, b) => b.length - a.length).join('|')})`,
  `(?:${MONTH_WORDS.join('|')})[a-z]*\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?`,
  '\\d{1,2}/\\d{1,2}',
].join('|');
const DATE_WORDS_END = new RegExp(`^(.*?\\S)\\s+(?:(?:on|by|due|for)\\s+)?(${DATE_PHRASE})$`, 'i');
const DATE_WORDS_START = new RegExp(`^(?:(?:on|by|due)\\s+)?(${DATE_PHRASE})\\s+(.*\\S)$`, 'i');

const pad = (n: number) => String(n).padStart(2, '0');

/** Turns one matched phrase into a date (null if it is not a real date). `today` is a YYYY-MM-DD date. */
export function dateFromPhrase(phrase: string, today: string): string | null {
  const words = phrase.toLowerCase().replace(/\s+/g, ' ').trim();
  if (words === 'today' || words === 'tonight') return today;
  if (words === 'tomorrow' || words === 'tmrw') return addDays(today, 1);
  if (words === 'next week') return addDays(today, 7);
  let match = words.match(/^in (\d+) (day|days|week|weeks)$/);
  if (match) return addDays(today, Number(match[1]) * (match[2].startsWith('week') ? 7 : 1));

  // A weekday means the next one coming: a week from today if today is that day.
  const dayWord = words.replace(/^next /, '');
  const weekday = WEEKDAYS.findIndex((names) => names.includes(dayWord));
  if (weekday >= 0) {
    const todayIndex = fromISO(today).getDay();
    return addDays(today, ((weekday - todayIndex + 6) % 7) + 1);
  }

  // "oct 20" or "3/15": this year, or next year if that day has already gone by.
  let month: number | null = null;
  let day: number | null = null;
  match = words.match(/^([a-z]+)\.? (\d{1,2})(?:st|nd|rd|th)?$/);
  if (match) { month = MONTH_WORDS.indexOf(match[1].slice(0, 3)); day = Number(match[2]); }
  match = words.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (match) { month = Number(match[1]) - 1; day = Number(match[2]); }
  if (month === null || day === null || month < 0) return null;
  const year = fromISO(today).getFullYear();
  const thisYear = `${year}-${pad(month + 1)}-${pad(day)}`;
  if (!isISODate(thisYear)) return null;
  return thisYear < today ? `${year + 1}-${pad(month + 1)}-${pad(day)}` : thisYear;
}

/** Splits "task + date words" into { title, date }; null when there are no date words or nothing is left of the task. */
export function parseDateWords(input: string, today: string): { title: string; date: string } | null {
  const trimmed = String(input || '').trim();
  const end = trimmed.match(DATE_WORDS_END);
  const start = end ? null : trimmed.match(DATE_WORDS_START);
  const title = end ? end[1] : start ? start[2] : null;
  const phrase = end ? end[2] : start ? start[1] : null;
  if (!title || !phrase) return null;
  const date = dateFromPhrase(phrase, today);
  const year = date ? Number(date.slice(0, 4)) : 0;
  return date && year >= 2000 && year <= 2100 ? { title: title.trim(), date } : null;
}

