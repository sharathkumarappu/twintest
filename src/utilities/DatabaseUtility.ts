/**
 * DatabaseUtility — SQL sanitization helpers and Oracle connection management.
 *
 * Ported from wms-test-automation's DatabaseUtility.java.
 * Provides safe SQL construction (preventing injection) and a thin connection
 * factory around the `oracledb` driver.
 *
 * Connection credentials are read from environment variables:
 *   - SQL_DATABASE_USER     (fallback: DB_USER)
 *   - SQL_DATABASE_PASSWORD (fallback: DB_PASSWORD)
 *   - SQL_DATABASE_URL      (fallback: DB_URL — Oracle connect string, e.g. "host:port/service")
 */

import oracledb from 'oracledb';

// ---------------------------------------------------------------------------
// SQL sanitization helpers (mirrors DatabaseUtility.java)
// ---------------------------------------------------------------------------

/** Escape a string value for safe inclusion in an SQL literal ('…'). */
export function sqlLiteral(value: string | null | undefined): string {
  if (value == null || value === 'NULL' || value === 'null') {
    return 'NULL';
  }
  return "'" + value.replace(/'/g, "''") + "'";
}

/** Validate and return a numeric string. Throws on non-numeric input. */
export function sqlNumber(value: string | null | undefined, fieldName: string): string {
  if (value == null || !/^\d+$/.test(value)) {
    throw new Error(`Invalid numeric input for ${fieldName}: ${value}`);
  }
  return value;
}

/** Validate an SQL identifier (table name, column name). Only letters, digits, underscores, dots, $. */
export function sqlIdentifier(value: string | null | undefined): string {
  if (value == null || !/^[A-Za-z0-9_$.]+$/.test(value)) {
    throw new Error(`Invalid SQL identifier: ${value}`);
  }
  return value;
}

/** Validate a stored procedure / function name. */
export function sqlProcedureName(name: string | null | undefined): string {
  if (name == null || !/^[A-Za-z0-9_$.]+$/.test(name)) {
    throw new Error(`Invalid procedure name: ${name}`);
  }
  return name;
}

// ---------------------------------------------------------------------------
// Date/time formatting for Oracle (mirrors DatabaseUtility.java)
// ---------------------------------------------------------------------------

const DATE_FORMATS = [
  'yyyyMMdd HH:mm',
  'yyyy-MM-dd HH:mm:ss',
  'yyyy-MM-dd HH:mm:ss.SSS',
  'yyyy-MM-dd HH:mm',
  'dd/MM/yyyy HH:mm:ss',
  'dd-MM-yyyy HH:mm:ss',
  'MM/dd/yyyy HH:mm:ss',
];

/**
 * Try to parse a date string and return a JS Date object.
 * Attempts multiple common formats before giving up.
 */
export function parseDateTime(input: string): Date {
  // Try ISO parse first (handles most standard formats)
  const isoDate = new Date(input);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }
  // Try yyyyMMdd HH:mm format
  const compactMatch = input.match(/^(\d{4})(\d{2})(\d{2}) (\d{2}):(\d{2})$/);
  if (compactMatch) {
    const [, y, m, d, h, min] = compactMatch;
    return new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min));
  }
  throw new Error(`Could not parse date/time: ${input}`);
}

/**
 * Format a Date as an Oracle-compatible timestamp string.
 */
export function toOracleTimestamp(date: Date): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

// ---------------------------------------------------------------------------
// Dynamic datetime parsing (mirrors ContextUtilities.java)
// ---------------------------------------------------------------------------

const DATETIME_KEYWORD_PATTERN = /^(now|today|tomorrow|yesterday)/;
const OFFSET_PATTERN = /([+-]\d+)\s*(days?|hours?|weeks?|minutes?)/g;

/**
 * Parse a dynamic date/time expression and return a Date.
 * Supports: "now", "today", "tomorrow", "yesterday"
 *   with optional offsets: "+2 days", "-4 hours", "+30 minutes", "-1 weeks"
 *   and chained offsets: "tomorrow-280 minutes"
 *
 * Returns null when the input is not a recognised dynamic expression.
 */
