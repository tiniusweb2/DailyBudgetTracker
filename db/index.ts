import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

export const db = drizzle({
  connection: process.env.DATABASE_URL,
  schema,
  ws: ws,
});

// Separate function for connection testing (optional)
async function testConnection() {
  try {
    await db.execute(sql`SELECT NOW()`);
    console.log('Database connection established successfully');
  } catch (error) {
    console.error('Database connection test failed:', error);
    process.exit(1);
  }
}

//Example of how to call the test function.  This is optional and was not in the original code.
testConnection();