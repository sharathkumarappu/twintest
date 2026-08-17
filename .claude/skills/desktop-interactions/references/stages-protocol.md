# Stages Protocol — Desktop Interactions Pipeline (Stages 1–4)

**Status:** authoritative spec for the four-stage desktop test-authoring pipeline.
**Scope:** Stage 1 (Scenario Discovery), Stage 2 (Element Inspection), Stage 3 (Write Automation), Stage 4 (Optimization + API Review).

---

## Stage 1: Scenario Discovery

**Goal:** Understand the Windows application and produce a clear, approvable scenario.

### Fast Path

If the user provides a complete scenario or detailed acceptance criteria:
1. Reformat into Given/When/Then Gherkin structure.
2. Ask only about genuinely unclear or ambiguous aspects.
3. Present for approval.

### Full Discovery Process

1. **Get the app identity.** The user may provide:
   - An `.exe` path (classic desktop app)
   - An Application User Model ID (UWP/Store app)
   - A `.appref-ms` path (ClickOnce)
   - A description of the application
2. **Discover the app.** If the app is available:
   - Launch it via WinAppDriver
   - Use `inspect.exe` or Accessibility Insights to examine the UI tree
   - Enumerate windows, controls, and available actions
3. **Ask clarifying questions — one at a time:**
   - What user flow is being tested?
   - What are the preconditions (app installed? specific data state? logged in?)
   - What constitutes success vs failure?
   - Are there edge cases to cover?
4. **Present the scenario** in Gherkin format:

```gherkin
Scenario: [Descriptive name]
  Given [precondition — app state]
  And [additional precondition]
  When [user action]
  And [additional action]
  Then [expected outcome]
  And [additional verification]
```

### Hard Gate

> "Here's the scenario I've drafted. Does this accurately capture what you want to automate?"

**Wait for explicit approval.** Do NOT proceed to Stage 2 without it.

---

## Stage 2: Element Inspection

**Goal:** Identify all UI Automation elements and build app-repository entries.

### Element Discovery Tools

1. **Accessibility Insights for Windows** — Microsoft's free tool for inspecting UIA trees.
2. **inspect.exe** — Ships with Windows SDK, shows full UIA property set.
3. **WinAppDriver element search** — Use driver endpoints to find elements programmatically.

### Locator Strategy Priority

| Priority | Strategy | WinAppDriver syntax | When to use |
|---|---|---|---|
| 1 | `automationId` | `~<id>` (accessibility id) | Always preferred — most stable, survives UI changes |
| 2 | `accessibilityId` | `~<id>` | Same as automationId in WinAppDriver |
| 3 | `name` | `[name="<value>"]` | When AutomationId absent; beware of localized strings |
| 4 | `className` | `.<className>` | Last resort for typed controls; not unique |
| 5 | `xpath` | `//<xpath>` | Complex hierarchies; fragile, avoid when possible |

### Process

1. For each element referenced in the approved scenario:
   - Inspect its UIA properties (AutomationId, Name, ClassName, ControlType)
   - Choose the most stable locator strategy
   - Record in app-repository.json format
2. **Check existing app-repository.json** — reuse existing entries where possible.
3. **Present proposed entries** for review.

### Output Format

```json
{
  "elementName": "saveButton",
  "selector": {
    "automationId": "btnSave",
    "name": "Save"
  },
  "description": "Save button in the main toolbar"
}
```

### Hard Gate

> "Here are the elements I've identified. Do these look correct?"

---

## Stage 3: Write Automation

**Goal:** Write the Cucumber feature and step definitions using DesktopSteps.

### Process

1. **Update app-repository.json** with new elements from Stage 2.
2. **Write the feature file** (`tests/e2e/features/<journey>.feature`).
3. **Write step definitions:**
   - Reusable steps → `tests/e2e/step-definitions/common.steps.ts`
   - App-specific steps → `tests/e2e/step-definitions/<app>.steps.ts`
4. **Run the test:** `npx wdio run wdio.conf.ts --spec tests/e2e/features/<name>.feature`
5. **Iterate until green** — fix selectors, timing, or step logic as needed.

### Rules

- All element references go through app-repository.json.
- All interactions use `this.steps.*` methods from DesktopSteps.
- No raw `driver.$()` calls in step definitions.
- Feature files describe business behaviour, not UI implementation.
- One feature file per user journey.

---

## Stage 4: Optimization + API Review

### 4a — Optimization

- Remove redundant waits (DesktopSteps has built-in element waiting).
- Consolidate duplicate step definitions across feature files.
- Add appropriate timeouts for slow UI transitions (app launch, dialog open).
- Verify failure screenshots are captured and attached to reports.
- Ensure clean app state between scenarios (Background or Before hook).

### 4b — API Compliance

- [ ] All element references use `(windowName, elementName)` from app-repository.
- [ ] All interactions go through DesktopSteps API methods.
- [ ] Feature files use Gherkin best practices (no CSS selectors, no code).
- [ ] Step definitions are properly typed (`this: DesktopWorld`).
- [ ] No hardcoded timeouts — use DesktopSteps defaults or env-configurable values.
- [ ] Screenshots attached to Allure report on failure.
