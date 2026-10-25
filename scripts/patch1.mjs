import { readFileSync, writeFileSync } from 'node:fs';
const sub = (file, from, to) => {
  const s = readFileSync(file, 'utf8');
  if (!s.includes(from)) throw new Error(`missing in ${file}: ${from.slice(0, 50)}`);
  writeFileSync(file, s.replace(from, to));
};
sub('src/lib/types.ts', "  kind: 'morning' | 'evening';", "  kind: PartOfDay;");
sub('src/lib/types.ts', "export interface Routine {", `/** Routines belong to a part of the day, not a clock time: "first thing", "winding down"… */
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

export interface Routine {`);
sub('src/lib/storage.ts', "['morning', 'evening'].includes(r.kind as string)", "PARTS.some((p) => p.id === r.kind)");
sub('src/lib/ops.ts', "export const renameRoutine", `export const setRoutineKind = (d: AppData, id: string, kind: Routine['kind']): AppData => ({
  ...d,
  routines: d.routines.map((r) => (r.id === id ? { ...r, kind } : r)),
});

export const renameRoutine`);
