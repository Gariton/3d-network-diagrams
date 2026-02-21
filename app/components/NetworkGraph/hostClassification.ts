import { HOSTNAME_PATTERN } from './config';
import { findCategoryForHost } from './categoryMatcher';
import type {
  CategoryDefine,
  Connection,
  GraphEdge,
  Host,
  HostType,
  HostTypeConfig,
  HostWithMeta,
  LayerConfig,
  LayerDefine,
  NetworkGraphConfigs,
  ParsedHostname,
} from './types';

const resolveHostType = (
  hostname: string,
  hostTypeConfig: HostTypeConfig,
  fallback: HostType,
): HostType => {
  const match = hostTypeConfig.find((item) => item.regexp.test(hostname));
  if (match) {
    return match.type;
  }
  return fallback && fallback !== '-' ? fallback : 'UNKNOWN';
};

const parseHostname = (hostname: string): ParsedHostname => {
  const match = HOSTNAME_PATTERN.exec(hostname);
  if (!match) {
    return {
      raw: hostname,
      prefectureCode: 'unknown-pref',
      buildingCode: 'unknown-building',
      unitCode: hostname,
    };
  }

  return {
    raw: hostname,
    prefectureCode: match[1].toLowerCase(),
    buildingCode: match[4].toLowerCase(),
    unitCode: match[5].toLowerCase(),
  };
};

const findLayer = (hostType: HostType, layerConfig: LayerConfig): LayerDefine => {
  const layer = layerConfig.find((item) => item.hostTypes.includes(hostType));
  if (layer) {
    return layer;
  }
  return {
    id: 'unclassified-layer',
    order: 999,
    hostTypes: [hostType],
  };
};

const buildClusterKey = (category: CategoryDefine, host: HostWithMeta): string => {
  if (category.scope === 'prefecture') {
    return `prefecture::${host.parsed.prefectureCode}`;
  }
  if (category.scope === 'building') {
    return `building::${host.parsed.prefectureCode}/${host.parsed.buildingCode}`;
  }
  return `global::${category.id}`;
};

const toHostMeta = (host: Host, configs: NetworkGraphConfigs): HostWithMeta => {
  const resolvedType = resolveHostType(host.hostname, configs.hostTypeConfig, host.hostType);
  const parsed = parseHostname(host.hostname);
  const layer = findLayer(resolvedType, configs.layerConfig);
  const category = findCategoryForHost(
    {
      hostname: host.hostname,
      hostType: resolvedType,
      parsed,
      layerId: layer.id,
    },
    configs.categoryConfig,
  );

  return {
    hostname: host.hostname,
    hostType: resolvedType,
    parsed,
    layerId: layer.id,
    layerOrder: layer.order,
    categoryId: category.id,
    categoryOrder: category.order,
    clusterKey: '',
  };
};

export const classifyHosts = (
  hosts: Host[],
  configs: NetworkGraphConfigs,
): HostWithMeta[] => {
  const dedupedHosts = [...new Map(hosts.map((host) => [host.hostname, host])).values()];

  return dedupedHosts
    .map((host) => toHostMeta(host, configs))
    .map((host) => {
      const category = findCategoryForHost(
        {
          hostname: host.hostname,
          hostType: host.hostType,
          parsed: host.parsed,
          layerId: host.layerId,
        },
        configs.categoryConfig,
      );
      return {
        ...host,
        categoryId: category.id,
        categoryOrder: category.order,
        clusterKey: buildClusterKey(category, host),
      };
    });
};

export const buildEdges = (
  connections: Connection[],
  knownHosts: Set<string>,
): GraphEdge[] => {
  return connections
    .filter(([source, target]) => knownHosts.has(source) && knownHosts.has(target))
    .map(([source, target], index) => ({
      id: `edge-${index}`,
      source,
      target,
    }));
};
