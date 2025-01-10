import { beforeAll, afterAll, afterEach, vi } from 'vitest';
import { db } from "@db";
import { sql } from 'drizzle-orm';
import { users, transactions, categories, plannedExpenses, incomeSources, bankAccounts, refreshTokens, dailyBudgets } from "@db/schema";
import '@testing-library/jest-dom';

// Mock database operations for testing
vi.mock('@db', () => ({
  db: {
    execute: vi.fn(),
    delete: vi.fn().mockResolvedValue([]),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue([])
      })
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([])
      })
    })
  }
}));

// Initialize test environment
beforeAll(async () => {
  try {
    // Mock successful database connection verification
    vi.mocked(db.execute).mockResolvedValueOnce([{ test: 1 }]);

    console.log('Test database mock initialized');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
});

// Test utilities for creating test data
export async function createTestUser() {
  const testUser = {
    id: 1,
    username: `testuser_${Date.now()}`,
    password: 'password123',
    dailyBudgetAmount: "50.00",
  };

  vi.mocked(db.insert).mockReturnValueOnce({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([testUser])
    })
  } as any);

  return testUser;
}

export async function createTestCategory() {
  const testCategory = {
    id: 1,
    name: `Test Category ${Date.now()}`,
    description: 'Test category description',
  };

  vi.mocked(db.insert).mockReturnValueOnce({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([testCategory])
    })
  } as any);

  return testCategory;
}

// Clean up after each test
afterEach(async () => {
  // Reset all mocks
  vi.clearAllMocks();
});

// Clean up after all tests
afterAll(async () => {
  // Restore original implementations
  vi.restoreAllMocks();
});