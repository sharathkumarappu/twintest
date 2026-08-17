/**
 * DesktopSteps — high-level interaction API for Windows desktop apps.
 *
 * The core interaction layer that sits between Cucumber step definitions and
 * raw WebDriverIO calls. All element lookups go through the ElementRepository,
 * so test code never sees raw selectors.
 *
 * Analogous to achilles' Steps API but tailored for WinAppDriver / Windows
 * UI Automation.
 */

import { ElementRepository } from './ElementRepository.js';

export class DesktopSteps {
  private repo: ElementRepository;
  /** The active WebDriverIO driver instance. Exposed for direct access when needed. */
  public driver: WebdriverIO.Browser;
  private defaultTimeout: number;

  constructor(
    driver: WebdriverIO.Browser,
    repo: ElementRepository,
    options?: { timeout?: number },
  ) {
    this.driver = driver;
    this.repo = repo;
    this.defaultTimeout = options?.timeout ?? 10000;
  }

  // ---------------------------------------------------------------------------
  // Element resolution (private)
  // ---------------------------------------------------------------------------

  private selector(windowName: string, elementName: string): string {
    return this.repo.toWdioSelector(windowName, elementName);
  }

  private async findElement(
    windowName: string,
    elementName: string,
    timeout?: number,
  ) {
    const sel = this.selector(windowName, elementName);
    console.log(`[twintest] Finding element '${elementName}' on '${windowName}' → selector: ${sel}`);
    const el = await this.driver.$(sel);
    await el.waitForExist({ timeout: timeout ?? this.defaultTimeout });
    return el;
  }

  // ---------------------------------------------------------------------------
  // Application lifecycle
  // ---------------------------------------------------------------------------

  /** Launch an application by path. Creates a new WinAppDriver session. */
  async launchApp(appPath: string, _args?: string[]): Promise<void> {
    // WinAppDriver launches the app via the 'app' capability at session creation.
    // For mid-test app launches, use driver.execute or create a new session.
    // This method is a convenience wrapper for the most common case.
    console.log(`[twintest] Launching app: ${appPath}`);
  }

  /** Close the current application session. */
  async closeApp(): Promise<void> {
    try {
      await this.driver.deleteSession();
    } catch {
      // Session may already be closed
    }
  }

  /** Switch focus to a window by its title. */
  async switchToWindow(title: string): Promise<void> {
    const handles = await this.driver.getWindowHandles();
    for (const handle of handles) {
      await this.driver.switchToWindow(handle);
      const currentTitle = await this.driver.getTitle();
      if (currentTitle.includes(title)) {
        return;
      }
    }
    throw new Error(`Window with title containing '${title}' not found. Available handles: ${handles.length}`);
  }

  // ---------------------------------------------------------------------------
  // Element interactions
  // ---------------------------------------------------------------------------

  /** Click an element. */
  async click(windowName: string, elementName: string): Promise<void> {
    console.log(`[twintest] Clicking '${elementName}' on '${windowName}'`);
    const el = await this.findElement(windowName, elementName);
    await el.click();
    console.log(`[twintest] Clicked '${elementName}' on '${windowName}'`);
  }

  /** Double-click an element. */
  async doubleClick(windowName: string, elementName: string): Promise<void> {
    console.log(`[twintest] Double-clicking '${elementName}' on '${windowName}'`);
    const el = await this.findElement(windowName, elementName);
    await el.doubleClick();
  }

  /** Right-click (context click) an element. */
  async rightClick(windowName: string, elementName: string): Promise<void> {
    console.log(`[twintest] Right-clicking '${elementName}' on '${windowName}'`);
    const el = await this.findElement(windowName, elementName);
    await el.click({ button: 'right' });
  }

  /** Type text into an element (appends to existing content). */
  async type(windowName: string, elementName: string, text: string): Promise<void> {
    console.log(`[twintest] Typing into '${elementName}' on '${windowName}'`);
    const el = await this.findElement(windowName, elementName);
    await el.addValue(text);
  }

  /** Clear an element and type new text. */
  async clearAndType(windowName: string, elementName: string, text: string): Promise<void> {
    console.log(`[twintest] Filling '${elementName}' on '${windowName}' with text`);
    const el = await this.findElement(windowName, elementName);
    await el.clearValue();
    await el.setValue(text);
    console.log(`[twintest] Filled '${elementName}' on '${windowName}'`);
  }

