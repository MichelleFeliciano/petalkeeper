import { readFileSync, writeFileSync } from 'node:fs';
const sub = (file, from, to) => {
  const s = readFileSync(file, 'utf8');
  if (!s.includes(from)) throw new Error(`missing in ${file}: ${from.slice(0, 50)}`);
  writeFileSync(file, s.replace(from, to));
};
const R = 'src/pages/Rituals.tsx';
sub(R, "import type { Routine } from '../lib/types';", "import { PARTS, currentPart, partOf, type PartOfDay, type Routine } from '../lib/types';");
// part-of-day picker while editing
sub(R, "          <button className=\"btn danger small\" onClick={() => setConfirmDel(true)}>Delete this routine</button>",
`          <label className="inline">
            Part of the day{' '}
            <select value={routine.kind} onChange={(e) => s.setRoutineKind(routine.id, e.target.value as PartOfDay)}>
              {PARTS.map((p) => (
                <option key={p.id} value={p.id}>{p.icon} {p.label} · {p.hint}</option>
              ))}
            </select>
          </label>
          <button className="btn danger small" onClick={() => setConfirmDel(true)}>Delete this routine</button>`);
const src = readFileSync(R, 'utf8');
const i = src.indexOf('export function Rituals()');
writeFileSync(R, src.slice(0, i) + `export function Rituals() {
  const { data, addRoutine } = useStore();
  const [kind, setKind] = useState<PartOfDay>(currentPart(new Date().getHours()));
  const list = data.routines.filter((r) => r.kind === kind);
  const part = partOf(kind);
  const count = (k: string) => data.routines.filter((r) => r.kind === k).length;

  return (
    <div className="page">
      <header>
        <p className="eyebrow">Daily Rituals · routines for each part of your day</p>
        <h1>{part.label} flowerbed</h1>
        <p className="hint">
          {part.hint}. Routines follow the part of the day, not the clock, so there's no set time. Checklists reset each day. Skip anything you like; nothing is lost. Medication items are just your own reminders, not medical advice.
        </p>
        <div className="tabs" role="tablist" aria-label="Part of the day">
          {PARTS.map((p) => (
            <button key={p.id} role="tab" aria-selected={kind === p.id} className={'tab' + (kind === p.id ? ' on' : '')} onClick={() => setKind(p.id)}>
              {p.icon} {p.label}
              {count(p.id) > 0 ? \` (\${count(p.id)})\` : ''}
            </button>
          ))}
        </div>
      </header>
      {list.map((r) => <RoutineCard key={r.id} routine={r} />)}
      {list.length === 0 && <p className="empty">No {part.label.toLowerCase()} routine yet. Plant one whenever you like, for example "{kind === 'morning' ? 'Wake-up: shower, brush teeth' : part.label + ' reset'}".</p>}
      <button className="btn primary" onClick={() => addRoutine(kind, \`New \${part.label.toLowerCase()} routine\`)}>
        ＋ New {part.label.toLowerCase()} routine
      </button>
    </div>
  );
}
`);
// Today: routines section
const T = 'src/pages/Today.tsx';
sub(T, "      </header>\n", `      </header>

      <TodaysRoutines />
`);
const t = readFileSync(T, 'utf8');
const j = t.indexOf('export function Today');
writeFileSync(T, t.slice(0, j) + `/** Every routine, in order through the day, with checkboxes right here. */
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

` + t.slice(j));
