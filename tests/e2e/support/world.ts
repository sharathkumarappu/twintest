/**
 * Cucumber World — injects DesktopSteps, ElementRepository, and the WDIO
 * driver into every step definition via `this`.
 */

import { World, IWorldOptions, setWorldConstructor } from '@cucumber/cucumber';
import { ElementRepository } from '../../../src/ElementRepository.js';
import { DesktopSteps } from '../../../src/DesktopSteps.js';
import { Database } from '../../../src/utilities/Database.js';
import path from 'path';

const DEFAULT_REPO_PATH = path.resolve(
  process.cwd(),
  'tests/e2e/data/app-repository.json',
);

export class DesktopWorld extends World {
  steps!: DesktopSteps;
  repo!: ElementRepository;

  /**
   * The active window name in the app-repository.
   * Set via APP_WINDOW env var, or overridden per-feature with
   * "Given the active window is {string}".
   * All step definitions that don't explicitly specify a window use this.
   */
  activeWindow!: string;

  /**
   * Context store — in-memory key-value store for passing data between steps.
   * Mirrors the Pickleib ContextStore pattern. Values can be referenced in
   * feature files with the CONTEXT- prefix (e.g., "CONTEXT-username").
   */
  context: Record<string, string> = {};

  /**
   * Database context store — holds complex query results (row arrays, objects)
   * that cannot be represented as plain strings. Used by database step
   * definitions for multi-row SELECT results and extracted column values.
   */
  dbContext: Record<string, unknown> = {};

  /**
   * Database API — lazy-initialized on first use so UI-only scenarios
   * incur no DB overhead. Shares the context and dbContext stores.
   */
  private _db?: Database;
  get db(): Database {
    if (!this._db) {
      this._db = new Database(this.context, this.dbContext);
    }
    return this._db;
  }

  constructor(options: IWorldOptions) {
    super(options);
  }

  /**
   * Resolve a value that may be a CONTEXT- reference.
   * If the value starts with "CONTEXT-", look it up in the context store.
   * Otherwise, return it as-is.
   */
  contextCheck(value: string): string {
    if (value.startsWith('CONTEXT-')) {
      const key = value.substring(8);
      const resolved = this.context[key];
      if (resolved === undefined) {
        throw new Error(`Context key '${key}' not found. Available: ${Object.keys(this.context).join(', ')}`);
      }
      return resolved;
    }
    return value;
  }

  /**
   * Initialize the world with the current WDIO browser instance.
   * Called from the Before hook once the driver session is active.
   */
  init(driver: WebdriverIO.Browser): void {
    const repoPath = process.env.APP_REPO_PATH || DEFAULT_REPO_PATH;
    this.repo = new ElementRepository(repoPath);
    this.steps = new DesktopSteps(driver, this.repo, {
      timeout: Number(process.env.ELEMENT_TIMEOUT) || 10000,
    });
    // Default active window — first window in the repository, or env override
    this.activeWindow = process.env.APP_WINDOW || this.repo.getWindows()[0] || 'MainWindow';
  }
}

// Register DesktopWorld as the Cucumber World constructor so that `this`
// in all hooks and step definitions is a DesktopWorld instance at runtime.
setWorldConstructor(DesktopWorld);
