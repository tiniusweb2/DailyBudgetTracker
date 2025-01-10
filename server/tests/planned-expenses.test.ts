import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@db";
import { plannedExpenses } from "@db/schema";
import { DrizzlePlannedExpenseRepository } from "../data/repositories/PlannedExpenseRepository";
import { addDays, differenceInDays } from "date-fns";
import { eq } from "drizzle-orm";
import { createTestUser, createTestCategory } from './utils/test-utils';

describe('Planned Expenses', () => {
  let userId: number;
  let categoryId: number;
  let repo: DrizzlePlannedExpenseRepository;

  beforeEach(async () => {
    // Create test user and category first
    const user = await createTestUser();
    const category = await createTestCategory();

    userId = user.id;
    categoryId = category.id;
    repo = new DrizzlePlannedExpenseRepository();

    // Clean up any existing test data
    await db.delete(plannedExpenses)
      .where(eq(plannedExpenses.userId, userId))
      .execute();
  });

  describe('Expense Creation', () => {
    it('should create a planned expense with correct daily contribution', async () => {
      const targetDate = addDays(new Date(), 30); // 30 days from now
      const amount = 300; // $300 over 30 days = $10/day
      const dailyAmount = (amount / 30).toFixed(2);

      const expense = await repo.create({
        userId,
        categoryId,
        name: 'New Laptop',
        amount: amount.toFixed(2),
        targetDate,
        isCompleted: false,
        dailyContribution: dailyAmount
      });

      expect(expense).toBeDefined();
      expect(expense.name).toBe('New Laptop');
      expect(Number(expense.amount)).toBe(300);
      expect(Number(expense.dailyContribution)).toBe(10);
    });

    it('should calculate total daily contributions for active expenses', async () => {
      const expenses = [
        {
          userId,
          categoryId,
          name: 'Vacation Fund',
          amount: "1000.00",
          targetDate: addDays(new Date(), 100),
          isCompleted: false,
          dailyContribution: "10.00" // $10/day
        },
        {
          userId,
          categoryId,
          name: 'New Phone',
          amount: "600.00",
          targetDate: addDays(new Date(), 60),
          isCompleted: false,
          dailyContribution: "10.00" // $10/day
        }
      ];

      await db.insert(plannedExpenses).values(expenses);

      const totalDailyContribution = await repo.calculateDailyContributions(userId);
      expect(totalDailyContribution).toBe(20); // $20/day total
    });
  });

  describe('Expense Management', () => {
    it('should update expense completion status', async () => {
      // Create an expense first
      const [expense] = await db
        .insert(plannedExpenses)
        .values({
          userId,
          categoryId,
          name: 'Emergency Fund',
          amount: "1000.00",
          targetDate: addDays(new Date(), 100),
          isCompleted: false,
          dailyContribution: "10.00"
        })
        .returning();

      // Update the expense status
      const updated = await repo.update(expense.id, {
        isCompleted: true
      });

      expect(updated.isCompleted).toBe(true);
    });

    it('should adjust daily contribution when target date changes', async () => {
      const initialDate = addDays(new Date(), 100);

      // Create initial expense
      const [expense] = await db
        .insert(plannedExpenses)
        .values({
          userId,
          categoryId,
          name: 'Car Down Payment',
          amount: "1000.00",
          targetDate: initialDate,
          isCompleted: false,
          dailyContribution: "10.00"
        })
        .returning();

      // Change target date to 50 days from now
      const newTargetDate = addDays(new Date(), 50);
      const daysUntilTarget = Math.max(1, differenceInDays(newTargetDate, new Date()));
      const expectedDailyContribution = (1000 / daysUntilTarget).toFixed(2);

      const updated = await repo.update(expense.id, {
        targetDate: newTargetDate,
        dailyContribution: expectedDailyContribution
      });

      expect(Number(updated.dailyContribution)).toBe(Number(expectedDailyContribution));
    });

    it('should find active expenses only', async () => {
      // Create test expenses with different states
      await db.insert(plannedExpenses).values([
        {
          userId,
          categoryId,
          name: 'Active Goal',
          amount: "1000.00",
          targetDate: addDays(new Date(), 30),
          isCompleted: false,
          dailyContribution: "33.33"
        },
        {
          userId,
          categoryId,
          name: 'Completed Goal',
          amount: "500.00",
          targetDate: addDays(new Date(), 15),
          isCompleted: true,
          dailyContribution: "33.33"
        },
        {
          userId,
          categoryId,
          name: 'Future Goal',
          amount: "1500.00",
          targetDate: addDays(new Date(), 45),
          isCompleted: false,
          dailyContribution: "33.33"
        }
      ]);

      const activeExpenses = await repo.findActiveByUserId(userId);
      expect(activeExpenses).toHaveLength(2);
      expect(activeExpenses.map(e => e.name)).toContain('Active Goal');
      expect(activeExpenses.map(e => e.name)).toContain('Future Goal');
      expect(activeExpenses.map(e => e.name)).not.toContain('Completed Goal');
    });
  });
});