---
name: database-testing
description: >
  Desktop-adapted database testing using twintest's built-in Oracle integration.
  Owns the structured patterns for DB verification in desktop test scenarios: connection
  setup, query execution, row-count assertions, cell-value assertions, stored procedures,
  DML operations, and data lifecycle checks. Uses the Database class, DatabaseUtility,
  context store, and Gherkin step patterns from database.steps.ts. Triggers on:
  "database test", "DB test", "verify in database", "check the database",
  "oracle query", "stored procedure test", "DB health check", "data verification".
---

> **Activation banner:** The first user-facing reply after this skill loads MUST begin with the line: **Protocol Twintest activated.** Once per session.


# Database Testing — Oracle DB Verification for Desktop Apps

Provides structured patterns for verifying database state as part of desktop application testing.

## Architecture

```
.env                          SQL_DATABASE_USER, SQL_DATABASE_PASSWORD, SQL_DATABASE_URL
  |
  v
DatabaseUtility.ts            Connection management, SQL sanitization, JDBC auto-conversion
  |
  v
Database.ts                   Query execution, DML, stored procedures, context resolution
  |
  v
database.steps.ts             Cucumber step definitions (Gherkin patterns)
  |
  v
DesktopWorld.db               Lazy-initialized Database instance per scenario
```

## Available Gherkin Steps

### Connection
```gherkin
* Verify connection to the database
```

### SELECT — Multi-row
```gherkin
* Run query <SQL> and store results to <contextKey>
```

### SELECT — Single value
```gherkin
* Run query <SQL> and store single result to <contextKey>
```

### Column Extraction
```gherkin
* Extract column <col> from <source> and store to <target>
* Extract column <col> from <source> and store to <target> as text
```

### DML (INSERT / UPDATE / DELETE)
```gherkin
* Run modification query <SQL>
* Run insert query on <table> table with context variables
* Run update query on <table> table with context variables
```

### Assertions
```gherkin
* Assert that the number of entries in <key> is equal to - <N>
* Assert that the number of entries in <key> is greater than - <N>
* Assert that the number of entries in <key> is lesser than - <N>
* Assert that value of <actual> equals <expected>
```

### Stored Procedures & Functions
```gherkin
* Run function <name> with inputs <Type->Value | Type->Value>
* Run procedure <name> with inputs <inputs> and outputs <outputs>
```

### Polling Wait
```gherkin
* Wait for a maximum of <N> seconds for <col> to be populated in the <table> table for the <refCol> column having value <refVal>
```

## Context Resolution

All SQL values support `CONTEXT-` prefix resolution:
```gherkin
* Update context orderId -> 12345
* Run query SELECT * FROM orders WHERE id = CONTEXT-orderId and store results to orderResult
```

## Env Vars

| Variable | Fallback | Description |
|----------|----------|-------------|
| `SQL_DATABASE_USER` | `DB_USER` | Oracle username |
| `SQL_DATABASE_PASSWORD` | `DB_PASSWORD` | Oracle password |
| `SQL_DATABASE_URL` | `DB_URL` | Oracle connect string (JDBC prefix auto-stripped) |

## Common Patterns

### Pattern 1: UI Action -> DB Verification
```gherkin
Scenario: Order created in database after UI submission
  * Fill input orderName on the NewOrderPage with text: Test Order
  * Click the submitButton on the NewOrderPage
  * Wait 5 seconds
  * Run query SELECT * FROM orders WHERE name = 'Test Order' and store results to dbResult
  * Assert that the number of entries in dbResult is equal to - 1
```

### Pattern 2: DB Setup -> UI Verification
```gherkin
Scenario: Pre-existing record appears in the UI
  * Run modification query INSERT INTO orders (name, status) VALUES ('Seed Order', 'ACTIVE')
  * Click the refreshButton on the OrderListPage
  * Assert that the orderName element on the OrderListPage contains the text: Seed Order
```

### Pattern 3: DB Health Check (no UI)
```gherkin
Scenario: Database health check
  * Verify connection to the database
  * Run query SELECT COUNT(*) FROM active_sessions and store single result to sessionCount
  * Assert that value of CONTEXT-sessionCount equals 0
```

## Safety

The `Database.validateQuerySafety()` method blocks dangerous DDL:
- `DROP`, `TRUNCATE`, `GRANT`, `REVOKE` are rejected
- Queries longer than 5000 characters are rejected
- All literal values are escaped via `sqlLiteral()` to prevent SQL injection

## Rules

- DB connection is established in a Before hook, independent of `@App-*` tags
- Use `CONTEXT-` prefix to pass data between UI steps and DB steps
- Store multi-row results in `dbContext`, single values in `context`
- Always verify connection before running queries in standalone DB scenarios
- Never use raw SQL in feature files for DDL operations
