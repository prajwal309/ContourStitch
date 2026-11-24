import type { MeasurementEstimate } from '@/lib/measurement/types';
import type {
  ReconstructionMesh,
  VisualHullInput,
  VisualHullResult,
} from './types';

export const visualHullConfig = {
  minimumViews: 4,
  maximumViews: 64,
  maximumAngularGapDegrees: 135,
  maxVoxels: 1_500_000,
  halfWidthHeightRatio: 0.35,
  defaultGrid: { x: 40, y: 40, z: 80 },
  samplingHeights: {
    chest: 0.74,
    waist: 0.58,
    hip: 0.49,
  },
} as const;

type Grid = { x: number; y: number; z: number };

function validateInput(input: VisualHullInput) {
  if (
    !Number.isFinite(input.heightCm) ||
    input.heightCm < 80 ||
    input.heightCm > 250
  )
    throw new Error('Height must be between 80 and 250 cm.');
  if (
    input.views.length < visualHullConfig.minimumViews ||
    input.views.length > visualHullConfig.maximumViews
  )
    throw new Error(
      `Visual hull requires ${visualHullConfig.minimumViews}–${visualHullConfig.maximumViews} silhouette views.`,
    );
  for (const [index, view] of input.views.entries()) {
    if (
      !Number.isFinite(view.angleDegrees) ||
      !Number.isInteger(view.width) ||
      !Number.isInteger(view.height) ||
      view.width < 2 ||
      view.height < 2 ||
      view.data.length !== view.width * view.height ||
      !Number.isFinite(view.quality) ||
      view.quality < 0 ||
      view.quality > 1
    )
      throw new Error(`Silhouette view ${index + 1} is invalid.`);
    if (
      view.width !== input.views[0].width ||
      view.height !== input.views[0].height
    )
      throw new Error('All silhouette views must use the same dimensions.');
    if (view.data.some((value) => value !== 0 && value !== 1))
      throw new Error(`Silhouette view ${index + 1} must be a binary mask.`);
  }
  const angles = input.views
    .map((view) => ((view.angleDegrees % 360) + 360) % 360)
    .sort((a, b) => a - b);
  const uniqueAngles = angles.filter(
    (angle, index) => index === 0 || angle - angles[index - 1] > 1,
  );
  if (uniqueAngles.length < visualHullConfig.minimumViews)
    throw new Error('Silhouette views must contain distinct rotation angles.');
  const largestGap = uniqueAngles.reduce((largest, angle, index) => {
    const next = uniqueAngles[(index + 1) % uniqueAngles.length];
    const gap =
      (next ?? 0) + (index === uniqueAngles.length - 1 ? 360 : 0) - angle;
    return Math.max(largest, gap);
  }, 0);
  if (largestGap > visualHullConfig.maximumAngularGapDegrees)
    throw new Error(
      `Silhouette angles do not provide enough rotation coverage (largest gap ${Math.round(largestGap)}°).`,
    );
}

function checkedGrid(grid: Grid): Grid {
  const valid = [grid.x, grid.y, grid.z].every(
    (dimension) =>
      Number.isInteger(dimension) && dimension >= 8 && dimension <= 128,
  );
  const count = grid.x * grid.y * grid.z;
  if (!valid || count > visualHullConfig.maxVoxels)
    throw new Error(
      `Grid must contain at most ${visualHullConfig.maxVoxels} voxels.`,
    );
  return grid;
}

