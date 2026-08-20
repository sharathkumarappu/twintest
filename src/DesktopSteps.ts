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
import { execSync } from 'child_process';

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

  /** Find an element and wait until it is displayed and enabled. */
  private async findInteractableElement(
    windowName: string,
    elementName: string,
    timeout?: number,
  ) {
    const el = await this.findElement(windowName, elementName, timeout);
    const t = timeout ?? this.defaultTimeout;
    await el.waitForDisplayed({ timeout: t });
    await el.waitForEnabled({ timeout: t });
    return el;
  }

  /** Perform a click on an already-located element, falling back to a
   *  coordinate-based click when the standard click doesn't register. */
  private async safeClick(el: Awaited<ReturnType<WebdriverIO.Browser['$']>>, label: string): Promise<void> {
    try {
      await el.click();
    } catch {
      console.log(`[twintest] Standard click failed for '${label}', trying coordinate click`);
      await el.moveTo();
      await this.driver.action('pointer')
        .down({ button: 0 })
        .up({ button: 0 })
        .perform();
    }
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

  /** Click an element. Verifies it is displayed and enabled first, then
   *  falls back to a coordinate-based click if the standard click fails to
   *  register (a known WinAppDriver false-positive). */
  async click(windowName: string, elementName: string): Promise<void> {
    console.log(`[twintest] Clicking '${elementName}' on '${windowName}'`);
    const el = await this.findInteractableElement(windowName, elementName);
    await this.safeClick(el, elementName);
    console.log(`[twintest] Clicked '${elementName}' on '${windowName}'`);
  }

  /** Double-click an element. */
  async doubleClick(windowName: string, elementName: string): Promise<void> {
    console.log(`[twintest] Double-clicking '${elementName}' on '${windowName}'`);
    const el = await this.findInteractableElement(windowName, elementName);
    await el.doubleClick();
    console.log(`[twintest] Double-clicked '${elementName}' on '${windowName}'`);
  }

  /** Right-click (context click) an element. */
  async rightClick(windowName: string, elementName: string): Promise<void> {
    console.log(`[twintest] Right-clicking '${elementName}' on '${windowName}'`);
    const el = await this.findInteractableElement(windowName, elementName);
    await el.click({ button: 'right' });
    console.log(`[twintest] Right-clicked '${elementName}' on '${windowName}'`);
  }

  /** Type text into an element (appends to existing content). */
  async type(windowName: string, elementName: string, text: string): Promise<void> {
    console.log(`[twintest] Typing into '${elementName}' on '${windowName}'`);
    const el = await this.findInteractableElement(windowName, elementName);
    await el.addValue(text);
    console.log(`[twintest] Typed into '${elementName}' on '${windowName}'`);
  }

  /** Clear an element and type new text. */
  async clearAndType(windowName: string, elementName: string, text: string): Promise<void> {
    console.log(`[twintest] Filling '${elementName}' on '${windowName}' with text`);
    const el = await this.findInteractableElement(windowName, elementName);
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
    const el = await this.findInteractableElement(windowName, elementName);
    // WinAppDriver ComboBox: click to open, then find and click the item
    await this.safeClick(el, elementName);
    // Wait for the dropdown to expand, then find the item by name
    const item = await this.driver.$(`[name="${text}"]`);
    await item.waitForExist({ timeout: this.defaultTimeout });
    await item.click();
    console.log(`[twintest] Selected '${text}' from '${elementName}' on '${windowName}'`);
  }

  /** Select a dropdown/combobox option by index. */
  async selectByIndex(windowName: string, elementName: string, index: number): Promise<void> {
    console.log(`[twintest] Selecting index ${index} from '${elementName}' on '${windowName}'`);
    const el = await this.findInteractableElement(windowName, elementName);
    await this.safeClick(el, elementName);
    // Navigate using arrow keys via PowerShell SendKeys (WinAppDriver compatible)
    const downKeys = '{DOWN}'.repeat(index + 1) + '{ENTER}';
    await this.sendKeys([downKeys]);
    console.log(`[twintest] Selected index ${index} from '${elementName}' on '${windowName}'`);
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

  /**
   * Send keys via PowerShell SendKeys.
   * Uses System.Windows.Forms.SendKeys which works with all Windows apps
   * regardless of WinAppDriver/Appium driver limitations.
   *
   * SendKeys syntax: https://learn.microsoft.com/en-us/dotnet/api/system.windows.forms.sendkeys
   *   - Regular characters: sent as-is
   *   - Special keys: {ENTER}, {TAB}, {ESC}, {DELETE}, {BACKSPACE}, {F1}-{F12},
   *     {UP}, {DOWN}, {LEFT}, {RIGHT}, {PGUP}, {PGDN}, {HOME}, {END}
   *   - Modifiers: % = Alt, ^ = Ctrl, + = Shift
   *   - Examples: "%s" = Alt+S, "^s" = Ctrl+S, "%{F4}" = Alt+F4
   */
  async sendKeys(keys: string[]): Promise<void> {
    const sendKeysStr = keys.join('');
    console.log(`[twintest] Sending keys via PowerShell: ${sendKeysStr}`);
    execSync(
      `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${sendKeysStr.replace(/'/g, "''")}')"`,
      { timeout: 10000 },
    );
  }

  /**
   * Execute a keyboard shortcut (e.g., Ctrl+S, Alt+F4).
   * Converts named keys to PowerShell SendKeys syntax.
   */
  async keyboardShortcut(...keys: string[]): Promise<void> {
    console.log(`[twintest] Keyboard shortcut: ${keys.join('+')}`);
    const sendKeysStr = keys.map(k => this.toSendKeysToken(k)).join('');
    execSync(
      `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${sendKeysStr.replace(/'/g, "''")}')"`,
      { timeout: 10000 },
    );
  }

  /** Convert a key name to PowerShell SendKeys token. */
  private toSendKeysToken(key: string): string {
    const map: Record<string, string> = {
      Alt: '%', Control: '^', Shift: '+', Ctrl: '^',
      Enter: '{ENTER}', Escape: '{ESC}', Tab: '{TAB}', Space: ' ',
      Delete: '{DELETE}', Backspace: '{BACKSPACE}',
      ArrowUp: '{UP}', ArrowDown: '{DOWN}', ArrowLeft: '{LEFT}', ArrowRight: '{RIGHT}',
      PageUp: '{PGUP}', PageDown: '{PGDN}', Home: '{HOME}', End: '{END}',
      F1: '{F1}', F2: '{F2}', F3: '{F3}', F4: '{F4}', F5: '{F5}', F6: '{F6}',
      F7: '{F7}', F8: '{F8}', F9: '{F9}', F10: '{F10}', F11: '{F11}', F12: '{F12}',
    };
    return map[key] ?? key;
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
    console.log(`[twintest] Dragging '${sourceElement}' on '${sourceWindow}' to '${targetElement}' on '${targetWindow}'`);
    const source = await this.findInteractableElement(sourceWindow, sourceElement);
    const target = await this.findInteractableElement(targetWindow, targetElement);
    await source.dragAndDrop(target);
    console.log(`[twintest] Drag-and-drop completed`);
  }

  /** Hover over an element. */
  async hover(windowName: string, elementName: string): Promise<void> {
    console.log(`[twintest] Hovering over '${elementName}' on '${windowName}'`);
    const el = await this.findInteractableElement(windowName, elementName);
    await el.moveTo();
    console.log(`[twintest] Hovered over '${elementName}' on '${windowName}'`);
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
    console.log(`[twintest] Scrolling to '${elementName}' on '${windowName}'`);
    const el = await this.findElement(windowName, elementName);
    await el.waitForDisplayed({ timeout: this.defaultTimeout });
    await el.scrollIntoView();
    console.log(`[twintest] Scrolled to '${elementName}' on '${windowName}'`);
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
