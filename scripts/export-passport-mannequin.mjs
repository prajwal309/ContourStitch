import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const sourceUrl = new URL(
  '../public/models/quaternius-female/mannequin-v1.bin',
  import.meta.url,
);
const outputUrl = new URL(
  '../public/models/quaternius-female/passport-front.svg',
  import.meta.url,
);
const binary = await readFile(sourceUrl);
const header = new Uint32Array(binary.buffer, binary.byteOffset, 6);
const [
  magic,
  coordinateCount,
  frontGuideCount,
  otherGuideCount,
  triangleCount,
] = header;
const headerBytes = 6 * Uint32Array.BYTES_PER_ELEMENT;
const expectedBytes =
  headerBytes +
  (2 * coordinateCount + frontGuideCount + otherGuideCount) *
    Float32Array.BYTES_PER_ELEMENT +
  (triangleCount + header[5]) * Uint16Array.BYTES_PER_ELEMENT;

if (magic !== 0x3148534d || binary.byteLength !== expectedBytes) {
  throw new Error('The baked mannequin asset has an invalid binary layout.');
}

const positions = new Float32Array(
  binary.buffer,
  binary.byteOffset + headerBytes,
  coordinateCount,
);
const otherGuideOffset =
  headerBytes +
  2 * coordinateCount * Float32Array.BYTES_PER_ELEMENT +
  frontGuideCount * Float32Array.BYTES_PER_ELEMENT;
const guides = new Float32Array(
  binary.buffer,
  binary.byteOffset + otherGuideOffset,
  otherGuideCount,
);
const trianglesOffset =
  headerBytes +
  (2 * coordinateCount + frontGuideCount + otherGuideCount) *
    Float32Array.BYTES_PER_ELEMENT;
const triangles = new Uint16Array(
  binary.buffer,
  binary.byteOffset + trianglesOffset,
  triangleCount,
);

const viewWidth = 260;
const viewHeight = 280;
const scale = 132;
const centerX = viewWidth / 2;
const top = 18;
const minimumProjectedEdgeLength = 3.1;
const project = (x, y) => [centerX + x * scale, top + (1.8 - y) * scale];
const format = (value) => Number(value.toFixed(1)).toString();
const visibleEdges = new Set();
const linePath = [];

for (let offset = 0; offset < triangles.length; offset += 3) {
  const first = triangles[offset] * 3;
  const second = triangles[offset + 1] * 3;
  const third = triangles[offset + 2] * 3;
  const normalZ =
    (positions[second] - positions[first]) *
      (positions[third + 1] - positions[first + 1]) -
    (positions[second + 1] - positions[first + 1]) *
      (positions[third] - positions[first]);
  if (normalZ <= 0.000001) continue;

  for (let edge = 0; edge < 3; edge += 1) {
    const from = triangles[offset + edge];
    const to = triangles[offset + ((edge + 1) % 3)];
    const key = `${Math.min(from, to)}:${Math.max(from, to)}`;
    if (visibleEdges.has(key)) continue;

    const [x1, y1] = project(positions[from * 3], positions[from * 3 + 1]);
    const [x2, y2] = project(positions[to * 3], positions[to * 3 + 1]);
    if (Math.hypot(x2 - x1, y2 - y1) < minimumProjectedEdgeLength) continue;
    visibleEdges.add(key);
    linePath.push(`M${format(x1)} ${format(y1)}L${format(x2)} ${format(y2)}`);
  }
}

const contourLevels = [
  { className: 'chest', height: 1.8 * 0.73 },
  { className: 'waist', height: 1.8 * 0.6 },
  { className: 'hip', height: 1.8 * 0.49 },
];
const contours = new Map(contourLevels.map(({ className }) => [className, []]));

for (let offset = 0; offset < guides.length; offset += 6) {
  const x1 = guides[offset];
  const y1 = guides[offset + 1];
  const z1 = guides[offset + 2];
  const x2 = guides[offset + 3];
  const y2 = guides[offset + 4];
  const z2 = guides[offset + 5];
  if ((z1 + z2) / 2 < 0) continue;

  const level = contourLevels.find(
    ({ height }) => Math.abs((y1 + y2) / 2 - height) < 0.001,
  );
  if (!level) continue;

  const [projectedX1, projectedY1] = project(x1, y1);
  const [projectedX2, projectedY2] = project(x2, y2);
  contours
    .get(level.className)
    .push(
      `M${format(projectedX1)} ${format(projectedY1)}L${format(projectedX2)} ${format(projectedY2)}`,
    );
}

const contourMarkup = contourLevels
  .map(
    ({ className }) =>
      `<path class="${className}" d="${contours.get(className).join('')}"/>`,
  )
  .join('\n    ');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${viewWidth}" height="${viewHeight}" viewBox="0 0 ${viewWidth} ${viewHeight}" fill="none">
  <style>
    .wireframe{stroke:#5b4662;stroke-width:.8;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.64;vector-effect:non-scaling-stroke}
    .contours{stroke:#c99b8b;stroke-width:1.55;stroke-linecap:round;stroke-linejoin:round;opacity:.94;vector-effect:non-scaling-stroke}
  </style>
  <ellipse cx="130" cy="266" rx="43" ry="5" fill="#412449" opacity=".08"/>
  <path class="wireframe" d="${linePath.join('')}"/>
  <g class="contours">
    ${contourMarkup}
  </g>
</svg>
`;

await writeFile(outputUrl, svg);
console.log(
  `Exported ${visibleEdges.size} front-facing mesh edges and ${[...contours.values()].reduce((total, items) => total + items.length, 0)} measurement contour segments to ${fileURLToPath(outputUrl)}`,
);