function buildMesh(
  occupancy: Uint8Array,
  grid: Grid,
  heightCm: number,
): ReconstructionMesh {
  const half = visualHullConfig.halfWidthHeightRatio;
  const dx = (2 * half * heightCm) / grid.x;
  const dy = (2 * half * heightCm) / grid.y;
  const dz = heightCm / grid.z;
  const vertices: number[] = [];
  const indices: number[] = [];
  const vertexLookup = new Map<string, number>();
  const index = (x: number, y: number, z: number) =>
    (z * grid.y + y) * grid.x + x;
  const vertex = (x: number, y: number, z: number) => {
    const key = `${x},${y},${z}`;
    const existing = vertexLookup.get(key);
    if (existing !== undefined) return existing;
    const next = vertices.length / 3;
    vertices.push(
      (x / grid.x - 0.5) * 2 * half * heightCm,
      (y / grid.y - 0.5) * 2 * half * heightCm,
      (z / grid.z) * heightCm,
    );
    vertexLookup.set(key, next);
    return next;
  };
  const faces = [
    {
      delta: [-1, 0, 0],
      corners: [
        [0, 0, 0],
        [0, 0, 1],
        [0, 1, 1],
        [0, 1, 0],
      ],
    },
    {
      delta: [1, 0, 0],
      corners: [
        [1, 0, 0],
        [1, 1, 0],
        [1, 1, 1],
        [1, 0, 1],
      ],
    },
    {
      delta: [0, -1, 0],
      corners: [
        [0, 0, 0],
        [1, 0, 0],
        [1, 0, 1],
        [0, 0, 1],
      ],
    },
    {
      delta: [0, 1, 0],
      corners: [
        [0, 1, 0],
        [0, 1, 1],
        [1, 1, 1],
        [1, 1, 0],
      ],
    },
    {
      delta: [0, 0, -1],
      corners: [
        [0, 0, 0],
        [0, 1, 0],
        [1, 1, 0],
        [1, 0, 0],
      ],
    },
    {
      delta: [0, 0, 1],
      corners: [
        [0, 0, 1],
        [1, 0, 1],
        [1, 1, 1],
        [0, 1, 1],
      ],
    },
  ] as const;
  for (let z = 0; z < grid.z; z++) {
    for (let y = 0; y < grid.y; y++) {
      for (let x = 0; x < grid.x; x++) {
        if (!occupancy[index(x, y, z)]) continue;
        for (const face of faces) {
          const [ox, oy, oz] = face.delta;
          const nx = x + ox,
            ny = y + oy,
            nz = z + oz;
          if (
            nx >= 0 &&
            nx < grid.x &&
            ny >= 0 &&
            ny < grid.y &&
            nz >= 0 &&
            nz < grid.z &&
            occupancy[index(nx, ny, nz)]
          )
            continue;
          const corners = face.corners.map(([cx, cy, cz]) =>
            vertex(x + cx, y + cy, z + cz),
          );
          indices.push(
            corners[0],
            corners[1],
            corners[2],
            corners[0],
            corners[2],
            corners[3],
          );
        }
      }
    }
  }
  if (!indices.length || !Number.isFinite(dx + dy + dz))
    throw new Error('Silhouette constraints produced an empty visual hull.');
  return {
    verticesCm: new Float32Array(vertices),
    indices: new Uint32Array(indices),
  };
}

function estimateSection(
  occupancy: Uint8Array,
  grid: Grid,
  heightCm: number,
  fractionFromFloor: number,
  key: 'chest' | 'waist' | 'hip',
): MeasurementEstimate | null {
  const z = Math.max(
    0,
    Math.min(grid.z - 1, Math.round(fractionFromFloor * grid.z)),
  );
  const half = visualHullConfig.halfWidthHeightRatio;
  const dx = (2 * half * heightCm) / grid.x;
  const dy = (2 * half * heightCm) / grid.y;
  const occupied = (x: number, y: number) =>
    occupancy[(z * grid.y + y) * grid.x + x] === 1;
  let perimeterCm = 0;
  let occupiedCells = 0;
  for (let y = 0; y < grid.y; y++) {
    for (let x = 0; x < grid.x; x++) {
      if (!occupied(x, y)) continue;
      occupiedCells++;
      if (x === 0 || !occupied(x - 1, y)) perimeterCm += dy;
      if (x === grid.x - 1 || !occupied(x + 1, y)) perimeterCm += dy;
      if (y === 0 || !occupied(x, y - 1)) perimeterCm += dx;
      if (y === grid.y - 1 || !occupied(x, y + 1)) perimeterCm += dx;
    }
  }
  if (!occupiedCells || !Number.isFinite(perimeterCm)) return null;
  return {
    key,
    valueCm: perimeterCm,
    uncertaintyCm: null,
    confidence: 'low',
    method: 'Voxel cross-section perimeter from an RGB visual hull',
    warnings: [
      'Uncertainty is not statistically calibrated; confirm with a tape.',
      'The visual hull cannot recover concavities hidden from the camera views.',
    ],
  };
}

