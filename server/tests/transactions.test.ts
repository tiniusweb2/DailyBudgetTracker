import { describe, it, expect, beforeEach } from 'vitest';
import { db } from "@db";
import { startOfDay, endOfDay, subDays } from 'date-fns';
import { users, transactions, categories } from "@db/schema";
import { categoryPredictor } from '../services/CategoryPrediction';
import { eq, and, gte, lte } from 'drizzle-orm';

describe('Transactions', () => {
  let userId: number;
  let foodCategoryId: number;

  beforeEach(async () => {
    // Clear transactions first due to foreign key constraint
    await db.delete(transactions);
    // Then clear categories and users
    await db.delete(categories);
    await db.delete(users);

    // Create a test user
    const [user] = await db
      .insert(users)
      .values({
        username: 'testuser',
        password: 'password123',
        dailyBudgetAmount: "50.00",
      })
      .returning();

    userId = user.id;

    // Create test category
    const [foodCategory] = await db
      .insert(categories)
      .values({
        name: 'Food & Dining',
        description: 'Restaurants, groceries, and food delivery'
      })
      .returning();

    foodCategoryId = foodCategory.id;
  });

  describe('Transaction Creation', () => {
    it('should predict category correctly for food-related transactions', async () => {
      const description = 'Lunch at restaurant';
      const prediction = await categoryPredictor.predictCategory(description);

      expect(prediction.confidence).toBeGreaterThan(0);
      expect(prediction.categoryId).toBe(foodCategoryId);
    });

    it('should create a new transaction with proper category', async () => {
      const transactionData = {
        userId,
        amount: "25.50",
        description: 'Lunch at restaurant',
        categoryId: foodCategoryId
      };

      const [transaction] = await db
        .insert(transactions)
        .values(transactionData)
        .returning();

      expect(transaction).toBeDefined();
      expect(transaction.amount).toBe('25.50');
      expect(transaction.description).toBe(transactionData.description);
      expect(transaction.categoryId).toBe(foodCategoryId);
    });
  });

  describe('Transaction Retrieval', () => {
    it('should find transactions by user ID with category information', async () => {
      // Create a transaction
      const [transaction] = await db
        .insert(transactions)
        .values({
          userId,
          amount: "25.50",
          description: 'Lunch at restaurant',
          categoryId: foodCategoryId
        })
        .returning();

      const results = await db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, userId));

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(transaction.id);
      expect(results[0].categoryId).toBe(foodCategoryId);
    });

    it('should return transactions within date range', async () => {
      const today = new Date();
      const yesterday = subDays(today, 1);

      await Promise.all([
        db.insert(transactions).values({
          userId,
          amount: "25.50",
          description: 'Lunch today',
          categoryId: foodCategoryId,
          createdAt: today
        }),
        db.insert(transactions).values({
          userId,
          amount: "20.00",
          description: 'Dinner yesterday',
          categoryId: foodCategoryId,
          createdAt: yesterday
        })
      ]);

      const results = await db
        .select()
        .from(transactions)
        .where(and(
          eq(transactions.userId, userId),
          gte(transactions.createdAt, startOfDay(yesterday)),
          lte(transactions.createdAt, endOfDay(today))
        ));

      expect(results).toHaveLength(2);
    });
  });
});