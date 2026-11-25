import type { ReconstructionMesh } from '@/lib/reconstruction/types';
import type { Section } from './observe';

/** Only reconstructed cross-sections form vertices. Faces between them are interpolated. */
export function torsoMesh(
  torsoCm: number,
  sections: Partial<Record<Section, { width: number; depth: number }>>,
): ReconstructionMesh | undefined {
  const rings = (['hip', 'waist', 'chest'] as const).flatMap((key) => {
    const section = sections[key];
    if (!section) return [];
    return [
      {
        ...section,
        height: torsoCm * { hip: 0, waist: 0.28, chest: 0.7 }[key],
      },
    ];
  });
  if (rings.length < 2) return undefined;
  const points = 24;
  const vertices = new Float32Array(rings.length * points * 3);
  const indices: number[] = [];
  for (const [index, ring] of rings.entries()) {
    for (let column = 0; column < points; column++) {
      const angle = (2 * Math.PI * column) / points;
      const offset = index * points + column;
      vertices[offset * 3] = (Math.cos(angle) * ring.width) / 2;
      vertices[offset * 3 + 1] = (Math.sin(angle) * ring.depth) / 2;
      vertices[offset * 3 + 2] = ring.height;
      if (index > 0) {
        const next = index * points + ((column + 1) % points);
        indices.push(
          offset - points,
          next - points,
          offset,
          offset,
          next - points,
          next,
        );
      }
    }
  }
  return { verticesCm: vertices, indices: Uint32Array.from(indices) };
}
