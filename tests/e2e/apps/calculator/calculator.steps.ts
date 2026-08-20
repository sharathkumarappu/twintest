/**
 * Calculator-specific step definitions.
 *
 * These steps are app-specific and demonstrate how to extend the generic
 * common.steps.ts for a particular Windows application. The active window
 * is set to "Calculator" (matching app-repository.json) in the Background.
 */

import { Given, When, Then } from '@cucumber/cucumber';
import { DesktopWorld } from '../../support/world.js';

// Digit character -> element name mapping for clickSequence
const DIGIT_MAP: Record<string, string> = {
  '0': 'DigitZero', '1': 'DigitOne', '2': 'DigitTwo',
  '3': 'DigitThree', '4': 'DigitFour', '5': 'DigitFive',
  '6': 'DigitSix', '7': 'DigitSeven', '8': 'DigitEight',
  '9': 'DigitNine', '.': 'DecimalButton',
};

// Operator name -> element name mapping
const OPERATOR_MAP: Record<string, string> = {
  plus: 'PlusButton',
  minus: 'MinusButton',
  multiply: 'MultiplyButton',
  divide: 'DivideButton',
  add: 'PlusButton',
  subtract: 'MinusButton',
  times: 'MultiplyButton',
};

// ---------------------------------------------------------------------------
// Calculator mode
// ---------------------------------------------------------------------------

Given('the calculator is in Standard mode', async function (this: DesktopWorld) {
  try {
    await this.steps.click(this.activeWindow, 'NavigationMenu');
    await this.steps.click(this.activeWindow, 'StandardMode');
  } catch {
    // May already be in standard mode
    await this.steps.waitForElement(this.activeWindow, 'ResultDisplay');
  }
  await this.steps.click(this.activeWindow, 'ClearButton');
});

// ---------------------------------------------------------------------------
// Number entry
// ---------------------------------------------------------------------------

When('I enter the number {string}', async function (this: DesktopWorld, numberStr: string) {
  await this.steps.clickSequence(this.activeWindow, numberStr, DIGIT_MAP);
});

// ---------------------------------------------------------------------------
// Operators
// ---------------------------------------------------------------------------

When('I click the {string} operator', async function (this: DesktopWorld, operator: string) {
  const elementName = OPERATOR_MAP[operator.toLowerCase()];
  if (!elementName) {
    throw new Error(
      `Unknown operator: '${operator}'. Available: ${Object.keys(OPERATOR_MAP).join(', ')}`,
    );
  }
  await this.steps.click(this.activeWindow, elementName);
});

When('I click the {string} button', async function (this: DesktopWorld, buttonRef: string) {
  const buttonMap: Record<string, string> = {
    clear: 'ClearButton',
    'clear entry': 'ClearEntryButton',
    backspace: 'BackspaceButton',
    equals: 'EqualsButton',
    decimal: 'DecimalButton',
    negate: 'NegateButton',
  };
  const elementName = buttonMap[buttonRef.toLowerCase()] || buttonRef;
  await this.steps.click(this.activeWindow, elementName);
});

// ---------------------------------------------------------------------------
// Result verification
// ---------------------------------------------------------------------------

Then('the result should contain {string}', async function (this: DesktopWorld, expected: string) {
  await this.steps.verifyText(this.activeWindow, 'ResultDisplay', expected);
});

Then('the result should be exactly {string}', async function (this: DesktopWorld, expected: string) {
  await this.steps.verifyExactText(this.activeWindow, 'ResultDisplay', expected);
});
