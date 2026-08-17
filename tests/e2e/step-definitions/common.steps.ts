/**
 * Common step definitions — reusable Given/When/Then for ANY Windows app.
 *
 * Mirrors the Pickleib/wms-test-automation step patterns:
 *   - Click the {element} on the {page}
 *   - Fill input {element} on the {page} with text: {text}
 *   - If present, click the {element} on the {page}
 *   - Wait {N} seconds
 *   - Switch to the next active window
 *   - Press {keys} to navigate to {target}
 *   - Update context {key} -> {value}
 *   - Assert the value of {attr} attribute for {element} element on {page} equals {value}
 *   - Assert that the {element} element on the {page} contains the text: {text}
 *   - Assert the value of element {element} on {page} is not empty
 *   - Click the element with text {text} on the {page}
 *
 * Text values prefixed with "CONTEXT-" are resolved from the context store.
 */

import { Given, When, Then, DataTable } from '@cucumber/cucumber';
import { DesktopWorld } from '../support/world.js';
import { execSync } from 'child_process';
import os from 'os';

// ---------------------------------------------------------------------------
// Context store
// ---------------------------------------------------------------------------

Given('Update context {word} -> {}', async function (this: DesktopWorld, key: string, value: string) {
  this.context[key] = value;
  console.log(`[twintest] Context: ${key} = ${value}`);
});

Given('Update context variables', async function (this: DesktopWorld, table: DataTable) {
  const rows = table.rows();
  for (const [key, value] of rows) {
    this.context[key.trim()] = value.trim();
  }
});

Given('Update context variable {word} with the host name', async function (this: DesktopWorld, key: string) {
  this.context[key] = os.hostname();
  console.log(`[twintest] Context: ${key} = ${this.context[key]}`);
});

// ---------------------------------------------------------------------------
// Window / app context
// ---------------------------------------------------------------------------

Given('the active window is {string}', async function (this: DesktopWorld, windowName: string) {
  this.activeWindow = windowName;
});

Given('the {word} app is launched', async function (this: DesktopWorld, _appName: string) {
  const title = await this.steps.getWindowTitle();
  console.log(`[twintest] App launched, window title: ${title}`);
});

// ---------------------------------------------------------------------------
// Click the {element} on the {page}  (Pickleib pattern)
// ---------------------------------------------------------------------------

Given('Click the {word} on the {word}', async function (
  this: DesktopWorld,
  elementName: string,
  pageName: string,
) {
  await this.steps.click(pageName, elementName);
});

Given('Click the CONTEXT-{word} on the {word}', async function (
  this: DesktopWorld,
  contextKey: string,
  pageName: string,
) {
  // Dynamic click: resolve the element text from context, then click by name
  const text = this.context[contextKey];
  if (!text) throw new Error(`Context key '${contextKey}' not found.`);
  const sel = `//*[@Name='${text}']`;
  const el = await this.steps.driver.$(sel);
  await el.waitForExist({ timeout: 10000 });
  await el.click();
});

Given('Click the element with text {} on the {word}', async function (
  this: DesktopWorld,
  elementText: string,
  _pageName: string,
) {
  elementText = this.contextCheck(elementText);
  const sel = `//*[@Name='${elementText}']`;
  const el = await this.steps.driver.$(sel);
  await el.waitForExist({ timeout: 10000 });
  await el.click();
});

Given('Click the button containing name {} on the {word}', async function (
  this: DesktopWorld,
  partialName: string,
  _pageName: string,
) {
  partialName = this.contextCheck(partialName);
  const sel = `//*[contains(@Name,'${partialName}')]`;
  const el = await this.steps.driver.$(sel);
  await el.waitForExist({ timeout: 10000 });
  await el.click();
});

// ---------------------------------------------------------------------------
// If present, click the {element} on the {page}
// ---------------------------------------------------------------------------

Given('If present, click the {word} on the {word}', async function (
  this: DesktopWorld,
  elementName: string,
  pageName: string,
) {
  try {
    const sel = this.repo.toWdioSelector(pageName, elementName);
    const el = await this.steps.driver.$(sel);
    const exists = await el.isExisting();
    if (exists) {
      await el.click();
    }
  } catch {
    // Element not present — that's OK
  }
});

