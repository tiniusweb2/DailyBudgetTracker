import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db';
import { startOfDay, endOfDay, subDays } from 'date-fns';

describe('Daily Budget', () => {
  let userId: number;

  beforeEach(async () => {
    // Clear the database before each test
    await db.delete(db.schema.users);
    await db.delete(db.schema.transactions);
    await db.delete(db.schema.dailyBudgets);

    // Create a test user
    const [user] = await db.insert(db.schema.users).values({
      username: 'testuser',
      password: 'password123',
      dailyBudgetAmount: "50.00",
    }).returning();
    userId = user.id;
  });

  it('should create a daily budget', async () => {
    const today = new Date();
    const budgetData = {
      userId,
      date: today,
      available: "50.00",
      spent: "0.00",
      saved: "0.00",
    };

    const [budget] = await db.insert(db.schema.dailyBudgets).values(budgetData).returning();
    expect(budget.userId).toBe(userId);
    expect(budget.budgetAmount).toBe("50.00");
    expect(budget.spent).toBe("0.00");
    expect(budget.saved).toBe("0.00");
  });

  it('should find daily budget by user ID and date', async () => {
    const today = new Date();
    const budgetData = {
      userId,
      date: today,
      budgetAmount: "50.00",
      spent: "20.00",
      saved: "10.00",
    };

    await db.insert(db.schema.dailyBudgets).values(budgetData);

    const [foundBudget] = await db
      .select()
      .from(db.schema.dailyBudgets)
      .where(db => db.and(
        db.eq(db.schema.dailyBudgets.userId, userId),
        db.gte(db.schema.dailyBudgets.date, startOfDay(today)),
        db.lte(db.schema.dailyBudgets.date, endOfDay(today))
      ))
      .limit(1);

    expect(foundBudget).toBeDefined();
    expect(foundBudget.budgetAmount).toBe("50.00");
    expect(foundBudget.spent).toBe("20.00");
    expect(foundBudget.saved).toBe("10.00");
  });

  it('should fetch daily budgets within date range', async () => {
    const today = new Date();
    const yesterday = subDays(today, 1);

    await Promise.all([
      db.insert(db.schema.dailyBudgets).values({
        userId,
        date: today,
        budgetAmount: "50.00",
        spent: "20.00",
        saved: "0.00",
      }),
      db.insert(db.schema.dailyBudgets).values({
        userId,
        date: yesterday,
        budgetAmount: "50.00",
        spent: "30.00",
        saved: "20.00",
      })
    ]);

    const budgets = await db
      .select()
      .from(db.schema.dailyBudgets)
      .where(db => db.eq(db.schema.dailyBudgets.userId, userId))
      .orderBy(db.schema.dailyBudgets.date);

    expect(budgets).toHaveLength(2);

    // Check that budgets are sorted by date (newest first)
    expect(budgets[0].date.toISOString().split('T')[0])
      .toBe(today.toISOString().split('T')[0]);
    expect(budgets[1].date.toISOString().split('T')[0])
      .toBe(yesterday.toISOString().split('T')[0]);
  });
});