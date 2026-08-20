/**
 * WMS Smart Client — ClickOnce launch helpers.
 *
 * Extracted from wms.steps.ts so they can be reused by both
 * tag-based Before/After hooks (hooks.ts) and step definitions.
 *
 * Handles the full ClickOnce lifecycle:
 *   1. Launch via rundll32 dfshim.dll,ShOpenVerbApplication <URL>
 *   2. Handle the "Application Run - Security Warning" popup
 *   3. Wait for the app to download and load
 *   4. Get the window handle by title via PowerShell
 *   5. Create a new Appium session attached to that window
 *
 * Env vars (set in .env):
 *   URL                — ClickOnce deployment URL
 *   WMS_WINDOW_TITLE   — expected window title (default: "IMI Supply Chain Smart Client")
 *   WMS_PROCESS_NAME   — executable name for taskkill (default: "Imi.SupplyChain.UX.SmartClient.exe")
 */

import { execSync, spawn } from 'child_process';
import { remote } from 'webdriverio';
import { waitMs } from '../../../../src/utilities/wait.js';

export const WMS_WINDOW_TITLE = process.env.WMS_WINDOW_TITLE || 'IMI Supply Chain Smart Client';
export const WMS_PROCESS_NAME = process.env.WMS_PROCESS_NAME || 'Imi.SupplyChain.UX.SmartClient.exe';
const SECURITY_WARNING_TITLE = 'Application Run - Security Warning';

/**
 * Launch a ClickOnce application via the Windows shell.
 */
export function launchClickOnce(url: string): void {
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
export async function getWindowHandleByTitle(
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
        const padded = result.padStart(8, '0');
        console.log(`[twintest:wms] Found window '${title}' -> handle 0x${padded}`);
        return padded;
      }
    } catch {
      // Window not found yet — keep polling
    }
    await waitMs(pollMs);
  }
  console.warn(`[twintest:wms] Window '${title}' not found within ${timeoutMs}ms`);
  return null;
}

/**
 * Create an Appium session attached to a specific window handle.
 */
export async function createSessionForWindow(hexHandle: string): Promise<WebdriverIO.Browser> {
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
export async function handleSecurityWarning(): Promise<boolean> {
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
export function forceCloseWMS(): void {
  try {
    execSync(`taskkill /IM ${WMS_PROCESS_NAME} /F`, { stdio: 'ignore' });
    console.log(`[twintest:wms] Force-closed ${WMS_PROCESS_NAME}`);
  } catch {
    // Process may not be running — that's OK
  }
}
