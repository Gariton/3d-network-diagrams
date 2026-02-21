import type {
  CategoryConfig,
  ClusterShell,
  HostWithMeta,
} from './types';

const TOP_LEVEL_Y = 1000;
const CATEGORY_Y_STEP = 700;
const PREFECTURE_BUILDING_OFFSET_Y = -550;
const CLUSTER_GAP = 120;
const BUILDING_CLUSTER_GAP = 100;

const getRingPoint = (
  index: number,
  total: number,
  radius: number,
  y: number,
  phase = 0,
): [number, number, number] => {
  const angle = phase + (Math.PI * 2 * index) / Math.max(total, 1);
  return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
};

type ClusterInfo = {
  key: string;
  hosts: HostWithMeta[];
  shellRadius: number;
};

const createClusterInfos = (
  categoryHosts: HostWithMeta[],
  localRingRadius: number,
  localRingStep: number,
) => {
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
      return {
        key,
        hosts,
        shellRadius: localRingRadius + layerCount * localRingStep + 80,
      } satisfies ClusterInfo;
    });
};

const resolveAdaptiveRingRadius = (
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

const createClusterCenters = (
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

  return {
    centers,
    clusterEntries: clusterInfos,
  };
};

const moveBuildingCenterByParent = (
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

const placeClusterNodes = (
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
    const yOffset = (layerIndex - (layerOrders.length - 1) / 2) * 90;

    bucket.forEach((host, nodeIndex) => {
      const [x, y, z] = getRingPoint(nodeIndex, bucket.length, radius, yOffset);
      positionsById.set(host.hostname, {
        id: host.hostname,
        x: center[0] + x,
        y: center[1] + y,
        z: center[2] + z,
      });
    });
  });

  return {
    layerCount: layerOrders.length,
  };
};

export const createTreeTd3DPositions = (
  hosts: HostWithMeta[],
  categoryConfig: CategoryConfig,
): {
  positionsById: Map<string, { id: string; x: number; y: number; z: number }>;
  shells: ClusterShell[];
} => {
  const positionsById = new Map<string, { id: string; x: number; y: number; z: number }>();
  const shells: ClusterShell[] = [];
  const prefectureCenters = new Map<string, [number, number, number]>();

  const categories = [...categoryConfig].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const categoriesByOrder = new Map<number, {
    category: CategoryConfig[number];
    clusterInfos: ClusterInfo[];
  }[]>();

  categories.forEach((category) => {
    const categoryHosts = hosts.filter((host) => host.categoryId === category.id);
    if (!categoryHosts.length) {
      return;
    }

    const clusterInfos = createClusterInfos(
      categoryHosts,
      category.localRingRadius,
      category.localRingStep,
    );

    const list = categoriesByOrder.get(category.order) ?? [];
    list.push({
      category,
      clusterInfos,
    });
    categoriesByOrder.set(category.order, list);
  });

  const orderKeys = [...categoriesByOrder.keys()].sort((a, b) => a - b);

  for (const order of orderKeys) {
    const orderGroup = categoriesByOrder.get(order) ?? [];
    let previousOuter = 0;

    for (let orderSlot = 0; orderSlot < orderGroup.length; orderSlot += 1) {
      const current = orderGroup[orderSlot];
      const { category, clusterInfos } = current;
      const orderSlotCount = orderGroup.length;
      const phase = (Math.PI * 2 * orderSlot) / Math.max(orderSlotCount, 1);
      const maxShell = Math.max(...clusterInfos.map((cluster) => cluster.shellRadius), 120);
      const adaptiveRadius = resolveAdaptiveRingRadius(
        clusterInfos,
        category.clusterRingRadius,
        CLUSTER_GAP,
      );
      const ringRadius = orderSlot === 0
        ? adaptiveRadius
        : Math.max(adaptiveRadius, previousOuter + maxShell + CLUSTER_GAP);
      previousOuter = ringRadius + maxShell;

      const { centers, clusterEntries } = createClusterCenters(
        clusterInfos,
        category.order,
        ringRadius,
        phase,
      );

      clusterEntries.forEach((clusterInfo, clusterIndex) => {
        let center = centers.get(clusterInfo.key);
        if (!center) {
          return;
        }

        if (category.scope === 'prefecture') {
          const prefCode = clusterInfo.key.replace('prefecture::', '');
          prefectureCenters.set(prefCode, center);
        }

        if (category.scope === 'building') {
          center = moveBuildingCenterByParent(
            clusterInfo.key,
            center,
            clusterIndex,
            clusterEntries,
            category.clusterRingRadius,
            orderSlot,
            orderSlotCount,
            prefectureCenters,
          );
        }

        const placed = placeClusterNodes(
          clusterInfo.hosts,
          center,
          category.localRingRadius,
          category.localRingStep,
          positionsById,
        );

        shells.push({
          id: `${category.id}:${clusterInfo.key}`,
          label: `${category.label} / ${clusterInfo.key}`,
          center,
          radius: clusterInfo.shellRadius + Math.max(0, placed.layerCount - 1) * 10,
          color: category.color,
          opacity: category.scope === 'global' ? 0.12 : 0.07,
        });
      });
    }
  }

  hosts.forEach((host, index) => {
    if (!positionsById.has(host.hostname)) {
      const [x, y, z] = getRingPoint(index, hosts.length, 300, TOP_LEVEL_Y - 3 * CATEGORY_Y_STEP);
      positionsById.set(host.hostname, {
        id: host.hostname,
        x,
        y,
        z,
      });
    }
  });

  return {
    positionsById,
    shells,
  };
};
