/**
 * Cucumber lifecycle hooks — tag-based app launching & DB connection.
 *
 * Mirrors the wms-test-automation (Java) pattern where @App-* tags on
 * feature files drive Before hooks that handle application launching
 * and database connection setup.
 *
 * Tags:
 *   @App-WMS        — ClickOnce launch, security warning handling, window attach
 *   @App-Calculator — WDIO-managed launch, set active window
 *
 * DB connection is eagerly verified when SQL_DATABASE_URL is set.
 *
 * Appium is auto-started by @wdio/appium-service (configured in wdio.conf.ts).
 */

import { Before, After, AfterStep, BeforeAll, AfterAll, Status } from '@cucumber/cucumber';
import { DesktopWorld } from './world.js';
import { StepLogCollector } from '../../../src/StepLogCollector.js';
import { config as loadDotenv } from 'dotenv';
import fs from 'fs';
import path from 'path';
import {
  launchClickOnce,
  getWindowHandleByTitle,
  createSessionForWindow,
  handleSecurityWarning,
  forceCloseWMS,
  WMS_WINDOW_TITLE,
} from '../apps/wms/wms-launch.js';
import { waitSeconds } from '../../../src/utilities/wait.js';

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'screenshots');

// ---------------------------------------------------------------------------
// Suite-level hooks
// ---------------------------------------------------------------------------

BeforeAll(async function () {
  // Load .env file (if present) — credentials, app paths, URLs
  loadDotenv();

  // Ensure screenshot directory exists
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
  // Install step log collector — intercepts console output for report attachment
  StepLogCollector.install();

  console.log('[twintest] Test suite starting...');
});

// ---------------------------------------------------------------------------
// Generic Before — world initialization (runs for ALL scenarios)
// ---------------------------------------------------------------------------

Before(async function (this: DesktopWorld, scenario) {
  // Auto-discover app-repository.json from the feature file's directory.
  // Walks up from the feature file's folder looking for app-repository.json,
  // so APP_REPO_PATH env var is no longer needed when the repo file sits
  // alongside (or above) the feature file.
  if (!process.env.APP_REPO_PATH) {
    const featureUri = scenario.gherkinDocument?.uri || scenario.pickle?.uri || '';
    if (featureUri) {
      const featureDir = path.dirname(path.resolve(process.cwd(), featureUri));
      let dir = featureDir;
      const root = path.parse(dir).root;
      while (dir !== root) {
        const candidate = path.join(dir, 'app-repository.json');
        if (fs.existsSync(candidate)) {
          process.env.APP_REPO_PATH = candidate;
          break;
        }
        dir = path.dirname(dir);
      }
    }
  }

  // `browser` is the global WDIO driver instance, injected by the WDIO runner.
  this.init(browser);
});

// ---------------------------------------------------------------------------
// @App-WMS — ClickOnce application launch (Before hook)
// ---------------------------------------------------------------------------