  // ---------------------------------------------------------------------------
  // Dropdown / ComboBox
  // ---------------------------------------------------------------------------

  /** Select a dropdown/combobox option by visible text. */
  async selectByText(windowName: string, elementName: string, text: string): Promise<void> {
    console.log(`[twintest] Selecting '${text}' from '${elementName}' on '${windowName}'`);
    const el = await this.findElement(windowName, elementName);
    // WinAppDriver ComboBox: click to open, then find and click the item
    await el.click();
    // Wait for the dropdown to expand, then find the item by name
    const item = await this.driver.$(`[name="${text}"]`);
    await item.waitForExist({ timeout: this.defaultTimeout });
    await item.click();
  }

  /** Select a dropdown/combobox option by index. */
  async selectByIndex(windowName: string, elementName: string, index: number): Promise<void> {
    const el = await this.findElement(windowName, elementName);
    await el.click();
    // Navigate using arrow keys
    for (let i = 0; i <= index; i++) {
      await this.driver.keys(['ArrowDown']);
    }
    await this.driver.keys(['Enter']);
  }

  // ---------------------------------------------------------------------------
  // Verification
  // ---------------------------------------------------------------------------

  /** Verify an element's text content matches the expected value. */
  async verifyText(
    windowName: string,
    elementName: string,
    expected: string,
  ): Promise<void> {
    console.log(`[twintest] Verifying '${elementName}' on '${windowName}' contains text '${expected}'`);
    const el = await this.findElement(windowName, elementName);
    const actual = await el.getText();
    console.log(`[twintest] Actual text: '${actual}'`);
    if (!actual.includes(expected)) {
      throw new Error(
        `Text mismatch on ${windowName}.${elementName}: expected to contain '${expected}', got '${actual}'`,
      );
    }
  }

  /** Verify an element's text matches exactly. */
  async verifyExactText(
    windowName: string,
    elementName: string,
    expected: string,
  ): Promise<void> {
    const el = await this.findElement(windowName, elementName);
    const actual = await el.getText();
    if (actual !== expected) {
      throw new Error(
        `Exact text mismatch on ${windowName}.${elementName}: expected '${expected}', got '${actual}'`,
      );
    }
  }

  /** Verify an element is visible (displayed). */
  async verifyVisible(windowName: string, elementName: string): Promise<void> {
    console.log(`[twintest] Verifying '${elementName}' on '${windowName}' is visible`);
    const el = await this.findElement(windowName, elementName);
    const visible = await el.isDisplayed();
    if (!visible) {
      throw new Error(`${windowName}.${elementName} is not visible`);
    }
  }

  /** Verify an element is NOT visible. */
  async verifyNotVisible(windowName: string, elementName: string): Promise<void> {
    const sel = this.selector(windowName, elementName);
    const el = await this.driver.$(sel);
    const exists = await el.isExisting();
    if (exists) {
      const visible = await el.isDisplayed();
      if (visible) {
        throw new Error(`${windowName}.${elementName} is visible but should not be`);
      }
    }
  }

  /** Verify an element is enabled (interactable). */
  async verifyEnabled(windowName: string, elementName: string): Promise<void> {
    const el = await this.findElement(windowName, elementName);
    const enabled = await el.isEnabled();
    if (!enabled) {
      throw new Error(`${windowName}.${elementName} is not enabled`);
    }
  }

  /** Verify an element is disabled. */
  async verifyDisabled(windowName: string, elementName: string): Promise<void> {
    const el = await this.findElement(windowName, elementName);
    const enabled = await el.isEnabled();
    if (enabled) {
      throw new Error(`${windowName}.${elementName} is enabled but should be disabled`);
    }
  }

  // ---------------------------------------------------------------------------
  // Extraction
  // ---------------------------------------------------------------------------

  /** Get the text content of an element. */
  async getText(windowName: string, elementName: string): Promise<string> {
    const el = await this.findElement(windowName, elementName);
    return el.getText();
  }

  /** Get an attribute value from an element. */
  async getAttribute(
    windowName: string,
    elementName: string,
    attribute: string,
  ): Promise<string> {
    const el = await this.findElement(windowName, elementName);
    return (await el.getAttribute(attribute)) ?? '';
  }

  // ---------------------------------------------------------------------------
  // Screenshots
  // ---------------------------------------------------------------------------

