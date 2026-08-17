/**
 * @twintest/framework — public API
 */
export { ElementRepository } from './ElementRepository.js';
export type {
  ElementSelector,
  ElementEntry,
  WindowEntry,
  AppRepository,
  ResolvedLocator,
} from './ElementRepository.js';

export { DesktopSteps } from './DesktopSteps.js';

export { Database } from './utilities/Database.js';
export type { ContextStore, DbContextStore } from './utilities/Database.js';
export {
  sqlLiteral,
  sqlNumber,
  sqlIdentifier,
  sqlProcedureName,
  getConnection,
  getConnectionConfig,
} from './utilities/DatabaseUtility.js';
export type { DbConnectionConfig } from './utilities/DatabaseUtility.js';
