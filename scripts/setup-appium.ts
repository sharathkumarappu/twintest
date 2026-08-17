/**
 * Appium + Windows Driver setup script.
 *
 * Mirrors the wms-test-automation workflow:
 *   1. Verify / install Appium globally
 *   2. Uninstall any stale windows driver
 *   3. Install appium-windows-driver@latest from npm
 *   4. List installed drivers to verify
 *   5. Health-check the Appium endpoint (if running)
 *
 * Usage: npm run appium:setup
 */

import { execSync } from 'child_process';
import http from 'http';

const APPIUM_PORT = Number(process.env.APPIUM_PORT) || 4723;
const APPIUM_HOST = process.env.APPIUM_HOST || '127.0.0.1';

function run(cmd: string, label: string, allowFailure = false): string {
  console.log(`\n[twintest] ${label}`);
  console.log(`  $ ${cmd}`);
  try {
    const output = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    if (output.trim()) console.log(output.trim());
    return output;
  } catch (err: any) {
    const stderr = err.stderr?.toString() || err.message;
    if (allowFailure) {
      console.log(`  (non-fatal) ${stderr.trim()}`);
      return '';
    }
    console.error(`  FAILED: ${stderr.trim()}`);
    throw err;
  }
}

function checkAppiumGlobal(): boolean {
  try {
    const version = execSync('appium --version', { encoding: 'utf-8' }).trim();
    console.log(`[twintest] Appium found globally: v${version}`);
    return true;
  } catch {
    return false;
  }
}

function healthCheck(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://${APPIUM_HOST}:${APPIUM_PORT}/status`, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const status = JSON.parse(body);
            console.log(`[twintest] Appium server is running.`);
            console.log(`  Build: ${JSON.stringify(status.value?.build || status.build || 'unknown')}`);
          } catch {
            console.log('[twintest] Appium server is running (could not parse status).');
          }
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  console.log('='.repeat(60));
  console.log('[twintest] Appium + Windows Driver Setup');
  console.log('='.repeat(60));

  // Step 1: Check / install Appium globally
  // Driver management (install/uninstall) must use the GLOBAL Appium, not the
  // project-local one — drivers are a global resource managed by the global
  // Appium CLI. The project-local `appium` dep is only for @wdio/appium-service
  // to start the server.
  if (!checkAppiumGlobal()) {
    console.log('[twintest] Appium not found globally. Installing...');
    run('npm install -g appium@latest', 'Installing Appium globally');
    // Verify
    if (!checkAppiumGlobal()) {
      console.error('[twintest] Appium installation failed. Install manually: npm install -g appium');
      process.exit(1);
    }
  } else {
    // Check version — appium-windows-driver@latest requires Appium >= 3.x
    try {
      const ver = execSync('appium --version', { encoding: 'utf-8' }).trim();
      const major = parseInt(ver.split('.')[0], 10);
      if (major < 3) {
        console.log(`[twintest] Appium ${ver} is too old (need >= 3.x). Upgrading...`);
        run('npm install -g appium@latest', 'Upgrading Appium globally');
      }
    } catch {
      // Proceed and let driver install surface errors
    }
  }

  // Step 2: Uninstall any stale windows driver (non-fatal if not installed)
  run('appium driver uninstall windows', 'Uninstalling stale windows driver (if any)', true);

  // Step 3: Install appium-windows-driver@latest from npm
  run(
    'appium driver install --source=npm appium-windows-driver@latest',
    'Installing appium-windows-driver@latest',
  );

  // Step 4: List installed drivers to verify
  run('appium driver list --installed', 'Verifying installed drivers');

  // Step 5: Health-check (if Appium is already running)
  console.log(`\n[twintest] Checking if Appium is running at ${APPIUM_HOST}:${APPIUM_PORT}...`);
  const running = await healthCheck();
  if (!running) {
    console.log('[twintest] Appium is not currently running (that\'s OK).');
    console.log('[twintest] It will auto-start via @wdio/appium-service when you run tests.');
    console.log('[twintest] To start manually: npm run appium:start');
  }

  console.log('\n' + '='.repeat(60));
  console.log('[twintest] Setup complete. Run tests with: npm test');
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error(`\n[twintest] Setup failed: ${err.message}`);
  process.exit(1);
});
