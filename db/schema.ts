import { pgTable, text, integer, decimal, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  dailyBudgetAmount: decimal("daily_budget_amount", { precision: 10, scale: 2 }).notNull().default("50.00"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const categories = pgTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6366f1"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  categoryId: integer("category_id").references(() => categories.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const dailyBudgets = pgTable("daily_budgets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  date: date("date").notNull(),
  available: decimal("available", { precision: 10, scale: 2 }).notNull(),
  spent: decimal("spent", { precision: 10, scale: 2 }).notNull(),
  saved: decimal("saved", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  transactions: many(transactions),
  dailyBudgets: many(dailyBudgets),
  categories: many(categories),
}));

export const categoriesRelations = relations(categories, ({ one }) => ({
  user: one(users, {
    fields: [categories.userId],
    references: [users.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
}));

export const dailyBudgetsRelations = relations(dailyBudgets, ({ one }) => ({
  user: one(users, {
    fields: [dailyBudgets.userId],
    references: [users.id],
  }),
}));

// Type definitions
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type DailyBudget = typeof dailyBudgets.$inferSelect;
export type SelectUser = User;

// Zod schemas
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);