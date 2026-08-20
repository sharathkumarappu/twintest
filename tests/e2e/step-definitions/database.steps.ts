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
import { sqlLiteral, sqlNumber, sqlIdentifier } from '../../../src/utilities/DatabaseUtility.js';
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

// ---------------------------------------------------------------------------
// Random data generators (mirrors DatabaseSteps.java)
// ---------------------------------------------------------------------------

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

Given('Generate random Order number', async function (this: DesktopWorld) {
  console.log('[twintest-db] Generating random Order number');
  let orderNumber: string;
  do {
    orderNumber = String(randomInt(10000, 90000));
  } while (
    await this.db.isDataUsedInDB('omlm_store_order', 'order_number', orderNumber) ||
    await this.db.isDataUsedInDB('co', 'coid', orderNumber) ||
    await this.db.isDataUsedInDB('cotrc', 'coid', orderNumber)
  );
  this.context['orderNumber'] = orderNumber;
  console.log(`[twintest-db] Generated random Order number: ${orderNumber}`);
});

Given('Generate random Batch number', async function (this: DesktopWorld) {
  console.log('[twintest-db] Generating random Batch number');
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const batchNumber = `Test${yyyy}-${mm}-${dd}`;
  this.context['BATCHNUMBER'] = batchNumber;
  console.log(`[twintest-db] Generated random Batch number: ${batchNumber}`);
});

Given('Generate random Message number', async function (this: DesktopWorld) {
  console.log('[twintest-db] Generating random Message number');
  let messageNumber: string;
  do {
    const num = randomInt(1, 99999999);
    messageNumber = `A-${String(num).padStart(8, '0')}`;
  } while (await this.db.isDataUsedInDB('MSG_2589_SHIPMENT_T', 'MESSAGENO', messageNumber));
  this.context['MESSAGENO'] = messageNumber;
  console.log(`[twintest-db] Generated unique random Message number: ${messageNumber}`);
});

Given('Generate random Shipment number', async function (this: DesktopWorld) {
  console.log('[twintest-db] Generating random Shipment number');
  let shipmentNumber: string;
  do {
    const num = randomInt(100, 130);
    const now = new Date();
    // ISO week number
    const janFirst = new Date(now.getFullYear(), 0, 1);
    const dayOfYear = Math.ceil((now.getTime() - janFirst.getTime()) / 86400000);
    const weekNumber = Math.ceil((dayOfYear + janFirst.getDay()) / 7);
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // ISO: Mon=1..Sun=7
    shipmentNumber = `h-test-${weekNumber}-${dayOfWeek}-${String(num).padStart(3, '0')}`;
  } while (await this.db.isDataUsedInDB('MSG_2589_SHIPMENT_T', 'SHIPMENTID', shipmentNumber));
  this.context['SHIPMENTID'] = shipmentNumber;
  console.log(`[twintest-db] Generated unique random Shipment number: ${shipmentNumber}`);
});

// ---------------------------------------------------------------------------
// Order verification (mirrors DatabaseSteps.java)
// ---------------------------------------------------------------------------

Given('Verify that order with number {} and message number {} is created in omlm_store_order', async function (
  this: DesktopWorld,
  orderNumber: string,
  messageNumber: string,
) {
  orderNumber = this.contextCheck(orderNumber);
  messageNumber = this.contextCheck(messageNumber);
  console.log(`[twintest-db] Verifying order ${orderNumber} (msg ${messageNumber}) in omlm_store_order`);

  const safeOrderNumber = sqlNumber(orderNumber, 'orderNumber');
  const safeMessageNumber = sqlLiteral(messageNumber);

  const query =
    'SELECT DISTINCT * FROM omlm_store_order t1 ' +
    'JOIN OMLM_PRODUCT_BY_SOPU_IN_ORDER t2 ' +
    'ON t1.STORE_NUMBER = t2.STORE_NUMBER ' +
    'AND t1.DELIVERY_DATETIME = t2.AFMO_DELIVERY_DATETIME ' +
    'AND t1.AFLS_NUMBER = t2.AFLS_NUMBER ' +
    'WHERE ORDER_NUMBER = ' + safeOrderNumber;

  const results = await this.db.executeQuery(query);

  if (!results || results.length === 0) {
    // Check alert logs for failure details
    const logsQuery =
      'SELECT * FROM ahgs_alert_log ' +
      'JOIN ahgs_alert_log_detail ON allg_id = id ' +
      'WHERE 1=1 AND appl_name = \'OMLM\' ' +
      'AND value = ' + safeMessageNumber + ' ' +
      'AND datetime > sysdate - 1 ORDER BY 1 DESC, 2';
    console.log(`[twintest-db] Checking alert logs: ${logsQuery}`);
    const logResults = await this.db.executeQuery(logsQuery);
    console.log(`[twintest-db] Alert log results: ${JSON.stringify(logResults)}`);
    throw new Error(`Order ${orderNumber} was not created in omlm_store_order.`);
  } else if (results.length === 1) {
    console.log(`[twintest-db] Order ${orderNumber} was successfully created.`);
  } else {
    throw new Error(`More than one order with number ${orderNumber} was created (${results.length} rows).`);
  }
});

