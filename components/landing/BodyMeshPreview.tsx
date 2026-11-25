'use client';

import { Component, memo, Suspense, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { DoubleSide } from 'three';
import type { Group, LineBasicMaterial } from 'three';
import {
  getDemoFrame,
  type DemoStage,
  type DemoTimelineRef,
} from './demo-timeline';
import { mannequinPath, MannequinLoader } from './MannequinGeometry';

const previewScale = 1.68;
const previewVerticalOffset = -1.55;

type MeshColors = {
  background: string;
  surface: string;
  edge: string;
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

function BodyModel({
  colors,
  activeStage,
  timelineRef,
}: {
  colors: MeshColors;
  activeStage: DemoStage;
  timelineRef: DemoTimelineRef;
}) {
  const asset = useLoader(MannequinLoader, mannequinPath);
  const rotationGroup = useRef<Group>(null);
  const guideMaterial = useRef<LineBasicMaterial>(null);
  useFrame(() => {
    const frame = getDemoFrame(timelineRef.current.elapsedSeconds);
    if (rotationGroup.current)
      rotationGroup.current.rotation.y = frame.rotation;
    if (guideMaterial.current)
      guideMaterial.current.opacity =
        0.78 * Math.min(1, frame.secondsIntoStage / 0.8);
  });

  return (
    <group
      ref={rotationGroup}
      position={[0, previewVerticalOffset, 0]}
      scale={previewScale}
    >
      <mesh geometry={asset.surface} renderOrder={1}>
        <meshStandardMaterial
          color={colors.surface}
          transparent
          opacity={0.78}
          roughness={0.66}
          metalness={0.08}
          side={DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <lineSegments geometry={asset.wireframe} renderOrder={2}>
        <lineBasicMaterial color={colors.edge} transparent opacity={0.96} />
      </lineSegments>
      <lineSegments
        geometry={
          activeStage === 'front' ? asset.frontGuides : asset.otherGuides
        }
        renderOrder={4}
      >
        <lineBasicMaterial
          ref={guideMaterial}
          color={colors.edge}
          transparent
          opacity={0}
          depthTest={false}
          depthWrite={false}
        />
      </lineSegments>
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
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const element = container.current;
    if (!element || !webglAvailable) return;
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(entry.isIntersecting),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [webglAvailable]);

  return (
    <div
      ref={container}
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
            frameloop={visible ? 'always' : 'demand'}
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

useLoader.preload(MannequinLoader, mannequinPath);
