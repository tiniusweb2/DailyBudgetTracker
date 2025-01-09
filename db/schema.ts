import { pgTable, serial, text, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from "zod";

// User table definition
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  dailyBudgetAmount: decimal("daily_budget_amount", { precision: 10, scale: 2 }).notNull().default("50.00"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Transaction table definition
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Define relationships
export const userRelations = relations(users, ({ many }) => ({
  transactions: many(transactions),
}));

export const transactionRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
}));

// Helper to convert decimal strings to numbers
export function convertDecimalToNumber<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;

  const newObj = { ...obj };
  for (const [key, value] of Object.entries(newObj)) {
    if (typeof value === 'string' && /^\d+\.\d+$/.test(value)) {
      (newObj as any)[key] = parseFloat(value);
    }
  }
  return newObj;
}

// Export types and schemas
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export const insertTransactionSchema = createInsertSchema(transactions);
export const selectTransactionSchema = createSelectSchema(transactions);