Given('Verify that order with route ID {} is created in RMUSER.DEP', async function (
  this: DesktopWorld,
  routeIdRef: string,
) {
  routeIdRef = this.contextCheck(routeIdRef);
  console.log(`[twintest-db] Verifying order with route ID ${routeIdRef} in RMUSER.DEP`);

  const query = 'SELECT * FROM rmuser.dep t0 WHERE t0.route_id_ref = ' + sqlLiteral(routeIdRef);
  const results = await this.db.executeQuery(query);

  if (!results || results.length === 0) {
    const logsQuery =
      'SELECT * FROM ahgs_alert_log ' +
      'JOIN ahgs_alert_log_detail ON allg_id = id ' +
      'WHERE 1=1 AND appl_name = \'IRMS\' ' +
      'AND datetime > sysdate - 1 ORDER BY 1 DESC, 2';
    console.log(`[twintest-db] Checking alert logs: ${logsQuery}`);
    const logResults = await this.db.executeQuery(logsQuery);
    console.log(`[twintest-db] Alert log results: ${JSON.stringify(logResults)}`);
    throw new Error(`Order with route ID ${routeIdRef} was not created in RMUSER.DEP.`);
  } else if (results.length === 1) {
    console.log(`[twintest-db] Order with route ID ${routeIdRef} was successfully created.`);
  } else {
    throw new Error(`More than one order with route ID ${routeIdRef} was created (${results.length} rows).`);
  }
});

// ---------------------------------------------------------------------------
// OMLM batch job (mirrors DatabaseSteps.java)
// ---------------------------------------------------------------------------

Given('Run OMLM batch job to start batch', async function (this: DesktopWorld) {
  console.log('[twintest-db] Running OMLM batch job (P1OMLM.omlm_batch.start_batch)');
  const result = await this.db.executeFunction('P1OMLM.omlm_batch.start_batch', '');
  if (result != null && isNaN(Number(result))) {
    throw new Error(`OMLM batch job failed with alarm code: ${result}`);
  }
  await waitSeconds(10);
  console.log('[twintest-db] OMLM batch job executed successfully.');
});

// ---------------------------------------------------------------------------
// Retry with quarter-hour wait (mirrors DatabaseSteps.java)
// ---------------------------------------------------------------------------

Given('If no entries were found in {} wait until the next quarter hour window for the OML batch job to run and rerun the query {}', async function (
  this: DesktopWorld,
  contextKey: string,
  query: string,
) {
  const results = this.dbContext[contextKey] as Array<Record<string, unknown>> | undefined;
  if (!results || results.length === 0) {
    // Wait until the next quarter-hour boundary
    const now = new Date();
    const currentMinute = now.getMinutes();
    const nextQuarter = (Math.floor(currentMinute / 15) + 1) * 15;
    let waitMinutes: number;
    if (nextQuarter >= 60) {
      waitMinutes = 60 - currentMinute;
    } else {
      waitMinutes = nextQuarter - currentMinute;
    }
    const waitSecs = waitMinutes * 60 - now.getSeconds();
    console.log(`[twintest-db] No entries in '${contextKey}'. Waiting ${waitSecs}s until next quarter-hour window for OMLM batch job`);
    await waitSeconds(waitSecs);
    // Wait extra 180 seconds for batch to complete
    console.log('[twintest-db] Waiting 180s for batch to complete');
    await waitSeconds(180);
    // Re-run the query
    query = this.db.replaceContexts(query);
    console.log(`[twintest-db] Re-running query: ${query}`);
    const newResults = await this.db.executeQuery(query);
    this.dbContext[contextKey] = newResults;
    console.log(`[twintest-db] Re-run query returned ${newResults.length} row(s), stored to '${contextKey}'.`);
  } else {
    console.log(`[twintest-db] Entries found in '${contextKey}' (${results.length} rows) — no need to wait.`);
  }
});
