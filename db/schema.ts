import { z } from "zod";
import { pgTable, text, integer, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

// User table definition
export const users = pgTable("users", {
  id: integer("id").primaryKey().notNull(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  dailyBudgetAmount: decimal("daily_budget_amount", { precision: 10, scale: 2 }).notNull().default("50.00"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Transaction table definition
export const transactions = pgTable("transactions", {
  id: integer("id").primaryKey().notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Daily budget tracking table
export const dailyBudgets = pgTable("daily_budgets", {
  id: integer("id").primaryKey().notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  date: timestamp("date").notNull(),
  available: decimal("available", { precision: 10, scale: 2 }).notNull(),
  spent: decimal("spent", { precision: 10, scale: 2 }).notNull().default("0.00"),
  saved: decimal("saved", { precision: 10, scale: 2 }).notNull().default("0.00"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Define relationships
export const userRelations = relations(users, ({ many }) => ({
  transactions: many(transactions),
  dailyBudgets: many(dailyBudgets),
}));

export const transactionRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
}));

export const dailyBudgetRelations = relations(dailyBudgets, ({ one }) => ({
  user: one(users, {
    fields: [dailyBudgets.userId],
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

// Zod schemas for validation
export const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  password: z.string(),
  dailyBudgetAmount: z.number(),
  createdAt: z.date()
});

export const transactionSchema = z.object({
  id: z.number(),
  userId: z.number(),
  amount: z.number(),
  description: z.string(),
  createdAt: z.date()
});

export const dailyBudgetSchema = z.object({
  id: z.number(),
  userId: z.number(),
  date: z.date(),
  available: z.number(),
  spent: z.number(),
  saved: z.number(),
  createdAt: z.date()
});

// Export types and schemas
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;
export type DailyBudget = typeof dailyBudgets.$inferSelect;
export type InsertDailyBudget = typeof dailyBudgets.$inferInsert;

export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export const insertTransactionSchema = createInsertSchema(transactions);
export const selectTransactionSchema = createSelectSchema(transactions);
export const insertDailyBudgetSchema = createInsertSchema(dailyBudgets);
export const selectDailyBudgetSchema = createSelectSchema(dailyBudgets);