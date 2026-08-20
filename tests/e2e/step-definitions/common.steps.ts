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
import { waitSeconds, waitMs } from '../../../src/utilities/wait.js';

// ---------------------------------------------------------------------------
// Context store
// ---------------------------------------------------------------------------

Given('Update context {word} -> {}', async function (this: DesktopWorld, key: string, value: string) {
  this.context[key] = value;
  console.log(`[twintest] Context: ${key} = ${value}`);
});

Given('Update context variables', async function (this: DesktopWorld, table: DataTable) {
  console.log('[twintest] Updating context variables from DataTable');
  const rows = table.rows();
  for (const [key, value] of rows) {
    this.context[key.trim()] = value.trim();
    console.log(`[twintest] Context: ${key.trim()} = ${value.trim()}`);
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
  console.log(`[twintest] Setting active window to '${windowName}'`);
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
  console.log(`[twintest] Clicking context element '${contextKey}' (resolved: '${text}') on '${pageName}'`);
  const sel = `//*[@Name='${text}']`;
  const el = await this.steps.driver.$(sel);
  await el.waitForExist({ timeout: 10000 });
  await el.click();
  console.log(`[twintest] Clicked context element '${contextKey}' on '${pageName}'`);
});

Given('Click the element with text {} on the {word}', async function (
  this: DesktopWorld,
  elementText: string,
  _pageName: string,
) {
  elementText = this.contextCheck(elementText);
  console.log(`[twintest] Clicking element with text '${elementText}' on '${_pageName}'`);
  const sel = `//*[@Name='${elementText}']`;
  const el = await this.steps.driver.$(sel);
  await el.waitForExist({ timeout: 10000 });
  await el.click();
  console.log(`[twintest] Clicked element with text '${elementText}' on '${_pageName}'`);
});

Given('Click the button containing name {} on the {word}', async function (
  this: DesktopWorld,
  partialName: string,
  _pageName: string,
) {
  partialName = this.contextCheck(partialName);
  console.log(`[twintest] Clicking button containing name '${partialName}' on '${_pageName}'`);
  const sel = `//*[contains(@Name,'${partialName}')]`;
  const el = await this.steps.driver.$(sel);
  await el.waitForExist({ timeout: 10000 });
  await el.click();
  console.log(`[twintest] Clicked button containing name '${partialName}' on '${_pageName}'`);
});

// ---------------------------------------------------------------------------
// If present, click the {element} on the {page}
// ---------------------------------------------------------------------------

Given('If present, click the {word} on the {word}', async function (
  this: DesktopWorld,
  elementName: string,
  pageName: string,
) {
  console.log(`[twintest] If present, clicking '${elementName}' on '${pageName}'`);
  try {
    const sel = this.repo.toWdioSelector(pageName, elementName);
    const el = await this.steps.driver.$(sel);
    const exists = await el.isExisting();
    if (exists) {
      await el.click();
      console.log(`[twintest] Element '${elementName}' was present and clicked on '${pageName}'`);
    } else {
      console.log(`[twintest] Element '${elementName}' not present on '${pageName}' — skipping`);
    }
  } catch {
    console.log(`[twintest] Element '${elementName}' not present on '${pageName}' — skipping`);
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
  console.log(`[twintest] Waiting ${seconds} seconds`);
  await waitSeconds(seconds);
  console.log(`[twintest] Wait complete`);
});

// ---------------------------------------------------------------------------
// Window management
// ---------------------------------------------------------------------------

Given('Switch to the next active window', async function (this: DesktopWorld) {
  console.log('[twintest] Switching to the next active window');
  const handles = await this.steps.driver.getWindowHandles();
  if (handles.length > 1) {
    await this.steps.driver.switchToWindow(handles[handles.length - 1]);
    console.log(`[twintest] Switched to window handle: ${handles[handles.length - 1]}`);
  } else {
    console.log('[twintest] Only one window handle available — staying on current');
  }
});

Given('Switch to window {word}', async function (this: DesktopWorld, title: string) {
  console.log(`[twintest] Switching to window '${title}'`);
  await this.steps.switchToWindow(title);
  console.log(`[twintest] Switched to window '${title}'`);
});

When('I switch to the {string} window', async function (this: DesktopWorld, title: string) {
  console.log(`[twintest] Switching to window '${title}'`);
  await this.steps.switchToWindow(title);
  console.log(`[twintest] Switched to window '${title}'`);
});

When('I maximize the window', async function (this: DesktopWorld) {
  console.log('[twintest] Maximizing window');
  await this.steps.maximizeWindow();
  console.log('[twintest] Window maximized');
});

When('I minimize the window', async function (this: DesktopWorld) {
  console.log('[twintest] Minimizing window');
  await this.steps.minimizeWindow();
  console.log('[twintest] Window minimized');
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
  // Sends each segment separately with pauses, matching the Java implementation.
  // "ALT, then S1" → sends ALT alone (activates menu bar), pauses,
  //   then sends "S" individually, pauses, then sends "1" individually.
  const namedKeys: Record<string, string> = {
    ALT: '%', SHIFT: '+', CONTROL: '^', CTRL: '^',
    ENTER: '{ENTER}', ESCAPE: '{ESC}', TAB: '{TAB}', SPACE: ' ',
    DELETE: '{DELETE}', BACKSPACE: '{BACKSPACE}',
    F1: '{F1}', F2: '{F2}', F3: '{F3}', F4: '{F4}', F5: '{F5}', F6: '{F6}',
    F7: '{F7}', F8: '{F8}', F9: '{F9}', F10: '{F10}', F11: '{F11}', F12: '{F12}',
    UP: '{UP}', DOWN: '{DOWN}', LEFT: '{LEFT}', RIGHT: '{RIGHT}',
    PAGEUP: '{PGUP}', PAGEDOWN: '{PGDN}',
  };

  console.log(`[twintest] Pressing keys '${keys}' to navigate to '${_menuOption}'`);
  const sequences = keys.split(/,\s*then\s*/);

  for (const seq of sequences) {
    const trimmed = seq.trim();
    const upper = trimmed.toUpperCase();

    if (namedKeys[upper]) {
      // Named key (ALT, ENTER, F1, etc.) — send as a single keypress
      await this.steps.sendKeys([namedKeys[upper]]);
    } else {
      // Multi-character sequence like "S1" or "SB" — send each character
      // individually with a pause between, so the menu has time to react
      for (const char of trimmed) {
        await this.steps.sendKeys([char.toLowerCase()]);
        await waitMs(200);
      }
      continue; // skip the trailing pause since we already paused per-char
    }
    await waitMs(200);
  }
  console.log(`[twintest] Key navigation complete`);
});

Given('Press keyboard keys {}', async function (this: DesktopWorld, inputText: string) {
  console.log(`[twintest] Pressing keyboard keys: ${inputText}`);
  const parts = inputText.split('+').map(p => p.trim());
  await this.steps.sendKeys(parts);
  console.log(`[twintest] Keyboard keys sent`);
});

When('I press the key(s) {string}', async function (this: DesktopWorld, keys: string) {
  console.log(`[twintest] Pressing key(s): ${keys}`);
  const keyList = keys.split('+').map(k => k.trim());
  await this.steps.keyboardShortcut(...keyList);
  console.log(`[twintest] Key(s) pressed`);
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
  console.log(`[twintest] Asserting '${attribute}' of '${elementName}' on '${pageName}' equals '${expected}'`);
  const actual = await this.steps.getAttribute(pageName, elementName, attribute);
  if (actual !== expected) {
    throw new Error(
      `Attribute '${attribute}' of ${pageName}.${elementName}: expected '${expected}', got '${actual}'`,
    );
  }
  console.log(`[twintest] Assertion passed: '${attribute}' = '${actual}'`);
});

Given('Assert the value of {word} attribute for {word} element on {word} contains {}', async function (
  this: DesktopWorld,
  attribute: string,
  elementName: string,
  pageName: string,
  expected: string,
) {
  expected = this.contextCheck(expected.trim());
  console.log(`[twintest] Asserting '${attribute}' of '${elementName}' on '${pageName}' contains '${expected}'`);
  const actual = await this.steps.getAttribute(pageName, elementName, attribute);
  if (!actual.includes(expected)) {
    throw new Error(
      `Attribute '${attribute}' of ${pageName}.${elementName}: expected to contain '${expected}', got '${actual}'`,
    );
  }
  console.log(`[twintest] Assertion passed: '${attribute}' = '${actual}' contains '${expected}'`);
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
  console.log(`[twintest] Asserting '${elementName}' on '${pageName}' is not empty`);
  const text = await this.steps.getText(pageName, elementName);
  if (!text || text.trim() === '') {
    throw new Error(`${pageName}.${elementName} is empty but should have a value`);
  }
  console.log(`[twintest] Assertion passed: '${elementName}' has value '${text}'`);
});

// ---------------------------------------------------------------------------
// Assertions — twintest-native patterns (kept for backward compat)
// ---------------------------------------------------------------------------

Then('{string} should contain {string}', async function (
  this: DesktopWorld,
  elementName: string,
  expected: string,
) {
  console.log(`[twintest] Asserting '${elementName}' on '${this.activeWindow}' contains '${expected}'`);
  await this.steps.verifyText(this.activeWindow, elementName, expected);
  console.log(`[twintest] Assertion passed`);
});

Then('{string} should be exactly {string}', async function (
  this: DesktopWorld,
  elementName: string,
  expected: string,
) {
  console.log(`[twintest] Asserting '${elementName}' on '${this.activeWindow}' is exactly '${expected}'`);
  await this.steps.verifyExactText(this.activeWindow, elementName, expected);
  console.log(`[twintest] Assertion passed`);
});

Then('{string} should be visible', async function (this: DesktopWorld, elementName: string) {
  console.log(`[twintest] Asserting '${elementName}' on '${this.activeWindow}' is visible`);
  await this.steps.verifyVisible(this.activeWindow, elementName);
  console.log(`[twintest] Assertion passed`);
});

Then('{string} should not be visible', async function (this: DesktopWorld, elementName: string) {
  console.log(`[twintest] Asserting '${elementName}' on '${this.activeWindow}' is not visible`);
  await this.steps.verifyNotVisible(this.activeWindow, elementName);
  console.log(`[twintest] Assertion passed`);
});

Then('{string} should be enabled', async function (this: DesktopWorld, elementName: string) {
  console.log(`[twintest] Asserting '${elementName}' on '${this.activeWindow}' is enabled`);
  await this.steps.verifyEnabled(this.activeWindow, elementName);
  console.log(`[twintest] Assertion passed`);
});

Then('{string} should be disabled', async function (this: DesktopWorld, elementName: string) {
  console.log(`[twintest] Asserting '${elementName}' on '${this.activeWindow}' is disabled`);
  await this.steps.verifyDisabled(this.activeWindow, elementName);
  console.log(`[twintest] Assertion passed`);
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
  console.log(`[twintest] Waiting for '${elementName}' to appear on '${this.activeWindow}'`);
  await this.steps.waitForElement(this.activeWindow, elementName);
  console.log(`[twintest] '${elementName}' appeared`);
});

When('I wait for {string} to disappear', async function (this: DesktopWorld, elementName: string) {
  console.log(`[twintest] Waiting for '${elementName}' to disappear from '${this.activeWindow}'`);
  await this.steps.waitForElementGone(this.activeWindow, elementName);
  console.log(`[twintest] '${elementName}' disappeared`);
});

// ---------------------------------------------------------------------------
// Force close
// ---------------------------------------------------------------------------

Given('Close the UI application {word}', async function (this: DesktopWorld, processName: string) {
  console.log(`[twintest] Closing UI application '${processName}'`);
  try {
    execSync(`taskkill /IM ${processName} /F`, { stdio: 'ignore' });
    console.log(`[twintest] Force-closed ${processName}`);
  } catch {
    console.log(`[twintest] Process '${processName}' was not running`);
  }
});
