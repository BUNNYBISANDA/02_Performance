import type { PoolClient } from "pg";
import { closePool, pool } from "./pool.js";

const materializedViews = [
  "o2.mv_quality_defects_unified",
  "o2.mv_scan_qty",
] as const;

export const refreshMaterializedViews = async (client: PoolClient) => {
  for (const view of materializedViews) {
    const exists = await client.query("SELECT to_regclass($1) IS NOT NULL AS exists", [view]);
    if (!exists.rows[0]?.exists) continue;

    const startedAt = performance.now();
    await client.query(`REFRESH MATERIALIZED VIEW ${view}`);
    await client.query(`ANALYZE ${view}`);
    console.info(`[db] refreshed ${view} ${Math.round(performance.now() - startedAt)}ms`);
  }
};

const run = async () => {
  const client = await pool.connect();
  try {
    await refreshMaterializedViews(client);
  } finally {
    client.release();
    await closePool();
  }
};

if (process.argv[1]?.endsWith("refreshMaterializedViews.ts") || process.argv[1]?.endsWith("refreshMaterializedViews.js")) {
  run().catch((error) => {
    console.error("Materialized view refresh failed:");
    console.error(error);
    process.exitCode = 1;
  });
}
