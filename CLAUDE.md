# @twintest/framework

Windows desktop application test automation framework.
Appium 2.x + WinAppDriver + WebDriverIO + Cucumber-js with AI agent skills.

## Project identity

This is a **desktop-only** testing framework. All tests target Windows native applications
(UWP, Win32, WPF, WinForms, ClickOnce) via WinAppDriver and the UI Automation tree.

## Skills

| Skill | Purpose |
|---|---|
| `desktop-interactions` | Core orchestrator: 4-stage desktop test authoring pipeline |
| `onboarding` | 8-phase bootstrap for new desktop test suites |
| `self-repair` | Autonomous per-file desktop suite repair |
| `bug-discovery` | Adversarial desktop app testing |
| `coverage-expansion` | Journey-by-journey desktop test growth |
| `journey-mapping` | Desktop app flow discovery and prioritization |
| `test-composer` | Full test portfolio for one desktop journey |
| `database-testing` | Oracle DB testing with twintest's Database integration |
| `bug-report` | File defects in Jira |
| `test-catalogue` | Stakeholder-facing scenario inventory |
| `ticket-driven-testing` | QA driven by tickets/PRs |
| `work-summary-deck` | QA work summary presentation |
| `secrets-sweep` | Extract hardcoded credentials to .env |

## Conventions

- All element references go through `app-repository.json` — no raw selectors in test code
- Element names use PascalCase (e.g., `UsernameInput`, `LoginButton`, `WarehouseButton`)
- All interactions use the `DesktopSteps` API — no direct `driver.$()` calls
- App-specific code lives under `tests/e2e/apps/<app-name>/`
- `@App-*` tags on feature files drive GUI lifecycle hooks (Before/After)
- Database connection runs independently of `@App-*` tags
- `CONTEXT-` prefix resolves values from the in-memory context store
- Feature files describe business behaviour, not UI implementation
