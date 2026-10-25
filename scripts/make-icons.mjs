// Renders public/icon-*.png from the same flower as icon.svg (no dependencies).
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const layers = [
  [null, hex('#A8B99A')],
  [{ x: 256, y: 256, r: 190 }, hex('#FFF7E9')],
  ...[[256, 150], [362, 256], [256, 362], [150, 256]].map(([x, y]) => [{ x, y, r: 64 }, hex('#E8B8C4')]),
  [{ x: 256, y: 256, r: 52 }, hex('#C9B8D9')],
];
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = ~0; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; };
const chunk = (t, d) => { const o = Buffer.alloc(12 + d.length); o.writeUInt32BE(d.length, 0); o.write(t, 4); d.copy(o, 8); o.writeUInt32BE(crc(o.subarray(4, 8 + d.length)), 8 + d.length); return o; };

function png(size) {
  const S = 3, scale = 512 / size, raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
        const px = (x + (sx + 0.5) / S) * scale, py = (y + (sy + 0.5) / S) * scale;
        let col = layers[0][1];
        for (const [c, rgb] of layers) if (c && (px - c.x) ** 2 + (py - c.y) ** 2 <= c.r ** 2) col = rgb;
        r += col[0]; g += col[1]; b += col[2];
      }
      const o = y * (size * 3 + 1) + 1 + x * 3, n = S * S;
      raw[o] = r / n; raw[o + 1] = g / n; raw[o + 2] = b / n;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
for (const s of [180, 192, 512]) writeFileSync(`public/icon-${s}.png`, png(s));
