import { readFile, writeFile } from 'node:fs/promises';
import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  SkinnedMesh,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptSimplifier } from 'meshoptimizer/simplifier';

function normalizedVertex(mesh, index, center, minimum, scale) {
  const point = mesh.getVertexPosition(index, new Vector3());
  mesh.localToWorld(point);
  return new Vector3(
    (point.x - center.x) * scale,
    (point.y - minimum.y) * scale,
    (point.z - center.z) * scale,
  );
}
function buildAdjacency(vertexCount, indices) {
  const neighbors = Array.from({ length: vertexCount }, () => new Set());
  for (let offset = 0; offset < indices.length; offset += 3) {
    const triangle = [
      indices[offset],
      indices[offset + 1],
      indices[offset + 2],
    ];
    for (let edge = 0; edge < 3; edge += 1) {
      const from = triangle[edge];
      const to = triangle[(edge + 1) % 3];
      neighbors[from].add(to);
      neighbors[to].add(from);
    }
  }
  return neighbors;
}
function nearestVertex(vertices, target) {
  let nearest = 0;
  let distance = Number.POSITIVE_INFINITY;
  vertices.forEach((vertex, index) => {
    const candidate = vertex.distanceToSquared(target);
    if (candidate < distance) {
      nearest = index;
      distance = candidate;
    }
  });
  return nearest;
}
function surfacePath(vertices, neighbors, start, end) {
  const previous = new Int32Array(vertices.length).fill(-1);
  const queue = new Int32Array(vertices.length);
  let head = 0;
  let tail = 0;
  previous[start] = start;
  queue[tail++] = start;
  while (head < tail && previous[end] === -1) {
    const current = queue[head++];
    for (const neighbor of neighbors[current]) {
      if (previous[neighbor] !== -1) continue;
      previous[neighbor] = current;
      queue[tail++] = neighbor;
      if (neighbor === end) break;
    }
  }
  if (previous[end] === -1) return [];
  const path = [end];
  while (path[path.length - 1] !== start) {
    path.push(previous[path[path.length - 1]]);
  }
  return path.reverse().map((index) => vertices[index]);
}
function flattenSegments(segments) {
  const coordinates = [];
  for (const segment of segments) {
    for (let index = 1; index < segment.length; index += 1) {
      coordinates.push(
        ...segment[index - 1].toArray(),
        ...segment[index].toArray(),
      );
    }
  }
  return coordinates;
}
function contourAtHeight(vertices, indices, height) {
  const segments = [];
  const tolerance = 0.00001;
  const intersection = (first, second) => {
    const firstDistance = first.y - height;
    const secondDistance = second.y - height;
    if (Math.abs(firstDistance) < tolerance) return first.clone();
    if (Math.abs(secondDistance) < tolerance) return second.clone();
    if (firstDistance * secondDistance > 0) return null;
    return first
      .clone()
      .lerp(second, firstDistance / (firstDistance - secondDistance));
  };
  for (let offset = 0; offset < indices.length; offset += 3) {
    const triangle = [
      vertices[indices[offset]],
      vertices[indices[offset + 1]],
      vertices[indices[offset + 2]],
    ];
    const points = [];
    for (let edge = 0; edge < 3; edge += 1) {
      const point = intersection(triangle[edge], triangle[(edge + 1) % 3]);
      if (
        point &&
        !points.some((existing) => existing.distanceToSquared(point) < 1e-10)
      ) {
        points.push(point);
      }
    }
    if (points.length === 2) segments.push(points);
  }
  return flattenSegments(segments);
}

function compact(positions, indices) {
  const [remap, count] = MeshoptSimplifier.compactMesh(indices);
  const compactPositions = new Float32Array(count * 3);
  for (const [original, next] of remap.entries()) {
    if (next < count)
      compactPositions.set(
        positions.subarray(original * 3, original * 3 + 3),
        next * 3,
      );
  }
  return compactPositions;
}

function edges(indices) {
  const result = [];
  const seen = new Set();
  for (let offset = 0; offset < indices.length; offset += 3) {
    for (let step = 0; step < 3; step += 1) {
      const a = indices[offset + step];
      const b = indices[offset + ((step + 1) % 3)];
      const key = Math.min(a, b) * 65536 + Math.max(a, b);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(a, b);
    }
  }
  return Uint16Array.from(result);
}

function computeNormals(positions, indices) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return geometry.getAttribute('normal').array;
}

const contourLevels = [0.84, 0.79, 0.73, 0.6, 0.49];

function protectContours(vertices, stature) {
  const locked = new Uint8Array(vertices.length);
  // Protect the support points that set the silhouette in each key anatomical band.
  for (const height of contourLevels) {
    for (let direction = 0; direction < 12; direction += 1) {
      const yaw = (direction * Math.PI) / 6;
      let peak = -Infinity;
      let index = -1;
      for (const [candidate, point] of vertices.entries()) {
        if (
          Math.abs(point.y / stature - height) > 0.025 ||
          Math.abs(point.x) > stature * 0.16
        )
          continue;
        const distance = point.x * Math.cos(yaw) + point.z * Math.sin(yaw);
        if (distance <= peak) continue;
        peak = distance;
        index = candidate;
      }
      if (index >= 0) locked[index] = 1;
    }
  }
  return locked;
}

