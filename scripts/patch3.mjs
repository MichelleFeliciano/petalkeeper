import { readFileSync, writeFileSync } from 'node:fs';
const T = 'src/pages/Today.tsx';
let t = readFileSync(T, 'utf8').replace(/\r\n/g, '\n');
t = t.replace("      </header>\n", "      </header>\n\n      <TodaysRoutines />\n");
t = t.replace("import { findConflicts", "import { PARTS, currentPart } from '../lib/types';\nimport { routineDay } from '../lib/ops';\nimport { findConflicts");
const j = t.indexOf('export function Today');
t = t.slice(0, j) + `/** Every routine, in order through the day, with checkboxes right here. */
function TodaysRoutines() {
  const { data, today, toggleStep } = useStore();
  const now = currentPart(new Date().getHours());
  const groups = PARTS.map((p) => ({ p, rs: data.routines.filter((r) => r.kind === p.id && r.steps.length > 0) })).filter((g) => g.rs.length > 0);
  if (groups.length === 0) return null;
  return (
    <section className="card" aria-labelledby="tr-h">
      <h2 id="tr-h">Today's routines</h2>
      {groups.map(({ p, rs }) =>
        rs.map((r) => {
          const day = routineDay(data, today, r.id);
          const active = r.steps.filter((st) => !day.skipped.includes(st.id));
          const done = active.filter((st) => day.done.includes(st.id)).length;
          return (
            <details key={r.id} open={p.id === now && done < active.length}>
              <summary>
                {p.icon} <strong>{r.name}</strong> <span className="meta">{done}/{active.length}{active.length > 0 && done === active.length ? ' ✿' : ''}</span>
              </summary>
              <ul className="ritual-steps">
                {active.map((st) => (
                  <li key={st.id} className={day.done.includes(st.id) ? 'done' : ''}>
                    <label>
                      <input type="checkbox" className="check" checked={day.done.includes(st.id)} onChange={() => toggleStep(today, r.id, st.id)} />
                      <span>{st.title}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </details>
          );
        }),
      )}
    </section>
  );
}

` + t.slice(j);
writeFileSync(T, t.replace(/\n/g, '\r\n'));
