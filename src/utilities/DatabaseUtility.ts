/**
 * DatabaseUtility — SQL sanitization helpers and Oracle connection management.
 *
 * Ported from wms-test-automation's DatabaseUtility.java.
 * Provides safe SQL construction (preventing injection) and a thin connection
 * factory around the `oracledb` driver.
 *
 * Connection credentials are read from environment variables:
 *   - SQL_DATABASE_USER
 *   - SQL_DATABASE_PASSWORD
 *   - SQL_DATABASE_URL  (Oracle connect string, e.g. "host:port/service")
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
// Connection management
// ---------------------------------------------------------------------------

export interface DbConnectionConfig {
  user: string;
  password: string;
  connectString: string;
}

/**
 * Build a connection config from environment variables or explicit overrides.
 * Falls back to process.env values when individual fields are omitted.
 */
export function getConnectionConfig(overrides?: Partial<DbConnectionConfig>): DbConnectionConfig {
  return {
    user: overrides?.user ?? process.env.SQL_DATABASE_USER ?? '',
    password: overrides?.password ?? process.env.SQL_DATABASE_PASSWORD ?? '',
    connectString: overrides?.connectString ?? process.env.SQL_DATABASE_URL ?? '',
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
      'Database connection not configured. Set SQL_DATABASE_USER, SQL_DATABASE_PASSWORD, and SQL_DATABASE_URL environment variables.',
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
