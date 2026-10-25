import { readFileSync, writeFileSync } from 'node:fs';
import { sub } from './lib.mjs';
const R = 'src/pages/Rituals.tsx';

// 1. imports
sub(R, "import { historyFor, isGentle, isPaused, progressOf, recentTended, STARTERS, stepsFor } from '../lib/routines';",
  "import { atPlace, historyFor, isGentle, isPaused, placeLabel, placeOn, progressOf, recentTended, STARTERS, stepsFor } from '../lib/routines';\nimport { linkify, typicalMinutes } from '../lib/journal';\nimport { PlaceSwitcher, RestControls } from '../components/Controls';\nimport type { Place } from '../lib/types';");

// 2. remove the local RestControls
let t = readFileSync(R, 'utf8');
const a = t.indexOf('/** Pause and gentle-day controls, shared by Today and Rituals */');
const b = t.indexOf('export function Rituals()');
if (a < 0 || b < 0) throw new Error('anchors');
t = t.slice(0, a) + t.slice(b);
writeFileSync(R, t);

// 3. generic chips + linkified text, placed before Guided
sub(R, "function Guided(", `function PlaceChips({ places, value, onChange, label, suffix = '' }: { places: Place[]; value?: string[]; onChange: (v: string[]) => void; label: string; suffix?: string }) {
  return (
    <fieldset className="day-chips">
      <legend>{label}</legend>
      {places.map((p) => {
        const on = value?.includes(p.id) ?? false;
        return (
          <label key={p.id} className={'chip' + (on ? ' on' : '')}>
            <input type="checkbox" aria-label={p.label + suffix} checked={on} onChange={() => onChange(on ? (value ?? []).filter((x) => x !== p.id) : [...(value ?? []), p.id])} />
            {p.icon} {p.label}
          </label>
        );
      })}
    </fieldset>
  );
}

/** note text with links and phone numbers made tappable; nothing is ever rendered as HTML */
function Note({ text }: { text: string }) {
  return (
    <span className="step-note">
      {linkify(text).map((p, i) =>
        p.href ? (
          <a key={i} href={p.href} target={p.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">{p.text}</a>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </span>
  );
}

function Guided(`);

// 4. place-aware steps
sub(R, "const remaining = stepsFor(routine, today, isGentle(data.settings, today)).filter(", "const remaining = stepsFor(routine, today, isGentle(data.settings, today), placeOn(data.settings, today)).filter(");
sub(R, "  const todays = stepsFor(routine, today, gentle);", "  const place = placeOn(data.settings, today);\n  const here = atPlace(routine, place);\n  const todays = stepsFor(routine, today, gentle, place);\n  const typical = typicalMinutes(data, routine.id);");

// 5. header badges
sub(R, "        {!routineOn(routine, today) && <span className=\"meta\">Not on today's list</span>}",
  "        {routine.places && routine.places.length > 0 && <span className=\"badge\">{routine.places.map((id) => placeLabel(data.settings, id)?.label ?? '').filter(Boolean).join(', ')}</span>}\n        {!routineOn(routine, today) && <span className=\"meta\">Not on today's list</span>}\n        {routineOn(routine, today) && !here && <span className=\"meta\">Not for {placeLabel(data.settings, place)?.label ?? 'here'}</span>}");

// 6. timing row (before the steps list)
sub(R, "      {gentle && hidden > 0 && !editing &&", `      {!editing && (
        <p className="timing meta">
          {!day.start && (
            <button className="btn ghost small" onClick={() => s.startRoutine(today, routine.id, new Date().toISOString())}>▶ Start</button>
          )}
          {day.start && !day.end && (
            <>
              Started {new Date(day.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}{' '}
              <button className="btn small" onClick={() => s.finishRoutine(today, routine.id, new Date().toISOString())}>Finished</button>
            </>
          )}
          {day.start && day.end && <>Took about {Math.max(1, Math.round((new Date(day.end).getTime() - new Date(day.start).getTime()) / 60000))} min today. </>}
          {typical && <>Usually about {typical.minutes} min (last {typical.samples} times). Just for your curiosity.</>}
        </p>
      )}
      {gentle && hidden > 0 && !editing &&`);

// 7. notes under step title
sub(R, "                  {isSkipped && <small> · skipped for today</small>}\n                  {isDone && <small> ✓</small>}\n                </span>", "                  {isSkipped && <small> · skipped for today</small>}\n                  {isDone && <small> ✓</small>}\n                  {st.note && !editing && <><br /><Note text={st.note} /></>}\n                </span>");

// 8. per-step note + places editors
sub(R, "              {editing && (\n                <details className=\"step-days\">", `              {editing && (
                <details className="step-days">
                  <summary>Note and places for “{st.title}”</summary>
                  <label>
                    Note (a link, address or phone number is fine)
                    <input aria-label={\`Note for \${st.title}\`} value={st.note ?? ''} onChange={(e) => patchStep(st.id, { note: e.target.value || undefined })} />
                  </label>
                  <PlaceChips suffix={\` for \${st.title}\`} places={data.settings.places} value={st.places} label="Only in these places (none = wherever the routine runs)" onChange={(v) => patchStep(st.id, { places: v.length ? v : undefined })} />
                </details>
              )}
              {editing && (
                <details className="step-days">`);

// 9. routine places + copy for a place
sub(R, "          <label className=\"inline\">\n            Part of the day{' '}", `          <PlaceChips places={data.settings.places} value={routine.places} label="Which places is this routine for? (none picked = everywhere)" onChange={(v) => s.setRoutinePlaces(routine.id, v)} />
          <div className="actions left">
            {data.settings.places.map((p) => (
              <button key={p.id} className="btn small" onClick={() => s.copyToPlace(routine.id, p.id)} aria-label={\`Make a copy of \${routine.name} just for \${p.label}\`}>
                Copy for {p.icon} {p.label}
              </button>
            ))}
          </div>
          <label className="inline">
            Part of the day{' '}`);

// 10. page header: place switcher
sub(R, "      <RestControls />\n      {paused &&", "      <PlaceSwitcher />\n      <RestControls />\n      {paused &&");
