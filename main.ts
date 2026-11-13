import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { deflateSync } from 'node:zlib';

// A tiny deterministic raster painter. Every mark is drawn here; the PNG is
// encoded with Node's built-in zlib and no image assets or third-party modules.
const W = 720;
const H = 720;
const rgba = Buffer.alloc(W * H * 4);
let seed = 0x6d2b79f5;
const rand = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
};
type Color = readonly [number, number, number, number];
const ink = (r: number, g: number, b: number, a = 255): Color => [r, g, b, a];

function dot(x: number, y: number, c: Color) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H || c[3] <= 0) return;
  const i = (y * W + x) * 4, a = c[3] / 255, ia = 1 - a;
  rgba[i] = Math.round(c[0] * a + rgba[i] * ia);
  rgba[i + 1] = Math.round(c[1] * a + rgba[i + 1] * ia);
  rgba[i + 2] = Math.round(c[2] * a + rgba[i + 2] * ia);
  rgba[i + 3] = Math.round(c[3] + rgba[i + 3] * ia);
}
function ellipse(cx: number, cy: number, rx: number, ry: number, c: Color) {
  const x0 = Math.max(0, Math.floor(cx - rx)), x1 = Math.min(W - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(H - 1, Math.ceil(cy + ry));
  const irx = 1 / (rx * rx), iry = 1 / (ry * ry);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++)
    if ((x - cx) ** 2 * irx + (y - cy) ** 2 * iry <= 1) dot(x, y, c);
}
function stroke(x1: number, y1: number, x2: number, y2: number, width: number, c: Color) {
  const dx = x2 - x1, dy = y2 - y1, n = Math.max(1, Math.ceil(Math.hypot(dx, dy) * 1.4));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    ellipse(x1 + dx * t, y1 + dy * t, width / 2, width / 2, c);
  }
}
function polygon(points: ReadonlyArray<readonly [number, number]>, c: Color) {
  const minY = Math.max(0, Math.floor(Math.min(...points.map(p => p[1]))));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(...points.map(p => p[1]))));
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i], [xj, yj] = points[j];
      if ((yi <= y && yj > y) || (yj <= y && yi > y)) xs.push(xi + (y - yi) * (xj - xi) / (yj - yi));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2)
      for (let x = Math.max(0, Math.ceil(xs[i])); x <= Math.min(W - 1, Math.floor(xs[i + 1])); x++) dot(x, y, c);
  }
}
function bezier(a: [number, number], b: [number, number], c: [number, number], d: [number, number], width: number, color: Color) {
  let px = a[0], py = a[1];
  for (let i = 1; i <= 42; i++) {
    const t = i / 42, u = 1 - t;
    const x = u ** 3 * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t ** 3 * d[0];
    const y = u ** 3 * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t ** 3 * d[1];
    stroke(px, py, x, y, width, color); px = x; py = y;
  }
}

// Deep-water gradient, with a turquoise opening behind the traveler.
for (let y = 0; y < H; y++) {
  const t = y / H, glow = Math.max(0, 1 - Math.hypot((360 - 360) / 390, (y - 310) / 390));
  const r = 4 + 5 * glow + 5 * t, g = 13 + 29 * glow + 9 * t, b = 31 + 47 * glow + 15 * t;
  for (let x = 0; x < W; x++) {
    const vignette = Math.max(0, 1 - Math.hypot((x - 360) / 560, (y - 350) / 600));
    dot(x, y, ink(r * vignette, g * vignette, b * vignette));
  }
}

// Faraway suspended particles and shafts of bioluminescent water.
for (let i = 0; i < 14; i++) {
  const x = 75 + i * 46 + rand() * 20;
  stroke(x, 0, x + (rand() - .5) * 80, 270 + rand() * 170, 2 + rand() * 5, ink(53, 184, 197, 9));
}
for (let i = 0; i < 180; i++) {
  const x = rand() * W, y = rand() * H, s = .8 + rand() * 2.3;
  ellipse(x, y, s, s, ink(94, 219, 211, 35 + Math.floor(rand() * 75)));
}