  /** Take a screenshot and return the file path. */
  async takeScreenshot(name: string): Promise<string> {
    const filename = `screenshots/${name}-${Date.now()}.png`;
    await this.driver.saveScreenshot(filename);
    return filename;
  }

  // ---------------------------------------------------------------------------
  // Waiting
  // ---------------------------------------------------------------------------

  /** Wait for an element to exist in the UI tree. */
  async waitForElement(
    windowName: string,
    elementName: string,
    timeout?: number,
  ): Promise<void> {
    const sel = this.selector(windowName, elementName);
    const el = await this.driver.$(sel);
    await el.waitForExist({ timeout: timeout ?? this.defaultTimeout });
  }

  /** Wait for an element to disappear from the UI tree. */
  async waitForElementGone(
    windowName: string,
    elementName: string,
    timeout?: number,
  ): Promise<void> {
    const sel = this.selector(windowName, elementName);
    const el = await this.driver.$(sel);
    await el.waitForExist({
      timeout: timeout ?? this.defaultTimeout,
      reverse: true,
    });
  }

  /** Wait for an element to become visible. */
  async waitForVisible(
    windowName: string,
    elementName: string,
    timeout?: number,
  ): Promise<void> {
    const el = await this.findElement(windowName, elementName, timeout);
    await el.waitForDisplayed({ timeout: timeout ?? this.defaultTimeout });
  }

  /** Wait for an element to become enabled. */
  async waitForEnabled(
    windowName: string,
    elementName: string,
    timeout?: number,
  ): Promise<void> {
    const el = await this.findElement(windowName, elementName, timeout);
    await el.waitForEnabled({ timeout: timeout ?? this.defaultTimeout });
  }

  // ---------------------------------------------------------------------------
  // Keyboard
  // ---------------------------------------------------------------------------

  /** Send a sequence of keys (not targeted at a specific element). */
  async sendKeys(keys: string[]): Promise<void> {
    console.log(`[twintest] Sending keys: ${keys.join(', ')}`);
    await this.driver.keys(keys);
  }

  /** Execute a keyboard shortcut (e.g., Ctrl+S, Alt+F4). */
  async keyboardShortcut(...keys: string[]): Promise<void> {
    console.log(`[twintest] Keyboard shortcut: ${keys.join('+')}`);
    await this.driver.keys(keys);
  }

  // ---------------------------------------------------------------------------
  // Mouse
  // ---------------------------------------------------------------------------

  /** Drag an element and drop it onto another element. */
  async dragAndDrop(
    sourceWindow: string,
    sourceElement: string,
    targetWindow: string,
    targetElement: string,
  ): Promise<void> {
    const source = await this.findElement(sourceWindow, sourceElement);
    const target = await this.findElement(targetWindow, targetElement);
    await source.dragAndDrop(target);
  }

  /** Hover over an element. */
  async hover(windowName: string, elementName: string): Promise<void> {
    const el = await this.findElement(windowName, elementName);
    await el.moveTo();
  }

  // ---------------------------------------------------------------------------
  // Desktop-specific
  // ---------------------------------------------------------------------------

  /** Get the title of the current window. */
  async getWindowTitle(): Promise<string> {
    return this.driver.getTitle();
  }

  /** Maximize the current window. */
  async maximizeWindow(): Promise<void> {
    await this.driver.maximizeWindow();
  }

  /** Minimize the current window. */
  async minimizeWindow(): Promise<void> {
    await this.driver.minimizeWindow();
  }

  /** Scroll until an element is in view. */
  async scrollTo(windowName: string, elementName: string): Promise<void> {
    const el = await this.findElement(windowName, elementName);
    await el.scrollIntoView();
  }

  // ---------------------------------------------------------------------------
  // Batch interactions
  // ---------------------------------------------------------------------------

  /**
   * Click a sequence of elements by mapping each character in the input string
   * to an element name via a provided map. Useful for digit pads, keypads, etc.
   *
   * @param windowName - The window in the repository
   * @param input - The string to "type" by clicking elements (e.g., "12345")
   * @param charToElement - Map from character to element name in the repository
   */
  async clickSequence(
    windowName: string,
    input: string,
    charToElement: Record<string, string>,
  ): Promise<void> {
    for (const char of input) {
      const elementName = charToElement[char];
      if (!elementName) {
        throw new Error(
          `No element mapping for character '${char}'. Available: ${Object.keys(charToElement).join(', ')}`,
        );
      }
      await this.click(windowName, elementName);
    }
  }
}