// ---------------------------------------------------------------------------
// Fill input {element} on the {page} with text: {text}  (Pickleib pattern)
// ---------------------------------------------------------------------------

Given(/^Fill input (\w+) on the (\w+) with (?:(?:un-verified|verified) )?text: (.+)$/, async function (
  this: DesktopWorld,
  inputName: string,
  pageName: string,
  text: string,
) {
  text = this.contextCheck(text.trim());
  await this.steps.clearAndType(pageName, inputName, text);
});

// ---------------------------------------------------------------------------
// Wait
// ---------------------------------------------------------------------------

Given('Wait {int} seconds', async function (this: DesktopWorld, seconds: number) {
  await new Promise(resolve => setTimeout(resolve, seconds * 1000));
});

// ---------------------------------------------------------------------------
// Window management
// ---------------------------------------------------------------------------

Given('Switch to the next active window', async function (this: DesktopWorld) {
  const handles = await this.steps.driver.getWindowHandles();
  if (handles.length > 1) {
    await this.steps.driver.switchToWindow(handles[handles.length - 1]);
  }
});

Given('Switch to window {word}', async function (this: DesktopWorld, title: string) {
  await this.steps.switchToWindow(title);
});

When('I switch to the {string} window', async function (this: DesktopWorld, title: string) {
  await this.steps.switchToWindow(title);
});

When('I maximize the window', async function (this: DesktopWorld) {
  await this.steps.maximizeWindow();
});

When('I minimize the window', async function (this: DesktopWorld) {
  await this.steps.minimizeWindow();
});

// ---------------------------------------------------------------------------
// Keyboard — Press {keys} to navigate to {target}  (Pickleib pattern)
//
// Parses: "Press ALT, then S7, then SB to navigate to Pick Zone"
// Splits on ", then " → sends each key sequence (ALT press, then S, 7, etc.)
// ---------------------------------------------------------------------------

