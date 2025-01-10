import { pgTable, text, serial, timestamp, decimal, boolean } from "drizzle-orm/pg-core";
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

// Categories table for expense categorization
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").unique().notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Transaction table definition with category
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  categoryId: serial("category_id").references(() => categories.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Daily Budget table for tracking daily spending and savings
export const dailyBudgets = pgTable("daily_budgets", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  date: timestamp("date").notNull(),
  budgetAmount: decimal("budget_amount", { precision: 10, scale: 2 }).notNull(),
  spent: decimal("spent", { precision: 10, scale: 2 }).notNull().default("0.00"),
  saved: decimal("saved", { precision: 10, scale: 2 }).notNull().default("0.00"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Planned Expenses table for future expense planning
export const plannedExpenses = pgTable("planned_expenses", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  categoryId: serial("category_id").references(() => categories.id).notNull(),
  name: text("name").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  targetDate: timestamp("target_date").notNull(),
  isCompleted: boolean("is_completed").notNull().default(false),
  dailyContribution: decimal("daily_contribution", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Income Sources table for tracking different income streams
export const incomeSources = pgTable("income_sources", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: text("name").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  frequency: text("frequency").notNull(), // 'monthly', 'bi-weekly', 'weekly'
  nextPaymentDate: timestamp("next_payment_date").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Bank Accounts table for storing Tink integration data
export const bankAccounts = pgTable("bank_accounts", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tinkAccessToken: text("tink_access_token").notNull(),
  institutionName: text("institution_name").notNull(),
  lastSync: timestamp("last_sync"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Refresh Token table for secure session management
export const refreshTokens = pgTable("refresh_tokens", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
  replacedByToken: text("replaced_by_token"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const userRelations = relations(users, ({ many }) => ({
  transactions: many(transactions),
  dailyBudgets: many(dailyBudgets),
  plannedExpenses: many(plannedExpenses),
  incomeSources: many(incomeSources),
  bankAccounts: many(bankAccounts),
  refreshTokens: many(refreshTokens),
}));

export const refreshTokenRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

// Schemas
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export const insertTransactionSchema = createInsertSchema(transactions);
export const selectTransactionSchema = createSelectSchema(transactions);
export const insertCategorySchema = createInsertSchema(categories);
export const selectCategorySchema = createSelectSchema(categories);
export const insertDailyBudgetSchema = createInsertSchema(dailyBudgets);
export const selectDailyBudgetSchema = createSelectSchema(dailyBudgets);
export const insertPlannedExpenseSchema = createInsertSchema(plannedExpenses);
export const selectPlannedExpenseSchema = createSelectSchema(plannedExpenses);
export const insertIncomeSourceSchema = createInsertSchema(incomeSources);
export const selectIncomeSourceSchema = createSelectSchema(incomeSources);
export const insertBankAccountSchema = createInsertSchema(bankAccounts);
export const selectBankAccountSchema = createSelectSchema(bankAccounts);
export const insertRefreshTokenSchema = createInsertSchema(refreshTokens);
export const selectRefreshTokenSchema = createSelectSchema(refreshTokens);

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;
export type DailyBudget = typeof dailyBudgets.$inferSelect;
export type InsertDailyBudget = typeof dailyBudgets.$inferInsert;
export type PlannedExpense = typeof plannedExpenses.$inferSelect;
export type InsertPlannedExpense = typeof plannedExpenses.$inferInsert;
export type IncomeSource = typeof incomeSources.$inferSelect;
export type InsertIncomeSource = typeof incomeSources.$inferInsert;
export type BankAccount = typeof bankAccounts.$inferSelect;
export type InsertBankAccount = typeof bankAccounts.$inferInsert;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type InsertRefreshToken = typeof refreshTokens.$inferInsert;

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