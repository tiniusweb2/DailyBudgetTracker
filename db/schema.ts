import { z } from "zod";

// User schema and types
export const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  password: z.string(),
  dailyBudgetAmount: z.number().default(50),
  createdAt: z.date()
});

export type User = z.infer<typeof userSchema>;

// Transaction schema and types
export const transactionSchema = z.object({
  id: z.number(),
  userId: z.number(),
  amount: z.number(),
  description: z.string(),
  createdAt: z.date()
});

export type Transaction = z.infer<typeof transactionSchema>;

// Daily Budget schema and types
export const dailyBudgetSchema = z.object({
  id: z.number(),
  userId: z.number(),
  date: z.date(),
  available: z.number(),
  spent: z.number().default(0),
  saved: z.number().default(0),
  createdAt: z.date()
});

export type DailyBudget = z.infer<typeof dailyBudgetSchema>;

// Input validation schemas
export const insertUserSchema = userSchema.omit({ 
  id: true, 
  createdAt: true 
});

export const selectUserSchema = userSchema;