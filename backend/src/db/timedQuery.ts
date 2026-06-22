import { performance } from "node:perf_hooks";
import type { QueryResult, QueryResultRow } from "pg";
import { pool } from "./pool.js";

export const timedQuery = async <Row extends QueryResultRow = QueryResultRow>(
  name: string,
  text: string,
  values: unknown[] = [],
): Promise<QueryResult<Row>> => {
  const startedAt = performance.now();

  try {
    return await pool.query<Row>(text, values);
  } finally {
    const durationMs = Math.round((performance.now() - startedAt) * 10) / 10;
    console.info(`[db] ${name} ${durationMs}ms`);
  }
};
