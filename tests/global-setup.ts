import "dotenv/config";
import { execSync } from "node:child_process";
import { Client } from "pg";

/**
 * Runs once before the whole test run: resets the test database schema, applies
 * migrations, then reseeds it with the synthetic dataset. Individual test files are
 * read-only against this fixed state (no per-test isolation in Fase 1).
 */
export default async function globalSetup() {
  const testUrl = process.env.DATABASE_URL_TEST;
  if (!testUrl) {
    throw new Error("DATABASE_URL_TEST non impostata: impossibile eseguire i test di integrazione.");
  }

  const client = new Client({ connectionString: testUrl });
  await client.connect();
  await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await client.end();

  const env = { ...process.env, DATABASE_URL: testUrl };
  execSync("npx prisma migrate deploy", { env, stdio: "inherit" });
  execSync("npx tsx prisma/seed.ts", { env, stdio: "inherit" });
}
