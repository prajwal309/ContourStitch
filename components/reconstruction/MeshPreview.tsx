'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReconstructionMesh } from '@/lib/reconstruction/types';

export function MeshPreview({
  mesh,
  label = 'Interactive voxel surface reconstruction; drag to rotate, or use the arrow keys.',
}: {
  mesh: ReconstructionMesh;
  label?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const [rotation, setRotation] = useState({ yaw: -0.55, pitch: 0.12 });

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context) return;
    const palette = getComputedStyle(element);
    const meshFace = palette.getPropertyValue('--mesh-face').trim();
    const meshOutline = palette.getPropertyValue('--mesh-outline').trim();
    const width = Math.max(320, element.clientWidth);
    const height = 300;
    const ratio = window.devicePixelRatio || 1;
    element.width = width * ratio;
    element.height = height * ratio;
    context.scale(ratio, ratio);
    context.clearRect(0, 0, width, height);
    const vertices = mesh.verticesCm;
    const triangleCount = Math.floor(mesh.indices.length / 3);
    if (!vertices.length || triangleCount === 0) return;
    let maxExtent = 0;
    for (let i = 0; i < vertices.length; i += 3)
      maxExtent = Math.max(
        maxExtent,
        Math.abs(vertices[i]),
        Math.abs(vertices[i + 1]),
        Math.abs(vertices[i + 2]),
      );
    if (!Number.isFinite(maxExtent) || maxExtent === 0) return;
    const sinYaw = Math.sin(rotation.yaw);
    const cosYaw = Math.cos(rotation.yaw);
    const sinPitch = Math.sin(rotation.pitch);
    const cosPitch = Math.cos(rotation.pitch);
    const scale = (Math.min(width, height) * 0.82) / (maxExtent * 2.2);
    const projected: { x: number; y: number; depth: number }[] = [];
    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i];
      const y = vertices[i + 1];
      const z = vertices[i + 2] - maxExtent * 0.65;
      const rotatedX = x * cosYaw - y * sinYaw;
      const rotatedY = x * sinYaw + y * cosYaw;
      const screenY = rotatedY * cosPitch - z * sinPitch;
      const depth = rotatedY * sinPitch + z * cosPitch;
      projected.push({
        x: width / 2 + rotatedX * scale,
        y: height / 2 - screenY * scale,
        depth,
      });
    }
    const triangles = Array.from({ length: triangleCount }, (_, index) => {
      const offset = index * 3;
      const a = projected[mesh.indices[offset]];
      const b = projected[mesh.indices[offset + 1]];
      const c = projected[mesh.indices[offset + 2]];
      return { a, b, c, depth: (a.depth + b.depth + c.depth) / 3 };
    }).sort((a, b) => a.depth - b.depth);
    for (const triangle of triangles) {
      context.beginPath();
      context.moveTo(triangle.a.x, triangle.a.y);
      context.lineTo(triangle.b.x, triangle.b.y);
      context.lineTo(triangle.c.x, triangle.c.y);
      context.closePath();
      context.fillStyle = meshFace;
      context.strokeStyle = meshOutline;
      context.lineWidth = 0.45;
      context.globalAlpha = 0.72;
      context.fill();
      context.globalAlpha = 0.2;
      context.stroke();
    }
    context.globalAlpha = 1;
  }, [mesh, rotation]);

  return (
    <div className="mesh-preview">
      <canvas
        ref={canvas}
        tabIndex={0}
        aria-label={label}
        onPointerDown={(event) => {
          pointer.current = { x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!pointer.current) return;
          const dx = event.clientX - pointer.current.x;
          const dy = event.clientY - pointer.current.y;
          pointer.current = { x: event.clientX, y: event.clientY };
          setRotation((current) => ({
            yaw: current.yaw + dx * 0.01,
            pitch: Math.max(-1.1, Math.min(1.1, current.pitch + dy * 0.01)),
          }));
        }}
        onPointerUp={() => {
          pointer.current = null;
        }}
        onPointerCancel={() => {
          pointer.current = null;
        }}
        onKeyDown={(event) => {
          const step = 0.12;
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            setRotation((current) => ({
              ...current,
              yaw: current.yaw + (event.key === 'ArrowLeft' ? -step : step),
            }));
          }
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            setRotation((current) => ({
              ...current,
              pitch: Math.max(
                -1.1,
                Math.min(
                  1.1,
                  current.pitch + (event.key === 'ArrowUp' ? -step : step),
                ),
              ),
            }));
          }
        }}
      />
      <p className="muted">
        Drag or focus the mesh and use the arrow keys to rotate it.
      </p>
    </div>
  );
}
