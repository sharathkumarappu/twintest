/**
 * ElementRepository — JSON-driven element locator resolution for Windows desktop apps.
 *
 * Decouples element acquisition from element interaction. Tests reference elements
 * by plain strings ('MainWindow.fileMenu', 'CalculatorWindow.digitSeven'); raw
 * selectors never appear in test code.
 *
 * Locator strategies (priority order):
 *   1. automationId  — UIA AutomationId (most stable, equivalent to data-testid)
 *   2. accessibilityId — maps to AutomationId in WinAppDriver
 *   3. name          — UIA Name property
 *   4. className     — UIA ClassName
 *   5. xpath         — XPath against the UI Automation tree
 */

import fs from 'fs';
import path from 'path';

export interface ElementSelector {
  automationId?: string;
  accessibilityId?: string;
  name?: string;
  className?: string;
  xpath?: string;
}

export interface ElementEntry {
  elementName: string;
  selector: ElementSelector;
  description?: string;
}

export interface WindowEntry {
  name: string;
  description?: string;
  elements: ElementEntry[];
}

export interface AppRepository {
  windows: WindowEntry[];
}

/** WinAppDriver-compatible locator strategy + value pair */
export interface ResolvedLocator {
  strategy: string;
  value: string;
}

// Strategy priority — most stable first
const STRATEGY_PRIORITY: Array<{
  key: keyof ElementSelector;
  wdioStrategy: string;
}> = [
  { key: 'automationId', wdioStrategy: 'accessibility id' },
  { key: 'accessibilityId', wdioStrategy: 'accessibility id' },
  { key: 'name', wdioStrategy: 'name' },
  { key: 'className', wdioStrategy: 'class name' },
  { key: 'xpath', wdioStrategy: 'xpath' },
];

export class ElementRepository {
  private repository: AppRepository;
  private windowMap: Map<string, WindowEntry> = new Map();
  private elementCache: Map<string, ElementEntry> = new Map();

  constructor(repositoryPath: string) {
    const absPath = path.isAbsolute(repositoryPath)
      ? repositoryPath
      : path.resolve(process.cwd(), repositoryPath);

    if (!fs.existsSync(absPath)) {
      throw new Error(`App repository not found at: ${absPath}`);
    }

    const raw = fs.readFileSync(absPath, 'utf-8');
    this.repository = JSON.parse(raw) as AppRepository;
    this.buildIndex();
  }

  private buildIndex(): void {
    for (const window of this.repository.windows) {
      this.windowMap.set(window.name, window);
      for (const element of window.elements) {
        const key = `${window.name}.${element.elementName}`;
        this.elementCache.set(key, element);
      }
    }
  }

  /**
   * Resolve a window.element reference to a WinAppDriver-compatible locator.
   *
   * @param windowName - The window name in the repository
   * @param elementName - The element name within that window
   * @param preferredStrategy - Override the default priority order
   * @returns ResolvedLocator with strategy and value
   */
  resolve(
    windowName: string,
    elementName: string,
    preferredStrategy?: keyof ElementSelector,
  ): ResolvedLocator {
    const key = `${windowName}.${elementName}`;
    const entry = this.elementCache.get(key);

    if (!entry) {
      const window = this.windowMap.get(windowName);
      if (!window) {
        throw new Error(
          `Window '${windowName}' not found in repository. Available: ${[...this.windowMap.keys()].join(', ')}`,
        );
      }
      const available = window.elements.map(e => e.elementName).join(', ');
      throw new Error(
        `Element '${elementName}' not found in window '${windowName}'. Available: ${available}`,
      );
    }

    // If a preferred strategy is specified and present, use it
    if (preferredStrategy && entry.selector[preferredStrategy]) {
      const strategyDef = STRATEGY_PRIORITY.find(s => s.key === preferredStrategy);
      if (strategyDef) {
        return {
          strategy: strategyDef.wdioStrategy,
          value: entry.selector[preferredStrategy]!,
        };
      }
    }

    // Otherwise, use priority order
    for (const { key: stratKey, wdioStrategy } of STRATEGY_PRIORITY) {
      const value = entry.selector[stratKey];
      if (value) {
        return { strategy: wdioStrategy, value };
      }
    }

    throw new Error(
      `Element '${key}' has no usable selector. Provide at least one of: automationId, accessibilityId, name, className, xpath`,
    );
  }

  /**
   * Convert a resolved locator to a WebDriverIO selector string.
   * WinAppDriver uses the 'using'/'value' protocol; WebDriverIO maps
   * some strategies to shorthand selectors.
   */
  toWdioSelector(windowName: string, elementName: string): string {
    const { strategy, value } = this.resolve(windowName, elementName);

    switch (strategy) {
      case 'accessibility id':
        return `~${value}`;
      case 'name':
        // WinAppDriver supports 'name' via XPath — CSS [name=] is not supported
        return `//*[@Name='${value}']`;
      case 'class name':
        // WinAppDriver does not support CSS selectors — use XPath for ClassName
        return `//*[@ClassName='${value}']`;
      case 'xpath':
        return value; // XPath is passed through directly
      default:
        return value;
    }
  }

  /** List all windows in the repository. */
  getWindows(): string[] {
    return [...this.windowMap.keys()];
  }

  /** List all elements for a given window. */
  getElements(windowName: string): string[] {
    const window = this.windowMap.get(windowName);
    if (!window) return [];
    return window.elements.map(e => e.elementName);
  }

  /** Get the raw element entry for advanced use cases. */
  getEntry(windowName: string, elementName: string): ElementEntry | undefined {
    return this.elementCache.get(`${windowName}.${elementName}`);
  }

  /** Reload the repository from disk (useful after runtime edits). */
  reload(repositoryPath: string): void {
    const absPath = path.isAbsolute(repositoryPath)
      ? repositoryPath
      : path.resolve(process.cwd(), repositoryPath);

    const raw = fs.readFileSync(absPath, 'utf-8');
    this.repository = JSON.parse(raw) as AppRepository;
    this.windowMap.clear();
    this.elementCache.clear();
    this.buildIndex();
  }
}
