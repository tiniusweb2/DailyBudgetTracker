import { beforeAll, afterAll, afterEach } from 'vitest';
import { db } from "@db";
import { sql } from 'drizzle-orm';
import { users, transactions, categories, plannedExpenses, incomeSources, bankAccounts, refreshTokens, dailyBudgets } from "@db/schema";
import '@testing-library/jest-dom';

// Initialize database connection and verify it works
beforeAll(async () => {
  try {
    // Verify database connection
    const result = await db.execute(sql`SELECT 1`);
    if (!result) {
      throw new Error('Failed to connect to database');
    }

    // Ensure all tables exist
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          daily_budget_amount DECIMAL(10,2) NOT NULL DEFAULT 50.00,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS categories (
          id SERIAL PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          description TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS transactions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
          category_id INTEGER REFERENCES categories(id) NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          description TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS daily_budgets (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
          date TIMESTAMP NOT NULL,
          budget_amount DECIMAL(10,2) NOT NULL,
          spent DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          saved DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS planned_expenses (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
          category_id INTEGER REFERENCES categories(id) NOT NULL,
          name TEXT NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          target_date TIMESTAMP NOT NULL,
          is_completed BOOLEAN NOT NULL DEFAULT false,
          daily_contribution DECIMAL(10,2) NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS income_sources (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
          name TEXT NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          frequency TEXT NOT NULL,
          next_payment_date TIMESTAMP NOT NULL,
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS bank_accounts (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
          plaid_access_token TEXT NOT NULL,
          plaid_item_id TEXT NOT NULL,
          institution_name TEXT NOT NULL,
          last_sync TIMESTAMP,
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS refresh_tokens (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
          token TEXT NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          revoked_at TIMESTAMP,
          replaced_by_token TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      END $$;
    `);

  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
});

// Test utilities for creating test data
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
      name: `Test Category ${Date.now()}`,
      description: 'Test category description'
    })
    .returning();

  return category;
}

// Clean up database after each test
afterEach(async () => {
  try {
    await db.delete(refreshTokens);
    await db.delete(transactions);
    await db.delete(plannedExpenses);
    await db.delete(incomeSources);
    await db.delete(bankAccounts);
    await db.delete(dailyBudgets);
    await db.delete(categories);
    await db.delete(users);
  } catch (error) {
    console.error('Failed to clean up test data:', error);
    throw error;
  }
});

// Clean up and close database connection after all tests
afterAll(async () => {
  try {
    // Clean up any remaining test data
    await db.delete(refreshTokens);
    await db.delete(transactions);
    await db.delete(plannedExpenses);
    await db.delete(incomeSources);
    await db.delete(bankAccounts);
    await db.delete(dailyBudgets);
    await db.delete(categories);
    await db.delete(users);
  } catch (error) {
    console.error('Failed to clean up after all tests:', error);
    throw error;
  }
});