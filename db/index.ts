import { drizzle } from "drizzle-orm/neon-http";
import { neon, neonConfig } from '@neondatabase/serverless';
import * as schema from "@db/schema";
import ws from "ws";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure WebSocket for Neon serverless driver
neonConfig.webSocketConstructor = ws;

// Initialize SQL client with connection pooling
const sqlClient = neon(process.env.DATABASE_URL);
export const db = drizzle(sqlClient, { schema });

// Verify database connection with retries
export async function verifyDatabaseConnection(retries = 3, delay = 1000): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Verifying database connection (attempt ${attempt}/${retries})...`);
      const result = await sqlClient`SELECT 1`;
      console.log("Database connection verified successfully");
      return true;
    } catch (error) {
      console.error(`Database connection verification failed (attempt ${attempt}/${retries}):`, error);
      if (attempt === retries) {
        throw new Error(`Failed to connect to database after ${retries} attempts`);
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return false;
}