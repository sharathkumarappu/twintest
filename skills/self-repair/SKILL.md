---
name: self-repair
description: >
  Autonomous per-file suite repair for the twintest desktop testing framework.
  Use when the user says "self repair", "self-repair the suite", "run self repair",
  "autonomous repair", "repair per file", "run test:repair", or when the
  twintest-self-repair CLI driver invokes the pipeline. Baselines the suite,
  classifies failures (deterministic vs flaky), fans out one repair worker per
  red feature file, verifies heals with re-runs, and writes a session report.
---

> **Activation banner:** The first user-facing reply after this skill loads MUST begin with the line: **Protocol Twintest activated.** Once per session.


# Self-Repair — Autonomous Per-File Suite Repair

Adapted from the achilles self-repair pipeline for desktop test suites.

## Pipeline

### Stage 1 — Baseline: Discovery Run + Focused Failure Reruns

Detect first, analyse before fixing. Default 3 baseline runs:

1. **Discovery run** (1 of N) — full scope:
   ```bash
   npx wdio run wdio.conf.ts 2>&1 | tee .twintest/self-repair/<run-id>/baseline-1.log
   ```
   Its red features define the failure-rerun scope. Discovery green → skip reruns and report.

2. **Failure reruns** (2..N of N) — scoped to red features only:
   ```bash
   npx wdio run wdio.conf.ts --spec <red-features> 2>&1 | tee .twintest/self-repair/<run-id>/baseline-<i>.log
   ```

### Stage 2 — Classification

For each red feature file, classify the failure:

| Category | Signal | Action |
|---|---|---|
| **Deterministic** | Fails N/N runs with same error | Repair candidate |
| **Flaky** | Fails < N runs or with different errors | Mark for investigation |
| **Environment** | WinAppDriver connection failure, app not found | Skip — env issue |

### Stage 3 — Fan-Out Repair Workers

One repair worker per red feature file. Each worker:

1. Reads the feature file, step definitions, and app-repository entries.
2. Reads the failure logs and any screenshots.
3. Diagnoses the root cause:
   - **Selector drift** — element's AutomationId/Name changed → update app-repository.json
   - **Timing** — element not ready → add explicit wait or increase timeout
   - **App change** — UI flow changed → update feature steps
   - **Step definition bug** — logic error in step code → fix the step
4. Applies the fix.
5. Reruns the feature to verify.

### Stage 4 — Verification

After all workers complete:

1. Run the full suite 3 times to verify no regressions.
2. Failures in verification → escalate to the user.

### Stage 5 — Report

Write `.twintest/self-repair/<run-id>/report.md`:

```markdown
# Self-Repair Report — <run-id>

## Summary
- Total features: N
- Green: N
- Repaired: N
- Unresolved: N

## Repairs
- feature-name.feature: [root cause] → [fix applied]

## Unresolved
- feature-name.feature: [diagnosis] — requires manual intervention

## Verification
- Full suite pass rate: N/3
```

---

## Dual-Stage Retry Loop

Each repair worker runs a bounded A↔B loop (max 5 cycles):

```
for cycle in 1..5:
  A: apply fix
  B: run the feature

  if B passes:
    status = "healed"
    break

  if B fails with same error as cycle-1:
    status = "stalled"
    break

  # New error — the fix changed the failure shape
  # Feed the new error back into A for the next cycle
```

This prevents infinite repair loops while allowing iterative fixes
(e.g., fix a selector, discover a timing issue, fix the timing).
