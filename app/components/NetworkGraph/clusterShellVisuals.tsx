'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  IcosahedronGeometry,
  MeshBasicMaterial,
  RepeatWrapping,
  Vector3,
} from 'three';
import type { ClusterShell } from './types';

const SHELL_HOVER_OPACITY_SCALE = 0.38;
const SHELL_HOVER_NOISE_SCALE = 0.12;
const SHELL_NOISE_TRANSITION_SPEED = 7.5;

type AnimatedGeometryState = {
  geometry: BufferGeometry;
  basePositions: Float32Array;
  baseAmplitude: number;
  frequency: number;
  speed: number;
  bias: number;
};

export const createCloudAlphaTexture = (): CanvasTexture => {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');
  if (!context) {
    return new CanvasTexture(canvas);
  }

  context.clearRect(0, 0, size, size);
  context.fillStyle = 'rgba(0, 0, 0, 0.25)';
  context.fillRect(0, 0, size, size);

  for (let i = 0; i < 120; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const radius = 10 + Math.random() * 36;
    const opacity = 0.08 + Math.random() * 0.22;
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(2.8, 2.8);
  texture.needsUpdate = true;
  return texture;
};

const createAnimatedBumpyGeometry = (
  detail: number,
  amplitude: number,
  frequency: number,
  speed: number,
  bias: number,
): AnimatedGeometryState => {
  const geometry = new IcosahedronGeometry(1, detail);
  const positions = geometry.attributes.position;
  const positionArray = positions.array as Float32Array;
  const basePositions = new Float32Array(positionArray.length);
  const normal = new Vector3();

  for (let i = 0; i < positions.count; i += 1) {
    normal.fromBufferAttribute(positions, i).normalize();
    const baseIndex = i * 3;
    basePositions[baseIndex] = normal.x;
    basePositions[baseIndex + 1] = normal.y;
    basePositions[baseIndex + 2] = normal.z;
    positionArray[baseIndex] = normal.x;
    positionArray[baseIndex + 1] = normal.y;
    positionArray[baseIndex + 2] = normal.z;
  }

  positions.needsUpdate = true;
  return { geometry, basePositions, baseAmplitude: amplitude, frequency, speed, bias };
};

const animateBumpyGeometry = (state: AnimatedGeometryState, elapsedTime: number, amplitude: number) => {
  const positions = state.geometry.attributes.position;
  const positionArray = positions.array as Float32Array;
  const t = elapsedTime * state.speed;

  for (let index = 0; index < positionArray.length; index += 3) {
    const nx = state.basePositions[index];
    const ny = state.basePositions[index + 1];
    const nz = state.basePositions[index + 2];
    const n1 = Math.sin((nx + t * 0.24) * state.frequency * Math.PI);
    const n2 = Math.sin((ny - t * 0.17) * state.frequency * 0.87 * Math.PI);
    const n3 = Math.sin((nz + t * 0.21) * state.frequency * 1.13 * Math.PI);
    const mixed = (n1 + n2 + n3) / 3;
    const normalized = (mixed + 1) / 2;
    const rounded = normalized ** 1.8;
    const displacement = amplitude * (rounded - state.bias);
    const radius = 1 + displacement;
    positionArray[index] = nx * radius;
    positionArray[index + 1] = ny * radius;
    positionArray[index + 2] = nz * radius;
  }

  positions.needsUpdate = true;
};

const AnimatedClusterShell = ({ shell, alphaTexture }: { shell: ClusterShell; alphaTexture: CanvasTexture | null }) => {
  const [hovered, setHovered] = useState(false);
  const coreAmplitudeRef = useRef(0.32);
  const outerAmplitudeRef = useRef(0.4);
  const innerAmplitudeRef = useRef(0.28);
  const opacityScaleRef = useRef(1);
  const coreMaterialRef = useRef<MeshBasicMaterial | null>(null);
  const outerMaterialRef = useRef<MeshBasicMaterial | null>(null);
  const innerMaterialRef = useRef<MeshBasicMaterial | null>(null);
  const baseCoreOpacity = Math.min(shell.opacity * 0.9 + 0.1, 0.24);
  const baseOuterOpacity = Math.min(shell.opacity * 0.8 + 0.08, 0.2);
  const baseInnerOpacity = Math.min(shell.opacity * 0.75 + 0.06, 0.17);

  const animatedGeometries = useMemo(() => ({
    core: createAnimatedBumpyGeometry(5, 0.32, 3.0, 0.55, 0.34),
    outer: createAnimatedBumpyGeometry(5, 0.4, 2.6, 0.45, 0.36),
    inner: createAnimatedBumpyGeometry(4, 0.28, 3.3, 0.65, 0.33),
  }), []);

  useFrame(({ clock }, delta) => {
    const elapsed = clock.getElapsedTime();
    const targetNoiseScale = hovered ? SHELL_HOVER_NOISE_SCALE : 1;
    const targetOpacityScale = hovered ? SHELL_HOVER_OPACITY_SCALE : 1;
    const blend = Math.min(1, delta * SHELL_NOISE_TRANSITION_SPEED);
    coreAmplitudeRef.current += (animatedGeometries.core.baseAmplitude * targetNoiseScale - coreAmplitudeRef.current) * blend;
    outerAmplitudeRef.current += (animatedGeometries.outer.baseAmplitude * targetNoiseScale - outerAmplitudeRef.current) * blend;
    innerAmplitudeRef.current += (animatedGeometries.inner.baseAmplitude * targetNoiseScale - innerAmplitudeRef.current) * blend;
    opacityScaleRef.current += (targetOpacityScale - opacityScaleRef.current) * blend;

    if (coreMaterialRef.current) {
      coreMaterialRef.current.opacity = baseCoreOpacity * opacityScaleRef.current;
    }
    if (outerMaterialRef.current) {
      outerMaterialRef.current.opacity = baseOuterOpacity * opacityScaleRef.current;
    }
    if (innerMaterialRef.current) {
      innerMaterialRef.current.opacity = baseInnerOpacity * opacityScaleRef.current;
    }

    animateBumpyGeometry(animatedGeometries.core, elapsed, coreAmplitudeRef.current);
    animateBumpyGeometry(animatedGeometries.outer, elapsed + 0.7, outerAmplitudeRef.current);
    animateBumpyGeometry(animatedGeometries.inner, elapsed + 1.3, innerAmplitudeRef.current);
  });

  useEffect(() => () => {
    animatedGeometries.core.geometry.dispose();
    animatedGeometries.outer.geometry.dispose();
    animatedGeometries.inner.geometry.dispose();
  }, [animatedGeometries]);

  return (
    <group position={shell.center}>
      <mesh scale={shell.radius} geometry={animatedGeometries.core.geometry}>
        <meshBasicMaterial ref={coreMaterialRef} color={shell.color} transparent opacity={baseCoreOpacity} depthWrite={false} side={DoubleSide} toneMapped={false} />
      </mesh>
      <mesh scale={shell.radius * 1.08} geometry={animatedGeometries.outer.geometry}>
        <meshBasicMaterial ref={outerMaterialRef} color={shell.color} transparent opacity={baseOuterOpacity} alphaMap={alphaTexture ?? undefined} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} toneMapped={false} />
      </mesh>
      <mesh scale={shell.radius * 0.92} geometry={animatedGeometries.inner.geometry}>
        <meshBasicMaterial ref={innerMaterialRef} color={shell.color} transparent opacity={baseInnerOpacity} alphaMap={alphaTexture ?? undefined} depthWrite={false} side={DoubleSide} toneMapped={false} />
      </mesh>
      <mesh scale={shell.radius * 1.12} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={DoubleSide} />
      </mesh>
    </group>
  );
};

export const AnimatedClusterShells = ({ shells, alphaTexture }: { shells: ClusterShell[]; alphaTexture: CanvasTexture | null }) => (
  <>
    {shells.map((shell) => (
      <AnimatedClusterShell key={shell.id} shell={shell} alphaTexture={alphaTexture} />
    ))}
  </>
);