export function parseDynamicDateTime(input: string): Date | null {
  if (!input || input.trim() === '') return null;

  const normalized = input.trim().toLowerCase();
  const keywordMatch = normalized.match(DATETIME_KEYWORD_PATTERN);
  if (!keywordMatch) return null;

  const keyword = keywordMatch[1];
  const now = new Date();
  let result: Date;

  switch (keyword) {
    case 'now':
      result = new Date(now);
      break;
    case 'today':
      result = new Date(now);
      break;
    case 'tomorrow':
      result = new Date(now);
      result.setDate(result.getDate() + 1);
      break;
    case 'yesterday':
      result = new Date(now);
      result.setDate(result.getDate() - 1);
      break;
    default:
      return null;
  }

  // Apply all offsets (e.g., "+2 days", "-4 hours")
  let match: RegExpExecArray | null;
  const re = new RegExp(OFFSET_PATTERN.source, OFFSET_PATTERN.flags);
  while ((match = re.exec(normalized)) !== null) {
    const value = parseInt(match[1], 10);
    const unit = match[2].replace(/s$/, ''); // normalise "days" → "day"

    switch (unit) {
      case 'minute':
        result.setMinutes(result.getMinutes() + value);
        break;
      case 'hour':
        result.setHours(result.getHours() + value);
        break;
      case 'day':
        result.setDate(result.getDate() + value);
        break;
      case 'week':
        result.setDate(result.getDate() + value * 7);
        break;
      default:
        throw new Error(`Unsupported time unit: ${unit}`);
    }
  }

  return result;
}

/**
 * If the input is a dynamic datetime expression, parse and format it as
 * "yyyy-MM-dd HH:mm". Otherwise return null (the input is not a datetime).
 */
export function formatDynamicDatetime(input: string): string | null {
  const date = parseDynamicDateTime(input);
  if (!date) return null;
  return toOracleTimestamp(date).slice(0, 16); // "yyyy-MM-dd HH:mm"
}

// ---------------------------------------------------------------------------
// Connection management
// ---------------------------------------------------------------------------

export interface DbConnectionConfig {
  user: string;
  password: string;
  connectString: string;
}

/**
 * Convert a JDBC Oracle URL to oracledb Easy Connect format.
 * Strips the "jdbc:oracle:thin:@//" or "jdbc:oracle:thin:@" prefix so the
 * same .env value works for both Java (wms-test-automation) and Node.
 *
 *   "jdbc:oracle:thin:@//host:port/service"  →  "host:port/service"
 *   "jdbc:oracle:thin:@host:port/service"    →  "host:port/service"
 *   "host:port/service"                      →  "host:port/service" (no-op)
 */
function toEasyConnect(url: string): string {
  return url.replace(/^jdbc:oracle:thin:@\/\/|^jdbc:oracle:thin:@/i, '');
}

/**
 * Build a connection config from environment variables or explicit overrides.
 * Falls back to process.env values when individual fields are omitted.
 * Automatically strips JDBC prefixes from the connect string.
 */
export function getConnectionConfig(overrides?: Partial<DbConnectionConfig>): DbConnectionConfig {
  const raw = overrides?.connectString ?? process.env.SQL_DATABASE_URL ?? process.env.DB_URL ?? '';
  return {
    user: overrides?.user ?? process.env.SQL_DATABASE_USER ?? process.env.DB_USER ?? '',
    password: overrides?.password ?? process.env.SQL_DATABASE_PASSWORD ?? process.env.DB_PASSWORD ?? '',
    connectString: toEasyConnect(raw),
  };
}

/**
 * Acquire a standalone Oracle connection.
 * Caller is responsible for closing it via `conn.close()`.
 */
export async function getConnection(config?: Partial<DbConnectionConfig>): Promise<oracledb.Connection> {
  const cfg = getConnectionConfig(config);
  if (!cfg.user || !cfg.password || !cfg.connectString) {
    throw new Error(
      'Database connection not configured. Set SQL_DATABASE_USER (or DB_USER), SQL_DATABASE_PASSWORD (or DB_PASSWORD), and SQL_DATABASE_URL (or DB_URL) environment variables.',
    );
  }
  return oracledb.getConnection({
    user: cfg.user,
    password: cfg.password,
    connectString: cfg.connectString,
  });
}

/**
 * Execute a SELECT query and return rows as an array of plain objects.
 * Each row maps column names (uppercased) to their values.
 */
export async function executeRawQuery(
  conn: oracledb.Connection,
  sql: string,
): Promise<Array<Record<string, unknown>>> {
  const result = await conn.execute(sql, [], {
    outFormat: oracledb.OUT_FORMAT_OBJECT,
  });
  return (result.rows ?? []) as Array<Record<string, unknown>>;
}

/**
 * Execute a DML statement (INSERT / UPDATE / DELETE) and return the number
 * of rows affected. Automatically commits.
 */
export async function executeRawDML(
  conn: oracledb.Connection,
  sql: string,
): Promise<number> {
  const result = await conn.execute(sql, [], { autoCommit: true });
  return result.rowsAffected ?? 0;
}
