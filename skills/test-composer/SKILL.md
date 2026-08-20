---
name: test-composer
description: >
  Compose the full test portfolio for one desktop user journey — happy path, error dialogs,
  invalid inputs, keyboard-only navigation, boundary values, state recovery, and data
  lifecycle variants. Drives a single journey to comprehensive coverage. Triggers on:
  "compose tests for", "full test coverage for", "test portfolio", "all scenarios for",
  "comprehensive tests for", "write all tests for this journey".
---

> **Activation banner:** The first user-facing reply after this skill loads MUST begin with the line: **Protocol Twintest activated.** Once per session.


# Test Composer — Full Test Portfolio for One Desktop Journey

Composes a comprehensive set of test scenarios for a single user journey in a Windows desktop application.

## Prerequisites

- Journey identified (from `journey-mapping` or user description)
- `app-repository.json` populated with elements for this journey
- `desktop-interactions` skill available for test authoring

## Test Categories

For each journey, compose scenarios across these categories:

### 1. Happy Path
The primary success flow — valid inputs, expected sequence, correct output.
- One scenario per distinct success path (if the journey has branches).

### 2. Validation & Error States
- Required field left empty
- Invalid format (wrong date format, non-numeric in numeric field)
- Value out of range (negative quantity, future date where past required)
- Duplicate entry (record already exists)
- Expected error dialog appears with correct message

### 3. Boundary Values
- Minimum valid input (1 character, smallest number)
- Maximum valid input (field length limit, largest allowed number)
- Just below minimum / just above maximum
- Empty string vs whitespace-only

### 4. Keyboard-Only Navigation
- Complete the entire journey using only keyboard (Tab, Enter, Escape, arrow keys)
- Verify focus order matches visual layout
- Verify keyboard shortcuts work (Alt+letter mnemonics)
- Verify Escape closes dialogs without saving

### 5. State Recovery
- Cancel mid-journey — verify app returns to clean state
- Close a dialog with unsaved changes — verify confirmation prompt
- Re-enter the journey after cancellation — verify no stale data
- App remains functional after an error dialog is dismissed

### 6. Data Lifecycle (if applicable)
- Create a record -> verify it appears
- Read/search for the record -> verify correct data
- Update the record -> verify changes persist
- Delete the record -> verify it's gone
- Verify cascading effects (related records updated/removed)

### 7. Concurrent State
- Start the journey, switch to another window, return — verify state preserved
- Minimize/restore during the journey
- Open the same form twice (if allowed) — verify no conflicts

## Workflow

1. **Identify the journey** — read journey-map.md or get from user.
2. **List all elements involved** — read app-repository.json.
3. **Draft scenarios** for each category above that applies.
4. **Present the scenario list** for user approval.
5. **Write feature file** with all approved scenarios.
6. **Write step definitions** using DesktopSteps API (reuse common.steps.ts where possible).
7. **Run and stabilize** — iterate until all scenarios pass.

## Output Format

Single feature file per journey with scenario tags:

```gherkin
@App-WMS
Feature: Create New Order — Full Test Portfolio

  @happy-path
  Scenario: Successfully create a new order with valid inputs
    ...

  @validation
  Scenario: Error when order quantity is empty
    ...

  @boundary
  Scenario: Order with maximum allowed quantity
    ...

  @keyboard
  Scenario: Complete order creation using keyboard only
    ...

  @recovery
  Scenario: Cancel order creation returns to clean state
    ...

  @data-lifecycle
  Scenario: Created order appears in order list
    ...
```

## Rules

- All interactions through DesktopSteps API.
- All elements via app-repository.json.
- Reuse existing step definitions from common.steps.ts where possible.
- Tag each scenario with its category for filtering.
- One feature file per journey — all categories in one file.
