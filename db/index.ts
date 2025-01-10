import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Create the connection
let db: ReturnType<typeof drizzle>;
try {
  const client = postgres(process.env.DATABASE_URL);
  db = drizzle(client, { schema });
} catch (error) {
  console.error("Failed to initialize database:", error);
  throw error;
}

export { db };