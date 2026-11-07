import { useStore } from '../store';
import { DAY_NAMES, fromISO, weekDates, weekday } from '../lib/dates';
import { historyFor, placeLabel, placeOn } from '../lib/routines';
import { partOf } from '../lib/types';

/** Routines down the side, days across: the shape of the week at a glance. */
export function WeekGrid() {
  const { data, today } = useStore();
  const dates = weekDates(today, data.settings.weekStart);
  if (data.routines.length === 0) return null;
  const mark = { off: '–', none: '·', some: '❀', all: '✿' } as const;
  const word = { off: 'not scheduled', none: 'not yet', some: 'partly done', all: 'all done' } as const;
  return (
    <details className="week-glance card">
      <summary>This week at a glance</summary>
      <div className="wg-scroll">
        <table className="wg">
          <thead>
            <tr>
              <th scope="col">Routine</th>
              {dates.map((d) => (
                <th key={d} scope="col" className={d === today ? 'today' : ''}>
                  {DAY_NAMES[weekday(d)].slice(0, 3)}
                  <small>{fromISO(d).getDate()}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.routines.map((r) => {
              const marks = historyFor(data, r, dates);
              return (
                <tr key={r.id}>
                  <th scope="row">
                    {partOf(r.kind).icon} {r.name}
                    {r.places && r.places.length > 0 && <small> {r.places.map((p) => placeLabel(data.settings, p)?.label).filter(Boolean).join(', ')}</small>}
                  </th>
                  {marks.map((m, i) => {
                    const future = dates[i] > today && m === 'none';
                    return (
                      <td key={dates[i]} className={'wg-' + m + (dates[i] === today ? ' today' : '')}>
                        <span aria-hidden="true">{future ? '○' : mark[m]}</span>
                        <span className="sr">{`${r.name}, ${dates[i]}: ${future ? 'coming up' : word[m]}`}</span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="hint">✿ all done · ❀ partly · · nothing yet · ○ coming up · – not scheduled that day. Today you're at {placeLabel(data.settings, placeOn(data.settings, today))?.label ?? 'home'}, so routines for other places show as resting.</p>
    </details>
  );
}
