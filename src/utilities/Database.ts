/**
 * Database — high-level database interaction API.
 *
 * Ported from wms-test-automation's Database.java.
 * Provides query execution, DML operations, stored procedure/function calls,
 * and INSERT/UPDATE query builders driven by context variables.
 *
 * Designed to mirror the Java implementation so that Cucumber feature files
 * using the same Gherkin step syntax work without modification.
 */

import oracledb from 'oracledb';
import {
  getConnection,
  executeRawQuery,
  executeRawDML,
  sqlLiteral,
  sqlNumber,
  sqlIdentifier,
  sqlProcedureName,
  parseDateTime,
  parseDynamicDateTime,
  toOracleTimestamp,
  type DbConnectionConfig,
} from './DatabaseUtility.js';
import { waitMs } from './wait.js';

// Re-export sanitization helpers for direct use in step definitions
export { sqlLiteral, sqlNumber, sqlIdentifier } from './DatabaseUtility.js';

export type ContextStore = Record<string, string>;
export type DbContextStore = Record<string, unknown>;

export class Database {
  private contextRef: ContextStore;
  private dbContextRef: DbContextStore;
  private configOverrides?: Partial<DbConnectionConfig>;

  constructor(
    context: ContextStore,
    dbContext: DbContextStore,
    configOverrides?: Partial<DbConnectionConfig>,
  ) {
    this.contextRef = context;
    this.dbContextRef = dbContext;
    this.configOverrides = configOverrides;
  }

  // ---------------------------------------------------------------------------
  // Context helpers (mirrors ContextUtilities / ContextStore from Java)
  // ---------------------------------------------------------------------------

  /** Replace all CONTEXT-{key} tokens in a string with values from the context store. */
  replaceContexts(input: string): string {
    return input.replace(/CONTEXT-(\w+)/g, (_match, key) => {
      const value = this.contextRef[key];
      if (value === undefined) {
        throw new Error(`Context key '${key}' not found. Available: ${Object.keys(this.contextRef).join(', ')}`);
      }
      return value;
    });
  }

  /** Resolve a value that may be a CONTEXT- reference. */
  contextCheck(value: string): string {
    if (value.startsWith('CONTEXT-')) {
      const key = value.substring(8);
      const resolved = this.contextRef[key];
      if (resolved === undefined) {
        throw new Error(`Context key '${key}' not found. Available: ${Object.keys(this.contextRef).join(', ')}`);
      }
      return resolved;
    }
    return value;
  }

  // ---------------------------------------------------------------------------
  // Query execution (mirrors Database.java)
  // ---------------------------------------------------------------------------

  /**
   * Execute a SELECT query and return all rows.
   * Supports optional retry logic controlled by RECORD_TIMEOUT and RETRY_EMPTY_QUERY context vars.
   */
  async executeQuery(sql: string): Promise<Array<Record<string, unknown>>> {
    const conn = await getConnection(this.configOverrides);
    try {
      const retryEmpty = this.contextRef['RETRY_EMPTY_QUERY'] === 'true';
      const recordTimeout = parseInt(this.contextRef['RECORD_TIMEOUT'] ?? '10000', 10);
      const checkInterval = 60_000; // 60 seconds between retries

      let results: Array<Record<string, unknown>>;
      const startTime = Date.now();
      let attempts = 0;

      do {
        attempts++;
        results = await executeRawQuery(conn, sql);

        if (results.length > 0 || !retryEmpty) break;

        const elapsed = Date.now() - startTime;
        if (elapsed >= recordTimeout) break;

        await waitMs(Math.min(checkInterval, recordTimeout - elapsed));
      } while (true);

      if (attempts > 1) {
        const duration = Math.round((Date.now() - startTime) / 1000);
        console.log(`[twintest-db] Checked ${attempts} times. Took ~${duration}s for entry to appear.`);
      }

      return results;
    } finally {
      await conn.close();
    }
  }

  /**
   * Execute a SELECT query that is expected to return exactly one row with one column.
   * Returns the value as a string, or null if no rows.
   */
  async executeSingleValueQuery(sql: string): Promise<string | null> {
    const results = await this.executeQuery(sql);

    if (results.length === 0) return null;

    if (results.length > 1) {
      throw new Error(`Expected single row but got ${results.length} rows for query: ${sql}`);
    }

    const row = results[0];
    const keys = Object.keys(row);

    if (keys.length > 1) {
      throw new Error(`Expected single column but got ${keys.length} columns: ${keys.join(', ')}`);
    }

    const value = row[keys[0]];
    return value != null ? String(value) : null;
  }

  /**
   * Execute a DML statement (INSERT / UPDATE / DELETE).
   * Returns the number of rows affected.
   */
  async executeDMLQuery(sql: string): Promise<number> {
    const conn = await getConnection(this.configOverrides);
    try {
      // Set Oracle NLS settings (mirrors Database.java)
      await conn.execute("ALTER SESSION SET NLS_NUMERIC_CHARACTERS = '.,'");
      const rowsAffected = await executeRawDML(conn, sql);
      console.log(`[twintest-db] DML executed. Rows affected: ${rowsAffected}`);
      if (rowsAffected === 0) {
        console.warn('[twintest-db] Warning: No rows were affected.');
      }
      return rowsAffected;
    } finally {
      await conn.close();
    }
  }