Given('Press {} to navigate to {}', async function (
  this: DesktopWorld,
  keys: string,
  _menuOption: string,
) {
  const sequences = keys.split(/,\s*then\s*/);
  for (const seq of sequences) {
    const trimmed = seq.trim();
    // If it's a named key (ALT, SHIFT, CONTROL, F1-F12, ENTER, etc.)
    const namedKeys: Record<string, string> = {
      ALT: 'Alt', SHIFT: 'Shift', CONTROL: 'Control', CTRL: 'Control',
      ENTER: 'Enter', ESCAPE: 'Escape', TAB: 'Tab', SPACE: ' ',
      DELETE: 'Delete', BACKSPACE: 'Backspace',
      F1: 'F1', F2: 'F2', F3: 'F3', F4: 'F4', F5: 'F5', F6: 'F6',
      F7: 'F7', F8: 'F8', F9: 'F9', F10: 'F10', F11: 'F11', F12: 'F12',
      UP: 'ArrowUp', DOWN: 'ArrowDown', LEFT: 'ArrowLeft', RIGHT: 'ArrowRight',
      PAGEUP: 'PageUp', PAGEDOWN: 'PageDown',
    };

    const upper = trimmed.toUpperCase();
    if (namedKeys[upper]) {
      await this.steps.driver.keys([namedKeys[upper]]);
    } else {
      // Send each character individually (e.g., "S7" → 'S', '7')
      for (const char of trimmed) {
        await this.steps.driver.keys([char]);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
});

Given('Press keyboard keys {}', async function (this: DesktopWorld, inputText: string) {
  const parts = inputText.split('+').map(p => p.trim());
  await this.steps.driver.keys(parts);
});

When('I press the key(s) {string}', async function (this: DesktopWorld, keys: string) {
  const keyList = keys.split('+').map(k => k.trim());
  await this.steps.keyboardShortcut(...keyList);
});

// ---------------------------------------------------------------------------
// Assertions — Pickleib patterns
// ---------------------------------------------------------------------------

Given('Assert the value of {word} attribute for {word} element on {word} equals {}', async function (
  this: DesktopWorld,
  attribute: string,
  elementName: string,
  pageName: string,
  expected: string,
) {
  expected = this.contextCheck(expected.trim());
  const actual = await this.steps.getAttribute(pageName, elementName, attribute);
  if (actual !== expected) {
    throw new Error(
      `Attribute '${attribute}' of ${pageName}.${elementName}: expected '${expected}', got '${actual}'`,
    );
  }
});

Given('Assert the value of {word} attribute for {word} element on {word} contains {}', async function (
  this: DesktopWorld,
  attribute: string,
  elementName: string,
  pageName: string,
  expected: string,
) {
  expected = this.contextCheck(expected.trim());
  const actual = await this.steps.getAttribute(pageName, elementName, attribute);
  if (!actual.includes(expected)) {
    throw new Error(
      `Attribute '${attribute}' of ${pageName}.${elementName}: expected to contain '${expected}', got '${actual}'`,
    );
  }
});

Given('Assert that the {word} element on the {word} contains the text: {}', async function (
  this: DesktopWorld,
  elementName: string,
  pageName: string,
  expected: string,
) {
  expected = this.contextCheck(expected.trim());
  await this.steps.verifyText(pageName, elementName, expected);
});

Given('Assert the value of element {word} on {word} is not empty', async function (
  this: DesktopWorld,
  elementName: string,
  pageName: string,
) {
  const text = await this.steps.getText(pageName, elementName);
  if (!text || text.trim() === '') {
    throw new Error(`${pageName}.${elementName} is empty but should have a value`);
  }
});

// ---------------------------------------------------------------------------
// Assertions — twintest-native patterns (kept for backward compat)
// ---------------------------------------------------------------------------

Then('{string} should contain {string}', async function (
  this: DesktopWorld,
  elementName: string,
  expected: string,
) {
  await this.steps.verifyText(this.activeWindow, elementName, expected);
});

Then('{string} should be exactly {string}', async function (
  this: DesktopWorld,
  elementName: string,
  expected: string,
) {
  await this.steps.verifyExactText(this.activeWindow, elementName, expected);
});

Then('{string} should be visible', async function (this: DesktopWorld, elementName: string) {
  await this.steps.verifyVisible(this.activeWindow, elementName);
});

Then('{string} should not be visible', async function (this: DesktopWorld, elementName: string) {
  await this.steps.verifyNotVisible(this.activeWindow, elementName);
});

Then('{string} should be enabled', async function (this: DesktopWorld, elementName: string) {
  await this.steps.verifyEnabled(this.activeWindow, elementName);
});

Then('{string} should be disabled', async function (this: DesktopWorld, elementName: string) {
  await this.steps.verifyDisabled(this.activeWindow, elementName);
});

// ---------------------------------------------------------------------------
// Screenshots
// ---------------------------------------------------------------------------

Given('Take a screenshot', async function (this: DesktopWorld) {
  const filepath = await this.steps.takeScreenshot('manual');
  console.log(`[twintest] Screenshot saved: ${filepath}`);
});

When('I take a screenshot named {string}', async function (this: DesktopWorld, name: string) {
  const filepath = await this.steps.takeScreenshot(name);
  console.log(`[twintest] Screenshot saved: ${filepath}`);
});

// ---------------------------------------------------------------------------
// Waiting — twintest-native patterns
// ---------------------------------------------------------------------------

When('I wait for {string} to appear', async function (this: DesktopWorld, elementName: string) {
  await this.steps.waitForElement(this.activeWindow, elementName);
});

When('I wait for {string} to disappear', async function (this: DesktopWorld, elementName: string) {
  await this.steps.waitForElementGone(this.activeWindow, elementName);
});

// ---------------------------------------------------------------------------
// Force close
// ---------------------------------------------------------------------------

Given('Close the UI application {word}', async function (this: DesktopWorld, processName: string) {
  try {
    execSync(`taskkill /IM ${processName} /F`, { stdio: 'ignore' });
    console.log(`[twintest] Force-closed ${processName}`);
  } catch {
    // Process may not be running
  }
});
