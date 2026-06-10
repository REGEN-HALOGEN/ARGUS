// ─── ARGUS Graph Package ─────────────────────────────────────────
// Neo4j graph engine with query service, traversal, and schema management

export { getNeo4jDriver, getSession, testConnection, closeDriver } from './driver';
export { executeQuery, executeReadOnlyQuery, fetchGraphData, searchCVEsFullText } from './queries';
export type { CVESearchResult } from './queries';
export {
  findShortestPath,
  findAllPaths,
  findAttackPathsToCrownJewels,
  getNeighborhood,
  findLateralMovementPaths,
} from './traversal';
export { initializeSchema } from './schema';
