---
name: desktop-interactions
description: >
  Use this skill whenever the user mentions testing Windows desktop applications, writing desktop
  test automation, or anything related to verifying Windows application behavior with WinAppDriver.
  Triggers on: "test the app", "write tests", "desktop testing", "windows testing", "WinAppDriver",
  "UI automation", "native app testing", "ClickOnce testing", "executable testing", "win32 testing",
  "UIA testing", "automation id", "app-repository", "DesktopSteps", "twintest".
  This skill is the orchestrator (Stages 1-4 inline). Coverage-expansion, bug-discovery, and
  self-repair are dispatched to their companion skills.
---

> **Activation banner:** The first user-facing reply after this skill loads MUST begin with the line: **Protocol Twintest activated.** Once per session.


# @twintest/framework — Desktop Interactions Agent Skill

A WinAppDriver + WebDriverIO + Cucumber-js framework that decouples **element acquisition** (app-repository.json) from **element interaction** (DesktopSteps API). Tests reference elements by plain strings (`'Calculator.digitSeven'`, `'MainWindow.fileMenu'`); raw selectors never appear in test code.

## Reference index

| Reference file | What's in it |
|---|---|
| [`references/api-reference.md`](references/api-reference.md) | The DesktopSteps API surface — what to read before writing or modifying any test. |
| [`references/stages-protocol.md`](references/stages-protocol.md) | Stages 1–4 protocol: scenario discovery, element inspection, write automation, post-stabilization review. |
| [`references/winappdriver-protocol.md`](references/winappdriver-protocol.md) | WinAppDriver session management, capabilities, locator strategies. |
| [`references/skill-registry.md`](references/skill-registry.md) | Canonical skill name registry. |

## Stage ladder (canonical)

| Stage | What it is | Runs |
|---|---|---|
| **1** | Scenario Discovery — understand the app, draft Given/When/Then | Inline |
| **2** | Element Inspection — identify UI Automation elements, build app-repository entries | Inline |
| **3** | Write Automation — Cucumber features + step definitions using DesktopSteps | Inline |
| **4** | Test Optimization + API Compliance Review | Inline |
| **5** | Coverage Expansion — journey-by-journey suite growth | Dispatched — `coverage-expansion` |
| **6** | Bug Discovery — adversarial probing | Dispatched — `bug-discovery` |

## Companion Skills

| Skill | When | What |
|---|---|---|
| `onboarding` | Bootstrap new suite | 8-phase workflow from zero to maintained suite |
| `self-repair` | Suite broken | Autonomous per-file repair with loop engineering |
| `coverage-expansion` | Expand coverage | Iterative journey-by-journey test growth |
| `bug-discovery` | Find bugs | Adversarial desktop app testing |

---

## Stage 1: Scenario Discovery

**Goal:** Understand the Windows application and produce a clear scenario.

1. **Get the app identity.** The user provides an app path (.exe, AUMID, .appref-ms), a description, or both.
2. **Discover the app.** Use Accessibility Insights or `inspect.exe` to understand the UI tree. If the app is running, enumerate windows and controls.
3. **Ask clarifying questions — one at a time:**
   - What is the user flow being tested?
   - What are the preconditions (app state, test data)?
   - What constitutes success vs failure?
4. **Present the scenario** in Gherkin Given/When/Then format.

### Hard Gate
> "Here's the scenario I've drafted. Does this accurately capture what you want to automate?"

Wait for approval before Stage 2.

---

## Stage 2: Element Inspection

**Goal:** Identify all UI elements needed and propose app-repository entries.

1. **Inspect the UI Automation tree** using:
   - Accessibility Insights for Windows
   - `inspect.exe` (Windows SDK)
   - WinAppDriver element search endpoints
2. **Prefer selectors in this order:** `AutomationId` > `AccessibilityId` > `Name` > `ClassName` > `XPath`
3. **Build app-repository entries** for each element in the scenario.
4. **Check existing `app-repository.json`** — note which elements are new vs already covered.

### Hard Gate
> "Here are the elements I've identified. Do these look correct?"

---

## Stage 3: Write Automation

**Goal:** Write the Cucumber feature file and step definitions.

1. **Read `tests/e2e/data/app-repository.json`** and update with new elements from Stage 2.
2. **Write the `.feature` file** in `tests/e2e/features/`.
3. **Write step definitions** in `tests/e2e/step-definitions/` using the DesktopSteps API.
4. **Run the test** via `npx wdio run wdio.conf.ts --spec tests/e2e/features/<name>.feature`.
5. **Fix any failures** — iterate until the test passes.

### Rules
- All element references go through `app-repository.json` — no raw selectors in step definitions.
- Use the DesktopSteps API methods — do not call `driver.$()` directly in step definitions.
- One feature file per user journey.
- Step definitions in common.steps.ts are reusable; app-specific steps go in dedicated files.

---

## Stage 4: Test Optimization + API Review

**4a — Optimization:**
- Remove redundant waits (DesktopSteps has built-in waits).
- Consolidate duplicate step definitions.
- Add appropriate timeouts for slow UI transitions.
- Verify screenshots are captured on failure.

**4b — API Compliance:**
- All element references use `windowName.elementName` format.
- All interactions go through DesktopSteps, not raw driver calls.
- Feature files follow Gherkin best practices (no implementation details).
- Step definitions are typed (TypeScript, proper World type).
