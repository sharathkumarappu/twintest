# Appium 2.x + Windows Driver — Session Management & Capabilities

## Overview

twintest uses **Appium 2.x** with the **appium-windows-driver** plugin for Windows desktop automation. Appium delegates to WinAppDriver under the hood, but you interact with Appium's W3C WebDriver endpoint. The `@wdio/appium-service` in `wdio.conf.ts` auto-starts and stops Appium — no manual server management needed during test runs.

## Setup

### One-time setup (run once per machine)

```bash
# Full setup — installs Appium globally + windows driver
npm run appium:setup
```

This runs the equivalent of:

```bash
# 1. Install Appium globally
npm install -g appium

# 2. Remove any stale windows driver
appium driver uninstall windows

# 3. Install the latest windows driver from npm
appium driver install --source=npm appium-windows-driver@latest

# 4. Verify
appium driver list --installed
```

### Prerequisites

1. **Windows 10/11** with Developer Mode enabled (Settings → For developers → Developer Mode).
2. **WinAppDriver** installed from https://github.com/microsoft/WinAppDriver/releases — the appium-windows-driver delegates to it.
3. **Node.js** 18+ installed.

### Diagnostics

```bash
# Check driver health
npm run appium:doctor

# Start Appium manually (for debugging — normally auto-started by WDIO)
npm run appium:start
```

## How the Service Works

In `wdio.conf.ts`:

```typescript
services: [
  ['appium', {
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
```

The `@wdio/appium-service`:
1. **Before tests**: starts `appium` as a child process on port 4723.
2. **During tests**: WDIO connects to `http://127.0.0.1:4723` to create sessions.
3. **After tests**: stops the Appium process.

Appium logs are written to `./logs/`.

## Session Capabilities

All capabilities use the `appium:` vendor prefix (W3C standard).

### UWP / Store Apps

```json
{
  "platformName": "Windows",
  "appium:automationName": "Windows",
  "appium:app": "Microsoft.WindowsCalculator_8wekyb3d8bbwe!App"
}
```

Find the AUMID with:
```powershell
Get-StartApps | Where-Object { $_.Name -like "*Calculator*" }
```

### Classic Desktop Apps (.exe)

```json
{
  "platformName": "Windows",
  "appium:automationName": "Windows",
  "appium:app": "C:\\Windows\\System32\\notepad.exe",
  "appium:appArguments": "/path/to/file.txt"
}
```

### ClickOnce Applications

```json
{
  "platformName": "Windows",
  "appium:automationName": "Windows",
  "appium:app": "C:\\Users\\<user>\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\<publisher>\\<app>.appref-ms"
}
```

### Already-Running Applications

```json
{
  "platformName": "Windows",
  "appium:automationName": "Windows",
  "appium:appTopLevelWindow": "0x00010A5C"
}
```

Find the window handle with:
```powershell
(Get-Process -Name "notepad" | Select-Object MainWindowHandle).MainWindowHandle.ToString("X")
```

### Desktop Session (Root)

For cross-app testing or desktop-level interactions:
```json
{
  "platformName": "Windows",
  "appium:automationName": "Windows",
  "appium:app": "Root"
}
```

## Locator Strategies

| Strategy | WinAppDriver name | Selector prefix | Example |
|---|---|---|---|
| AutomationId | `accessibility id` | `~` | `~CalculatorResults` |
| Name | `name` | `[name="..."]` | `[name="Calculator"]` |
| ClassName | `class name` | `.` | `.Button` |
| XPath | `xpath` | (raw) | `//Button[@Name='Seven']` |
| Tag Name | `tag name` | (raw) | `Button` |

### Locator Priority

1. **AutomationId** — most stable, survives layout changes, equivalent to `data-testid`
2. **Name** — readable but may change with localization
3. **ClassName** — not unique, use as qualifier only
4. **XPath** — powerful but fragile; use sparingly

## Common Operations

### Window Management

```typescript
const title = await driver.getTitle();
const handles = await driver.getWindowHandles();
await driver.switchToWindow(handle);
await driver.maximizeWindow();
await driver.minimizeWindow();
```

### Screenshots

```typescript
await driver.saveScreenshot('path/to/screenshot.png');
```

### Keyboard Input

```typescript
await driver.keys(['Control', 'a']); // Select all
await driver.keys(['Control', 'c']); // Copy
await driver.keys(['Tab']);
await driver.keys(['Enter']);
await driver.keys(['Escape']);
```

## Troubleshooting

| Issue | Solution |
|---|---|
| "Could not create session" | Ensure WinAppDriver is installed and Developer Mode is enabled |
| "The system cannot find the file specified" | WinAppDriver.exe not found — install from GitHub releases |
| "Failed to locate opened application window" | App may need time to load; increase `appium:newCommandTimeout` |
| Appium fails to start | Run `npm run appium:doctor` to diagnose; check `./logs/` |
| "appium-windows-driver is not installed" | Run `npm run appium:setup` |
| Element not found | Use Accessibility Insights to verify the element's UIA properties |
| stale element reference | Element re-rendered; re-find it |