  // ---------------------------------------------------------------------------
  // Stored procedures & functions (mirrors Database.java)
  // ---------------------------------------------------------------------------

  /**
   * Execute an Oracle stored procedure.
   *
   * @param procedureName - Name of the procedure (validated as safe identifier)
   * @param inputs - Pipe-separated input definitions: "Type->Value | Type->Value"
   *                 Types: Int, String, Timestamp, Null
   * @param outputs - Pipe-separated output parameter names: "PARAM1 | PARAM2"
   * @returns The last output parameter value, or null if no outputs
   */
  async executeProcedure(procedureName: string, inputs: string, outputs: string): Promise<string | null> {
    const safeName = sqlProcedureName(procedureName);
    const inputDefs = this.splitParameterDefinitions(inputs);
    const outputDefs = this.splitParameterDefinitions(outputs);
    const totalParams = inputDefs.length + outputDefs.length;

    const bindParams: Record<string, oracledb.BindParameter> = {};
    let paramIndex = 0;

    // Bind input parameters
    for (const def of inputDefs) {
      const { type, value } = this.parseTypedParameter(def);
      bindParams[`p${paramIndex}`] = { dir: oracledb.BIND_IN, type, val: value };
      paramIndex++;
    }

    // Bind output parameters
    for (const _def of outputDefs) {
      bindParams[`p${paramIndex}`] = { dir: oracledb.BIND_OUT, type: oracledb.STRING };
      paramIndex++;
    }

    // Build SQL with named bind variables
    let sql = `BEGIN ${safeName}(`;
    sql += Array.from({ length: totalParams }, (_, i) => `:p${i}`).join(', ');
    sql += '); END;';

    console.log(`[twintest-db] Procedure: ${procedureName}. Inputs: ${inputs}`);
    const conn = await getConnection(this.configOverrides);
    try {
      const result = await conn.execute(sql, bindParams);

      // Return last output value
      if (outputDefs.length > 0) {
        const lastOutputKey = `p${totalParams - 1}`;
        const outVal = (result.outBinds as Record<string, unknown>)?.[lastOutputKey];
        console.log(`[twintest-db] Procedure output: ${outVal}`);
        return outVal != null ? String(outVal) : null;
      }
      return null;
    } finally {
      await conn.close();
    }
  }

  /**
   * Execute an Oracle function and return its result.
   *
   * @param functionName - Name of the function (validated as safe identifier)
   * @param inputs - Pipe-separated input definitions: "Type->Value | Type->Value"
   * @returns The function return value as a string
   */
  async executeFunction(functionName: string, inputs: string): Promise<string | null> {
    const safeName = sqlProcedureName(functionName);
    const inputDefs = this.splitParameterDefinitions(inputs);

    const bindParams: Record<string, oracledb.BindParameter> = {
      ret: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
    };

    for (let i = 0; i < inputDefs.length; i++) {
      const { type, value } = this.parseTypedParameter(inputDefs[i]);
      bindParams[`p${i}`] = { dir: oracledb.BIND_IN, type, val: value };
    }

    const inputPlaceholders = inputDefs.map((_, i) => `:p${i}`).join(', ');
    const sql = `BEGIN :ret := ${safeName}(${inputPlaceholders}); END;`;

    console.log(`[twintest-db] Function: ${functionName}. Inputs: ${inputs}`);
    const conn = await getConnection(this.configOverrides);
    try {
      const result = await conn.execute(sql, bindParams);
      const output = (result.outBinds as Record<string, unknown>)?.ret;
      console.log(`[twintest-db] Function output: ${output}`);
      return output != null ? String(output) : null;
    } finally {
      await conn.close();
    }
  }

  // ---------------------------------------------------------------------------
  // INSERT / UPDATE query builders (mirrors Database.java + QueryAttributePair)
  // ---------------------------------------------------------------------------

