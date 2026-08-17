#!/usr/bin/env node
// self-repair.mjs — external driver for autonomous desktop suite repair.
//
// Adapted from achilles self-repair: baselines the suite, classifies failures,
// spawns one repair worker per red feature file, verifies heals, and writes
// an audit-grade report.
//
// Consumers reach this through `npm run test:repair`.
//
// Exit codes: 0 = every test green or explained, 2 = unresolved, 1 = driver error.

import { spawn, execSync } from 'node:child_process';
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

const HELP = `twintest-self-repair — autonomous per-file suite repair

Usage: twintest-self-repair [options]

Options:
  --baseline-runs <n>   Baseline runs for flake classification (default 3)
  --verify-runs <n>     Post-repair verification runs (default 3)
  --max-rounds <n>      Repair cycles per feature before giving up (default 5)
  --dry-run             Baseline + classification only, no repairs
  -h, --help            Show this help
`;

function parseArgs(argv) {
  const opts = {
    baselineRuns: 3,
    verifyRuns: 3,
    maxRounds: 5,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--baseline-runs': opts.baselineRuns = Number(argv[++i]); break;
      case '--verify-runs': opts.verifyRuns = Number(argv[++i]); break;
      case '--max-rounds': opts.maxRounds = Number(argv[++i]); break;
      case '--dry-run': opts.dryRun = true; break;
      case '-h': case '--help': console.log(HELP); process.exit(0);
      default: console.error(`Unknown option: ${a}`); process.exit(1);
    }
  }

  return opts;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function runId() {
  return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
}

function runSuite(label, extraArgs = []) {
  console.log(`[self-repair] ${label}...`);
  try {
    const result = execSync(
      `npx wdio run wdio.conf.ts ${extraArgs.join(' ')}`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 300000 },
    );
    return { passed: true, output: result };
  } catch (err) {
    return { passed: false, output: err.stdout || err.message };
  }
}

function extractRedFeatures(output) {
  // Parse WDIO spec reporter output to find failed feature files
  const failures = [];
  const lines = output.split('\n');
  for (const line of lines) {
    const match = line.match(/✗\s+(.+\.feature)/i) || line.match(/FAILED.*?([^\s]+\.feature)/i);
    if (match) {
      failures.push(match[1].trim());
    }
  }
  return [...new Set(failures)];
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const id = runId();
  const runDir = join('.twintest', 'self-repair', id);
  mkdirSync(runDir, { recursive: true });

  console.log(`[self-repair] Run ID: ${id}`);
  console.log(`[self-repair] Baseline runs: ${opts.baselineRuns}`);

  // Stage 1 — Baseline
  const baselineResults = [];
  let allRedFeatures = new Set();

  for (let i = 1; i <= opts.baselineRuns; i++) {
    const label = i === 1 ? 'Discovery run (full scope)' : `Failure rerun ${i}/${opts.baselineRuns}`;
    const result = runSuite(label);
    baselineResults.push(result);

    writeFileSync(join(runDir, `baseline-${i}.log`), result.output);

    if (!result.passed) {
      const reds = extractRedFeatures(result.output);
      reds.forEach(f => allRedFeatures.add(f));
    }
  }

  const redFeatures = [...allRedFeatures];

  if (redFeatures.length === 0) {
    console.log('[self-repair] All features passed in baseline. Nothing to repair.');
    writeReport(runDir, id, opts, redFeatures, [], { runs: 0, allGreen: true });
    process.exit(0);
  }

  console.log(`[self-repair] Red features (${redFeatures.length}):`);
  redFeatures.forEach(f => console.log(`  - ${f}`));

  // Stage 2 — Classification
  const classification = redFeatures.map(feature => {
    const failCount = baselineResults.filter(r => !r.passed && r.output.includes(feature)).length;
    let category;
    if (failCount === opts.baselineRuns) {
      category = 'deterministic';
    } else if (failCount > 0) {
      category = 'flaky';
    } else {
      category = 'environment';
    }
    return { feature, category, failCount };
  });

  console.log('[self-repair] Classification:');
  classification.forEach(c => console.log(`  ${c.feature}: ${c.category} (${c.failCount}/${opts.baselineRuns})`));

  writeFileSync(join(runDir, 'classification.json'), JSON.stringify(classification, null, 2));

  if (opts.dryRun) {
    console.log('[self-repair] Dry run — stopping after classification.');
    process.exit(0);
  }

  // Stage 3 — Repair (placeholder — actual repair requires Claude agent workers)
  console.log('[self-repair] Stage 3: Repair workers would be dispatched here.');
  console.log('[self-repair] In interactive mode, use the self-repair skill to dispatch Agent-tool workers.');
  console.log('[self-repair] In script mode, this driver would spawn `claude -p` subprocesses per red feature.');

  const repairs = classification.map(c => ({
    feature: c.feature,
    status: 'operator-pending',
    rootCause: 'Awaiting repair worker dispatch',
    cycles: 0,
  }));

  // Stage 4 — Verification (skip if no repairs applied)
  const verification = { runs: 0, allGreen: false, failures: redFeatures };

  // Stage 5 — Report
  writeReport(runDir, id, opts, redFeatures, repairs, verification);

  const unresolved = repairs.filter(r => r.status !== 'healed').length;
  console.log(`[self-repair] Report written to ${runDir}/report.json`);
  process.exit(unresolved > 0 ? 2 : 0);
}

function writeReport(runDir, id, opts, redFeatures, repairs, verification) {
  const report = {
    runId: id,
    mode: 'script',
    timestamp: new Date().toISOString(),
    baseline: {
      runs: opts.baselineRuns,
      redFeatures,
      greenFeatures: [],
    },
    classification: [],
    repairs,
    verification,
    summary: {
      total: redFeatures.length,
      healed: repairs.filter(r => r.status === 'healed').length,
      unresolved: repairs.filter(r => !['healed', 'app-bug', 'quarantined'].includes(r.status)).length,
      appBugs: repairs.filter(r => r.status === 'app-bug').length,
      quarantined: repairs.filter(r => r.status === 'quarantined').length,
    },
  };

  writeFileSync(join(runDir, 'report.json'), JSON.stringify(report, null, 2));

  // Human-readable report
  const md = `# Self-Repair Report — ${id}

## Summary
- Total red features: ${report.summary.total}
- Healed: ${report.summary.healed}
- Unresolved: ${report.summary.unresolved}
- App bugs: ${report.summary.appBugs}
- Quarantined: ${report.summary.quarantined}

## Repairs
${repairs.map(r => `- \`${r.feature}\`: **${r.status}** — ${r.rootCause || 'pending'}`).join('\n')}

## Verification
- Runs: ${verification.runs}
- All green: ${verification.allGreen}
${verification.failures?.length ? `- Remaining failures: ${verification.failures.join(', ')}` : ''}
`;

  writeFileSync(join(runDir, 'report.md'), md);
}

main().catch(err => {
  console.error(`[self-repair] Fatal: ${err.message}`);
  process.exit(1);
});
