import { beforeAll, afterAll, afterEach } from 'vitest';
import { db } from "@db";
import { sql } from 'drizzle-orm';
import { users, transactions, categories, plannedExpenses, incomeSources, bankAccounts, refreshTokens, dailyBudgets } from "@db/schema";
import '@testing-library/jest-dom';

// Initialize database connection
beforeAll(async () => {
  try {
    // Verify database connection
    const result = await db.execute(sql`SELECT 1`);
    if (!result) {
      throw new Error('Failed to connect to database');
    }

    // Push schema changes if needed
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        revoked_at TIMESTAMP,
        replaced_by_token TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
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