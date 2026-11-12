import { drizzle } from "drizzle-orm/netlify-db";
import type { PgAsyncDatabase } from "drizzle-orm/pg-core/async/db";
import * as schema from "./schema";

// Both runtime variants (serverless + server) share the async Postgres query API.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = PgAsyncDatabase<any, typeof schema>;

let instance: Db | undefined;

/** Lazily created so importing this module never needs a connection (e.g. at build time). */
export function getDb(): Db {
  if (!instance) instance = drizzle({ schema }) as unknown as Db;
  return instance;
}

export * as schema from "./schema";
