import { sub } from './lib.mjs';
const S = 'src/pages/Shed.tsx';
sub(S, "export function Shed() {", `const JUMPS: [string, string][] = [
  ['pref-h', 'Preferences'],
  ['nt-h', 'Reminders'],
  ['cc-h', 'Categories'],
  ['pl-h', 'Places'],
  ['sy-h', 'Sync'],
  ['dv-h', 'This device'],
  ['bk-h', 'Backup'],
  ['up-h', 'Updates'],
  ['rs-h', 'Start fresh'],
];

/** A row of shortcuts so a long settings page is quick to get around on a phone. */
function JumpBar() {
  return (
    <nav className="jump" aria-label="Jump to a section">
      {JUMPS.map(([id, label]) => (
        <button key={id} className="tab" onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
          {label}
        </button>
      ))}
    </nav>
  );
}

export function Shed() {`);
sub(S, "        <h1>Garden Shed</h1>\n      </header>", "        <h1>Garden Shed</h1>\n      </header>\n\n      <JumpBar />");
