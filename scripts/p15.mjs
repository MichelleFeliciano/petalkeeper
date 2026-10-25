import { sub } from './lib.mjs';
const T = 'src/test/features2.test.tsx';
sub(T, "    const d = ops.copyToPlace(base(), base().routines[0].id, 'moms');", "    const b = base();\n    const d = ops.copyToPlace(b, b.routines[0].id, 'moms');");
sub(T, "    let d = ops.setRoutinePlaces(base(), base().routines[0].id, ['moms']);\n    d = ops.deletePlace(d, 'moms');", "    const b = base();\n    let d = ops.setRoutinePlaces(b, b.routines[0].id, ['moms']);\n    d = ops.deletePlace(d, 'moms');");
sub(T, "    let d = ops.setRoutinePlaces(base(), base().routines[0].id, ['moms']);\n    expect(historyFor", "    const b = base();\n    let d = ops.setRoutinePlaces(b, b.routines[0].id, ['moms']);\n    expect(historyFor");
sub(T, "selectOptions(screen.getByLabelText('Where are you right now?'), \"Mom's\")", "selectOptions(screen.getByLabelText('Where are you right now?'), 'moms')");
sub(T, "selectOptions(screen.getByLabelText('Where are you right now?'), 'Home')", "selectOptions(screen.getByLabelText('Where are you right now?'), 'home')");
sub('src/lib/ops.ts', "export const finishRoutine = (d: AppData, date: string, rid: string, whenISO: string): AppData =>\n  withDay(d, date, rid, (day) => (day.start ? { ...day, end: whenISO } : day));", "export const finishRoutine = (d: AppData, date: string, rid: string, whenISO: string): AppData =>\n  d.routineLog[date]?.[rid]?.start ? withDay(d, date, rid, (day) => ({ ...day, end: whenISO })) : d;");
