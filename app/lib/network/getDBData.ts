import type { DBData, Host, HostType } from '@/components/NetworkGraph/types';

const prefectures = ['e01', 'e02', 'w03', 'w04'];
const buildings = ['a01', 'a02', 'b10', 'c20'];

const makeHost = (
  area: string,
  building: string,
  unit: string,
  hostType: HostType,
): Host => ({
  hostname: `${area}${building}--${unit}`,
  hostType,
});

export const getDBData = async (): Promise<DBData> => {
  const hosts: Host[] = [];
  const connections: Array<[string, string]> = [];

  const coreNodes = [
    makeHost('e01', 'core', 'gwr1', 'GWR'),
    makeHost('w03', 'core', 'gwr2', 'GWR'),
    makeHost('e01', 'core', 'cr1', 'CORE_ROUTER'),
  ];

  hosts.push(...coreNodes);

  for (const [prefIndex, pref] of prefectures.entries()) {
    const edge1 = makeHost(pref, 'edge', `er${prefIndex * 2 + 1}`, 'EDGE_ROUTER');
    const edge2 = makeHost(pref, 'edge', `er${prefIndex * 2 + 2}`, 'EDGE_ROUTER');
    hosts.push(edge1, edge2);

    connections.push([coreNodes[0].hostname, edge1.hostname]);
    connections.push([coreNodes[1].hostname, edge2.hostname]);
    connections.push([coreNodes[2].hostname, edge1.hostname]);

    for (const building of buildings) {
      const csw = makeHost(pref, building, `csw1`, 'BUILDING_CORE_SW');
      const dsw = makeHost(pref, building, `dsw1`, 'BUILDING_DISTRIBUTION_SW');
      const asw1 = makeHost(pref, building, `asw1`, 'BUILDING_ACCESS_SW');
      const asw2 = makeHost(pref, building, `asw2`, 'BUILDING_ACCESS_SW');

      hosts.push(csw, dsw, asw1, asw2);

      connections.push([edge1.hostname, csw.hostname]);
      connections.push([edge2.hostname, csw.hostname]);
      connections.push([csw.hostname, dsw.hostname]);
      connections.push([dsw.hostname, asw1.hostname]);
      connections.push([dsw.hostname, asw2.hostname]);
    }
  }

  return { hosts, connections };
};
