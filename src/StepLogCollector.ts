/**
 * StepLogCollector — TypeScript port of StepLogCollector.java
 *
 * Intercepts console.log/warn/error/info calls, buffers messages,
 * strips ANSI escape codes, and masks sensitive data (passwords,
 * tokens, secrets). After each step, the buffer is drained and
 * attached as a collapsible HTML block in the Cucumber report.
 */

const ANSI_PATTERN = /\u001B\[[;\d]*m/g;
const SENSITIVE_KEYWORD = /password|pwd|secret|token|credential|api[_-]?key/i;
const VALUE_AFTER_TEXT = /((?:text|value):\s*)\S+/gi;
const VALUE_AFTER_CONTEXT = /(context\s+\S*(?:password|pwd|secret|token|credential|api[_-]?key)\S*\s+)\S+/gi;

const buffer: string[] = [];

let installed = false;
let originalConsole: {
  log: typeof console.log;
  warn: typeof console.warn;
  error: typeof console.error;
  info: typeof console.info;
};

function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, '');
}

function maskSensitive(line: string): string {
  if (!SENSITIVE_KEYWORD.test(line)) return line;
  line = line.replace(VALUE_AFTER_TEXT, '$1****');
  line = line.replace(VALUE_AFTER_CONTEXT, '$1****');
  return line;
}

function formatArgs(args: unknown[]): string {
  return args
    .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
    .join(' ');
}

function capture(level: string, ...args: unknown[]): void {
  const message = formatArgs(args);
  const entry = `[${level}] ${message}`;
  buffer.push(maskSensitive(stripAnsi(entry)));
}

export const StepLogCollector = {
  /**
   * Install the collector — monkey-patches console methods to buffer output.
   * The original methods are still called so terminal output is preserved.
   */
  install(): void {
    if (installed) return;

    originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
    };

    console.log = (...args: unknown[]) => {
      capture('LOG', ...args);
      originalConsole.log(...args);
    };
    console.warn = (...args: unknown[]) => {
      capture('WARN', ...args);
      originalConsole.warn(...args);
    };
    console.error = (...args: unknown[]) => {
      capture('ERROR', ...args);
      originalConsole.error(...args);
    };
    console.info = (...args: unknown[]) => {
      capture('INFO', ...args);
      originalConsole.info(...args);
    };

    installed = true;
  },

  /**
   * Uninstall the collector — restores original console methods.
   */
  uninstall(): void {
    if (!installed) return;
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.info = originalConsole.info;
    installed = false;
  },

  /**
   * Drain all buffered log messages and return them as a single string.
   * The buffer is cleared after draining.
   * Returns null if no messages were buffered.
   */
  drain(): string | null {
    if (buffer.length === 0) return null;
    const result = buffer.join('\n');
    buffer.length = 0;
    return result;
  },
};
