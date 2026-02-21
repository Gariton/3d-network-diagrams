'use client';

import type { ReactNode } from 'react';
import { NetworkGraphCanvas } from './NetworkGraphCanvas';
import { useNetworkGraphData } from './useNetworkGraphData';
import type { GetDBData, NetworkGraphConfigs } from './types';

type NetworkGraphProps = {
  getDBData?: GetDBData;
  configs?: Partial<NetworkGraphConfigs>;
  showFPS?: boolean;
  loadingFallback?: ReactNode;
};

const defaultLoading = (
  <div
    style={{
      width: '100%',
      height: '100vh',
      display: 'grid',
      placeItems: 'center',
      fontFamily: 'sans-serif',
      color: '#5a6b7c',
    }}
  >
    loading network topology...
  </div>
);

export const NetworkGraph = ({
  getDBData,
  configs,
  showFPS = true,
  loadingFallback = defaultLoading,
}: NetworkGraphProps) => {
  const { loading, error, model } = useNetworkGraphData({
    getDBData,
    configs,
  });

  if (loading) {
    return loadingFallback;
  }

  if (error) {
    return (
      <div
        style={{
          width: '100%',
          height: '100vh',
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'sans-serif',
          color: '#9f2b2b',
          background: '#fff7f7',
        }}
      >
        failed to load topology: {error}
      </div>
    );
  }

  return <NetworkGraphCanvas model={model} showFPS={showFPS} />;
};