Before({ tags: '@App-WMS' }, async function (this: DesktopWorld) {
  const url = process.env.URL;
  if (!url) {
    throw new Error('URL environment variable is not set. Set it in .env or export it.');
  }

  // 1. Force-close any previous instance
  forceCloseWMS();
  await waitSeconds(2);

  // 2. Launch via ClickOnce
  launchClickOnce(url);

  // 3. Wait for the app to start downloading
  await waitSeconds(10);

  // 4. Handle security warning if present
  const warningHandled = await handleSecurityWarning();
  if (warningHandled) {
    // Extra wait after clicking "Run" — app needs to download
    await waitSeconds(60);
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

  // 8. Populate context with WMS GUI credentials
  const username = process.env.WMS_USER;
  const password = process.env.WMS_PWD;
  if (username) this.context['username'] = username;
  if (password) this.context['password'] = password;
  if (process.env.DC_NAME) this.context['dcName'] = process.env.DC_NAME;
  if (process.env.GLN) this.context['GLN'] = process.env.GLN;

  console.log('[twintest:wms] WMS Smart Client is ready.');
});

// ---------------------------------------------------------------------------
// @App-Calculator — WDIO-managed launch (Before hook)
// ---------------------------------------------------------------------------

Before({ tags: '@App-Calculator' }, async function (this: DesktopWorld) {
  // WDIO launches the Calculator via the appium:app capability (APP_PATH env var).
  // This hook sets the active window so step definitions resolve elements correctly.
  this.activeWindow = 'Calculator';
  const title = await this.steps.getWindowTitle();
  console.log(`[twintest:calculator] Calculator app ready, window title: ${title}`);
});

// ---------------------------------------------------------------------------
// DB connection setup (Before hook — runs for ALL scenarios)
//
// Database is infrastructure, not tied to any @App-* tag.
// Populates DB-related context vars and eagerly verifies the connection
// when SQL_DATABASE_URL (or DB_URL) is configured.
// ---------------------------------------------------------------------------

Before(async function (this: DesktopWorld) {
  // Populate DB context from env vars
  if (process.env.DB_URL) this.context['DB_URL'] = process.env.DB_URL;
  if (process.env.SQL_DATABASE_URL) this.context['SQL_DATABASE_URL'] = process.env.SQL_DATABASE_URL;

  const dbUrl = process.env.SQL_DATABASE_URL || process.env.DB_URL;
  const dbUser = process.env.SQL_DATABASE_USER || process.env.DB_USER;
  const dbPassword = process.env.SQL_DATABASE_PASSWORD || process.env.DB_PASSWORD;
  if (dbUrl && dbUser && dbPassword) {
    try {
      const results = await this.db.executeQuery('SELECT 1 FROM DUAL');
      this.context['DB_CONNECTED'] = 'true';
      console.log(`[twintest:db] Database connection verified: ${JSON.stringify(results)}`);
    } catch (err) {
      console.warn(`[twintest:db] Database connection failed: ${(err as Error).message}`);
      this.context['DB_CONNECTED'] = 'false';
    }
  }
});

// ---------------------------------------------------------------------------
// @App-WMS — cleanup (After hook)
// ---------------------------------------------------------------------------

After({ tags: '@App-WMS' }, async function () {
  forceCloseWMS();
  console.log('[twintest:wms] WMS cleanup complete.');
});

// ---------------------------------------------------------------------------
// Generic After — screenshot on failure (runs for ALL scenarios)
// ---------------------------------------------------------------------------

After(async function (this: DesktopWorld, scenario) {
  if (scenario.result?.status === Status.FAILED) {
    try {
      const slug = scenario.pickle.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `failure-${slug}-${timestamp}.png`;
      const filepath = path.join(SCREENSHOT_DIR, filename);
      // Use the app-scoped driver session (attached to the app window) so the
      // screenshot captures only the application, not the entire desktop.
      // Only fall back to browser (Root session) when no app driver exists.
      if (this.steps?.driver && this.steps.driver !== browser) {
        await this.steps.driver.saveScreenshot(filepath);
      } else {
        await browser.saveScreenshot(filepath);
      }
      console.log(`[twintest] Failure screenshot: ${filepath}`);
      // Attach to Cucumber report
      const screenshot = fs.readFileSync(filepath);
      this.attach(screenshot, 'image/png');
    } catch (err) {
      console.warn(`[twintest] Could not capture failure screenshot: ${(err as Error).message}`);
    }
  }
});

// ---------------------------------------------------------------------------
// AfterStep — log attachment
// ---------------------------------------------------------------------------

AfterStep(async function (this: DesktopWorld) {
  // Drain buffered logs and attach as collapsible HTML block (mirrors StepLogPlugin.java)
  const logs = StepLogCollector.drain();
  if (logs) {
    const html =
      '<details><summary>Step Logs</summary>' +
      '<pre style="margin:6px 0;padding:8px;background:#f8f9fa;' +
      'border:1px solid #e0e0e0;border-radius:4px;font-size:12px;' +
      'white-space:pre-wrap;word-break:break-word;">' +
      escapeHtml(logs) +
      '</pre></details>';
    this.attach(html, 'text/html');
  }
});

// ---------------------------------------------------------------------------
// Suite teardown
// ---------------------------------------------------------------------------

AfterAll(async function () {
  StepLogCollector.uninstall();
  console.log('[twintest] Test suite complete.');
});

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
