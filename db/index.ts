import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@db/schema";
import { sql } from "drizzle-orm";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create the connection
const client = postgres(process.env.DATABASE_URL);

export const db = drizzle(client, { schema });

// Separate function for connection testing
async function testConnection() {
  try {
    const result = await db.execute(sql`SELECT NOW()`);
    console.log('Database connection established successfully');
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    throw error;
  }
}

// Only test connection in development
if (process.env.NODE_ENV !== 'production') {
  testConnection().catch((error) => {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  });
}