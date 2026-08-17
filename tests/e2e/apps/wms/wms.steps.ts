/**
 * WMS Smart Client — ClickOnce application step definitions.
 *
 * Handles the full ClickOnce lifecycle:
 *   1. Launch via rundll32 dfshim.dll,ShOpenVerbApplication <URL>
 *   2. Handle the "Application Run - Security Warning" popup
 *   3. Wait for the app to download and load
 *   4. Get the window handle by title via PowerShell
 *   5. Create a new Appium session attached to that window
 *
 * Env vars (set in .env):
 *   URL            — ClickOnce deployment URL
 *   WMS_WINDOW_TITLE   — expected window title (default: "IMI Supply Chain Smart Client")
 *   WMS_PROCESS_NAME   — executable name for taskkill (default: "Imi.SupplyChain.UX.SmartClient.exe")
 *   WMS_USER / WMS_PWD — login credentials
 */

import { Given, When, After } from '@cucumber/cucumber';
import { DesktopWorld } from '../../support/world.js';
import { execSync, spawn } from 'child_process';
import { remote } from 'webdriverio';

const WMS_WINDOW_TITLE = process.env.WMS_WINDOW_TITLE || 'IMI Supply Chain Smart Client';
const WMS_PROCESS_NAME = process.env.WMS_PROCESS_NAME || 'Imi.SupplyChain.UX.SmartClient.exe';
const SECURITY_WARNING_TITLE = 'Application Run - Security Warning';
const APPIUM_URL = `http://${process.env.APPIUM_HOST || '127.0.0.1'}:${process.env.APPIUM_PORT || 4723}`;

// ---------------------------------------------------------------------------
// ClickOnce launch helpers
// ---------------------------------------------------------------------------

/**
 * Launch a ClickOnce application via the Windows shell.
 */
function launchClickOnce(url: string): void {
  console.log(`[twintest:wms] Launching ClickOnce app: ${url}`);
  spawn('rundll32', ['dfshim.dll,ShOpenVerbApplication', url], {
    detached: true,
    stdio: 'ignore',
  }).unref();
}

/**
 * Find a window by its exact title and return the hex HWND handle.
 * Uses PowerShell to avoid native dependencies (JNA equivalent).
 * Polls until the window appears or timeout is reached.
 */
async function getWindowHandleByTitle(
  title: string,
  timeoutMs: number = 30000,
  pollMs: number = 2000,
): Promise<string | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const ps = `$p = Get-Process | Where-Object {$_.MainWindowTitle -eq '${title}'} | Select-Object -First 1; if ($p) { $p.MainWindowHandle.ToString('X') } else { '0' }`;
      const result = execSync(`powershell -NoProfile -Command "${ps}"`, {
        encoding: 'utf-8',
        timeout: 10000,
      }).trim();
      if (result && result !== '0') {
        // Pad with leading zeros to match the Java format (e.g., "00190EDC")
        const padded = result.padStart(8, '0');
        console.log(`[twintest:wms] Found window '${title}' → handle 0x${padded}`);
        return padded;
      }
    } catch {
      // Window not found yet — keep polling
    }
    await new Promise(resolve => setTimeout(resolve, pollMs));
  }
  console.warn(`[twintest:wms] Window '${title}' not found within ${timeoutMs}ms`);
  return null;
}

/**
 * Create an Appium session attached to a specific window handle.
 */
async function createSessionForWindow(hexHandle: string): Promise<WebdriverIO.Browser> {
  return remote({
    hostname: process.env.APPIUM_HOST || '127.0.0.1',
    port: Number(process.env.APPIUM_PORT) || 4723,
    path: '/',
    capabilities: {
      platformName: 'Windows',
      'appium:automationName': 'Windows',
      'appium:appTopLevelWindow': hexHandle,
      'appium:newCommandTimeout': 120,
      'appium:connectHardwareKeyboard': true,
    } as any,
  });
}

/**
 * Handle the ClickOnce security warning popup if it appears.
 * Attaches to the warning window, clicks "Run", then waits for the actual app.
 */
async function handleSecurityWarning(): Promise<boolean> {
  const warningHandle = await getWindowHandleByTitle(SECURITY_WARNING_TITLE, 15000, 1000);
  if (!warningHandle) {
    console.log('[twintest:wms] No security warning popup detected — skipping.');
    return false;
  }

  console.log('[twintest:wms] Handling security warning popup...');
  const warningSession = await createSessionForWindow(warningHandle);
  try {
    const runButton = await warningSession.$("//*[@Name='Run']");
    await runButton.waitForExist({ timeout: 10000 });
    await runButton.click();
    console.log('[twintest:wms] Clicked "Run" on security warning. Waiting for app to load...');
  } finally {
    try { await warningSession.deleteSession(); } catch { /* session may auto-close */ }
  }
  return true;
}

/**
 * Force-close the WMS application process.
 */
function forceCloseWMS(): void {
  try {
    execSync(`taskkill /IM ${WMS_PROCESS_NAME} /F`, { stdio: 'ignore' });
    console.log(`[twintest:wms] Force-closed ${WMS_PROCESS_NAME}`);
  } catch {
    // Process may not be running — that's OK
  }
}

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

