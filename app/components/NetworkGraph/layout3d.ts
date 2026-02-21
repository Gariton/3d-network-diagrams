import type { CategoryConfig, ClusterShell, HostWithMeta } from './types';
import {
  CATEGORY_Y_STEP,
  ClusterInfo,
  TOP_LEVEL_Y,
  createClusterCenters,
  createClusterInfos,
  getRingPoint,
  moveBuildingCenterByParent,
  placeClusterNodes,
  resolveAdaptiveRingRadius,
} from './layout3dHelpers';

const CLUSTER_GAP = 120;

type PositionedNode = { id: string; x: number; y: number; z: number };
type CategoryEntry = { category: CategoryConfig[number]; clusterInfos: ClusterInfo[] };

const groupCategoriesByOrder = (
  hosts: HostWithMeta[],
  categoryConfig: CategoryConfig,
): Map<number, CategoryEntry[]> => {
  const grouped = new Map<number, CategoryEntry[]>();
  const categories = [...categoryConfig].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  categories.forEach((category) => {
    const categoryHosts = hosts.filter((host) => host.categoryId === category.id);
    if (!categoryHosts.length) {
      return;
    }

    const list = grouped.get(category.order) ?? [];
    list.push({
      category,
      clusterInfos: createClusterInfos(categoryHosts, category.localRingRadius, category.localRingStep),
    });
    grouped.set(category.order, list);
  });

  return grouped;
};

const placeCategoryClusters = (
  orderGroup: CategoryEntry[],
  positionsById: Map<string, PositionedNode>,
  shells: ClusterShell[],
  prefectureCenters: Map<string, [number, number, number]>,
) => {
  let previousOuter = 0;

  for (let orderSlot = 0; orderSlot < orderGroup.length; orderSlot += 1) {
    const { category, clusterInfos } = orderGroup[orderSlot];
    const orderSlotCount = orderGroup.length;
    const phase = (Math.PI * 2 * orderSlot) / Math.max(orderSlotCount, 1);
    const maxShell = Math.max(...clusterInfos.map((cluster) => cluster.shellRadius), 120);
    const adaptiveRadius = resolveAdaptiveRingRadius(clusterInfos, category.clusterRingRadius, CLUSTER_GAP);
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
};

const fillFallbackPositions = (
  hosts: HostWithMeta[],
  positionsById: Map<string, PositionedNode>,
) => {
  hosts.forEach((host, index) => {
    if (!positionsById.has(host.hostname)) {
      const [x, y, z] = getRingPoint(index, hosts.length, 300, TOP_LEVEL_Y - 3 * CATEGORY_Y_STEP);
      positionsById.set(host.hostname, { id: host.hostname, x, y, z });
    }
  });
};

export const createTreeTd3DPositions = (
  hosts: HostWithMeta[],
  categoryConfig: CategoryConfig,
): {
  positionsById: Map<string, PositionedNode>;
  shells: ClusterShell[];
} => {
  const positionsById = new Map<string, PositionedNode>();
  const shells: ClusterShell[] = [];
  const prefectureCenters = new Map<string, [number, number, number]>();
  const categoriesByOrder = groupCategoriesByOrder(hosts, categoryConfig);
  const orderKeys = [...categoriesByOrder.keys()].sort((a, b) => a - b);

  orderKeys.forEach((order) => {
    const orderGroup = categoriesByOrder.get(order) ?? [];
    placeCategoryClusters(orderGroup, positionsById, shells, prefectureCenters);
  });

  fillFallbackPositions(hosts, positionsById);
  return { positionsById, shells };
};
