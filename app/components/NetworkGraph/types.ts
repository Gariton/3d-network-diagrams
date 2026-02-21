export type Hostname = string;
export type HostType = string;
export type LayerId = string;
export type CategoryId = string;

export type HostHierarchy = HostType[][];

export type Host = {
  hostname: Hostname;
  hostType: HostType;
};

export type Connection = [Hostname, Hostname];

export type DBData = {
  hosts: Host[];
  connections: Connection[];
};

export type HostTypeDefine = {
  type: HostType;
  regexp: RegExp;
};

export type HostTypeConfig = HostTypeDefine[];

export type LayerDefine = {
  id: LayerId;
  order: number;
  hostTypes: HostType[];
};

export type LayerConfig = LayerDefine[];

export type CategoryScope = 'global' | 'prefecture' | 'building';

export type CategoryMatch = {
  hostTypes?: HostType[];
  excludeHostTypes?: HostType[];
  layerIds?: LayerId[];
  excludeLayerIds?: LayerId[];
  hostnameRegexp?: RegExp;
  prefectureRegexp?: RegExp;
  buildingRegexp?: RegExp;
  unitRegexp?: RegExp;
};

export type CategoryDefine = {
  id: CategoryId;
  label: string;
  order: number;
  hostTypes?: HostType[];
  match?: CategoryMatch;
  scope: CategoryScope;
  color: string;
  clusterRingRadius: number;
  localRingRadius: number;
  localRingStep: number;
};

export type CategoryConfig = CategoryDefine[];

export type ParsedHostname = {
  raw: Hostname;
  prefectureCode: string;
  buildingCode: string;
  unitCode: string;
};

export type HostWithMeta = {
  hostname: Hostname;
  hostType: HostType;
  parsed: ParsedHostname;
  layerId: LayerId;
  layerOrder: number;
  categoryId: CategoryId;
  categoryOrder: number;
  clusterKey: string;
};

export type PositionedHost = HostWithMeta & {
  position: {
    x: number;
    y: number;
    z: number;
  };
};

export type ClusterShell = {
  id: string;
  label: string;
  center: [number, number, number];
  radius: number;
  color: string;
  opacity: number;
};

export type GraphNodeData = {
  hostType: HostType;
  categoryId: CategoryId;
  clusterKey: string;
  layerId: LayerId;
  prefectureCode: string;
  buildingCode: string;
};

export type GraphNode = {
  id: string;
  label: string;
  fill?: string;
  data: GraphNodeData;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
};

export type ClusteredGraphModel = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  positionsById: Map<string, { id: string; x: number; y: number; z: number }>;
  edgeVertices: Float32Array;
  shells: ClusterShell[];
};

export type NetworkGraphConfigs = {
  hostTypeConfig: HostTypeConfig;
  layerConfig: LayerConfig;
  categoryConfig: CategoryConfig;
};

export type GetDBData = () => Promise<DBData>;
