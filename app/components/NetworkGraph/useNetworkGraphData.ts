'use client';

import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_CONFIGS } from './config';
import { buildClusteredGraphModel } from './model';
import type {
  ClusteredGraphModel,
  DBData,
  GetDBData,
  NetworkGraphConfigs,
} from './types';
import { getDBData as defaultGetDBData } from '@/lib/network/getDBData';

type UseNetworkGraphDataOptions = {
  getDBData?: GetDBData;
  configs?: Partial<NetworkGraphConfigs>;
};

type UseNetworkGraphDataResult = {
  loading: boolean;
  error: string | null;
  model: ClusteredGraphModel;
  reload: () => void;
};

const emptyModel: ClusteredGraphModel = {
  nodes: [],
  edges: [],
  positionsById: new Map(),
  edgeVertices: new Float32Array(),
  shells: [],
};

export const useNetworkGraphData = (
  options?: UseNetworkGraphDataOptions,
): UseNetworkGraphDataResult => {
  const [rawData, setRawData] = useState<DBData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const getData = options?.getDBData ?? defaultGetDBData;
  const mergedConfigs = useMemo<NetworkGraphConfigs>(() => ({
    hostTypeConfig: options?.configs?.hostTypeConfig ?? DEFAULT_CONFIGS.hostTypeConfig,
    layerConfig: options?.configs?.layerConfig ?? DEFAULT_CONFIGS.layerConfig,
    categoryConfig: options?.configs?.categoryConfig ?? DEFAULT_CONFIGS.categoryConfig,
  }), [options?.configs?.hostTypeConfig, options?.configs?.layerConfig, options?.configs?.categoryConfig]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await getData();
        if (!active) {
          return;
        }
        setRawData(data);
      } catch (e) {
        if (!active) {
          return;
        }
        setRawData(null);
        setError(e instanceof Error ? e.message : 'failed to load graph data');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [getData, reloadKey]);

  const model = useMemo(() => {
    if (!rawData) {
      return emptyModel;
    }
    return buildClusteredGraphModel(rawData, mergedConfigs);
  }, [rawData, mergedConfigs]);

  const reload = () => {
    setReloadKey((prev) => prev + 1);
  };

  return {
    loading,
    error,
    model,
    reload,
  };
};
