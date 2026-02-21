import type {
  CategoryConfig,
  CategoryDefine,
  CategoryMatch,
  HostType,
  LayerId,
  ParsedHostname,
} from './types';

export type CategoryTarget = {
  hostname: string;
  hostType: HostType;
  parsed: ParsedHostname;
  layerId: LayerId;
};

const fallbackCategory = (hostType: HostType): CategoryDefine => ({
  id: 'unclassified-category',
  label: 'Unclassified',
  order: 999,
  hostTypes: [hostType],
  scope: 'global',
  color: '#9aa5b1',
  clusterRingRadius: 0,
  localRingRadius: 120,
  localRingStep: 40,
});

const testRegexp = (regexp: RegExp, value: string): boolean => {
  regexp.lastIndex = 0;
  return regexp.test(value);
};

const hasRule = (category: CategoryDefine): boolean => {
  const match = category.match;
  if (!match) {
    return Array.isArray(category.hostTypes) && category.hostTypes.length > 0;
  }

  return (
    (match.hostTypes?.length ?? 0) > 0
    || (match.excludeHostTypes?.length ?? 0) > 0
    || (match.layerIds?.length ?? 0) > 0
    || (match.excludeLayerIds?.length ?? 0) > 0
    || Boolean(match.hostnameRegexp)
    || Boolean(match.prefectureRegexp)
    || Boolean(match.buildingRegexp)
    || Boolean(match.unitRegexp)
  );
};

const matchesCategory = (
  target: CategoryTarget,
  category: CategoryDefine,
): boolean => {
  const match: CategoryMatch = {
    ...category.match,
    hostTypes: category.match?.hostTypes ?? category.hostTypes,
  };

  if ((match.hostTypes?.length ?? 0) > 0 && !match.hostTypes?.includes(target.hostType)) {
    return false;
  }
  if ((match.excludeHostTypes?.length ?? 0) > 0 && match.excludeHostTypes?.includes(target.hostType)) {
    return false;
  }
  if ((match.layerIds?.length ?? 0) > 0 && !match.layerIds?.includes(target.layerId)) {
    return false;
  }
  if ((match.excludeLayerIds?.length ?? 0) > 0 && match.excludeLayerIds?.includes(target.layerId)) {
    return false;
  }
  if (match.hostnameRegexp && !testRegexp(match.hostnameRegexp, target.hostname)) {
    return false;
  }
  if (match.prefectureRegexp && !testRegexp(match.prefectureRegexp, target.parsed.prefectureCode)) {
    return false;
  }
  if (match.buildingRegexp && !testRegexp(match.buildingRegexp, target.parsed.buildingCode)) {
    return false;
  }
  if (match.unitRegexp && !testRegexp(match.unitRegexp, target.parsed.unitCode)) {
    return false;
  }

  return hasRule(category);
};

export const findCategoryForHost = (
  target: CategoryTarget,
  categoryConfig: CategoryConfig,
): CategoryDefine => {
  const matched = categoryConfig.find((category) => matchesCategory(target, category));
  return matched ?? fallbackCategory(target.hostType);
};
