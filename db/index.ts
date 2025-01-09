import { drizzle } from "drizzle-orm/neon-serverless";
import { sql } from "drizzle-orm";
import ws from "ws";
import * as schema from "@db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Initialize database connection
let db: ReturnType<typeof drizzle>;

try {
  db = drizzle({
    connection: process.env.DATABASE_URL,
    schema,
    ws: ws,
  });

  // Test the connection immediately and handle any errors
  (async () => {
    try {
      await db.execute(sql`SELECT NOW()`);
      console.log('Database connection established successfully');
    } catch (error) {
      console.error('Database connection test failed:', error);
      process.exit(1);
    }
  })();
} catch (error) {
  console.error('Failed to initialize database connection:', error);
  process.exit(1);
}

export { db };