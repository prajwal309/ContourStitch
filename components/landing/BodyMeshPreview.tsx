'use client';

import {
  Component,
  memo,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import {
  getDemoFrame,
  type DemoStage,
  type DemoTimelineRef,
} from './demo-timeline';
import {
  Box3,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SkinnedMesh,
  Vector3,
} from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const modelPath = '/models/quaternius-female/base-character.gltf';
const bodyHeightCm = 180;
const previewScale = 1.68;
const previewVerticalOffset = -1.55;

const measurementOptions = [
  { key: 'shoulder', label: 'Shoulder breadth', view: 'front' },
  { key: 'chest', label: 'Chest circumference', view: 'front', level: 0.73 },
  { key: 'waist', label: 'Waist circumference', view: 'front', level: 0.6 },
  { key: 'hip', label: 'Hip circumference', view: 'side', level: 0.49 },
  { key: 'sleeve', label: 'Sleeve length', view: 'side' },
  { key: 'inseam', label: 'Inseam', view: 'front' },
  { key: 'thigh', label: 'Thigh circumference', view: 'front', level: 0.35 },
  { key: 'neck', label: 'Neck circumference', view: 'front', level: 0.88 },
] as const;

type MeasurementKey = (typeof measurementOptions)[number]['key'];

type MeshColors = {
  background: string;
  surface: string;
  edge: string;
};

type ModelAsset = {
  geometry: BufferGeometry;
  surface: Mesh<BufferGeometry, MeshStandardMaterial>;
  wireframe: Mesh<BufferGeometry, MeshBasicMaterial>;
  height: number;
  contours: Partial<Record<MeasurementKey, BufferGeometry>>;
  paths: Partial<Record<MeasurementKey, BufferGeometry>>;
};

function getMeshColors(): MeshColors {
  const styles = getComputedStyle(document.documentElement);
  return {
    background: styles.getPropertyValue('--mesh-preview-background').trim(),
    surface: styles.getPropertyValue('--mesh-preview-surface').trim(),
    edge: styles.getPropertyValue('--mesh-preview-edge').trim(),
  };
}

function canUseWebGL() {
  const canvas = document.createElement('canvas');
  return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
}

function makeMaterial(color: string, wireframe: true): MeshBasicMaterial;
function makeMaterial(color: string, wireframe: false): MeshStandardMaterial;
function makeMaterial(
  color: string,
  wireframe: boolean,
): MeshStandardMaterial | MeshBasicMaterial {
  if (wireframe) {
    return new MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.96,
      wireframe: true,
    });
  }

  return new MeshStandardMaterial({
    color,
    transparent: true,
    opacity: 0.78,
    roughness: 0.66,
    metalness: 0.08,
    side: DoubleSide,
    depthWrite: false,
  });
}

function normalizedVertex(
  mesh: SkinnedMesh,
  index: number,
  center: Vector3,
  minimum: Vector3,
  scale: number,
) {
  const point = mesh.getVertexPosition(index, new Vector3());
  mesh.localToWorld(point);
  return new Vector3(
    (point.x - center.x) * scale,
    (point.y - minimum.y) * scale,
    (point.z - center.z) * scale,
  );
}

