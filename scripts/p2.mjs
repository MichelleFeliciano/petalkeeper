import { sub } from './lib.mjs';
const R = 'src/pages/Rituals.tsx';
sub(R, "function DayChips({ days, onChange, weekStart, label }: { days?: number[]; onChange: (d: number[]) => void; weekStart: 0 | 1; label: string }) {", "function DayChips({ days, onChange, weekStart, label, suffix = '' }: { days?: number[]; onChange: (d: number[]) => void; weekStart: 0 | 1; label: string; suffix?: string }) {");
sub(R, "aria-label={DAY_LONG[n]}", "aria-label={DAY_LONG[n] + suffix}");
sub(R, "<DayChips days={st.days} weekStart={weekStart}", "<DayChips suffix={` for ${st.title}`} days={st.days} weekStart={weekStart}");
