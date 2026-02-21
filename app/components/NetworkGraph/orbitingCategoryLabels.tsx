'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture, DoubleSide, Group } from 'three';
import type { ClusterShell } from './types';

type OrbitingLabelGlyph = {
  id: string;
  position: [number, number, number];
  size: [number, number];
  rotationY: number;
  texture: CanvasTexture;
};

const CATEGORY_LABEL_OPACITY = 0.72;
const CATEGORY_LABEL_ORBIT_SPEED = 0.16;
const CATEGORY_LABEL_RADIUS_FACTOR = 1.1;
const CATEGORY_LABEL_LATITUDE = 0.34;
const CATEGORY_LABEL_SPACING_FACTOR = 0.62;

const hashString = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const createGlyphTexture = (char: string): { texture: CanvasTexture; aspect: number } => {
  const fontSize = 96;
  const horizontalPadding = 14;
  const verticalPadding = 10;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    canvas.width = 4;
    canvas.height = 4;
    return { texture: new CanvasTexture(canvas), aspect: 1 };
  }

  context.font = `600 ${fontSize}px sans-serif`;
  const measuredTextWidth = Math.ceil(context.measureText(char).width);
  const width = measuredTextWidth + horizontalPadding * 2;
  const height = fontSize + verticalPadding * 2;
  canvas.width = Math.max(4, width);
  canvas.height = Math.max(4, height);

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = `600 ${fontSize}px sans-serif`;
  context.strokeStyle = 'rgba(15, 23, 42, 0.88)';
  context.lineWidth = 9;
  context.lineJoin = 'round';
  context.textBaseline = 'top';
  context.strokeText(char, horizontalPadding, verticalPadding);
  context.fillStyle = 'rgba(255, 255, 255, 1)';
  context.fillText(char, horizontalPadding, verticalPadding);

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return { texture, aspect: canvas.width / Math.max(canvas.height, 1) };
};

const OrbitingCategoryLabel = ({ shell }: { shell: ClusterShell }) => {
  const orbitRef = useRef<Group | null>(null);
  const glyphs = useMemo<OrbitingLabelGlyph[]>(() => {
    const orbitRadius = Math.max(
      shell.radius * CATEGORY_LABEL_RADIUS_FACTOR * Math.cos(CATEGORY_LABEL_LATITUDE),
      40,
    );
    const orbitY = shell.radius * CATEGORY_LABEL_RADIUS_FACTOR * Math.sin(CATEGORY_LABEL_LATITUDE);
    const worldCharHeight = Math.max(26, Math.min(62, shell.radius * 0.14));
    const stepAngle = Math.max(
      0.045,
      Math.min(0.22, (worldCharHeight * CATEGORY_LABEL_SPACING_FACTOR) / orbitRadius),
    );
    const chars = [...shell.label].reverse();
    const startAngle = -((chars.length - 1) * stepAngle) / 2;

    return chars
      .map((char, index) => {
        if (char.trim().length === 0) {
          return null;
        }
        const angle = startAngle + index * stepAngle;
        const { texture, aspect } = createGlyphTexture(char);
        const width = worldCharHeight * aspect * 0.86;
        return {
          id: `${shell.id}-glyph-${index}`,
          position: [Math.cos(angle) * orbitRadius, orbitY, Math.sin(angle) * orbitRadius],
          size: [width, worldCharHeight],
          rotationY: -angle + Math.PI / 2,
          texture,
        } satisfies OrbitingLabelGlyph;
      })
      .filter((glyph): glyph is OrbitingLabelGlyph => Boolean(glyph));
  }, [shell]);

  useEffect(() => () => {
    glyphs.forEach((glyph) => glyph.texture.dispose());
  }, [glyphs]);

  useFrame((_, delta) => {
    if (!orbitRef.current) {
      return;
    }
    const speedSeed = hashString(shell.id) % 7;
    orbitRef.current.rotation.y += delta * (CATEGORY_LABEL_ORBIT_SPEED + speedSeed * 0.012);
  });

  return (
    <group ref={orbitRef} position={shell.center}>
      {glyphs.map((glyph) => (
        <mesh key={glyph.id} position={glyph.position} rotation={[0, glyph.rotationY, 0]}>
          <planeGeometry args={glyph.size} />
          <meshBasicMaterial
            color={shell.color}
            map={glyph.texture}
            transparent
            opacity={CATEGORY_LABEL_OPACITY}
            depthWrite={false}
            side={DoubleSide}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
};

export const OrbitingCategoryLabels = ({ shells }: { shells: ClusterShell[] }) => (
  <>
    {shells.map((shell) => (
      <OrbitingCategoryLabel key={`cluster-label-${shell.id}`} shell={shell} />
    ))}
  </>
);
