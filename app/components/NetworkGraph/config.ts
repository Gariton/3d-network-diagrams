import type {
  CategoryConfig,
  HostTypeConfig,
  LayerConfig,
  NetworkGraphConfigs,
} from './types';

// Prefix: (e|w)NN + building code, delimiter, unit code.
export const HOSTNAME_PATTERN = /^((e|w)(\d{2}))(.+?)-+(.+)$/i;

export const DEFAULT_HOST_TYPE_CONFIG: HostTypeConfig = [
  { type: 'GWR', regexp: /-+gwr\d+$/i },
  { type: 'CORE_ROUTER', regexp: /-+(core|cr|corert)\d+$/i },
  { type: 'EDGE_ROUTER', regexp: /-+(edge|er)\d+$/i },
  { type: 'BUILDING_CORE_SW', regexp: /-+(bcsw|coresw|csw)\d+$/i },
  { type: 'BUILDING_DISTRIBUTION_SW', regexp: /-+(bdsw|distsw|dsw)\d+$/i },
  { type: 'BUILDING_ACCESS_SW', regexp: /-+(basw|accsw|asw)\d+$/i },
];

export const DEFAULT_LAYER_CONFIG: LayerConfig = [
  {
    id: 'upper-layer',
    order: 0,
    hostTypes: ['GWR', 'CORE_ROUTER'],
  },
  {
    id: 'prefecture-edge',
    order: 1,
    hostTypes: ['EDGE_ROUTER'],
  },
  {
    id: 'building-core',
    order: 2,
    hostTypes: ['BUILDING_CORE_SW'],
  },
  {
    id: 'building-distribution',
    order: 3,
    hostTypes: ['BUILDING_DISTRIBUTION_SW'],
  },
  {
    id: 'building-access',
    order: 4,
    hostTypes: ['BUILDING_ACCESS_SW'],
  },
];

export const DEFAULT_CATEGORY_CONFIG: CategoryConfig = [
  {
    id: 'core-network',
    label: 'コアネットワーク層',
    order: 0,
    match: {
      hostTypes: ['GWR', 'CORE_ROUTER'],
    },
    scope: 'global',
    color: '#7B8FEA',
    clusterRingRadius: 0,
    localRingRadius: 180,
    localRingStep: 40,
  },
  {
    id: 'prefecture-edges',
    label: '県域',
    order: 1,
    match: {
      hostTypes: ['EDGE_ROUTER'],
      prefectureRegexp: /^(e|w)\d{2}$/i,
    },
    scope: 'prefecture',
    color: '#4DB6AC',
    clusterRingRadius: 1300,
    localRingRadius: 190,
    localRingStep: 35,
  },
  {
    id: 'building-switches',
    label: 'ビル',
    order: 2,
    match: {
      layerIds: ['building-core', 'building-distribution', 'building-access'],
    },
    scope: 'building',
    color: '#8AB4F8',
    clusterRingRadius: 530,
    localRingRadius: 120,
    localRingStep: 55,
  },
];

export const DEFAULT_CONFIGS: NetworkGraphConfigs = {
  hostTypeConfig: DEFAULT_HOST_TYPE_CONFIG,
  layerConfig: DEFAULT_LAYER_CONFIG,
  categoryConfig: DEFAULT_CATEGORY_CONFIG,
};