  /**
   * Convert a context value to its SQL representation, mirroring Java's
   * QueryAttributePair.convertValueFormat() + toString():
   *
   *   1. NULL / "null" / "NULL" → SQL NULL
   *   2. Pure integer (not starting with '0') → bare number
   *   3. Parseable date string → TO_DATE('yyyyMMdd HH:mm', 'YYYYMMDD HH24:MI')
   *   4. Everything else → quoted string literal
   */
  private formatValueForSQL(value: string): string {
    // 1. NULL
    if (value == null || value === 'NULL' || value === 'null') {
      return 'NULL';
    }

    // 2. Integer (not starting with '0' to preserve codes like '0123')
    if (!value.startsWith('0') && /^-?\d+$/.test(value)) {
      return value;
    }

    // 3. Date/time — try parsing as a date string (matches Java's formatDateTimeForOracle)
    const DATE_FORMATS = [
      /^\d{8} \d{2}:\d{2}$/,                  // yyyyMMdd HH:mm
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, // yyyy-MM-dd HH:mm:ss
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/, // yyyy-MM-ddTHH:mm:ss
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/,       // yyyy-MM-dd HH:mm
    ];

    for (const fmt of DATE_FORMATS) {
      if (fmt.test(value)) {
        // Parse and re-format to Oracle's yyyyMMdd HH:mm
        try {
          const date = parseDateTime(value);
          const pad = (n: number, w = 2) => String(n).padStart(w, '0');
          const oracleFmt =
            `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())} ` +
            `${pad(date.getHours())}:${pad(date.getMinutes())}`;
          return `TO_DATE('${oracleFmt}', 'YYYYMMDD HH24:MI')`;
        } catch {
          // Not a valid date — fall through to string
        }
      }
    }

    // 4. String literal (escape single quotes)
    return "'" + value.replace(/'/g, "''") + "'";
  }

  /**
   * Build and execute an INSERT query from context variable keys.
   *
   * @param tableName - Target table (validated as safe identifier)
   * @param columns - List of column names; values are resolved from the context store
   */
  async runInsertQuery(tableName: string, columns: string[]): Promise<void> {
    const safeTable = sqlIdentifier(tableName);
    const values: string[] = columns.map(col => {
      const value = this.contextRef[col];
      if (value === undefined) {
        throw new Error(`Context key '${col}' not found for INSERT into ${tableName}`);
      }
      return this.formatValueForSQL(value);
    });

    const safeColumns = columns.map(c => sqlIdentifier(c));
    const sql = `INSERT INTO ${safeTable} (${safeColumns.join(', ')}) VALUES (${values.join(', ')})`;
    console.log(`[twintest-db] INSERT: ${sql}`);
    await this.executeDMLQuery(sql);
  }

  /**
   * Build and execute an UPDATE query from context variable keys.
   *
   * @param tableName - Target table
   * @param setColumns - Columns for the SET clause; values from context
   * @param whereColumns - Columns for the WHERE clause; values from context
   */
  async runUpdateQuery(tableName: string, setColumns: string[], whereColumns: string[]): Promise<void> {
    const safeTable = sqlIdentifier(tableName);

    const setClauses = setColumns.map(col => {
      const value = this.contextRef[col];
      if (value === undefined) {
        throw new Error(`Context key '${col}' not found for UPDATE SET on ${tableName}`);
      }
      return `${sqlIdentifier(col)} = ${this.formatValueForSQL(value)}`;
    });

    const whereClauses = whereColumns.map(col => {
      const value = this.contextRef[col];
      if (value === undefined) {
        throw new Error(`Context key '${col}' not found for UPDATE WHERE on ${tableName}`);
      }
      return `${sqlIdentifier(col)} = ${this.formatValueForSQL(value)}`;
    });

    const sql = `UPDATE ${safeTable} SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`;
    console.log(`[twintest-db] UPDATE: ${sql}`);
    await this.executeDMLQuery(sql);
  }

  // ---------------------------------------------------------------------------
  // Safety validation
  // ---------------------------------------------------------------------------

  /** Block dangerous DDL operations. Mirrors DatabaseSteps.java validateQuerySafety(). */
  validateQuerySafety(query: string): void {
    const upper = query.toUpperCase();
    if (upper.includes('DROP ') || upper.includes('TRUNCATE ') ||
        upper.includes('GRANT ') || upper.includes('REVOKE ')) {
      throw new Error('DDL operations are not allowed');
    }
    if (query.length > 5000) {
      throw new Error('Query too long (max 5000 characters)');
    }
  }

  /** Check whether a value already exists in a table column. */
  async isDataUsedInDB(table: string, column: string, data: string): Promise<boolean> {
    const sql = `SELECT * FROM ${sqlIdentifier(table)} WHERE ${sqlIdentifier(column)} = ${sqlLiteral(data)}`;
    const result = await this.executeQuery(sql);
    return result.length > 0;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private splitParameterDefinitions(defs: string): string[] {
    if (!defs || defs.trim() === '') return [];
    return defs.split(' | ');
  }

  private parseTypedParameter(def: string): { type: number; value: unknown } {
    const parts = def.split('->');
    const typeName = parts[0].trim();
    const rawValue = parts.length > 1 ? parts[1].trim() : '';

    switch (typeName) {
      case 'Int':
        return { type: oracledb.NUMBER, value: parseInt(rawValue, 10) };
      case 'String':
        return { type: oracledb.STRING, value: rawValue };
      case 'Timestamp': {
        const date = parseDateTime(rawValue);
        return { type: oracledb.DATE, value: date };
      }
      case 'Null':
        return { type: oracledb.STRING, value: null };
      default:
        throw new Error(`Unsupported parameter type: ${typeName}`);
    }
  }

}
