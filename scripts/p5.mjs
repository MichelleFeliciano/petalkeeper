import { readFileSync, writeFileSync } from 'node:fs';
const f = 'src/components/DailyExtras.tsx';
let s = readFileSync(f, 'utf8');
const a = s.indexOf("  if (isPaused(data.settings, today)) {\n    return (\n      <section className=\"card donow\" aria-label=\"Routines resting\">");
const b = s.indexOf("  const next = nextUp(");
if (a < 0 || b < 0) throw new Error('anchor');
s = s.slice(0, a) + "  if (isPaused(data.settings, today)) return null; // the rest controls below already say so\n" + s.slice(b);
writeFileSync(f, s);
