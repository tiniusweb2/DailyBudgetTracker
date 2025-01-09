import { describe, it, expect, beforeEach } from 'vitest';
import { categoryPredictor } from '../services/CategoryPrediction';
import { db } from '../db';
import { categories, transactions } from '../db/schema';

describe('Category Prediction Service', () => {
  let foodCategoryId: number;
  let transportCategoryId: number;

  beforeEach(async () => {
    // Clear transactions first due to foreign key constraint
    await db.delete(transactions);
    // Then clear categories
    await db.delete(categories);

    // Create test categories
    const [food, transport] = await db.insert(categories)
      .values([
        {
          name: 'Food & Dining',
          description: 'Restaurants, groceries, and food delivery'
        },
        {
          name: 'Transportation',
          description: 'Public transit, ride-sharing, and fuel'
        }
      ])
      .returning();

    foodCategoryId = food.id;
    transportCategoryId = transport.id;
  });

  describe('Text Processing', () => {
    it('should correctly identify food-related expenses', async () => {
      const testCases = [
        'lunch at restaurant',
        'groceries from walmart',
        'coffee shop',
        'dinner with friends',
        'food delivery'
      ];

      for (const description of testCases) {
        const { categoryId, confidence } = await categoryPredictor.predictCategory(description);
        expect(categoryId).toBe(foodCategoryId);
        expect(confidence).toBeGreaterThan(0);
      }
    });

    it('should correctly identify transportation expenses', async () => {
      const testCases = [
        'uber ride',
        'bus ticket',
        'train fare',
        'gas station',
        'taxi ride'
      ];

      for (const description of testCases) {
        const { categoryId, confidence } = await categoryPredictor.predictCategory(description);
        expect(categoryId).toBe(transportCategoryId);
        expect(confidence).toBeGreaterThan(0);
      }
    });

    it('should handle ambiguous descriptions gracefully', async () => {
      const description = 'payment';
      const { confidence } = await categoryPredictor.predictCategory(description);
      expect(confidence).toBeLessThan(0.5);
    });

    it('should be case insensitive', async () => {
      const lowerCase = await categoryPredictor.predictCategory('lunch at restaurant');
      const upperCase = await categoryPredictor.predictCategory('LUNCH AT RESTAURANT');
      const mixedCase = await categoryPredictor.predictCategory('LuNcH aT ReStAuRaNt');

      expect(lowerCase.categoryId).toBe(upperCase.categoryId);
      expect(upperCase.categoryId).toBe(mixedCase.categoryId);
    });
  });
});