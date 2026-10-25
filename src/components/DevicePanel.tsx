import { useState } from 'react';
import { applyTextSize, autoBackupOn, getTextSize, hasPin, setAutoBackup, setPin, setTextSize, validPin, checkPin, type TextSize } from '../lib/device';

/** Settings that belong to this device only (they don't sync). */
export function DevicePanel() {
  const [size, setSize] = useState<TextSize>(getTextSize);
  const [pinOn, setPinOn] = useState(hasPin);
  const [auto, setAuto] = useState(autoBackupOn);
  const [pin, setPinInput] = useState('');
  const [current, setCurrent] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const save = () => {
    if (!validPin(pin)) return setMsg({ ok: false, text: 'Use 4 to 8 digits.' });
    if (pinOn && !checkPin(current)) return setMsg({ ok: false, text: 'The current PIN is not right.' });
    setPin(pin);
    setPinOn(true);
    setPinInput('');
    setCurrent('');
    setMsg({ ok: true, text: 'PIN saved on this device.' });
  };
  const remove = () => {
    if (!checkPin(current)) return setMsg({ ok: false, text: 'Enter the current PIN to remove it.' });
    setPin(null);
    setPinOn(false);
    setCurrent('');
    setMsg({ ok: true, text: 'PIN removed.' });
  };

  return (
    <section className="card form" aria-labelledby="dv-h">
      <h2 id="dv-h">This device</h2>
      <p className="hint">These two settings are just for this phone or computer and don't sync.</p>
      <label>
        Text size
        <select
          value={size}
          onChange={(e) => {
            const v = e.target.value as TextSize;
            setSize(v);
            setTextSize(v);
            applyTextSize(v);
          }}
        >
          <option value="normal">Standard</option>
          <option value="large">Large</option>
          <option value="xlarge">Extra large</option>
        </select>
      </label>
      <label className="inline">
        <input
          type="checkbox"
          checked={auto}
          onChange={(e) => {
            setAuto(e.target.checked);
            setAutoBackup(e.target.checked);
          }}
        />{' '}
        Save a backup file automatically about once a week
      </label>
      <p className="hint">A browser can't write to a folder quietly, so this downloads a backup file when you open the app and a week has passed. It works best on a computer. Phones may ask where to save it.</p>
      <fieldset className="pin">
        <legend>Private PIN {pinOn ? '(on)' : '(off)'}</legend>
        {pinOn && (
          <label>
            Current PIN
            <input type="password" inputMode="numeric" autoComplete="off" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </label>
        )}
        <label>
          {pinOn ? 'New PIN' : 'Choose a PIN (4 to 8 digits)'}
          <input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPinInput(e.target.value)} />
        </label>
        <div className="actions left">
          <button className="btn" onClick={save} disabled={!pin}>{pinOn ? 'Change PIN' : 'Set PIN'}</button>
          {pinOn && <button className="btn ghost" onClick={remove}>Remove PIN</button>}
        </div>
        <p className="hint">A casual lock for when someone else picks up your phone. It asks for the PIN when the app opens and after it's been away a couple of minutes. It isn't encryption, so use your phone's own lock too.</p>
        {msg && <p role="status" className={msg.ok ? 'ok-msg' : 'error'}>{msg.text}</p>}
      </fieldset>
    </section>
  );
}