// Forest: layered ribbon kelp frames the bright central figure.
const kelpColors: Color[] = [ink(11, 72, 76, 230), ink(12, 103, 94, 205), ink(17, 123, 106, 150)];
for (let i = 0; i < 24; i++) {
  const side = i % 2 ? 1 : -1, baseX = side < 0 ? 8 + rand() * 150 : 562 + rand() * 150;
  const topY = 185 + rand() * 280, sway = (rand() - .5) * 100, height = 260 + rand() * 240;
  const color = kelpColors[i % kelpColors.length], w = 6 + rand() * 16;
  bezier([baseX, 735], [baseX + sway, 590], [baseX - sway, topY + 100], [baseX + sway * .35, topY], w, color);
  bezier([baseX, 700], [baseX + sway * .2, 620], [baseX + sway, 570], [baseX + sway + 18 * side, 545 - rand() * 90], 2, ink(75, 197, 151, 95));
  ellipse(baseX + sway * .35, topY, 3, 3, ink(125, 246, 199, 160));
  void height;
}
// Broad fronds with fine glowing midribs.
for (let i = 0; i < 17; i++) {
  const side = i % 2 ? 1 : -1, x = side < 0 ? 20 + rand() * 150 : 550 + rand() * 150;
  const y = 410 + rand() * 230, len = 45 + rand() * 115, rise = 25 + rand() * 90;
  bezier([x, y], [x + side * 18, y - rise], [x + side * len * .65, y - rise], [x + side * len, y - rise * .25], 11 + rand() * 10, ink(14, 113, 92, 175));
  bezier([x, y - 1], [x + side * 20, y - rise], [x + side * len * .65, y - rise], [x + side * len, y - rise * .25], 1.5, ink(88, 215, 161, 145));
}

// Seafloor and coral silhouettes.
polygon([[0, 642], [72, 618], [143, 635], [223, 610], [301, 638], [390, 610], [468, 634], [560, 608], [650, 632], [720, 607], [720, 720], [0, 720]], ink(7, 30, 42, 255));
for (let i = 0; i < 11; i++) {
  const x = 26 + i * 66 + rand() * 22, y = 634 + rand() * 36;
  for (let j = 0; j < 4; j++) bezier([x, y], [x - 12 + j * 7, y - 16], [x - 10 + j * 11, y - 38], [x - 5 + j * 13, y - 50 - rand() * 32], 4, ink(213, 94 + j * 8, 119, 170));
}

// Jellyfish halo and translucent glass bell.
for (let r = 1; r <= 9; r++) ellipse(360, 284, 188 + r * 8, 150 + r * 7, ink(39, 221, 231, 3));
ellipse(360, 276, 177, 126, ink(43, 202, 220, 23));
ellipse(360, 268, 158, 108, ink(123, 246, 243, 29));
// Bell dome with a softly lit crown and dark rim.
polygon([[205, 278], [210, 238], [228, 198], [257, 164], [294, 139], [333, 124], [360, 119], [391, 125], [429, 142], [463, 169], [490, 204], [507, 242], [514, 278], [498, 291], [465, 295], [430, 286], [397, 281], [360, 289], [324, 281], [287, 289], [249, 295], [220, 290]], ink(110, 232, 239, 55));
bezier([210, 277], [241, 293], [279, 276], [309, 282], 5, ink(170, 255, 250, 180));
bezier([309, 282], [337, 290], [381, 275], [410, 283], 5, ink(172, 255, 246, 190));
bezier([410, 283], [443, 291], [481, 278], [510, 277], 5, ink(162, 251, 250, 175));
bezier([235, 249], [259, 162], [321, 121], [360, 120], 3, ink(206, 255, 251, 210));
bezier([360, 120], [420, 122], [479, 168], [492, 251], 3, ink(200, 255, 251, 190));
bezier([252, 251], [273, 190], [300, 167], [325, 158], 9, ink(213, 255, 244, 72));
ellipse(310, 178, 19, 6, ink(230, 255, 251, 95));
ellipse(291, 198, 6, 3, ink(240, 255, 255, 170));

