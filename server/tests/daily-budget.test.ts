import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@db';
import { startOfDay, endOfDay, subDays } from 'date-fns';

describe('Daily Budget', () => {
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

  it('should create a daily budget', async () => {
    const today = new Date();
    const budgetData = {
      userId,
      date: today,
      available: 50,
      spent: 0,
      saved: 0,
    };

    const budget = await db.createDailyBudget(budgetData);
    expect(budget.userId).toBe(userId);
    expect(budget.available).toBe(50);
    expect(budget.spent).toBe(0);
    expect(budget.saved).toBe(0);
  });

  it('should find daily budget by user ID and date', async () => {
    const today = new Date();
    const budgetData = {
      userId,
      date: today,
      available: 50,
      spent: 20,
      saved: 10,
    };

    await db.createDailyBudget(budgetData);
    const foundBudget = await db.findDailyBudgetByUserIdAndDate(userId, today);
    
    expect(foundBudget).toBeDefined();
    expect(foundBudget?.available).toBe(50);
    expect(foundBudget?.spent).toBe(20);
    expect(foundBudget?.saved).toBe(10);
  });

  it('should update daily budget', async () => {
    const today = new Date();
    const budget = await db.createDailyBudget({
      userId,
      date: today,
      available: 50,
      spent: 0,
      saved: 0,
    });

    const updated = await db.updateDailyBudget(budget.id, {
      spent: 30,
      available: 20,
    });

    expect(updated).toBeDefined();
    expect(updated?.spent).toBe(30);
    expect(updated?.available).toBe(20);
    expect(updated?.saved).toBe(0); // Should remain unchanged
  });

  it('should fetch daily budgets within date range', async () => {
    const today = new Date();
    const yesterday = subDays(today, 1);
    
    await Promise.all([
      db.createDailyBudget({
        userId,
        date: today,
        available: 50,
        spent: 20,
        saved: 0,
      }),
      db.createDailyBudget({
        userId,
        date: yesterday,
        available: 50,
        spent: 30,
        saved: 20,
      })
    ]);

    const budgets = await db.findDailyBudgetsByUserId(userId);
    expect(budgets).toHaveLength(2);

    // Check that budgets are sorted by date (newest first)
    expect(budgets[0].date.toISOString().split('T')[0])
      .toBe(today.toISOString().split('T')[0]);
    expect(budgets[1].date.toISOString().split('T')[0])
      .toBe(yesterday.toISOString().split('T')[0]);
  });

  it('should handle multiple users daily budgets separately', async () => {
    const today = new Date();
    
    // Create another user
    const anotherUser = await db.createUser({
      username: 'anotheruser',
      password: 'password123',
      dailyBudgetAmount: 100,
    });

    // Create budgets for both users
    await Promise.all([
      db.createDailyBudget({
        userId,
        date: today,
        available: 50,
        spent: 20,
        saved: 0,
      }),
      db.createDailyBudget({
        userId: anotherUser.id,
        date: today,
        available: 100,
        spent: 50,
        saved: 0,
      })
    ]);

    const user1Budgets = await db.findDailyBudgetsByUserId(userId);
    const user2Budgets = await db.findDailyBudgetsByUserId(anotherUser.id);

    expect(user1Budgets).toHaveLength(1);
    expect(user2Budgets).toHaveLength(1);
    expect(user1Budgets[0].available).toBe(50);
    expect(user2Budgets[0].available).toBe(100);
  });
});
