import { beforeAll, afterAll, afterEach } from 'vitest';
import { db } from "@db";
import { sql } from 'drizzle-orm';
import { users, transactions, categories, plannedExpenses, incomeSources, bankAccounts, refreshTokens, dailyBudgets } from "@db/schema";
import '@testing-library/jest-dom';

// Clean up database after each test
afterEach(async () => {
  await db.delete(refreshTokens);
  await db.delete(transactions);
  await db.delete(plannedExpenses);
  await db.delete(incomeSources);
  await db.delete(bankAccounts);
  await db.delete(dailyBudgets);
  await db.delete(categories);
  await db.delete(users);
});

// Add some global test utilities
export async function createTestUser() {
  const [user] = await db
    .insert(users)
    .values({
      username: `testuser_${Date.now()}`,
      password: 'password123',
      dailyBudgetAmount: "50.00",
    })
    .returning();

  return user;
}

export async function createTestCategory() {
  const [category] = await db
    .insert(categories)
    .values({
      name: 'Test Category',
      description: 'Test category description'
    })
    .returning();

  return category;
}

// Initialize database connection
beforeAll(async () => {
  try {
    // Verify database connection
    const result = await db.execute(sql`SELECT 1`);
    if (!result) {
      throw new Error('Failed to connect to database');
    }
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
});

// Close database connection after all tests
afterAll(async () => {
  // Clean up any remaining test data
  await db.delete(refreshTokens);
  await db.delete(transactions);
  await db.delete(plannedExpenses);
  await db.delete(incomeSources);
  await db.delete(bankAccounts);
  await db.delete(dailyBudgets);
  await db.delete(categories);
  await db.delete(users);
});