export function reconstructVisualHull(
  input: VisualHullInput,
  requestedGrid: Grid = visualHullConfig.defaultGrid,
): VisualHullResult {
  validateInput(input);
  const grid = checkedGrid(requestedGrid);
  const voxelCount = grid.x * grid.y * grid.z;
  const occupancy = new Uint8Array(voxelCount).fill(1);
  const half = visualHullConfig.halfWidthHeightRatio;
  const columns = input.views.map((view) => {
    const angle = (view.angleDegrees * Math.PI) / 180;
    const projected = new Int16Array(grid.x * grid.y);
    for (let y = 0; y < grid.y; y++) {
      const worldY = ((y + 0.5) / grid.y - 0.5) * 2 * half;
      for (let x = 0; x < grid.x; x++) {
        const worldX = ((x + 0.5) / grid.x - 0.5) * 2 * half;
        const u = Math.round(
          (0.5 + worldX * Math.cos(angle) + worldY * Math.sin(angle)) *
            (view.width - 1),
        );
        projected[y * grid.x + x] = u >= 0 && u < view.width ? u : -1;
      }
    }
    return { view, projected };
  });
  for (let z = 0; z < grid.z; z++) {
    const v = Math.max(
      0,
      Math.min(
        input.views[0].height - 1,
        Math.round((1 - (z + 0.5) / grid.z) * (input.views[0].height - 1)),
      ),
    );
    for (let y = 0; y < grid.y; y++) {
      for (let x = 0; x < grid.x; x++) {
        const voxel = (z * grid.y + y) * grid.x + x;
        if (!occupancy[voxel]) continue;
        for (const { view, projected } of columns) {
          const u = projected[y * grid.x + x];
          if (
            u < 0 ||
            v >= view.height ||
            view.data[v * view.width + u] === 0
          ) {
            occupancy[voxel] = 0;
            break;
          }
        }
      }
    }
  }
  const mesh = buildMesh(occupancy, grid, input.heightCm);
  const estimates = (
    Object.entries(visualHullConfig.samplingHeights) as [
      'chest' | 'waist' | 'hip',
      number,
    ][]
  )
    .map(([key, fraction]) =>
      estimateSection(occupancy, grid, input.heightCm, fraction, key),
    )
    .filter((estimate): estimate is MeasurementEstimate => estimate !== null);
  const missing = (['chest', 'waist', 'hip'] as const).filter(
    (key) => !estimates.some((estimate) => estimate.key === key),
  );
  const warnings = [
    'Visual hull reconstruction is an experimental geometric proxy, not a validated measurement method.',
    'Absolute scale uses entered height; no uncalibrated RGB-only scale is inferred.',
    'Camera intrinsics and the rotation axis are not calibrated; relative pose angles and weak-perspective projection are assumed.',
    'Mesh and dimensions are affected by rotation-angle error, perspective, clothing, and silhouette segmentation.',
    ...(missing.length
      ? [`Cross-sections unavailable: ${missing.join(', ')}.`]
      : []),
  ];
  return {
    engine: 'visual-hull',
    estimates,
    missing,
    mesh,
    quality: {
      viewCount: input.views.length,
      meanSilhouetteQuality:
        input.views.reduce((sum, view) => sum + view.quality, 0) /
        input.views.length,
      grid,
      calibrated: false,
      warnings,
    },
  };
}
