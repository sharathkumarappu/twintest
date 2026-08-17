#!/usr/bin/env node

/**
 * postinstall.js — auto-install twintest skills and hooks.
 *
 * Adapted from the achilles postinstall pattern:
 *   - Copies skills to ~/.claude/skills/ and <project>/.claude/skills/
 *   - Copies hooks to ~/.claude/hooks/ and registers them in settings.json
 *   - Idempotent: safe to run multiple times
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const packageDir = path.resolve(__dirname, '..');
const skillsDir = path.join(packageDir, 'skills');

// When installed as a dependency, resolve to the consumer's project root.
const projectRoot = path.resolve(__dirname, '..', '..', '..', '..');

// Skip when running in the package's own repo (local dev).
if (require.main === module && !packageDir.includes('node_modules')) {
  // For local dev, still install skills to project-level .claude/skills/
  installLocalSkills();
  process.exit(0);
}

const homeDir = os.homedir();

const destinations = [
  path.join(projectRoot, '.claude', 'skills'),
  path.join(homeDir, '.claude', 'skills'),
];

function discoverSkills(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .filter(name => fs.existsSync(path.join(root, name, 'SKILL.md')));
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function installLocalSkills() {
  const skills = discoverSkills(skillsDir);
  const localDest = path.join(packageDir, '.claude', 'skills');
  try {
    for (const skill of skills) {
      const srcDir = path.join(skillsDir, skill);
      const destDir = path.join(localDest, skill);
      copyDirRecursive(srcDir, destDir);
    }
    if (skills.length > 0) {
      console.log(`[@twintest] ${skills.length} skill(s) installed to .claude/skills/.`);
    }
  } catch (err) {
    console.warn(`[@twintest] Could not install skills locally: ${err.message}`);
  }
}

function installSkills() {
  const skills = discoverSkills(skillsDir);
  try {
    const installed = new Set();
    for (const dest of destinations) {
      for (const skill of skills) {
        const srcDir = path.join(skillsDir, skill);
        const destDir = path.join(dest, skill);
        copyDirRecursive(srcDir, destDir);
        installed.add(skill);
      }
    }
    if (installed.size > 0) {
      console.log(
        `[@twintest] ${installed.size} skill(s) installed to ${destinations.length} locations — restart Claude Code to pick them up.`,
      );
    }
  } catch (err) {
    console.warn(`[@twintest] Could not install skills: ${err.message}`);
  }
}

// Hook manifest — twintest harness hooks
const HOOK_MANIFEST = [
  {
    file: 'winappdriver-session-guard.sh',
    event: 'PreToolUse',
    matcher: 'Bash',
    timeout: 10,
  },
  {
    file: 'commit-message-gate.sh',
    event: 'PreToolUse',
    matcher: 'Bash',
    timeout: 10,
  },
];

function installHooks() {
  if (process.env.TWINTEST_SKIP_HOOK_INSTALL === '1') {
    console.log('[@twintest] TWINTEST_SKIP_HOOK_INSTALL=1 — hook install skipped.');
    return;
  }

  const userHooksDir = path.join(homeDir, '.claude', 'hooks');
  const settingsPath = path.join(homeDir, '.claude', 'settings.json');
  fs.mkdirSync(userHooksDir, { recursive: true });

  let settings = {};
  if (fs.existsSync(settingsPath)) {
    try {
      const raw = fs.readFileSync(settingsPath, 'utf8').trim();
      settings = raw ? JSON.parse(raw) : {};
    } catch (err) {
      console.warn(`[@twintest] Could not parse ${settingsPath}: ${err.message}`);
      return;
    }
  }

  let copiedCount = 0;
  let registeredCount = 0;
  let settingsModified = false;

  for (const entry of HOOK_MANIFEST) {
    const hookSrc = path.join(packageDir, 'hooks', entry.file);
    if (!fs.existsSync(hookSrc)) continue;

    const hookDest = path.join(userHooksDir, entry.file);

    // Copy if missing or older
    let shouldCopy = !fs.existsSync(hookDest);
    if (!shouldCopy) {
      try {
        shouldCopy = fs.statSync(hookSrc).mtimeMs > fs.statSync(hookDest).mtimeMs;
      } catch {
        shouldCopy = true;
      }
    }
    if (shouldCopy) {
      fs.copyFileSync(hookSrc, hookDest);
      try { fs.chmodSync(hookDest, 0o755); } catch { /* Windows */ }
      copiedCount++;
    }

    // Register in settings.json
    settings.hooks = settings.hooks || {};
    settings.hooks[entry.event] = settings.hooks[entry.event] || [];
    let group = settings.hooks[entry.event].find(
      g => g && (g.matcher || null) === (entry.matcher || null),
    );
    if (!group) {
      group = entry.matcher ? { matcher: entry.matcher, hooks: [] } : { hooks: [] };
      settings.hooks[entry.event].push(group);
    }
    group.hooks = group.hooks || [];
    const alreadyRegistered = group.hooks.some(
      h => h && h.type === 'command' && h.command === hookDest,
    );
    if (!alreadyRegistered) {
      const hookEntry = { type: 'command', command: hookDest };
      if (entry.timeout) hookEntry.timeout = entry.timeout;
      group.hooks.push(hookEntry);
      registeredCount++;
      settingsModified = true;
    }
  }

  // Copy lib/ helpers
  const libSrcDir = path.join(packageDir, 'hooks', 'lib');
  const libDestDir = path.join(userHooksDir, 'lib');
  if (fs.existsSync(libSrcDir)) {
    fs.mkdirSync(libDestDir, { recursive: true });
    for (const entry of fs.readdirSync(libSrcDir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const srcPath = path.join(libSrcDir, entry.name);
      const destPath = path.join(libDestDir, entry.name);
      let shouldCopy = !fs.existsSync(destPath);
      if (!shouldCopy) {
        try {
          shouldCopy = fs.statSync(srcPath).mtimeMs > fs.statSync(destPath).mtimeMs;
        } catch {
          shouldCopy = true;
        }
      }
      if (shouldCopy) {
        fs.copyFileSync(srcPath, destPath);
        copiedCount++;
      }
    }
  }

  if (settingsModified) {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  }

  console.log(
    `[@twintest] Hooks: ${copiedCount} script(s) copied, ${registeredCount} registration(s) added.`,
  );
}

if (require.main === module) {
  try { installSkills(); } catch (err) {
    console.warn(`[@twintest] Skill install error: ${err.message}`);
  }
  try { installHooks(); } catch (err) {
    console.warn(`[@twintest] Hook install error: ${err.message}`);
  }
}

module.exports = { installSkills, installHooks };
