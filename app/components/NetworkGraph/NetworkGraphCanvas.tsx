'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo } from 'react';
import { CanvasTexture } from 'three';
import FPSStats from 'react-fps-stats';
import { configureTextBuilder } from 'troika-three-text';
import type { ClusteredGraphModel } from './types';

const GraphCanvas = dynamic(
  () => import('reagraph').then((module) => module.GraphCanvas),
  { ssr: false },
);

type NetworkGraphCanvasProps = {
  model: ClusteredGraphModel;
  showFPS?: boolean;
  showClusterLabels?: boolean;
};

type ClusterLabelSprite = {
  id: string;
  position: [number, number, number];
  scale: [number, number, number];
  texture: CanvasTexture;
};

const createLabelTexture = (label: string): { texture: CanvasTexture; aspect: number } => {
  const fontSize = 48;
  const horizontalPadding = 24;
  const verticalPadding = 16;

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    canvas.width = 4;
    canvas.height = 4;
    return {
      texture: new CanvasTexture(canvas),
      aspect: 1,
    };
  }

  context.font = `600 ${fontSize}px sans-serif`;
  const measuredTextWidth = Math.ceil(context.measureText(label).width);
  const width = measuredTextWidth + horizontalPadding * 2;
  const height = fontSize + verticalPadding * 2;

  canvas.width = Math.max(4, width);
  canvas.height = Math.max(4, height);

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(15, 23, 42, 0.76)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.font = `600 ${fontSize}px sans-serif`;
  context.fillStyle = '#F8FAFC';
  context.textBaseline = 'top';
  context.fillText(label, horizontalPadding, verticalPadding);

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;

  return {
    texture,
    aspect: canvas.width / Math.max(canvas.height, 1),
  };
};

const resolveUnicodeFontsURL = (value: string | undefined): string | null => {
  const raw = value?.trim();
  if (!raw) {
    return null;
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  if (typeof window !== 'undefined') {
    return new URL(raw, window.location.origin).toString();
  }
  return raw;
};

const unicodeFontsURL = resolveUnicodeFontsURL(
  process.env.NEXT_PUBLIC_UNICODE_FONTS_URL,
);

if (unicodeFontsURL) {
  const globalKey = '__troikaUnicodeFontsURL';
  const globalState = globalThis as typeof globalThis & {
    [globalKey]?: string;
  };

  if (globalState[globalKey] !== unicodeFontsURL) {
    configureTextBuilder({ unicodeFontsURL });
    globalState[globalKey] = unicodeFontsURL;
  }
}

export const NetworkGraphCanvas = ({
  model,
  showFPS = true,
  showClusterLabels = true,
}: NetworkGraphCanvasProps) => {
  const isLargeGraph = model.nodes.length >= 500;

  const layoutOverrides = useMemo(() => ({
    getNodePosition: (id: string) => {
      const pos = model.positionsById.get(id);
      return pos ?? { id, x: 0, y: 0, z: 0 };
    },
  }), [model.positionsById]);

  const clusterLabelSprites = useMemo<ClusterLabelSprite[]>(() => {
    if (!showClusterLabels || typeof window === 'undefined') {
      return [];
    }

    return model.shells.map((shell) => {
      const { texture, aspect } = createLabelTexture(shell.label);
      const labelHeight = 70;
      const labelWidth = labelHeight * aspect;
      return {
        id: shell.id,
        position: [shell.center[0], shell.center[1] + shell.radius + 60, shell.center[2]],
        scale: [labelWidth, labelHeight, 1],
        texture,
      };
    });
  }, [model.shells, showClusterLabels]);

  useEffect(() => {
    return () => {
      clusterLabelSprites.forEach((sprite) => {
        sprite.texture.dispose();
      });
    };
  }, [clusterLabelSprites]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <GraphCanvas
        labelType={isLargeGraph ? 'none' : 'auto'}
        nodes={model.nodes}
        edges={[]}
        cameraMode='rotate'
        layoutType='custom'
        layoutOverrides={layoutOverrides as never}
        animated={false}
        defaultNodeSize={5}
        draggable={false}
        glOptions={{
          powerPreference: 'high-performance',
          antialias: false,
        }}
      >
        <lineSegments frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute
              attach='attributes-position'
              args={[model.edgeVertices, 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial
            color='#9FB4D0'
            transparent
            opacity={0.35}
          />
        </lineSegments>

        {model.shells.map((shell) => (
          <mesh key={shell.id} position={shell.center}>
            <sphereGeometry args={[shell.radius, 28, 28]} />
            <meshBasicMaterial
              color={shell.color}
              transparent
              opacity={shell.opacity}
              wireframe
            />
          </mesh>
        ))}

        {showClusterLabels
          ? clusterLabelSprites.map((sprite) => (
            <sprite
              key={`cluster-label-${sprite.id}`}
              position={sprite.position}
              scale={sprite.scale}
              renderOrder={50}
            >
              <spriteMaterial
                map={sprite.texture}
                transparent
                depthTest={false}
                depthWrite={false}
                sizeAttenuation
              />
            </sprite>
          ))
          : null}
      </GraphCanvas>

      {showFPS ? <FPSStats /> : null}
    </div>
  );
};
