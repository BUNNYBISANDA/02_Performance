import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL ?? "postgres://postgres:YOUR_PASSWORD@localhost:5432/O2_Performance";

export const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

export const closePool = async () => {
  await pool.end();
};
