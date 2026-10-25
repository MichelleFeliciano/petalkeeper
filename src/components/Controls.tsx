import { useState } from 'react';
import { useStore } from '../store';
import { addDays } from '../lib/dates';
import { isGentle, isPaused, placeLabel, placeOn } from '../lib/routines';

/** Where you are right now. Routines and steps tied to other places step aside. */
export function PlaceSwitcher() {
  const { data, today, updateSettings } = useStore();
  const { settings } = data;
  const at = placeOn(settings, today);
  const stay = settings.stays.find((s) => s.from <= today && today <= s.until);
  const p = placeLabel(settings, at);
  return (
    <div className="place-switch" role="group" aria-label="Where you are">
      <label className="inline">
        <span aria-hidden="true">{p?.icon ?? '📍'}</span> I'm at{' '}
        <select
          aria-label="Where are you right now?"
          value={stay ? stay.place : settings.place}
          disabled={!!stay}
          onChange={(e) => updateSettings({ place: e.target.value })}
        >
          {settings.places.map((pl) => (
            <option key={pl.id} value={pl.id}>{pl.icon} {pl.label}</option>
          ))}
        </select>
      </label>
      {stay && <span className="meta">A planned stay through {stay.until} has switched this for you.</span>}
    </div>
  );
}

/** Pause and gentle-day controls, plus rests planned ahead. Shared by Today and Rituals. */
export function RestControls() {
  const { data, today, updateSettings, addPlannedPause, removePlannedPause } = useStore();
  const { settings } = data;
  const paused = isPaused(settings, today);
  const gentle = isGentle(settings, today);
  const [from, setFrom] = useState(addDays(today, 1));
  const [until, setUntil] = useState(addDays(today, 7));
  const rest = (days: number | 'open') => updateSettings({ pausedFrom: today, pausedUntil: days === 'open' ? '9999-12-31' : addDays(today, days - 1) });
  const resting = settings.pausedFrom && settings.pausedUntil && settings.pausedFrom <= today && today <= settings.pausedUntil;
  const planned = settings.plannedPauses.find((p) => p.from <= today && today <= p.until);
  return (
    <div className="rest card" role="group" aria-label="Rest options">
      {paused ? (
        <p>
          🌙 Routines are resting
          {resting ? (settings.pausedUntil && settings.pausedUntil < '9999' ? ` through ${settings.pausedUntil}` : ' until you resume') : planned ? ` through ${planned.until} (planned)` : ''}. Nothing is missed.{' '}
          {resting && <button className="btn small" onClick={() => updateSettings({ pausedFrom: undefined, pausedUntil: undefined })}>Resume routines</button>}
        </p>
      ) : (
        <div className="row">
          <label className="inline">
            <input type="checkbox" checked={gentle} onChange={(e) => updateSettings({ gentleOn: e.target.checked ? today : undefined })} /> Gentle day (essentials only)
          </label>
          <label className="inline">
            Pause routines{' '}
            <select
              aria-label="Pause routines"
              value=""
              onChange={(e) => {
                const v = e.target.value;
                if (v) rest(v === 'open' ? 'open' : Number(v));
              }}
            >
              <option value="">…</option>
              <option value="1">Just today</option>
              <option value="3">3 days</option>
              <option value="7">A week</option>
              <option value="open">Until I resume</option>
            </select>
          </label>
        </div>
      )}
      <details className="planned">
        <summary>Plan a rest ahead{settings.plannedPauses.length > 0 ? ` (${settings.plannedPauses.length})` : ''}</summary>
        <div className="row">
          <label className="inline">From <input type="date" aria-label="Rest starts" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="inline">Through <input type="date" aria-label="Rest ends" value={until} onChange={(e) => setUntil(e.target.value)} /></label>
          <button className="btn small" onClick={() => from && until && addPlannedPause(from, until)}>Add this rest</button>
        </div>
        <ul className="plain">
          {settings.plannedPauses.map((p) => (
            <li key={p.id}>
              {p.from} → {p.until}{' '}
              <button className="btn ghost small" onClick={() => removePlannedPause(p.id)} aria-label={`Remove planned rest ${p.from}`}>✕</button>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