function buildAdjacency(vertexCount: number, indices: ArrayLike<number>) {
  const neighbors = Array.from(
    { length: vertexCount },
    () => new Set<number>(),
  );

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

function nearestVertex(vertices: Vector3[], target: Vector3) {
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

function surfacePath(
  vertices: Vector3[],
  neighbors: Set<number>[],
  start: number,
  end: number,
) {
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

function geometryFromSegments(segments: Vector3[][]) {
  const coordinates: number[] = [];
  for (const segment of segments) {
    for (let index = 1; index < segment.length; index += 1) {
      coordinates.push(
        ...segment[index - 1].toArray(),
        ...segment[index].toArray(),
      );
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(coordinates, 3));
  return geometry;
}

function contourAtHeight(
  vertices: Vector3[],
  indices: ArrayLike<number>,
  height: number,
) {
  const segments: Vector3[][] = [];
  const tolerance = 0.00001;
  const intersection = (first: Vector3, second: Vector3) => {
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
    const points: Vector3[] = [];

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

  return geometryFromSegments(segments);
}

function disposeAsset(asset: ModelAsset) {
  asset.geometry.dispose();
  asset.surface.material.dispose();
  asset.wireframe.material.dispose();
  Object.values(asset.contours).forEach((geometry) => geometry?.dispose());
  Object.values(asset.paths).forEach((geometry) => geometry?.dispose());
}

function makeModelAsset(scene: Group, colors: MeshColors): ModelAsset {
  const rig = SkeletonUtils.clone(scene) as Group;

  const bounds = new Box3().setFromObject(rig);
  const size = bounds.getSize(new Vector3());
  if (!Number.isFinite(size.y) || size.y <= 0) {
    throw new Error('The illustrative human mesh has no usable height.');
  }

  const center = bounds.getCenter(new Vector3());
  const scale = bodyHeightCm / 100 / size.y;
  const bodyMesh = rig.getObjectByName('Superhero_Female');
  if (!(bodyMesh instanceof SkinnedMesh)) {
    throw new Error('The human mesh is missing its skinned body surface.');
  }
  bodyMesh.updateWorldMatrix(true, false);

  const vertices = Array.from(
    { length: bodyMesh.geometry.attributes.position.count },
    (_, index) => normalizedVertex(bodyMesh, index, center, bounds.min, scale),
  );
  const indices =
    bodyMesh.geometry.index?.array ??
    Array.from({ length: vertices.length }, (_, index) => index);
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(
      vertices.flatMap((vertex) => vertex.toArray()),
      3,
    ),
  );
  geometry.setIndex(Array.from(indices));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const surface = new Mesh(geometry, makeMaterial(colors.surface, false));
  const wireframe = new Mesh(geometry, makeMaterial(colors.edge, true));
  surface.renderOrder = 1;
  wireframe.renderOrder = 2;
  const neighbors = buildAdjacency(vertices.length, indices);
  const height = size.y * scale;
  const contours: ModelAsset['contours'] = {};

  for (const option of measurementOptions) {
    if ('level' in option) {
      contours[option.key] = contourAtHeight(
        vertices,
        indices,
        height * option.level,
      );
    }
  }

  const bonePosition = (name: string) => {
    const bone = bodyMesh.skeleton.getBoneByName(name);
    if (!bone) return null;
    const point = bone.getWorldPosition(new Vector3());
    return new Vector3(
      (point.x - center.x) * scale,
      (point.y - bounds.min.y) * scale,
      (point.z - center.z) * scale,
    );
  };
  const surfacePathFromTargets = (start: Vector3, end: Vector3) =>
    surfacePath(
      vertices,
      neighbors,
      nearestVertex(vertices, start),
      nearestVertex(vertices, end),
    );
  const sleeveStart = bonePosition('upperarm_l');
  const sleeveElbow = bonePosition('lowerarm_l');
  const sleeveEnd = bonePosition('hand_l');
  const shoulderLeft = bonePosition('upperarm_l');
  const shoulderRight = bonePosition('upperarm_r');
  const frontZ = Math.max(...vertices.map((vertex) => vertex.z));
  const paths: ModelAsset['paths'] = {};

  if (shoulderLeft && shoulderRight) {
    paths.shoulder = geometryFromSegments([
      surfacePathFromTargets(shoulderLeft, shoulderRight),
    ]);
  }
  if (sleeveStart && sleeveElbow && sleeveEnd) {
    paths.sleeve = geometryFromSegments([
      surfacePathFromTargets(sleeveStart, sleeveElbow),
      surfacePathFromTargets(sleeveElbow, sleeveEnd),
    ]);
  }
  paths.inseam = geometryFromSegments([
    surfacePathFromTargets(
      new Vector3(0, height * 0.49, frontZ),
      new Vector3(-0.07, height * 0.05, frontZ),
    ),
  ]);

  return {
    geometry,
    surface,
    wireframe,
    height,
    contours,
    paths,
  };
}

function useModelAsset(scene: Group, colors: MeshColors) {
  const asset = useMemo(() => makeModelAsset(scene, colors), [colors, scene]);
  useEffect(() => () => disposeAsset(asset), [asset]);
  return asset;
}

function BodyModel({
  colors,
  activeStage,
  timelineRef,
}: {
  colors: MeshColors;
  activeStage: DemoStage;
  timelineRef: DemoTimelineRef;
}) {
  const { scene } = useGLTF(modelPath);
  const asset = useModelAsset(scene, colors);
  const rotationGroup = useRef<Group>(null);
  const guideMaterials = useRef(new Map<string, LineBasicMaterial>());
  useFrame(() => {
    const group = rotationGroup.current;
    if (!group) return;
    const frame = getDemoFrame(timelineRef.current.elapsedSeconds);
    group.rotation.y = frame.rotation;
    const guideOpacity = 0.78 * Math.min(1, frame.secondsIntoStage / 0.8);
    guideMaterials.current.forEach((material) => {
      material.opacity = guideOpacity;
    });
  });

  const contourKeys =
    activeStage === 'front'
      ? new Set(['chest', 'waist'])
      : new Set(['chest', 'waist', 'hip']);
  const pathKeys =
    activeStage === 'front'
      ? new Set(['shoulder', 'inseam'])
      : new Set<string>();

  const renderGuide = (
    key: string,
    geometry: BufferGeometry,
    visible: boolean,
  ) => (
    <lineSegments
      key={key}
      geometry={geometry}
      visible={visible}
      renderOrder={4}
    >
      <lineBasicMaterial
        ref={(material) => {
          if (material) guideMaterials.current.set(key, material);
          else guideMaterials.current.delete(key);
        }}
        color={colors.edge}
        transparent
        opacity={0}
        depthTest={false}
        depthWrite={false}
      />
    </lineSegments>
  );

  return (
    <group
      ref={rotationGroup}
      position={[0, previewVerticalOffset, 0]}
      scale={previewScale}
    >
      <primitive object={asset.surface} />
      <primitive object={asset.wireframe} />
      {Object.entries(asset.contours).map(([key, geometry]) =>
        geometry ? renderGuide(key, geometry, contourKeys.has(key)) : null,
      )}
      {Object.entries(asset.paths).map(([key, geometry]) =>
        geometry ? renderGuide(key, geometry, pathKeys.has(key)) : null,
      )}
    </group>
  );
}

function MeshScene({
  colors,
  activeStage,
  timelineRef,
}: {
  colors: MeshColors;
  activeStage: DemoStage;
  timelineRef: DemoTimelineRef;
}) {
  return (
    <>
      <color attach="background" args={[colors.background]} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[3, 4, 5]} intensity={0.65} />
      <directionalLight position={[-3, 1, -2]} intensity={0.25} />
      <Suspense fallback={null}>
        <BodyModel
          colors={colors}
          activeStage={activeStage}
          timelineRef={timelineRef}
        />
      </Suspense>
    </>
  );
}

type BoundaryProps = {
  children: ReactNode;
  fallback: ReactNode;
};

class MeshErrorBoundary extends Component<
  BoundaryProps,
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

function MeshFallback({ reason }: { reason: string }) {
  return (
    <div className="body-mesh-fallback" role="img" aria-label={reason}>
      <span>{reason}</span>
    </div>
  );
}

export const BodyMeshPreview = memo(function BodyMeshPreview({
  activeStage,
  timelineRef,
}: {
  activeStage: DemoStage;
  timelineRef: DemoTimelineRef;
}) {
  const [webglAvailable] = useState(canUseWebGL);
  const [colors] = useState(getMeshColors);
  return (
    <div
      className="body-mesh-preview"
      role="group"
      aria-label="Rotating illustrative 3D human body mesh"
    >
      {webglAvailable ? (
        <MeshErrorBoundary
          fallback={
            <MeshFallback reason="The illustrative human mesh could not be loaded." />
          }
        >
          <Canvas
            aria-hidden="true"
            className="body-mesh-canvas"
            dpr={[1, 1.5]}
            camera={{ position: [0, 0.92, 5.1], fov: 54 }}
            gl={{ alpha: false, antialias: true, powerPreference: 'low-power' }}
            onCreated={({ gl }) => gl.setClearColor(colors.background)}
          >
            <MeshScene
              colors={colors}
              activeStage={activeStage}
              timelineRef={timelineRef}
            />
          </Canvas>
        </MeshErrorBoundary>
      ) : (
        <MeshFallback reason="A 3D preview is unavailable in this browser." />
      )}
    </div>
  );
});

useGLTF.preload(modelPath);
