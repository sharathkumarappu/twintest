---
name: onboarding
description: >
  End-to-end methodology for adding a brand-new desktop e2e suite to a project.
  Defines the eight-phase workflow (scaffold, groundwork, happy-path, journey-mapping,
  coverage-expansion, bug-discovery, secrets-sweep, report) and the gate criteria
  between phases. Use this skill when a project has no existing desktop test automation
  and needs to be bootstrapped from zero.
---

> **Activation banner:** The first user-facing reply after this skill loads MUST begin with the line: **Protocol Twintest activated.** Once per session.


# Onboarding — Eight-Phase Desktop E2E Bootstrap

Takes a Windows desktop application project from zero e2e tests to a maintained suite.

---

## Phase Map

| # | Phase | What it produces | Skill |
|---|---|---|---|
| 1 | Scaffold | `wdio.conf.ts`, `tests/e2e/{features,step-definitions,support,data,docs}/`, `tsconfig.json`, `package.json` scripts | `desktop-interactions` (Stage 1) |
| 2 | Groundwork | `app-context.md`, `app-repository.json` with initial elements, WinAppDriver connection verified | `desktop-interactions` (Stage 2) |
| 3 | Happy-path | One `tests/e2e/features/<journey>.feature` per primary user flow | `desktop-interactions` (Stages 3–4) |
| 4 | Journey Mapping | `tests/e2e/docs/journey-map.md` — all user flows identified and prioritized | (manual or future `journey-mapping` skill) |
| 5 | Coverage Expansion | Feature files for priority-2/3 journeys | (future `coverage-expansion` skill) |
| 6 | Bug Discovery | Adversarial findings + regression features | (future `bug-discovery` skill) |
| 7 | Secrets Sweep | Credentials/URLs extracted to `.env`; `.env.example` committed | Manual |
| 8 | Report | Summary of suite status, coverage, and known issues | Manual |

---

## Phase 1: Scaffold

**Goal:** Set up the project structure so tests can be written.

### Checklist

- [ ] `package.json` has all twintest dependencies
- [ ] `tsconfig.json` configured for TypeScript
- [ ] `wdio.conf.ts` created with WinAppDriver connection and Cucumber framework
- [ ] Directory structure created:
  ```
  tests/e2e/
    features/
    step-definitions/
    support/
      world.ts
      hooks.ts
    data/
      app-repository.json
    docs/
  ```
- [ ] `screenshots/` directory exists
- [ ] WinAppDriver connectivity verified (`npm run wad:start` or manual start)

### Exit Criteria

- `npx wdio run wdio.conf.ts --spec tests/e2e/features/smoke.feature` executes without framework errors (test itself may fail — that's Stage 3).

---

## Phase 2: Groundwork

**Goal:** Understand the application and prepare element repository.

### Checklist

- [ ] `tests/e2e/docs/app-context.md` written — describes the app, its purpose, entry points, and key workflows
- [ ] App launched via WinAppDriver — session creation works
- [ ] UI tree inspected (Accessibility Insights or `inspect.exe`)
- [ ] `tests/e2e/data/app-repository.json` populated with at least the main window and navigation elements
- [ ] `tests/e2e/support/world.ts` configured with correct repo path
- [ ] `tests/e2e/support/hooks.ts` handles Before/After lifecycle

### Exit Criteria

- A step definition can successfully find and interact with at least one element from the app-repository.

---

## Phase 3: Happy-Path

**Goal:** Write the first passing end-to-end test.

- Invoke `desktop-interactions` Stages 1–4 for the primary user flow.
- The feature file must exercise the app's core functionality.
- The test must pass 3 consecutive runs to prove stability.

### Exit Criteria

- At least one `.feature` file passes reliably.
- Allure report generates with screenshots.

---

## Phases 4–8

Phases 4–8 follow the same gate-criteria pattern as achilles:
- **Phase 4 (Journey Mapping):** Enumerate all user flows, prioritize by business impact.
- **Phase 5 (Coverage Expansion):** One feature per journey, iterative passes.
- **Phase 6 (Bug Discovery):** Adversarial probing of edge cases.
- **Phase 7 (Secrets Sweep):** Extract hardcoded values to `.env`.
- **Phase 8 (Report):** Summary deck of suite status.

These phases will be implemented when their companion skills are built out.
