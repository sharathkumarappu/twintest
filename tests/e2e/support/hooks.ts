/**
 * Cucumber lifecycle hooks — Appium + Windows driver session management.
 *
 * Appium is auto-started by @wdio/appium-service (configured in wdio.conf.ts).
 * Before: initialize the DesktopWorld with the active WDIO driver.
 * After:  screenshot on failure, clean up.
 */

import { Before, After, AfterStep, BeforeAll, AfterAll, Status } from '@cucumber/cucumber';
import { DesktopWorld } from './world.js';
import { StepLogCollector } from '../../../src/StepLogCollector.js';
import { config as loadDotenv } from 'dotenv';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'screenshots');

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

After(async function (this: DesktopWorld, scenario) {
  // Screenshot on failure
  if (scenario.result?.status === Status.FAILED) {
    try {
      const slug = scenario.pickle.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `failure-${slug}-${timestamp}.png`;
      const filepath = path.join(SCREENSHOT_DIR, filename);
      const driver = this.steps?.driver || browser;
      await driver.saveScreenshot(filepath);
      console.log(`[twintest] Failure screenshot: ${filepath}`);
      // Attach to Cucumber report
      const screenshot = fs.readFileSync(filepath);
      this.attach(screenshot, 'image/png');
    } catch (err) {
      console.warn(`[twintest] Could not capture failure screenshot: ${(err as Error).message}`);
    }
  }
});

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

AfterAll(async function () {
  StepLogCollector.uninstall();
  console.log('[twintest] Test suite complete.');
});

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
