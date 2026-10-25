import { readFileSync, writeFileSync } from 'node:fs';
export const sub = (file, from, to, all = false) => {
  const raw = readFileSync(file, 'utf8');
  const crlf = raw.includes('\r\n');
  const s = raw.replace(/\r\n/g, '\n');
  if (!s.includes(from)) throw new Error(`missing in ${file}: ${from.slice(0, 70)}`);
  const out = all ? s.split(from).join(to) : s.replace(from, () => to);
  writeFileSync(file, crlf ? out.replace(/\n/g, '\r\n') : out);
};
export const append = (file, text) => {
  const raw = readFileSync(file, 'utf8');
  const crlf = raw.includes('\r\n');
  writeFileSync(file, raw + (crlf ? text.replace(/\n/g, '\r\n') : text));
};
export const write = (file, text) => writeFileSync(file, text);
