/**
 * Database step definitions — Cucumber Given/When/Then for database operations.
 *
 * Ported from wms-test-automation's DatabaseSteps.java.
 * Mirrors the exact Gherkin patterns so feature files are cross-compatible:
 *   - Verify connection to the database
 *   - Run query {} and store results to {}
 *   - Run query {} and store single result to {}
 *   - Extract column {col} from {source} and store to {target}
 *   - Run insert query on {} table with context variables  (+ DataTable)
 *   - Run update query on {} table with context variables  (+ DataTable)
 *   - Run modification query {}
 *   - Assert that the number of entries in {} is {} - {}
 *   - Run function {} with inputs {}
 *   - Run procedure {} with inputs {} and outputs {}
 *   - Wait for a maximum of {int} seconds for {} to be populated in the {} table for the {} column having value {}
 *
 * All values prefixed with "CONTEXT-" are resolved from the context store.
 */

import { Given, DataTable } from '@cucumber/cucumber';
import { DesktopWorld } from '../support/world.js';
import { sqlLiteral, sqlIdentifier } from '../../../src/utilities/DatabaseUtility.js';
import { waitSeconds } from '../../../src/utilities/wait.js';

// ---------------------------------------------------------------------------
// Connection verification
// ---------------------------------------------------------------------------

Given('Verify connection to the database', async function (this: DesktopWorld) {
  const results = await this.db.executeQuery('SELECT 1 FROM DUAL');
  console.log(`[twintest-db] Connection verified. Result: ${JSON.stringify(results)}`);
});

// ---------------------------------------------------------------------------
// SELECT — multi-row
// ---------------------------------------------------------------------------

Given('Run query {} and store results to {}', async function (
  this: DesktopWorld,
  query: string,
  contextKey: string,
) {
  query = this.db.replaceContexts(query);
  console.log(`[twintest-db] Query: ${query}`);
  const results = await this.db.executeQuery(query);
  this.dbContext[contextKey] = results;
  console.log(`[twintest-db] Query executed. ${results.length} row(s) stored to '${contextKey}'.`);
});

// ---------------------------------------------------------------------------
// SELECT — single value
// ---------------------------------------------------------------------------

Given('Run query {} and store single result to {}', async function (
  this: DesktopWorld,
  query: string,
  contextKey: string,
) {
  query = this.db.replaceContexts(query);
  console.log(`[twintest-db] Query: ${query}`);
  const result = await this.db.executeSingleValueQuery(query);
  if (result == null) {
    throw new Error(`Query returned no results or null value: ${query}`);
  }
  this.context[contextKey] = result;
  console.log(`[twintest-db] Result '${result}' stored to '${contextKey}'.`);
});

// ---------------------------------------------------------------------------
// Extract column from stored results
// ---------------------------------------------------------------------------

Given(/^Extract column (\S+) from (\S+) and store to (\S+)$/, async function (
  this: DesktopWorld,
  columnName: string,
  sourceContextKey: string,
  targetContextKey: string,
) {
  const results = this.dbContext[sourceContextKey] as Array<Record<string, unknown>> | undefined;
  if (!results || !Array.isArray(results) || results.length === 0) {
    throw new Error(`No results found in context key: ${sourceContextKey}`);
  }
  const value = results[0][columnName];
  this.dbContext[targetContextKey] = value;
  // Also store as string in the main context for CONTEXT- resolution
  if (value != null) {
    this.context[targetContextKey] = String(value);
  }
  console.log(`[twintest-db] Extracted ${columnName}: ${value} → '${targetContextKey}'.`);
});

Given(/^Extract column (\S+) from (\S+) and store to (\S+) as text$/, async function (
  this: DesktopWorld,
  columnName: string,
  sourceContextKey: string,
  targetContextKey: string,
) {
  const results = this.dbContext[sourceContextKey] as Array<Record<string, unknown>> | undefined;
  if (!results || !Array.isArray(results) || results.length === 0) {
    throw new Error(`No results found in context key: ${sourceContextKey}`);
  }
  const value = results[0][columnName];
  const textValue = value != null ? String(value) : '';
  this.context[targetContextKey] = textValue;
  this.dbContext[targetContextKey] = textValue;
  console.log(`[twintest-db] Extracted ${columnName}: '${textValue}' → '${targetContextKey}' (as text).`);
});

// ---------------------------------------------------------------------------
// INSERT from context variables
// ---------------------------------------------------------------------------

Given('Run insert query on {} table with context variables', async function (
  this: DesktopWorld,
  tableName: string,
  table: DataTable,
) {
  // DataTable transpose → first row contains all column names
  const transposed = table.transpose().raw();
  const columns = transposed.map(row => row[0]);
  await this.db.runInsertQuery(tableName, columns);
  console.log(`[twintest-db] INSERT into ${tableName} completed.`);
});

// ---------------------------------------------------------------------------
// UPDATE from context variables
// ---------------------------------------------------------------------------

