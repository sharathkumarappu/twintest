/**
 * WMS Smart Client — step definitions for login, navigation, and reattach.
 *
 * App launching and cleanup are handled by tag-based Before/After hooks
 * in hooks.ts (triggered by @App-WMS tag on feature files).
 *
 * Env vars (set in .env):
 *   WMS_USER / WMS_PWD — login credentials
 */

import { Given, When } from '@cucumber/cucumber';
import { DesktopWorld } from '../../support/world.js';
import {
  getWindowHandleByTitle,
  createSessionForWindow,
  WMS_WINDOW_TITLE,
} from './wms-launch.js';
import { waitSeconds } from '../../../../src/utilities/wait.js';

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

Given('I log in to WMS', async function (this: DesktopWorld) {
  console.log('[twintest:wms] Logging in to WMS');
  const username = process.env.WMS_USER;
  const password = process.env.WMS_PWD;
  if (!username || !password) {
    throw new Error('WMS_USER and WMS_PWD environment variables must be set.');
  }

  this.activeWindow = 'LoginPage';
  await this.steps.clearAndType('LoginPage', 'UsernameInput', username);
  await this.steps.clearAndType('LoginPage', 'PasswordInput', password);
  await this.steps.click('LoginPage', 'LoginButton');
  console.log('[twintest:wms] Login submitted.');

  // Wait for the main application to load
  await waitSeconds(20);

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
    await this.steps.click('ChangeUserSettingsPage', 'OKButton');
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
  console.log(`[twintest:wms] Logging in to WMS with username '${username}'`);
  this.activeWindow = 'LoginPage';
  await this.steps.clearAndType('LoginPage', 'UsernameInput', username);
  await this.steps.clearAndType('LoginPage', 'PasswordInput', password);
  await this.steps.click('LoginPage', 'LoginButton');
  console.log('[twintest:wms] Login submitted.');

  await waitSeconds(20);

  try {
    const handles = await this.steps.driver.getWindowHandles();
    if (handles.length > 1) {
      await this.steps.driver.switchToWindow(handles[handles.length - 1]);
    }
  } catch {
    // Single window
  }

  try {
    await this.steps.click('ChangeUserSettingsPage', 'OKButton');
  } catch {
    // Popup didn't appear
  }

  this.activeWindow = 'LeftPanelMenuPage';
});

Given('Reattach to the WMS application', async function (this: DesktopWorld) {
  console.log('[twintest:wms] Reattaching to the WMS application');
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
  console.log(`[twintest:wms] Reattached to WMS window -> handle 0x${appHandle}`);
});

When('I navigate to {string} via the left panel', async function (
  this: DesktopWorld,
  menuItem: string,
) {
  console.log(`[twintest:wms] Navigating to '${menuItem}' via the left panel`);
  const menuMap: Record<string, string> = {
    warehouse: 'WarehouseButton',
    'warehouse gateway': 'WarehouseGatewayButton',
    transportation: 'TransportationButton',
    'output manager': 'OutputManagerButton',
    dock: 'DockButton',
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
    await this.steps.click('ChangeUserSettingsPage', 'OKButton');
    console.log('[twintest:wms] Dismissed Change User Settings popup');
  } catch {
    // No popup
  }
  console.log(`[twintest:wms] Navigated to '${menuItem}'`);
});
