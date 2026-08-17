import type { Options } from '@wdio/types';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Determine app under test from environment.
// APP_PATH: exe path, AUMID, or .appref-ms
// APP_TOP_LEVEL_WINDOW: hex window handle for already-running apps (overrides APP_PATH)
// Default to 'Root' (desktop session) — apps that manage their own launch
// (e.g., ClickOnce via wms.steps.ts) don't need WDIO to launch anything.
// Set APP_PATH to a specific AUMID or exe path for direct-launch apps (e.g., Calculator).
const APP_PATH = process.env.APP_PATH || 'Root';
const APP_TOP_LEVEL_WINDOW = process.env.APP_TOP_LEVEL_WINDOW;

export const config: Options.Testrunner & { capabilities: unknown } = {
  //
  // Runner & Connection
  // Appium 2.x is auto-started by @wdio/appium-service (see `services` below).
  // The service manages the Appium server lifecycle — no manual start needed.
  //
  runner: 'local',
  port: 4723,

  //
  // Specs — Cucumber feature files
  //
  specs: [
    './tests/e2e/features/**/*.feature',
    './tests/e2e/apps/**/*.feature',
  ],
  exclude: [],

  //
  // Capabilities — Appium 2.x + appium-windows-driver
  //
  // Appium 2.x uses W3C capabilities with the `appium:` vendor prefix.
  // The windows driver (appium-windows-driver) delegates to WinAppDriver
  // under the hood. Supported launch modes:
  //   1. UWP / Store apps: `appium:app` = Application User Model ID
  //   2. Classic desktop apps: `appium:app` = full .exe path
  //   3. ClickOnce apps: `appium:app` = .appref-ms path
  //   4. Already-running apps: `appium:appTopLevelWindow` = hex window handle
  //
  capabilities: [{
    platformName: 'Windows',
    'appium:automationName': 'Windows',
    // If APP_TOP_LEVEL_WINDOW is set, attach to running app; otherwise launch via APP_PATH
    ...(APP_TOP_LEVEL_WINDOW
      ? { 'appium:appTopLevelWindow': APP_TOP_LEVEL_WINDOW }
      : { 'appium:app': APP_PATH }),
    'appium:newCommandTimeout': 60,
    'appium:connectHardwareKeyboard': true,
  }] as any,

  //
  // Services — Appium auto-start
  //
  // @wdio/appium-service starts Appium before the test run and stops it after.
  // Requires: npm install -g appium && npm run appium:setup
  //
  services: [
    ['appium', {
      // Use the globally installed Appium (set up via `npm run appium:setup`)
      command: 'appium',
      args: {
        address: '127.0.0.1',
        port: 4723,
        relaxedSecurity: true,
        allowCors: true,
      },
      logPath: './logs',
    }],
  ],

  //
  // Test Framework — Cucumber
  //
  framework: 'cucumber',
  cucumberOpts: {
    require: [
      './tests/e2e/step-definitions/**/*.ts',
      './tests/e2e/apps/**/*.steps.ts',
      './tests/e2e/support/**/*.ts',
    ],
    requireModule: ['ts-node/register'],
    backtrace: false,
    dryRun: false,
    failFast: false,
    snippets: true,
    source: true,
    strict: false,
    timeout: 60000,
    tags: '',
    format: ['json:./target/reports/cucumber.json'],
  },

  //
  // Reporters
  //
  reporters: [
    ['spec', { realtimeReporting: true }],
  ],

  //
  // Logging
  //
  logLevel: 'warn',
  outputDir: './logs',

  //
  // Test execution
  //
  maxInstances: 1, // Desktop apps are single-instance by nature
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

  //
  // Hooks — lifecycle management
  //
  onPrepare: async function () {
    console.log('[twintest] Preparing test session...');
    console.log('[twintest] Appium service will auto-start on port 4723');
    console.log(`[twintest] Target app: ${APP_PATH}`);
  },

  before: async function (_capabilities, _specs) {
    // Import chai for assertions alongside WDIO expect
    const chai = await import('chai');
    (global as any).expect = chai.expect;
    (global as any).assert = chai.assert;
  },

  afterTest: async function (_test, _context, result) {
    // Screenshot on failure
    if (!result.passed) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const screenshotPath = path.join('screenshots', `failure-${timestamp}.png`);
      try {
        await browser.saveScreenshot(screenshotPath);
        console.log(`[twintest] Failure screenshot saved: ${screenshotPath}`);
      } catch (err) {
        console.warn(`[twintest] Could not save failure screenshot: ${(err as Error).message}`);
      }
    }
  },

  onComplete: async function () {
    try {
      const reporter = require('cucumber-html-reporter');
      reporter.generate({
        theme: 'bootstrap',
        jsonFile: './target/reports/cucumber.json',
        output: './target/reports/CucumberHTMLReport.html',
        reportSuiteAsScenarios: true,
        launchReport: false,
        brandTitle: 'twintest',
        name: 'twintest',
        metadata: {
          Platform: 'Windows',
          Framework: 'WebDriverIO + Cucumber',
          Driver: 'Appium Windows Driver',
        },
      });
      console.log('[twintest] HTML report generated: target/reports/CucumberHTMLReport.html');
    } catch (err) {
      console.warn(`[twintest] Could not generate HTML report: ${(err as Error).message}`);
    }
  },
};
