import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@db';
import { startOfDay, endOfDay, subDays } from 'date-fns';

describe('Transactions', () => {
  let userId: number;

  beforeEach(async () => {
    // Clear the database before each test
    (db as any).users.clear();
    (db as any).transactions.clear();
    (db as any).dailyBudgets.clear();

    // Create a test user
    const user = await db.createUser({
      username: 'testuser',
      password: 'password123',
      dailyBudgetAmount: 50,
    });
    userId = user.id;
  });

  it('should create a new transaction', async () => {
    const transactionData = {
      userId,
      amount: 25,
      description: 'Test transaction',
    };

    const transaction = await db.createTransaction(transactionData);
    expect(transaction.id).toBe(1);
    expect(transaction.amount).toBe(transactionData.amount);
    expect(transaction.description).toBe(transactionData.description);
  });

  it('should find transactions by user ID', async () => {
    const transactions = [
      { userId, amount: 25, description: 'Transaction 1' },
      { userId, amount: 30, description: 'Transaction 2' },
    ];

    await Promise.all(transactions.map(t => db.createTransaction(t)));
    const foundTransactions = await db.findTransactionsByUserId(userId);
    expect(foundTransactions).toHaveLength(2);
    expect(foundTransactions[0].amount).toBe(transactions[1].amount); // Most recent first
    expect(foundTransactions[1].amount).toBe(transactions[0].amount);
  });

  it('should create and update daily budgets', async () => {
    const today = new Date();
    const budgetData = {
      userId,
      date: today,
      available: 50,
      spent: 20,
      saved: 0,
    };

    const budget = await db.createDailyBudget(budgetData);
    expect(budget.available).toBe(budgetData.available);
    expect(budget.spent).toBe(budgetData.spent);

    const updated = await db.updateDailyBudget(budget.id, {
      spent: 30,
      available: 40,
    });

    expect(updated?.spent).toBe(30);
    expect(updated?.available).toBe(40);
  });

  it('should find daily budgets within date range', async () => {
    const today = new Date();
    const sevenDaysAgo = subDays(today, 7);

    // Create some budgets
    await Promise.all([
      db.createDailyBudget({
        userId,
        date: today,
        available: 50,
        spent: 20,
        saved: 0,
      }),

  it('should handle invalid budget updates gracefully', async () => {
    const nonExistentId = 999;
    const updated = await db.updateDailyBudget(nonExistentId, {
      spent: 30,
      available: 40,
    });
    expect(updated).toBeUndefined();
  });

  it('should not create transaction with invalid user ID', async () => {
    const invalidUserId = 999;
    const transactionData = {
      userId: invalidUserId,
      amount: 25,
      description: 'Test transaction',
    };

    const transaction = await db.createTransaction(transactionData);
    const foundTransactions = await db.findTransactionsByUserId(invalidUserId);
    expect(foundTransactions).toHaveLength(0);
  });

      db.createDailyBudget({
        userId,
        date: sevenDaysAgo,
        available: 50,
        spent: 30,
        saved: 0,
      }),
    ]);

    const budgets = await db.findDailyBudgetsByUserId(userId);
    const recentBudgets = budgets.filter(b => 
      b.date >= startOfDay(sevenDaysAgo) && 
      b.date <= endOfDay(today)
    );

    expect(recentBudgets).toHaveLength(2);
  });
});