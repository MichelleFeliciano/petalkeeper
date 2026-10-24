import { useStore } from '../store';
import { useUI } from '../ui';
import { isDone, span, type Occurrence } from '../lib/schedule';
import { fmtTime } from '../lib/dates';
import { categoryOf } from '../lib/types';

const PX = 0.9; // pixels per minute

/** Hour-by-hour view of today's timed activities, so gaps and free time are visible. */
export function TimeBlocks({ items, conflicts }: { items: Occurrence[]; conflicts: Set<string> }) {
  const { data } = useStore();
  const { openForm } = useUI();
  const { defaultDuration } = data.settings;
  const blocks = items
    .map((o) => ({ o, s: span(o.task, defaultDuration) }))
    .filter((b): b is { o: Occurrence; s: [number, number] } => b.s !== null);

  if (blocks.length === 0) return <p className="empty">Nothing is set for a specific time. Lovely, open space.</p>;

  const first = Math.max(0, Math.floor(Math.min(...blocks.map((b) => b.s[0]), 8 * 60) / 60));
  const last = Math.min(24, Math.ceil(Math.max(...blocks.map((b) => b.s[1]), 18 * 60) / 60));

  // side-by-side lanes for overlapping blocks
  const laneEnds: number[] = [];
  const placed = [...blocks]
    .sort((a, b) => a.s[0] - b.s[0])
    .map((b) => {
      let lane = laneEnds.findIndex((e) => e <= b.s[0]);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = b.s[1];
      return { ...b, lane };
    });
  const lanes = Math.max(1, laneEnds.length);

  return (
    <div className="hours" style={{ height: (last - first) * 60 * PX }} aria-label="Hour-by-hour view of today">
      {Array.from({ length: last - first }, (_, i) => (
        <div key={i} className="hour-line" style={{ top: i * 60 * PX }}>
          <span>{fmtTime(`${String(first + i).padStart(2, '0')}:00`)}</span>
        </div>
      ))}
      {placed.map(({ o, s, lane }) => {
        const cat = categoryOf(data.settings, o.task.category);
        return (
          <button
            key={o.key}
            className={'block' + (isDone(o.task, o.date) ? ' done' : '') + (conflicts.has(o.key) ? ' conflict' : '')}
            style={{
              top: (s[0] - first * 60) * PX,
              height: Math.max(22, (s[1] - s[0]) * PX - 2),
              left: `calc(64px + (100% - 64px) * ${lane / lanes})`,
              width: `calc((100% - 64px) / ${lanes} - 4px)`,
              ...(cat.color ? { borderLeftColor: cat.color } : {}),
            }}
            onClick={() => openForm(o.task)}
            aria-label={`${o.task.title}, ${fmtTime(o.task.start)}. Edit.`}
          >
            <span aria-hidden="true">{cat.icon}</span> {o.task.title}
            {isDone(o.task, o.date) && ' ✓'}
          </button>
        );
      })}
    </div>
  );
}
