import type { HostWithMeta } from './types';

export const TOP_LEVEL_Y = 1000;
export const CATEGORY_Y_STEP = 700;
const PREFECTURE_BUILDING_OFFSET_Y = -750;
const BUILDING_CLUSTER_GAP = 100;

export type ClusterInfo = {
  key: string;
  hosts: HostWithMeta[];
  shellRadius: number;
};

export const getRingPoint = (
  index: number,
  total: number,
  radius: number,
  y: number,
  phase = 0,
): [number, number, number] => {
  if (total <= 1) {
    return [0, y, 0];
  }

  const angle = phase + (Math.PI * 2 * index) / Math.max(total, 1);
  return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
};

export const createClusterInfos = (
  categoryHosts: HostWithMeta[],
  localRingRadius: number,
  localRingStep: number,
): ClusterInfo[] => {
  const clusters = new Map<string, HostWithMeta[]>();
  for (const host of categoryHosts) {
    const list = clusters.get(host.clusterKey) ?? [];
    list.push(host);
    clusters.set(host.clusterKey, list);
  }

  return [...clusters.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, hosts]) => {
      const layerCount = new Set(hosts.map((host) => host.layerOrder)).size || 1;
      return { key, hosts, shellRadius: localRingRadius + layerCount * localRingStep + 80 };
    });
};

export const resolveAdaptiveRingRadius = (
  clusterInfos: ClusterInfo[],
  clusterRingRadius: number,
  gap: number,
) => {
  if (clusterInfos.length <= 1) {
    return clusterRingRadius;
  }

  const maxShell = Math.max(...clusterInfos.map((info) => info.shellRadius), 120);
  const minSpacing = maxShell * 2 + gap;
  const requiredRadius = (clusterInfos.length * minSpacing) / (Math.PI * 2);
  return Math.max(clusterRingRadius, requiredRadius);
};

export const createClusterCenters = (
  clusterInfos: ClusterInfo[],
  categoryOrder: number,
  ringRadius: number,
  phase = 0,
) => {
  const centers = new Map<string, [number, number, number]>();
  clusterInfos.forEach((cluster, clusterIndex) => {
    centers.set(
      cluster.key,
      getRingPoint(
        clusterIndex,
        clusterInfos.length,
        ringRadius,
        TOP_LEVEL_Y - categoryOrder * CATEGORY_Y_STEP,
        phase,
      ),
    );
  });

  return { centers, clusterEntries: clusterInfos };
};

export const moveBuildingCenterByParent = (
  clusterKey: string,
  rawCenter: [number, number, number],
  clusterIndex: number,
  clusterInfos: ClusterInfo[],
  categoryRadius: number,
  orderSlot: number,
  orderSlotCount: number,
  prefectureCenters: Map<string, [number, number, number]>,
): [number, number, number] => {
  const buildingKey = clusterKey.replace('building::', '');
  const [prefCode] = buildingKey.split('/');
  const parentCenter = prefectureCenters.get(prefCode);
  if (!parentCenter) {
    return rawCenter;
  }

  const prefCodeKey = `building::${prefCode}/`;
  const siblings = clusterInfos.filter((cluster) => cluster.key.startsWith(prefCodeKey));
  const siblingIndex = siblings.findIndex((cluster) => cluster.key === clusterKey);
  const siblingCount = siblings.length || 1;
  const adaptiveRadius = resolveAdaptiveRingRadius(siblings, categoryRadius, BUILDING_CLUSTER_GAP);
  const phase = (Math.PI * 2 * orderSlot) / Math.max(orderSlotCount, 1);
  const offset = getRingPoint(
    siblingIndex >= 0 ? siblingIndex : clusterIndex,
    siblingCount,
    adaptiveRadius,
    0,
    phase,
  );

  return [
    parentCenter[0] + offset[0],
    parentCenter[1] + PREFECTURE_BUILDING_OFFSET_Y,
    parentCenter[2] + offset[2],
  ];
};

export const placeClusterNodes = (
  clusterHosts: HostWithMeta[],
  center: [number, number, number],
  localRingRadius: number,
  localRingStep: number,
  positionsById: Map<string, { id: string; x: number; y: number; z: number }>,
) => {
  const layerBuckets = new Map<number, HostWithMeta[]>();
  for (const host of clusterHosts) {
    const list = layerBuckets.get(host.layerOrder) ?? [];
    list.push(host);
    layerBuckets.set(host.layerOrder, list);
  }

  const layerOrders = [...layerBuckets.keys()].sort((a, b) => a - b);
  layerOrders.forEach((layerOrder, layerIndex) => {
    const bucket = layerBuckets.get(layerOrder) ?? [];
    const radius = localRingRadius + layerIndex * localRingStep;
    const yOffset = ((layerOrders.length - 1) / 2 - layerIndex) * 90;
    bucket.forEach((host, nodeIndex) => {
      const [x, y, z] = getRingPoint(nodeIndex, bucket.length, radius, yOffset);
      positionsById.set(host.hostname, { id: host.hostname, x: center[0] + x, y: center[1] + y, z: center[2] + z });
    });
  });

  return { layerCount: layerOrders.length };
};
