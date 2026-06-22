import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL ?? "postgres://postgres:YOUR_PASSWORD@localhost:5432/O2_Performance";

// Most managed Postgres hosts (Render, Railway, Supabase, Neon, RDS...) require SSL and
// reject plain connections. Local Postgres usually has no SSL configured at all, so this
// must stay opt-in via env rather than always-on.
const sslEnabled = (process.env.DATABASE_SSL ?? "false").trim().toLowerCase() === "true";

export const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
});

export const closePool = async () => {
  await pool.end();
};
