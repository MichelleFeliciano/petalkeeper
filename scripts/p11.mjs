import { sub } from './lib.mjs';

// ---- types
const TY = 'src/lib/types.ts';
sub(TY, "  /** a private note or link, like an address or a phone number */\n  note?: string;\n}", "  /** a private note or link, like an address or a phone number */\n  note?: string;\n  /** places this step applies to (a place id); missing means everywhere the routine runs */\n  places?: string[];\n}");
sub(TY, "  /** time (HH:MM) for a phone-calendar nudge when exported as .ics */\n  remindAt?: string;", "  /** time (HH:MM) for a phone-calendar nudge when exported as .ics */\n  remindAt?: string;\n  /** places this routine belongs to (a place id, like \"home\" or \"moms\"); missing or empty means everywhere */\n  places?: string[];");
sub(TY, "  plannedPauses: PlannedPause[];", "  plannedPauses: PlannedPause[];\n  /** where you are right now; routines and steps tied to other places step aside */\n  places: Place[];\n  place: string;\n  /** stays planned ahead, like a weekend at Mom's; they switch the place by themselves */\n  stays: Stay[];");
sub(TY, "export interface PlannedPause {", "export interface Place {\n  id: string;\n  label: string;\n  icon: string;\n}\nexport interface Stay {\n  id: string;\n  place: string;\n  from: string;\n  until: string;\n}\nexport const DEFAULT_PLACES: Place[] = [\n  { id: 'home', label: 'Home', icon: '🏡' },\n  { id: 'moms', label: \"Mom's\", icon: '💐' },\n  { id: 'vacation', label: 'Vacation', icon: '🏖️' },\n  { id: 'roadtrip', label: 'Road trip', icon: '🚗' },\n];\n\nexport interface PlannedPause {");
sub(TY, "  plannedPauses: [],\n};", "  plannedPauses: [],\n  places: DEFAULT_PLACES,\n  place: 'home',\n  stays: [],\n};");

// ---- validation
const ST = 'src/lib/storage.ts';
sub(ST, "(s.note === undefined || isStr(s.note)))", "(s.note === undefined || isStr(s.note)) && (s.places === undefined || (Array.isArray(s.places) && s.places.every(isStr))))");
sub(ST, "(r.remindAt !== undefined && !isTime(r.remindAt)) ||", "(r.remindAt !== undefined && !isTime(r.remindAt)) ||\n      (r.places !== undefined && !(Array.isArray(r.places) && r.places.every(isStr))) ||");
sub(ST, "  let needed: Needed[] = [];", `  if (Array.isArray(s.places)) {
    const ps = (s.places as unknown[]).filter((p): p is Place => isObj(p) && isStr(p.id) && isStr(p.label) && isStr(p.icon));
    if (ps.length > 0) settings.places = ps;
  }
  if (isStr(s.place) && settings.places.some((p) => p.id === s.place)) settings.place = s.place;
  else settings.place = settings.places[0].id;
  if (Array.isArray(s.stays)) {
    settings.stays = (s.stays as unknown[]).filter((p): p is Stay => isObj(p) && isStr(p.id) && isStr(p.place) && isISODate(p.from) && isISODate(p.until));
  }
  let needed: Needed[] = [];`);
sub(ST, "type Needed, type PlannedPause,", "type Needed, type Place, type PlannedPause, type Stay,");

// ---- logic
const R = 'src/lib/routines.ts';
sub(R, "export const stepOn =", `/** where you are on a date: a planned stay wins, otherwise the place you've switched to */
export const placeOn = (s: Settings, date: string): string => s.stays.find((st) => st.from <= date && date <= st.until)?.place ?? s.place;
/** things with no places listed belong everywhere */
export const atPlace = (x: { places?: string[] }, place: string): boolean => !x.places || x.places.length === 0 || x.places.includes(place);
export const placeLabel = (s: Settings, id: string) => s.places.find((p) => p.id === id);
export const stepOn =`);
sub(R, "export function stepsFor(r: Routine, date: string, gentle: boolean): RoutineStep[] {\n  const todays = r.steps.filter((st) => stepOn(st, date));", "export function stepsFor(r: Routine, date: string, gentle: boolean, place?: string): RoutineStep[] {\n  const todays = r.steps.filter((st) => stepOn(st, date) && (place === undefined || atPlace(st, place)));");
sub(R, "export const routinesFor = (d: AppData, date: string): Routine[] => (isPaused(d.settings, date) ? [] : d.routines.filter((r) => routineOn(r, date)));", "export const routinesFor = (d: AppData, date: string): Routine[] =>\n  isPaused(d.settings, date) ? [] : d.routines.filter((r) => routineOn(r, date) && atPlace(r, placeOn(d.settings, date)));");
sub(R, "export function progressOf(d: AppData, r: Routine, date: string) {\n  const day = d.routineLog[date]?.[r.id] ?? { done: [], skipped: [] };\n  const steps = stepsFor(r, date, isGentle(d.settings, date)).filter(", "export function progressOf(d: AppData, r: Routine, date: string, anyPlace = false) {\n  const day = d.routineLog[date]?.[r.id] ?? { done: [], skipped: [] };\n  const steps = stepsFor(r, date, isGentle(d.settings, date), anyPlace ? undefined : placeOn(d.settings, date)).filter(");
sub(R, "    if (!routineOn(r, date)) return 'off';\n    const pr = progressOf(d, r, date);\n    if (pr.total === 0) return 'off';", "    if (!routineOn(r, date)) return 'off';\n    const pr = progressOf(d, r, date, true);\n    // a routine for somewhere else is just resting that day, unless you did some of it anyway\n    if (!atPlace(r, placeOn(d.settings, date)) && pr.done === 0) return 'off';\n    if (pr.total === 0) return 'off';");

