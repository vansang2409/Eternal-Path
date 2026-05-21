import pg from "pg";

export function createPool(): pg.Pool | undefined {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn("DATABASE_URL is not set. Using in-memory player saves.");
    return undefined;
  }

  return new pg.Pool({ connectionString });
}
