import * as arrow from 'apache-arrow';
import type { AsyncDuckDB, AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import type {
  QueryResult,
  QueryResultColumn,
  SafeEntityId,
  SafeIdentifier,
  SafeSqlQuery,
  SheetModel,
} from '@unsheet/contracts';
import {
  QueryResultSchema,
  SafeIdentifierSchema,
  SafeSqlQuerySchema,
} from '@unsheet/contracts';
import { getSheetTableName } from '@unsheet/engine';

let dbInstance: AsyncDuckDB | null = null;
let connInstance: AsyncDuckDBConnection | null = null;
let initPromise: Promise<{ db: AsyncDuckDB; conn: AsyncDuckDBConnection }> | null = null;

/**
 * Maps Apache Arrow data types to user-friendly column type descriptions.
 */
function mapArrowType(dataType: arrow.DataType): string {
  const typeStr = dataType.toString().toLowerCase();
  if (typeStr.includes('int') || typeStr.includes('float') || typeStr.includes('double') || typeStr.includes('decimal')) {
    return 'number';
  }
  if (typeStr.includes('date') || typeStr.includes('timestamp') || typeStr.includes('time')) {
    return 'date';
  }
  if (typeStr.includes('bool')) {
    return 'boolean';
  }
  return 'string';
}

/**
 * Initializes or retrieves the active DuckDB-WASM singleton in a browser environment.
 */
export async function getDuckDB(): Promise<{ db: AsyncDuckDB; conn: AsyncDuckDBConnection }> {
  if (typeof window === 'undefined') {
    throw new Error('DuckDB-WASM can only be initialized in a browser environment');
  }

  if (dbInstance && connInstance) {
    return { db: dbInstance, conn: connInstance };
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const duckdb = await import('@duckdb/duckdb-wasm');
    const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

    const worker = new Worker(bundle.mainWorker!);
    const logger = new duckdb.ConsoleLogger();
    const db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

    const conn = await db.connect();
    dbInstance = db;
    connInstance = conn;
    return { db, conn };
  })();

  return initPromise;
}

/**
 * Converts an Apache Arrow Table into a contract-validated QueryResult.
 * Safely converts BigInt values to JavaScript numbers or strings to prevent serialization errors.
 */
export function arrowTableToQueryResult(
  table: arrow.Table,
  queryId?: string,
  executionTimeMs?: number
): QueryResult {
  const columns: QueryResultColumn[] = table.schema.fields.map((field) => ({
    name: field.name as SafeIdentifier,
    type: mapArrowType(field.type),
  }));

  const rows = table.toArray().map((row) => {
    const json = row.toJSON();
    const convertedRow: Record<SafeIdentifier, unknown> = {};
    for (const [key, val] of Object.entries(json)) {
      if (typeof val === 'bigint') {
        convertedRow[key as SafeIdentifier] =
          val <= BigInt(Number.MAX_SAFE_INTEGER) && val >= BigInt(Number.MIN_SAFE_INTEGER)
            ? Number(val)
            : val.toString();
      } else {
        convertedRow[key as SafeIdentifier] = val;
      }
    }
    return convertedRow;
  });

  const safeQueryId = (queryId ?? `q_${Date.now()}`).slice(0, 64) as SafeEntityId;

  const result: QueryResult = {
    queryId: safeQueryId,
    columns,
    rows,
    rowCount: rows.length,
    executionTimeMs: Math.max(0, executionTimeMs ?? 0),
    cached: false,
  };

  return QueryResultSchema.parse(result);
}

/**
 * Registers a SheetModel's rows as a queryable table inside DuckDB-WASM.
 */
export async function registerSheetTable(
  sheet: SheetModel,
  tableName?: string
): Promise<string> {
  const tableKey = tableName ?? getSheetTableName(sheet);
  SafeIdentifierSchema.parse(tableKey);

  const { conn } = await getDuckDB();

  try {
    await conn.query(`DROP TABLE IF EXISTS "${tableKey}"`);
  } catch (err) {
    void err;
  }

  if (sheet.rows.length === 0) {
    const colDefs = sheet.columns
      .map((c) => `"${c.key}" VARCHAR`)
      .join(', ');
    await conn.query(`CREATE TABLE "${tableKey}" (${colDefs})`);
    return tableKey;
  }

  const arrowTable = arrow.tableFromJSON(sheet.rows);
  await conn.insertArrowTable(arrowTable, {
    name: tableKey,
    create: true,
  });

  return tableKey;
}

export interface DuckDBQueryOptions {
  timeoutMs?: number;
  queryId?: string;
}

// FIFO Mutex queue for serializing queries against DuckDB connection
let queryQueueTail: Promise<unknown> = Promise.resolve();

async function runWithDuckDBMutex<T>(fn: () => Promise<T>): Promise<T> {
  const previousTail = queryQueueTail;
  let release: () => void = () => {};
  queryQueueTail = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previousTail;
  try {
    return await fn();
  } finally {
    release();
  }
}

/**
 * Executes a SafeSqlQuery against the DuckDB-WASM instance with an execution timeout and query serialization mutex.
 */
export async function executeDuckDBQuery(
  sql: SafeSqlQuery,
  options?: DuckDBQueryOptions
): Promise<QueryResult> {
  const validatedSql = SafeSqlQuerySchema.parse(sql);
  const timeoutMs = options?.timeoutMs ?? 5000;
  const queryId = options?.queryId ?? `q_${Date.now()}`;

  return runWithDuckDBMutex(async () => {
    const { conn } = await getDuckDB();

    const startTime = performance.now();

    let timer: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        conn.cancelSent().catch(() => {});
        reject(new Error(`DuckDB query execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      const arrowTable = await Promise.race([
        conn.query(validatedSql),
        timeoutPromise,
      ]);

      const executionTimeMs = Math.round((performance.now() - startTime) * 100) / 100;
      return arrowTableToQueryResult(arrowTable, queryId, executionTimeMs);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  });
}

/**
 * Resets the DuckDB singleton instance and terminates active workers.
 */
export async function resetDuckDB(): Promise<void> {
  if (connInstance) {
    try {
      await connInstance.close();
    } catch (err) {
      void err;
    }
    connInstance = null;
  }
  if (dbInstance) {
    try {
      await dbInstance.terminate();
    } catch (err) {
      void err;
    }
    dbInstance = null;
  }
  initPromise = null;
}

export const DuckDBManager = {
  getInstance: getDuckDB,
  registerSheetTable,
  executeQuery: executeDuckDBQuery,
  reset: resetDuckDB,
  arrowTableToQueryResult,
};
