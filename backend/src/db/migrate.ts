import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { closePool, pool } from "./pool.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(currentDir, "migrations");

const runMigrations = async () => {
  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    throw new Error(`No migration files found in ${migrationsDir}`);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query("CREATE SCHEMA IF NOT EXISTS o2");
    await client.query(`
      CREATE TABLE IF NOT EXISTS o2.schema_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const appliedResult = await client.query<{ filename: string }>(
      "SELECT filename FROM o2.schema_migrations",
    );
    const applied = new Set(appliedResult.rows.map((row) => row.filename));

    if (applied.size === 0) {
      const legacyState = await client.query<{ complete: boolean }>(
        "SELECT to_regclass('o2.v_quality_denominators_unified') IS NOT NULL AS complete",
      );

      if (legacyState.rows[0]?.complete) {
        const legacyFiles = files.filter((file) => file < "006_");
        for (const file of legacyFiles) {
          await client.query(
            "INSERT INTO o2.schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING",
            [file],
          );
          applied.add(file);
        }
        console.log(`Recorded ${legacyFiles.length} existing legacy migration(s).`);
      }
    }

    const pendingFiles = files.filter((file) => !applied.has(file));

    for (const file of pendingFiles) {
      const sql = await readFile(path.join(migrationsDir, file), "utf8");
      console.log(`Running migration ${file}`);
      await client.query(sql);
      await client.query("INSERT INTO o2.schema_migrations (filename) VALUES ($1)", [file]);
    }

    await client.query("COMMIT");
    console.log(`Applied ${pendingFiles.length} migration(s).`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await closePool();
  }
};

runMigrations().catch((error) => {
  console.error("Migration failed:");
  console.error(error);
  process.exitCode = 1;
});
