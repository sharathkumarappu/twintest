# API Reference — DesktopSteps

The DesktopSteps API for writing Cucumber step definitions in Stage 3.

## Setup — Cucumber World

```typescript
// tests/e2e/support/world.ts
import { World, IWorldOptions } from '@cucumber/cucumber';
import { ElementRepository } from '../../../src/ElementRepository';
import { DesktopSteps } from '../../../src/DesktopSteps';

export class DesktopWorld extends World {
  steps!: DesktopSteps;
  repo!: ElementRepository;

  constructor(options: IWorldOptions) {
    super(options);
  }

  init(driver: WebdriverIO.Browser): void {
    this.repo = new ElementRepository('tests/e2e/data/app-repository.json');
    this.steps = new DesktopSteps(driver, this.repo, { timeout: 10000 });
  }
}
```

## Locator Format — app-repository.json

```json
{
  "windows": [
    {
      "name": "MainWindow",
      "elements": [
        {
          "elementName": "saveButton",
          "selector": {
            "automationId": "btnSave",
            "name": "Save",
            "className": "Button"
          }
        }
      ]
    }
  ]
}
```

Supported strategies (priority order):
1. `automationId` — UIA AutomationId (most stable)
2. `accessibilityId` — maps to AutomationId in WinAppDriver
3. `name` — UIA Name property
4. `className` — UIA ClassName
5. `xpath` — XPath against the UI Automation tree

## DesktopSteps API

### Application Lifecycle

| Method | Description |
|---|---|
| `launchApp(appPath, args?)` | Launch an application |
| `closeApp()` | Close the current application session |
| `switchToWindow(title)` | Switch focus to a window by title |

### Element Interactions

| Method | Description |
|---|---|
| `click(windowName, elementName)` | Click an element |
| `doubleClick(windowName, elementName)` | Double-click an element |
| `rightClick(windowName, elementName)` | Right-click an element |
| `type(windowName, elementName, text)` | Type text (appends) |
| `clearAndType(windowName, elementName, text)` | Clear and type text |

### Dropdown / ComboBox

| Method | Description |
|---|---|
| `selectByText(windowName, elementName, text)` | Select by visible text |
| `selectByIndex(windowName, elementName, index)` | Select by index |

### Verification

| Method | Description |
|---|---|
| `verifyText(windowName, elementName, expected)` | Verify text contains expected |
| `verifyExactText(windowName, elementName, expected)` | Verify exact text match |
| `verifyVisible(windowName, elementName)` | Verify element is visible |
| `verifyNotVisible(windowName, elementName)` | Verify element is not visible |
| `verifyEnabled(windowName, elementName)` | Verify element is enabled |
| `verifyDisabled(windowName, elementName)` | Verify element is disabled |

### Extraction

| Method | Description |
|---|---|
| `getText(windowName, elementName)` | Get element text |
| `getAttribute(windowName, elementName, attr)` | Get attribute value |

### Screenshots

| Method | Description |
|---|---|
| `takeScreenshot(name)` | Save screenshot, return file path |

### Waiting

| Method | Description |
|---|---|
| `waitForElement(windowName, elementName, timeout?)` | Wait for element to exist |
| `waitForElementGone(windowName, elementName, timeout?)` | Wait for element to disappear |
| `waitForVisible(windowName, elementName, timeout?)` | Wait for element to be visible |
| `waitForEnabled(windowName, elementName, timeout?)` | Wait for element to be enabled |

### Keyboard

| Method | Description |
|---|---|
| `sendKeys(keys[])` | Send keys (global) |
| `keyboardShortcut(...keys)` | Execute keyboard shortcut (e.g., Ctrl+S) |

### Mouse

| Method | Description |
|---|---|
| `dragAndDrop(srcWin, srcEl, tgtWin, tgtEl)` | Drag and drop between elements |
| `hover(windowName, elementName)` | Hover over element |

### Desktop-Specific

| Method | Description |
|---|---|
| `getWindowTitle()` | Get current window title |
| `maximizeWindow()` | Maximize window |
| `minimizeWindow()` | Minimize window |
| `scrollTo(windowName, elementName)` | Scroll element into view |
| `clickSequence(windowName, input, charToElement)` | Click elements mapped from each character in a string (for digit pads, keypads, etc.) |

## Writing Step Definitions

```typescript
import { Given, When, Then } from '@cucumber/cucumber';
import { DesktopWorld } from '../support/world';

// Use this.activeWindow — set via "Given the active window is ..." or APP_WINDOW env var
When('I click the save button', async function (this: DesktopWorld) {
  await this.steps.click(this.activeWindow, 'saveButton');
});

Then('the status bar should show {string}', async function (
  this: DesktopWorld,
  expected: string,
) {
  await this.steps.verifyText(this.activeWindow, 'statusBar', expected);
});
```

### App-specific step definitions

Place app-specific features and steps under `tests/e2e/apps/<app-name>/`:

```
tests/e2e/apps/
  calculator/
    app-repository.json      # Element definitions for Calculator
    calculator.feature        # Gherkin scenarios
    calculator.steps.ts       # App-specific step definitions
  your-app/
    app-repository.json
    your-app.feature
    your-app.steps.ts
```

Set `APP_REPO_PATH=tests/e2e/apps/<app-name>/app-repository.json` to point at the
correct repository for each app.

### Rules
- Always type `this` as `DesktopWorld` in step definitions.
- Always use `this.steps.*` methods — never call `browser.$()` directly.
- Use `this.activeWindow` for the window name — never hardcode window strings.
- All element references use `windowName, elementName` from app-repository.json.
- Feature files reference business actions, not UI implementation details.
- Generic steps go in `tests/e2e/step-definitions/common.steps.ts`.
- App-specific steps go in `tests/e2e/apps/<app-name>/<app>.steps.ts`.