Given('Run update query on {} table with context variables', async function (
  this: DesktopWorld,
  tableName: string,
  table: DataTable,
) {
  const rows = table.raw();
  const setColumns: string[] = [];
  const whereColumns: string[] = [];

  for (const row of rows) {
    if (!row || row.length === 0) {
      throw new Error('DataTable row cannot be empty');
    }
    const rowType = row[0].toUpperCase();
    if (rowType === 'SET') {
      setColumns.push(...row.slice(1));
    } else if (rowType === 'WHERE') {
      whereColumns.push(...row.slice(1));
    } else {
      throw new Error("Each row must start with 'SET' or 'WHERE'");
    }
  }

  if (setColumns.length === 0 || whereColumns.length === 0) {
    throw new Error('DataTable must include at least one SET key and one WHERE key');
  }

  await this.db.runUpdateQuery(tableName, setColumns, whereColumns);
  console.log(`[twintest-db] UPDATE on ${tableName} completed.`);
});

// ---------------------------------------------------------------------------
// Modification query (raw DML)
// ---------------------------------------------------------------------------

Given('Run modification query {}', async function (
  this: DesktopWorld,
  query: string,
) {
  query = this.db.replaceContexts(query);
  console.log(`[twintest-db] Modification query: ${query}`);
  this.db.validateQuerySafety(query);

  const trimmed = query.trim().toUpperCase();
  if (trimmed.startsWith('UPDATE') || trimmed.startsWith('INSERT') || trimmed.startsWith('DELETE')) {
    await this.db.executeDMLQuery(query);
  } else {
    await this.db.executeQuery(query);
  }
  console.log('[twintest-db] Modification query executed.');
});

// ---------------------------------------------------------------------------
// Row count assertions
// ---------------------------------------------------------------------------

Given('Assert that the number of entries in {} is {} - {}', async function (
  this: DesktopWorld,
  contextKey: string,
  comparator: string,
  expectedValue: string,
) {
  const results = this.dbContext[contextKey] as Array<Record<string, unknown>> | undefined;
  if (!results || !Array.isArray(results)) {
    throw new Error(`No results array found in context key: ${contextKey}`);
  }

  const expected = parseInt(expectedValue, 10);
  const actual = results.length;

  switch (comparator) {
    case 'equal to':
      if (actual !== expected) {
        throw new Error(`Row count mismatch! Expected ${expected}, got ${actual}.`);
      }
      break;
    case 'greater than':
      if (!(actual > expected)) {
        throw new Error(`Expected row count (${actual}) to be greater than ${expected}.`);
      }
      break;
    case 'lesser than':
      if (!(actual < expected)) {
        throw new Error(`Expected row count (${actual}) to be lesser than ${expected}.`);
      }
      break;
    default:
      throw new Error(`Unknown comparator: '${comparator}'. Use 'equal to', 'greater than', or 'lesser than'.`);
  }

  console.log(`[twintest-db] Verified: ${actual} entries is ${comparator} ${expected}.`);
});

// ---------------------------------------------------------------------------
// Stored procedure / function
// ---------------------------------------------------------------------------

Given('Run function {} with inputs {}', async function (
  this: DesktopWorld,
  functionName: string,
  inputs: string,
) {
  const result = await this.db.executeFunction(functionName, inputs);
  if (result != null) {
    // If the result is not a valid number, it indicates a function alarm
    if (isNaN(Number(result))) {
      throw new Error(`Function failed with alarm code: ${result}`);
    }
  }
  console.log('[twintest-db] Function executed successfully.');
});

Given('Run procedure {} with inputs {} and outputs {}', async function (
  this: DesktopWorld,
  procedureName: string,
  inputs: string,
  outputs: string,
) {
  const result = await this.db.executeProcedure(procedureName, inputs, outputs);
  if (result != null) {
    throw new Error(`Procedure failed with alarm code: ${result}`);
  }
  console.log('[twintest-db] Procedure executed successfully.');
});

// ---------------------------------------------------------------------------
// Polling wait for data population
// ---------------------------------------------------------------------------

Given(
  'Wait for a maximum of {int} seconds for {} to be populated in the {} table for the {} column having value {}',
  async function (
    this: DesktopWorld,
    timeout: number,
    columnName: string,
    tableName: string,
    referenceColumnName: string,
    referenceColumnValue: string,
  ) {
    referenceColumnValue = this.db.contextCheck(referenceColumnValue);
    const query = `SELECT ${sqlIdentifier(columnName)} FROM ${sqlIdentifier(tableName)} WHERE ${sqlIdentifier(referenceColumnName)} = ${sqlLiteral(referenceColumnValue)}`;
    console.log(`[twintest-db] Waiting for data with query: ${query}`);

    let remaining = timeout;
    let found = false;

    while (remaining >= 10) {
      const result = await this.db.executeSingleValueQuery(query);
      if (result != null) {
        console.log(`[twintest-db] Data found: ${result}`);
        found = true;
        break;
      }
      console.log(`[twintest-db] Data not found yet, retrying for another ${remaining}s...`);
      await waitSeconds(10);
      remaining -= 10;
    }

    if (!found) {
      throw new Error('Data was not populated in the table before timeout.');
    }
    console.log('[twintest-db] Data populated in the table successfully.');
  },
);

// ---------------------------------------------------------------------------
// Assert context value (generic — used after DB extraction)
// ---------------------------------------------------------------------------

Given('Assert that value of {} equals {}', async function (
  this: DesktopWorld,
  actualRef: string,
  expected: string,
) {
  const actual = this.contextCheck(actualRef);
  expected = this.contextCheck(expected);
  if (actual !== expected) {
    throw new Error(`Value mismatch! Expected '${expected}', got '${actual}'.`);
  }
  console.log(`[twintest-db] Verified: '${actual}' equals '${expected}'.`);
});
