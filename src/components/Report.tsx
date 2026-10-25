import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { addDays } from '../lib/dates';
import { MOODS } from '../lib/types';
import { buildReport, reportText, type ReportInclude } from '../lib/summary';

/** A summary of a stretch of days you can print, save as a PDF, or copy as text, with only what you choose to include. */
export function SummaryReport() {
  const { data, today, notify } = useStore();
  const [from, setFrom] = useState(addDays(today, -29));
  const [to, setTo] = useState(today);
  const [inc, setInc] = useState<ReportInclude>({ moods: true, notes: false, routines: true, counters: false });
  const ok = from <= to;
  const rep = useMemo(() => (ok ? buildReport(data, from, to) : null), [data, from, to, ok]);
  const toggle = (k: keyof ReportInclude) => setInc({ ...inc, [k]: !inc[k] });
  const label = (k: keyof ReportInclude, text: string) => (
    <label className="inline">
      <input type="checkbox" checked={inc[k]} onChange={() => toggle(k)} /> {text}
    </label>
  );

  return (
    <section className="card report" aria-labelledby="rp-h">
      <h2 id="rp-h" className="no-print">A summary to share</h2>
      <div className="no-print">
        <p className="hint">Make a summary of a stretch of days, for yourself or to show someone like a therapist. You choose what goes in. Nothing leaves your device unless you print or copy it.</p>
        <div className="row">
          <label>From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label>Through <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
        <div className="chips-row">
          {label('moods', 'How days felt')}
          {label('routines', 'Routine consistency')}
          {label('counters', 'Counters')}
          {label('notes', 'My notes (private, so off by default)')}
        </div>
        {!ok && <p className="error" role="alert">The start date should not be after the end date.</p>}
      </div>
      {rep && (
        <div className="report-body">
          <h3>Summary, {rep.from} to {rep.to}</h3>
          <p className="meta">{rep.days} days</p>
          {inc.moods && (
            <>
              <h4>How days felt</h4>
              {rep.moodDays === 0 ? (
                <p>No check-ins in this period.</p>
              ) : (
                <p>
                  {rep.moodDays} check-in{rep.moodDays === 1 ? '' : 's'}, average {rep.avgMood} out of 5.{' '}
                  {MOODS.filter((m) => rep.moodCounts[m.id]).map((m) => `${m.icon} ${m.label} ×${rep.moodCounts[m.id]}`).join('  ')}
                </p>
              )}
            </>
          )}
          {inc.routines && rep.routines.length > 0 && (
            <>
              <h4>Routines</h4>
              <ul className="plain">
                {rep.routines.map((r) => (
                  <li key={r.name + r.scheduled}>
                    {r.name}: tended on {r.tended} of {r.scheduled} scheduled days, fully finished on {r.complete}
                  </li>
                ))}
              </ul>
            </>
          )}
          {inc.counters && rep.counters.length > 0 && (
            <>
              <h4>Counters</h4>
              <ul className="plain">
                {rep.counters.map((c) => (
                  <li key={c.label}>
                    {c.label}: {c.total} over {c.days} days
                  </li>
                ))}
              </ul>
            </>
          )}
          {inc.notes && rep.notes.length > 0 && (
            <>
              <h4>Notes</h4>
              <ul className="plain">
                {rep.notes.map((n) => (
                  <li key={n.date}>
                    <strong>{n.date}</strong> {n.mood ? MOODS.find((m) => m.id === n.mood)?.icon : ''} {n.note}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      <div className="actions left no-print">
        <button className="btn primary" disabled={!rep} onClick={() => window.print()}>Print or save as PDF</button>
        <button
          className="btn"
          disabled={!rep}
          onClick={() => {
            if (!rep) return;
            const text = reportText(rep, inc);
            if (navigator.clipboard?.writeText) {
              navigator.clipboard.writeText(text).then(
                () => notify('Summary copied.'),
                () => notify("Couldn't copy. Try Print instead."),
              );
            } else notify("Couldn't copy. Try Print instead.");
          }}
        >
          Copy as text
        </button>
      </div>
    </section>
  );
}