Given('the WMS Smart Client is launched', async function (this: DesktopWorld) {
  const url = process.env.URL;
  if (!url) {
    throw new Error('URL environment variable is not set. Set it in .env or export it.');
  }

  // 1. Force-close any previous instance
  forceCloseWMS();
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 2. Launch via ClickOnce
  launchClickOnce(url);

  // 3. Wait for the app to start downloading
  await new Promise(resolve => setTimeout(resolve, 10000));

  // 4. Handle security warning if present
  const warningHandled = await handleSecurityWarning();
  if (warningHandled) {
    // Extra wait after clicking "Run" — app needs to download
    await new Promise(resolve => setTimeout(resolve, 60000));
  }

  // 5. Get the main app window handle
  const appHandle = await getWindowHandleByTitle(WMS_WINDOW_TITLE, 60000, 3000);
  if (!appHandle) {
    throw new Error(
      `WMS app window '${WMS_WINDOW_TITLE}' did not appear within timeout. ` +
      `Check that URL is correct and the app is accessible.`,
    );
  }

  // 6. Create a new Appium session attached to the app window
  const appSession = await createSessionForWindow(appHandle);

  // 7. Re-initialize the world with the new session
  this.init(appSession as any);
  this.activeWindow = 'LoginPage';

  // 8. Populate context with credentials (mirrors Java processWMSCredentials)
  const username = process.env.WMS_USER;
  const password = process.env.WMS_PWD;
  if (username) this.context['username'] = username;
  if (password) this.context['password'] = password;
  if (process.env.DC_NAME) this.context['dcName'] = process.env.DC_NAME;
  if (process.env.DB_URL) this.context['DB_URL'] = process.env.DB_URL;
  if (process.env.GLN) this.context['GLN'] = process.env.GLN;

  console.log('[twintest:wms] WMS Smart Client is ready.');
});

Given('I log in to WMS', async function (this: DesktopWorld) {
  const username = process.env.WMS_USER;
  const password = process.env.WMS_PWD;
  if (!username || !password) {
    throw new Error('WMS_USER and WMS_PWD environment variables must be set.');
  }

  this.activeWindow = 'LoginPage';
  await this.steps.clearAndType('LoginPage', 'usernameInput', username);
  await this.steps.clearAndType('LoginPage', 'passwordInput', password);
  await this.steps.click('LoginPage', 'loginButton');
  console.log('[twintest:wms] Login submitted.');

  // Wait for the main application to load
  await new Promise(resolve => setTimeout(resolve, 20000));

  // Switch to the next active window (post-login the app may switch windows)
  try {
    const handles = await this.steps.driver.getWindowHandles();
    if (handles.length > 1) {
      await this.steps.driver.switchToWindow(handles[handles.length - 1]);
    }
  } catch {
    // Single window — stay on current
  }

  // Handle "Change User Settings" popup if it appears
  try {
    await this.steps.click('ChangeUserSettingsPage', 'okButton');
    console.log('[twintest:wms] Dismissed Change User Settings popup.');
  } catch {
    // Popup didn't appear — that's fine
  }

  this.activeWindow = 'LeftPanelMenuPage';
});

Given('I log in to WMS with username {string} and password {string}', async function (
  this: DesktopWorld,
  username: string,
  password: string,
) {
  this.activeWindow = 'LoginPage';
  await this.steps.clearAndType('LoginPage', 'usernameInput', username);
  await this.steps.clearAndType('LoginPage', 'passwordInput', password);
  await this.steps.click('LoginPage', 'loginButton');
  console.log('[twintest:wms] Login submitted.');

  await new Promise(resolve => setTimeout(resolve, 20000));

  try {
    const handles = await this.steps.driver.getWindowHandles();
    if (handles.length > 1) {
      await this.steps.driver.switchToWindow(handles[handles.length - 1]);
    }
  } catch {
    // Single window
  }

  try {
    await this.steps.click('ChangeUserSettingsPage', 'okButton');
  } catch {
    // Popup didn't appear
  }

  this.activeWindow = 'LeftPanelMenuPage';
});

Given('Reattach to the WMS application', async function (this: DesktopWorld) {
  // After login or window transitions, the app may have a new top-level window.
  // Re-discover the handle and create a fresh Appium session attached to it.
  const appHandle = await getWindowHandleByTitle(WMS_WINDOW_TITLE, 30000, 2000);
  if (!appHandle) {
    throw new Error(`WMS window '${WMS_WINDOW_TITLE}' not found after transition.`);
  }

  // Terminate old session gracefully
  try { await this.steps.driver.deleteSession(); } catch { /* may already be gone */ }

  // Create fresh session on the new handle
  const appSession = await createSessionForWindow(appHandle);
  this.init(appSession as any);

  // Update global browser reference so WDIO's session cleanup doesn't fail
  Object.assign(browser, { sessionId: (appSession as any).sessionId });

  this.activeWindow = 'LeftPanelMenuPage';
  console.log(`[twintest:wms] Reattached to WMS window → handle 0x${appHandle}`);
});

When('I navigate to {string} via the left panel', async function (
  this: DesktopWorld,
  menuItem: string,
) {
  const menuMap: Record<string, string> = {
    warehouse: 'warehouseButton',
    'warehouse gateway': 'warehouseGatewayButton',
    transportation: 'transportationButton',
    'output manager': 'outputManagerButton',
    dock: 'dockButton',
  };

  const elementName = menuMap[menuItem.toLowerCase()];
  if (!elementName) {
    throw new Error(
      `Unknown menu item: '${menuItem}'. Available: ${Object.keys(menuMap).join(', ')}`,
    );
  }

  await this.steps.click('LeftPanelMenuPage', elementName);

  // Handle "Change User Settings" popup that may appear after navigation
  try {
    await this.steps.click('ChangeUserSettingsPage', 'okButton');
  } catch {
    // No popup
  }
});

// ---------------------------------------------------------------------------
// Cleanup — force-close WMS after each scenario
// ---------------------------------------------------------------------------

After({ tags: '@App-WMS' }, async function () {
  forceCloseWMS();
  console.log('[twintest:wms] WMS cleanup complete.');
});
