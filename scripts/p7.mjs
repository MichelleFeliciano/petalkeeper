import { sub } from './lib.mjs';
sub('src/lib/routines.ts', "export const isPaused = (s: Settings, date: string): boolean => !!s.pausedFrom && !!s.pausedUntil && s.pausedFrom <= date && date <= s.pausedUntil;",
"export const isPaused = (s: Settings, date: string): boolean =>\n  (!!s.pausedFrom && !!s.pausedUntil && s.pausedFrom <= date && date <= s.pausedUntil) || s.plannedPauses.some((p) => p.from <= date && date <= p.until);");
