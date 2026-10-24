export type Pose = 'welcome' | 'focus' | 'rest' | 'encourage';

const SKIN = '#F3D2B8';
const HAIR = '#8B6B58';

function Flower({ x, y, r = 5, color = '#E8B8C4' }: { x: number; y: number; r?: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx="0" cy={-r} rx={r * 0.62} ry={r * 0.9} fill={color} transform={`rotate(${a})`} />
      ))}
      <circle r={r * 0.5} fill="#FFF7E9" />
    </g>
  );
}

function WateringCan({ x, y, tilt = 0 }: { x: number; y: number; tilt?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${tilt})`}>
      <rect x="-9" y="-6" width="16" height="12" rx="3" fill="#A8B99A" stroke="#687B5D" strokeWidth="1.2" />
      <path d="M7 -2 L16 -8" stroke="#687B5D" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M-9 -2 q-7 0 -7 6" fill="none" stroke="#687B5D" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M-5 -6 q5 -7 10 0" fill="none" stroke="#687B5D" strokeWidth="1.4" />
    </g>
  );
}

/** A small hand-built SVG garden fairy. Decorative only: always aria-hidden. */
export function Fairy({ pose = 'welcome', size = 110 }: { pose?: Pose; size?: number }) {
  const sitting = pose === 'rest';
  return (
    <svg
      className="fairy"
      width={size}
      height={size * 1.16}
      viewBox="0 0 120 140"
      aria-hidden="true"
      focusable="false"
    >
      {/* wings */}
      <g opacity="0.7" stroke="#C9B8D9" strokeWidth="1">
        <ellipse cx="38" cy="62" rx="20" ry="30" fill="#C9B8D9" opacity="0.55" transform="rotate(-25 38 62)" />
        <ellipse cx="82" cy="62" rx="20" ry="30" fill="#C9B8D9" opacity="0.55" transform="rotate(25 82 62)" />
        <ellipse cx="42" cy="82" rx="12" ry="18" fill="#E8B8C4" opacity="0.5" transform="rotate(-35 42 82)" />
        <ellipse cx="78" cy="82" rx="12" ry="18" fill="#E8B8C4" opacity="0.5" transform="rotate(35 78 82)" />
      </g>
      {/* ground / leaf */}
      <path d="M20 128 q40 -10 80 0" fill="none" stroke="#687B5D" strokeWidth="2" strokeLinecap="round" />
      {/* legs */}
      {sitting ? (
        <>
          <path d="M52 106 q-12 8 -22 6" stroke={SKIN} strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M68 106 q12 8 22 6" stroke={SKIN} strokeWidth="5" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M54 108 v14" stroke={SKIN} strokeWidth="5" strokeLinecap="round" />
          <path d="M66 108 v14" stroke={SKIN} strokeWidth="5" strokeLinecap="round" />
        </>
      )}
      {/* dress */}
      <path d="M60 66 L44 108 Q60 116 76 108 Z" fill="#A8B99A" stroke="#687B5D" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M50 96 Q60 102 70 96" fill="none" stroke="#E8B8C4" strokeWidth="3" strokeLinecap="round" />
      {/* arms */}
      {pose === 'welcome' && (
        <>
          <path d="M54 76 L36 56" stroke={SKIN} strokeWidth="5" strokeLinecap="round" />
          <path d="M66 76 L76 94" stroke={SKIN} strokeWidth="5" strokeLinecap="round" />
        </>
      )}
      {pose === 'focus' && (
        <>
          <path d="M54 76 L44 92" stroke={SKIN} strokeWidth="5" strokeLinecap="round" />
          <path d="M66 76 L84 88" stroke={SKIN} strokeWidth="5" strokeLinecap="round" />
          <WateringCan x={92} y={88} tilt={25} />
          <path d="M104 94 l4 8 M100 96 l2 9 M108 92 l6 6" stroke="#9CC3DA" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M108 128 v-12" stroke="#687B5D" strokeWidth="2" />
          <path d="M108 118 q-10 -2 -10 -9 q9 0 10 9 M108 118 q10 -2 10 -9 q-9 0 -10 9" fill="#A8B99A" stroke="#687B5D" strokeWidth="1" />
        </>
      )}
      {pose === 'rest' && (
        <>
          <path d="M54 78 L50 94" stroke={SKIN} strokeWidth="5" strokeLinecap="round" />
          <path d="M66 78 L70 94" stroke={SKIN} strokeWidth="5" strokeLinecap="round" />
          <path d="M96 128 v-26" stroke="#687B5D" strokeWidth="2" />
          <Flower x={96} y={98} r={7} color="#C9B8D9" />
        </>
      )}
      {pose === 'encourage' && (
        <>
          <path d="M54 76 L44 94" stroke={SKIN} strokeWidth="5" strokeLinecap="round" />
          <path d="M66 76 L78 90" stroke={SKIN} strokeWidth="5" strokeLinecap="round" />
          <path d="M80 90 v-10" stroke="#687B5D" strokeWidth="2" />
          <Flower x={80} y={76} r={6} />
        </>
      )}
      {/* head */}
      <circle cx="60" cy="48" r="18" fill={HAIR} />
      <circle cx="60" cy="52" r="15" fill={SKIN} />
      <path d="M45 48 Q60 30 75 48 Q60 40 45 48" fill={HAIR} />
      <circle cx="54" cy="53" r="1.6" fill="#4a3a30" />
      <circle cx="66" cy="53" r="1.6" fill="#4a3a30" />
      <path d="M55 59 Q60 63 65 59" fill="none" stroke="#b5675f" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="49" cy="58" r="2.6" fill="#E8B8C4" opacity="0.7" />
      <circle cx="71" cy="58" r="2.6" fill="#E8B8C4" opacity="0.7" />
      {/* flower crown */}
      <Flower x={46} y={38} r={4} />
      <Flower x={60} y={32} r={4.5} color="#C9B8D9" />
      <Flower x={74} y={38} r={4} />
      <path d="M44 40 Q60 28 76 40" fill="none" stroke="#687B5D" strokeWidth="1.5" />
    </svg>
  );
}

type Decor = 'blooms' | 'mushrooms' | 'butterflies' | 'stars';

function Mushroom({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-r * 0.3} y="-2" width={r * 0.6} height="8" rx="2" fill="#FFF7E9" stroke="#687B5D" strokeWidth="0.8" />
      <path d={`M${-r} -2 Q0 ${-r * 1.8} ${r} -2 Z`} fill="#E8B8C4" stroke="#687B5D" strokeWidth="0.8" />
      <circle cx={-r * 0.35} cy={-r * 0.5} r="1.2" fill="#FFF7E9" />
      <circle cx={r * 0.35} cy={-r * 0.7} r="1" fill="#FFF7E9" />
    </g>
  );
}

function Butterfly({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="-3.5" cy="-2" rx="3.5" ry="4" fill="#C9B8D9" stroke="#687B5D" strokeWidth="0.6" />
      <ellipse cx="3.5" cy="-2" rx="3.5" ry="4" fill="#E8B8C4" stroke="#687B5D" strokeWidth="0.6" />
      <path d="M0 -5 V5" stroke="#687B5D" strokeWidth="1" />
    </g>
  );
}

function Star({ x, y }: { x: number; y: number }) {
  return <path transform={`translate(${x} ${y})`} d="M0 -5 L1.4 -1.4 L5 0 L1.4 1.4 L0 5 L-1.4 1.4 L-5 0 L-1.4 -1.4 Z" fill="#C9B8D9" stroke="#687B5D" strokeWidth="0.6" />;
}

/** Tiny decorative garden strip. Decorations only ever accumulate. */
export function GardenStrip({ blooms, decor = 'blooms' }: { blooms: number; decor?: Decor }) {
  const n = Math.min(blooms, 24);
  const colors = ['#E8B8C4', '#C9B8D9', '#FFF7E9', '#E8B8C4'];
  const noun = decor === 'blooms' ? 'blooms' : decor;
  return (
    <div className="garden-strip" role="img" aria-label={blooms === 0 ? 'Your garden is ready for its first little addition' : `${blooms} little ${noun} in your garden`}>
      <svg viewBox="0 0 240 40" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
        <path d="M0 36 Q60 30 120 36 T240 36" fill="none" stroke="#687B5D" strokeWidth="2" strokeLinecap="round" />
        {Array.from({ length: n }, (_, i) => {
          const x = 8 + (i * 224) / Math.max(n, 12);
          const h = 8 + ((i * 7) % 12);
          if (decor === 'mushrooms') return <Mushroom key={i} x={x} y={32} r={3.5 + (i % 3)} />;
          if (decor === 'butterflies') return <Butterfly key={i} x={x} y={30 - ((i * 5) % 18)} />;
          if (decor === 'stars') return <Star key={i} x={x} y={8 + ((i * 9) % 22)} />;
          return (
            <g key={i}>
              <path d={`M${x} 36 v-${h}`} stroke="#687B5D" strokeWidth="1.5" />
              <Flower x={x} y={36 - h} r={4} color={colors[i % colors.length]} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
