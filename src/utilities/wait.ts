/**
 * Wait helpers — reusable delay functions for hooks, steps, and utilities.
 */

/** Wait for the given number of seconds. */
export function waitSeconds(seconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

/** Wait for the given number of milliseconds. */
export function waitMs(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
