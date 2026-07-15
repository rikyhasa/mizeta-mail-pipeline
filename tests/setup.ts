import "dotenv/config";

if (!process.env.DATABASE_URL_TEST) {
  throw new Error("DATABASE_URL_TEST non impostata: impossibile eseguire i test.");
}

// Every test file must talk to the test database, never the dev database.
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
