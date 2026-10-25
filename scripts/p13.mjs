import { sub, append } from './lib.mjs';
const D = 'src/components/DailyExtras.tsx';
sub(D, "import { RestControls } from '../pages/Rituals';", "import { Note } from '../pages/Rituals';\nimport { RestControls } from './Controls';");
sub(D, "import { isGentle, isPaused, nextUp, progressOf, routinesFor, stepsFor } from '../lib/routines';", "import { isGentle, isPaused, nextUp, placeOn, progressOf, routinesFor, stepsFor } from '../lib/routines';\nimport { countdownText, daysUntil, lastDoneLabel } from '../lib/journal';");
sub(D, "stepsFor(r, today, gentle).length > 0", "stepsFor(r, today, gentle, placeOn(data.settings, today)).length > 0");
sub(D, "      <p className=\"donow-step\">{step.title}{step.optional ? ' (optional)' : ''}</p>", "      <p className=\"donow-step\">{step.title}{step.optional ? ' (optional)' : ''}</p>\n      {step.note && <p className=\"meta\"><Note text={step.note} /></p>}");
sub('src/pages/Rituals.tsx', "function Note({ text }", "export function Note({ text }");
append(D, `
/** Things you do now and then, with the time you last did them. Your own record, not medical advice. */
export function AsNeeded() {
  const { data, markNeeded, unmarkNeeded, addNeeded, deleteNeeded } = useStore();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState('🌿');
  const now = new Date();
  return (
    <section className="card" aria-labelledby="an-h">
      <h2 id="an-h">As needed</h2>
      <p className="hint">Things you do now and then. A quick tap remembers when. This is only your own record, not medical advice.</p>
      {data.needed.map((n) => {
        const log = data.neededLog[n.id] ?? [];
        const last = log[log.length - 1];
        const today = log.filter((t) => new Date(t).toDateString() === now.toDateString()).length;
        return (
          <div key={n.id} className="counter">
            <span aria-hidden="true">{n.icon}</span>
            <span className="counter-label">
              {n.label}
              <small> · {last ? \`last \${lastDoneLabel(last, now)}\` : 'not yet'}{today > 1 ? \` · \${today} today\` : ''}</small>
            </span>
            <button className="btn small primary" onClick={() => markNeeded(n.id, new Date().toISOString())} aria-label={\`Just did: \${n.label}\`}>Just did it</button>
            <button className="btn ghost small" onClick={() => unmarkNeeded(n.id)} disabled={!last} aria-label={\`Undo last \${n.label}\`}>↺</button>
            <button className="btn ghost small" onClick={() => deleteNeeded(n.id)} aria-label={\`Remove \${n.label}\`}>✕</button>
          </div>
        );
      })}
      {adding ? (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!label.trim()) return;
            addNeeded(label.trim(), icon || '🌿');
            setLabel('');
            setAdding(false);
          }}
        >
          <input aria-label="As-needed icon" value={icon} onChange={(e) => setIcon(e.target.value)} style={{ maxWidth: 64 }} />
          <input aria-label="As-needed name" placeholder="Water the plants" value={label} onChange={(e) => setLabel(e.target.value)} />
          <button className="btn primary" type="submit">Add</button>
          <button className="btn ghost" type="button" onClick={() => setAdding(false)}>Cancel</button>
        </form>
      ) : (
        <button className="btn small" onClick={() => setAdding(true)}>＋ Add an as-needed item</button>
      )}
    </section>
  );
}

/** "6 days until the trip". Disappears the day after. */
export function Countdowns() {
  const { data, today, addCountdown, deleteCountdown } = useStore();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState('✈️');
  const [date, setDate] = useState('');
  const upcoming = data.countdowns.filter((c) => daysUntil(c.date, today) >= 0).sort((a, b) => a.date.localeCompare(b.date));
  if (upcoming.length === 0 && !adding) {
    return (
      <section className="card" aria-label="Coming up">
        <h2>Coming up</h2>
        <button className="btn small" onClick={() => setAdding(true)}>＋ Add a countdown</button>
      </section>
    );
  }
  return (
    <section className="card" aria-labelledby="cd-h">
      <h2 id="cd-h">Coming up</h2>
      {upcoming.map((c) => (
        <div key={c.id} className="counter">
          <span aria-hidden="true">{c.icon}</span>
          <span className="counter-label">{countdownText(c.label, c.date, today)}</span>
          <button className="btn ghost small" onClick={() => deleteCountdown(c.id)} aria-label={\`Remove countdown \${c.label}\`}>✕</button>
        </div>
      ))}
      {adding ? (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!label.trim() || !date) return;
            addCountdown(label.trim(), icon || '🌸', date);
            setLabel('');
            setDate('');
            setAdding(false);
          }}
        >
          <input aria-label="Countdown icon" value={icon} onChange={(e) => setIcon(e.target.value)} style={{ maxWidth: 64 }} />
          <input aria-label="Countdown name" placeholder="The trip" value={label} onChange={(e) => setLabel(e.target.value)} />
          <input aria-label="Countdown date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
          <button className="btn primary" type="submit">Add</button>
          <button className="btn ghost" type="button" onClick={() => setAdding(false)}>Cancel</button>
        </form>
      ) : (
        <button className="btn small" onClick={() => setAdding(true)}>＋ Add a countdown</button>
      )}
    </section>
  );
}
`);
// Today wiring
const t = 'src/pages/Today.tsx';
sub(t, "import { DoNow, TodaysRoutines, Counters, CheckIn } from '../components/DailyExtras';", "import { AsNeeded, Countdowns, DoNow, TodaysRoutines, Counters, CheckIn } from '../components/DailyExtras';\nimport { PlaceSwitcher } from '../components/Controls';");
sub(t, "      <DoNow />\n\n      <TodaysRoutines />\n\n      <Counters />\n\n      <CheckIn />\n", "      <PlaceSwitcher />\n\n      <Countdowns />\n\n      <DoNow />\n\n      <TodaysRoutines />\n\n      <AsNeeded />\n\n      <Counters />\n\n      <CheckIn />\n");
// Shed: places panel
sub('src/pages/Shed.tsx', "import { DevicePanel } from '../components/DevicePanel';", "import { DevicePanel } from '../components/DevicePanel';\nimport { PlacesPanel } from '../components/PlacesPanel';");
sub('src/pages/Shed.tsx', "      <SyncPanel />\n", "      <PlacesPanel />\n\n      <SyncPanel />\n");
