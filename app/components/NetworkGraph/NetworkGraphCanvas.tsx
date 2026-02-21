'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo } from 'react';
import FPSStats from 'react-fps-stats';
import { configureTextBuilder } from 'troika-three-text';
import { AnimatedClusterShells, createCloudAlphaTexture } from './clusterShellVisuals';
import { OrbitingCategoryLabels } from './orbitingCategoryLabels';
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

const unicodeFontsURL = resolveUnicodeFontsURL(process.env.NEXT_PUBLIC_UNICODE_FONTS_URL);
if (unicodeFontsURL) {
  const globalKey = '__troikaUnicodeFontsURL';
  const globalState = globalThis as typeof globalThis & { [globalKey]?: string };
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

  const cloudAlphaTexture = useMemo(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    return createCloudAlphaTexture();
  }, []);

  useEffect(() => () => {
    cloudAlphaTexture?.dispose();
  }, [cloudAlphaTexture]);

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
        glOptions={{ powerPreference: 'high-performance', antialias: false }}
      >
        <lineSegments frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute attach='attributes-position' args={[model.edgeVertices, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color='#9FB4D0' transparent opacity={0.35} />
        </lineSegments>

        <AnimatedClusterShells shells={model.shells} alphaTexture={cloudAlphaTexture} />
        {showClusterLabels ? <OrbitingCategoryLabels shells={model.shells} /> : null}
      </GraphCanvas>

      {showFPS ? <FPSStats /> : null}
    </div>
  );
};