async function loadOriginal() {
  // Three's FileLoader streams the embedded resource and uses this browser event in Node.
  globalThis.ProgressEvent ??= class ProgressEvent extends Event {};
  const modelFolder = new URL(
    '../public/models/quaternius-female/',
    import.meta.url,
  );
  const source = JSON.parse(
    await readFile(new URL('base-character.gltf', modelFolder), 'utf8'),
  );
  const binary = await readFile(new URL(source.buffers[0].uri, modelFolder));
  source.buffers[0].uri = `data:application/octet-stream;base64,${binary.toString('base64')}`;
  const { scene } = await new GLTFLoader().parseAsync(
    JSON.stringify(source),
    '',
  );
  const bounds = new Box3().setFromObject(scene);
  const center = bounds.getCenter(new Vector3());
  const stature = 1.8;
  const scale = stature / bounds.getSize(new Vector3()).y;
  const body = scene.getObjectByName('Superhero_Female');
  if (!(body instanceof SkinnedMesh))
    throw new Error('The rig has no body mesh.');
  body.updateWorldMatrix(true, false);
  const vertices = Array.from(
    { length: body.geometry.getAttribute('position').count },
    (_, index) => normalizedVertex(body, index, center, bounds.min, scale),
  );
  const indices = Uint32Array.from(body.geometry.index.array);
  const bone = (name) => {
    const point = body.skeleton
      .getBoneByName(name)
      .getWorldPosition(new Vector3());
    return new Vector3(
      (point.x - center.x) * scale,
      (point.y - bounds.min.y) * scale,
      (point.z - center.z) * scale,
    );
  };
  return { vertices, indices, bone, stature, modelFolder };
}

function maximumContourWidthChange(original, reduced, stature) {
  let maximum = 0;
  for (const level of contourLevels) {
    const sections = [original, reduced].map(({ vertices, indices }) =>
      contourAtHeight(vertices, indices, level * stature),
    );
    for (let direction = 0; direction < 12; direction += 1) {
      const yaw = (direction * Math.PI) / 6;
      const widths = sections.map((section) => {
        let minimum = Infinity;
        let maximum = -Infinity;
        for (let i = 0; i < section.length; i += 3) {
          const projection =
            section[i] * Math.cos(yaw) + section[i + 2] * Math.sin(yaw);
          minimum = Math.min(minimum, projection);
          maximum = Math.max(maximum, projection);
        }
        return maximum - minimum;
      });
      maximum = Math.max(maximum, Math.abs(widths[0] - widths[1]));
    }
  }
  return maximum;
}

await MeshoptSimplifier.ready;
const original = await loadOriginal();
const { vertices, indices, bone, stature } = original;
const neighbors = buildAdjacency(vertices.length, indices);
const trace = (start, end) =>
  surfacePath(
    vertices,
    neighbors,
    nearestVertex(vertices, start),
    nearestVertex(vertices, end),
  );

const chest = contourAtHeight(vertices, indices, stature * 0.73);
const waist = contourAtHeight(vertices, indices, stature * 0.6);
const hip = contourAtHeight(vertices, indices, stature * 0.49);
const frontZ = Math.max(...vertices.map(({ z }) => z));
const frontPaths = flattenSegments([
  trace(bone('upperarm_l'), bone('upperarm_r')),
  trace(
    new Vector3(0, stature * 0.49, frontZ),
    new Vector3(-0.07, stature * 0.05, frontZ),
  ),
]);
const frontGuides = Float32Array.from([...chest, ...waist, ...frontPaths]);
const otherGuides = Float32Array.from([...chest, ...waist, ...hip]);

const originalPositions = Float32Array.from(
  vertices.flatMap((point) => point.toArray()),
);
const weld = MeshoptSimplifier.generatePositionRemap(originalPositions, 3);
const weldedIndices = indices.map((index) => weld[index]);
const normals = computeNormals(originalPositions, weldedIndices);
const [simplified, error] = MeshoptSimplifier.simplifyWithAttributes(
  weldedIndices,
  originalPositions,
  3,
  normals,
  3,
  [0.15, 0.15, 0.15],
  protectContours(vertices, stature),
  Math.floor((indices.length * 0.27) / 3) * 3,
  0.015,
  ['Regularize'],
);
const positions = compact(originalPositions, simplified);
const normal = computeNormals(positions, simplified);
const reducedVertices = Array.from(
  { length: positions.length / 3 },
  (_, index) => new Vector3().fromArray(positions, index * 3),
);
const maximumContourWidthChangeMm =
  maximumContourWidthChange(
    { vertices, indices },
    { vertices: reducedVertices, indices: simplified },
    stature,
  ) * 1000;
const wire = edges(simplified);
const surface = Uint16Array.from(simplified);
const header = Uint32Array.of(
  0x3148534d,
  positions.length,
  frontGuides.length,
  otherGuides.length,
  surface.length,
  wire.length,
);
const binary = Buffer.concat(
  [header, positions, normal, frontGuides, otherGuides, surface, wire].map(
    (array) => Buffer.from(array.buffer, array.byteOffset, array.byteLength),
  ),
);
const asset = new URL('mannequin-v1.bin', original.modelFolder);
await writeFile(asset, binary);
console.log(
  JSON.stringify(
    {
      original: {
        vertices: vertices.length,
        edges: edges(indices).length / 2,
        triangles: indices.length / 3,
      },
      optimized: {
        vertices: positions.length / 3,
        edges: wire.length / 2,
        triangles: surface.length / 3,
        bytes: binary.length,
      },
      relativeSimplifierError: error,
      maximumContourWidthChangeMm,
    },
    null,
    2,
  ),
);
