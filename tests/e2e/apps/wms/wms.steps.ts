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
