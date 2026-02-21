import {
  DEFAULT_CATEGORY_CONFIG,
  DEFAULT_HOST_TYPE_CONFIG,
  DEFAULT_LAYER_CONFIG,
} from './config';
import { buildEdges, classifyHosts } from './hostClassification';
import { createTreeTd3DPositions } from './layout3d';
import type {
  CategoryConfig,
  ClusteredGraphModel,
  DBData,
  GraphNode,
  NetworkGraphConfigs,
} from './types';

const mergeConfigs = (
  configs?: Partial<NetworkGraphConfigs>,
): NetworkGraphConfigs => {
  return {
    hostTypeConfig: configs?.hostTypeConfig ?? DEFAULT_HOST_TYPE_CONFIG,
    layerConfig: configs?.layerConfig ?? DEFAULT_LAYER_CONFIG,
    categoryConfig: configs?.categoryConfig ?? DEFAULT_CATEGORY_CONFIG,
  };
};

const buildGraphNodes = (
  hostMeta: ReturnType<typeof classifyHosts>,
  categoryConfig: CategoryConfig,
): GraphNode[] => {
  const categoryById = new Map(categoryConfig.map((category) => [category.id, category]));

  return hostMeta.map((host) => ({
    id: host.hostname,
    label: host.hostname,
    fill: categoryById.get(host.categoryId)?.color ?? '#9aa5b1',
    data: {
      hostType: host.hostType,
      categoryId: host.categoryId,
      clusterKey: host.clusterKey,
      layerId: host.layerId,
      prefectureCode: host.parsed.prefectureCode,
      buildingCode: host.parsed.buildingCode,
    },
  }));
};

const buildEdgeVertices = (
  edges: ClusteredGraphModel['edges'],
  positionsById: ClusteredGraphModel['positionsById'],
): Float32Array => {
  const points: number[] = [];

  for (const edge of edges) {
    const source = positionsById.get(edge.source);
    const target = positionsById.get(edge.target);
    if (!source || !target) {
      continue;
    }

    points.push(
      source.x,
      source.y,
      source.z,
      target.x,
      target.y,
      target.z,
    );
  }

  return new Float32Array(points);
};

export const buildClusteredGraphModel = (
  dbData: DBData,
  inputConfigs?: Partial<NetworkGraphConfigs>,
): ClusteredGraphModel => {
  const configs = mergeConfigs(inputConfigs);
  const hostMeta = classifyHosts(dbData.hosts, configs);

  const nodes = buildGraphNodes(hostMeta, configs.categoryConfig);
  const knownHosts = new Set(nodes.map((node) => node.id));
  const edges = buildEdges(dbData.connections, knownHosts);

  const { positionsById, shells } = createTreeTd3DPositions(
    hostMeta,
    configs.categoryConfig,
  );

  const edgeVertices = buildEdgeVertices(edges, positionsById);

  return {
    nodes,
    edges,
    positionsById,
    edgeVertices,
    shells,
  };
};
