import { useState } from 'react';
import { useStore } from '../store';
import { addDays } from '../lib/dates';

/** Manage the places/modes (Home, Mom's, Vacation, Road trip, your own) and plan stays ahead of time. */
export function PlacesPanel() {
  const s = useStore();
  const { places, stays } = s.data.settings;
  const today = s.today;
  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState('📍');
  const [stayPlace, setStayPlace] = useState(places.find((p) => p.id === 'moms')?.id ?? places[0].id);
  const [from, setFrom] = useState(addDays(today, 1));
  const [until, setUntil] = useState(addDays(today, 3));
  const name = (id: string) => places.find((p) => p.id === id);
  const chosen = places.some((p) => p.id === stayPlace) ? stayPlace : places[0].id;

  return (
    <section className="card form" aria-labelledby="pl-h">
      <h2 id="pl-h">Places &amp; modes</h2>
      <p className="hint">
        Switch where you are (like Mom's, Vacation or Road trip) from Today, and your routines follow: each routine, and each step, can be for certain places only. Make a version of a routine for a place from Daily Rituals → Edit.
      </p>
      <ul className="plain">
        {places.map((p) => (
          <li key={p.id} className="row">
            <input aria-label={`Icon for ${p.label}`} value={p.icon} onChange={(e) => s.renamePlace(p.id, p.label, e.target.value)} style={{ maxWidth: 60 }} />
            <input aria-label={`Name of ${p.label}`} value={p.label} onChange={(e) => s.renamePlace(p.id, e.target.value, p.icon)} />
            <button className="btn ghost small" disabled={places.length <= 1} onClick={() => s.deletePlace(p.id)} aria-label={`Remove ${p.label}`}>✕</button>
          </li>
        ))}
      </ul>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!label.trim()) return;
          s.addPlace(label.trim(), icon || '📍');
          setLabel('');
        }}
      >
        <input aria-label="New place icon" value={icon} onChange={(e) => setIcon(e.target.value)} style={{ maxWidth: 60 }} />
        <input aria-label="New place name" placeholder="Grandma's, camping, a hotel…" value={label} onChange={(e) => setLabel(e.target.value)} />
        <button className="btn" type="submit">Add place</button>
      </form>

      <h3>Planned stays</h3>
      <p className="hint">Add a stay ahead of time and the app switches itself for those dates, then switches back.</p>
      <div className="row">
        <select aria-label="Stay place" value={chosen} onChange={(e) => setStayPlace(e.target.value)}>
          {places.map((p) => (
            <option key={p.id} value={p.id}>{p.icon} {p.label}</option>
          ))}
        </select>
        <label className="inline">From <input type="date" aria-label="Stay starts" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="inline">Through <input type="date" aria-label="Stay ends" value={until} onChange={(e) => setUntil(e.target.value)} /></label>
        <button className="btn" onClick={() => from && until && s.addStay(chosen, from, until)}>Add stay</button>
      </div>
      <ul className="plain">
        {stays.map((st) => (
          <li key={st.id}>
            {name(st.place)?.icon} {name(st.place)?.label ?? 'A place'}: {st.from} → {st.until}{' '}
            <button className="btn ghost small" onClick={() => s.removeStay(st.id)} aria-label={`Remove stay ${st.from}`}>✕</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