// Miniature city riding inside the clear bell, on a luminous shelf.
polygon([[232, 302], [266, 291], [300, 298], [331, 286], [365, 292], [400, 282], [433, 292], [468, 285], [493, 300], [476, 313], [441, 319], [406, 314], [372, 324], [337, 316], [301, 324], [265, 314]], ink(94, 209, 202, 220));
stroke(234, 299, 491, 299, 4, ink(225, 255, 235, 235));
const buildings = [
  [253, 251, 27, 48], [284, 230, 31, 69], [319, 242, 26, 57], [349, 211, 34, 88],
  [387, 231, 31, 68], [422, 217, 37, 82], [463, 241, 29, 58],
];
for (let i = 0; i < buildings.length; i++) {
  const [x, y, w, h] = buildings[i];
  polygon([[x, 300], [x, y + 9], [x + w / 2, y], [x + w, y + 9], [x + w, 301]], ink(7 + i % 3 * 3, 35 + i % 2 * 8, 58 + i % 3 * 5, 255));
  stroke(x + 1.5, y + 10, x + w / 2, y + 2, 2, ink(205, 255, 233, 220));
  stroke(x + w - 2, y + 10, x + w - 2, 297, 1, ink(83, 184, 167, 180));
  for (let wy = y + 16; wy < 295; wy += 12) for (let wx = x + 6; wx < x + w - 4; wx += 9) {
    ellipse(wx, wy, 3, 3.5, ink(255, 178, 55, 90));
    ellipse(wx, wy, 1.9, 2.5, ink(255, 224, 115, 255));
  }
}
// Spire, tiny pennant, bridges, and a central clock face.
stroke(366, 211, 366, 186, 3, ink(225, 255, 222, 240));
polygon([[366, 187], [384, 194], [366, 200]], ink(255, 149, 115, 240));
ellipse(366, 258, 9, 9, ink(255, 218, 119, 255));
ellipse(366, 258, 5, 5, ink(27, 77, 85, 255));
stroke(274, 284, 292, 284, 3, ink(143, 255, 221, 245));
stroke(403, 281, 423, 281, 3, ink(143, 255, 221, 245));

// Fine radial glass ribs catch the light above the town.
for (let i = 0; i < 13; i++) {
  const x = 238 + i * 20, y = 278 - 155 * Math.sqrt(Math.max(.03, 1 - ((x - 360) / 158) ** 2));
  stroke(360, 267, x, y + 12, 1, ink(190, 255, 248, 42));
}

// Trailing crystal tendrils, each with a bright core and soft aura.
for (let i = 0; i < 13; i++) {
  const x = 244 + i * 19, endX = x + (rand() - .5) * 40, endY = 435 + rand() * 105;
  const c = i % 3 === 0 ? ink(255, 124, 181, 175) : ink(91, 229, 236, 180);
  bezier([x, 285], [x - 20, 331 + rand() * 22], [endX + 27, endY - 45], [endX, endY], 2 + (i % 3 === 0 ? 1 : 0), c);
  ellipse(endX, endY, 3, 5, ink(189, 255, 239, 150));
}
for (let i = 0; i < 8; i++) {
  const x = 285 + i * 21;
  bezier([x, 287], [x + 8, 318], [x - 7, 344], [x + (i % 2 ? 20 : -18), 365 + (i % 3) * 12], 1.5, ink(177, 247, 244, 130));
}

// Foreground drifting spores add depth in front of the forest.
for (let i = 0; i < 45; i++) {
  const x = rand() * W, y = 360 + rand() * 270;
  ellipse(x, y, 1 + rand() * 2.2, 1 + rand() * 2.2, ink(255, 202, 131, 80 + Math.floor(rand() * 100)));
}

function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer) {
  const name = Buffer.from(type, 'ascii'), out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0); name.copy(out, 4); data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8);
  return out;
}
function png() {
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) rgba.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const outputDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
const outputPath = join(outputDir, 'entry.png');
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, png());
console.log(`Wrote ${outputPath} (${W}x${H})`);
