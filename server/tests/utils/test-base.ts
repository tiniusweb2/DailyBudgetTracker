import { beforeEach, afterEach } from 'vitest';
import { db } from "@db";
import { users, transactions, categories, plannedExpenses, incomeSources, bankAccounts, refreshTokens, dailyBudgets } from "@db/schema";

export function setupTestBase() {
  // Clean up database before each test
  beforeEach(async () => {
    await db.delete(refreshTokens).execute();
    await db.delete(transactions).execute();
    await db.delete(plannedExpenses).execute();
    await db.delete(incomeSources).execute();
    await db.delete(bankAccounts).execute();
    await db.delete(dailyBudgets).execute();
    await db.delete(categories).execute();
    await db.delete(users).execute();
  });

  // Clean up database after each test
  afterEach(async () => {
    await db.delete(refreshTokens).execute();
    await db.delete(transactions).execute();
    await db.delete(plannedExpenses).execute();
    await db.delete(incomeSources).execute();
    await db.delete(bankAccounts).execute();
    await db.delete(dailyBudgets).execute();
    await db.delete(categories).execute();
    await db.delete(users).execute();
  });
}
