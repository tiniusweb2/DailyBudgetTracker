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

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });