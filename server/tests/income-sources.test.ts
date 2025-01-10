import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from "@db";
import { incomeSources, bankAccounts } from "@db/schema";
import { eq } from 'drizzle-orm';
import { createTestUser } from './setup';
import { addDays } from 'date-fns';
import { plaidService } from '../services/PlaidService';

describe('Income Sources', () => {
  let userId: number;

  beforeEach(async () => {
    // Reset all mocks before each test
    vi.resetAllMocks();

    // Setup mock implementations
    vi.mocked(plaidService.createLinkToken).mockResolvedValue({
      link_token: 'mock_link_token'
    });

    vi.mocked(plaidService.exchangePublicToken).mockResolvedValue({
      access_token: 'mock_access_token',
      item_id: 'mock_item_id'
    });

    vi.mocked(plaidService.getIncome).mockResolvedValue({
      income_streams: [{
        monthly_income: 5000,
        name: "Primary Income",
        next_payment_date: new Date().toISOString().split('T')[0]
      }]
    });
    const user = await createTestUser();
    userId = user.id;
  });

  describe('Manual Income Sources', () => {
    it('should create a manual income source', async () => {
      const incomeData = {
        userId,
        name: 'Monthly Salary',
        amount: "5000.00",
        frequency: 'monthly',
        nextPaymentDate: new Date(),
        isActive: true
      };

      const [income] = await db
        .insert(incomeSources)
        .values(incomeData)
        .returning();

      expect(income).toBeDefined();
      expect(income.name).toBe(incomeData.name);
      expect(income.amount).toBe(incomeData.amount);
      expect(income.frequency).toBe(incomeData.frequency);
    });

    it('should retrieve all income sources for a user', async () => {
      const incomeData = [
        {
          userId,
          name: 'Primary Job',
          amount: "5000.00",
          frequency: 'monthly',
          nextPaymentDate: new Date(),
          isActive: true
        },
        {
          userId,
          name: 'Side Gig',
          amount: "1000.00",
          frequency: 'bi-weekly',
          nextPaymentDate: new Date(),
          isActive: true
        }
      ];

      await db.insert(incomeSources).values(incomeData);

      const sources = await db
        .select()
        .from(incomeSources)
        .where(eq(incomeSources.userId, userId));

      expect(sources).toHaveLength(2);
      expect(sources[0].name).toBe('Primary Job');
      expect(sources[1].name).toBe('Side Gig');
    });

    it('should calculate daily income correctly', async () => {
      const incomeData = [
        {
          userId,
          name: 'Monthly Salary',
          amount: "3000.00",
          frequency: 'monthly',
          nextPaymentDate: new Date(),
          isActive: true
        },
        {
          userId,
          name: 'Part-time Job',
          amount: "400.00",
          frequency: 'weekly',
          nextPaymentDate: new Date(),
          isActive: true
        }
      ];

      await db.insert(incomeSources).values(incomeData);

      const sources = await db
        .select()
        .from(incomeSources)
        .where(eq(incomeSources.userId, userId));

      // Calculate expected daily income
      const monthlyIncome = Number(sources[0].amount); // $3000/month
      const weeklyIncome = Number(sources[1].amount); // $400/week

      const expectedDailyIncome = (monthlyIncome / 30) + (weeklyIncome / 7);
      const calculatedDailyIncome = sources.reduce((total, source) => {
        const amount = Number(source.amount);
        switch (source.frequency) {
          case 'monthly':
            return total + (amount / 30);
          case 'weekly':
            return total + (amount / 7);
          case 'bi-weekly':
            return total + (amount / 14);
          default:
            return total;
        }
      }, 0);

      expect(calculatedDailyIncome).toBeCloseTo(expectedDailyIncome, 2);
    });

    it('should handle inactive income sources', async () => {
      const incomeData = [
        {
          userId,
          name: 'Active Income',
          amount: "3000.00",
          frequency: 'monthly',
          nextPaymentDate: new Date(),
          isActive: true
        },
        {
          userId,
          name: 'Inactive Income',
          amount: "2000.00",
          frequency: 'monthly',
          nextPaymentDate: addDays(new Date(), 30),
          isActive: false
        }
      ];

      await db.insert(incomeSources).values(incomeData);

      const activeSources = await db
        .select()
        .from(incomeSources)
        .where(eq(incomeSources.userId, userId))
        .where(eq(incomeSources.isActive, true));

      expect(activeSources).toHaveLength(1);
      expect(activeSources[0].name).toBe('Active Income');
    });
  });

  describe('Bank Integration', () => {
    afterEach(() => {
      vi.resetAllMocks();
    });

    it('should create a bank account link', async () => {
      const bankData = {
        userId,
        plaidAccessToken: 'mock_access_token',
        plaidItemId: 'mock_item_id',
        institutionName: 'Test Bank',
        isActive: true
      };

      const [bank] = await db
        .insert(bankAccounts)
        .values(bankData)
        .returning();

      expect(bank).toBeDefined();
      expect(bank.institutionName).toBe(bankData.institutionName);
      expect(bank.plaidAccessToken).toBe(bankData.plaidAccessToken);
    });

    it('should create income sources from Plaid data', async () => {
      // First create a bank account link
      const [bank] = await db
        .insert(bankAccounts)
        .values({
          userId,
          plaidAccessToken: 'mock_access_token',
          plaidItemId: 'mock_item_id',
          institutionName: 'Test Bank',
          isActive: true
        })
        .returning();

      // Get income data from mocked Plaid service
      const plaidIncome = await plaidService.getIncome('mock_access_token');

      // Create income sources
      await Promise.all(plaidIncome.income_streams.map(stream =>
        db.insert(incomeSources).values({
          userId,
          name: `Test Bank - ${stream.name}`,
          amount: stream.monthly_income.toFixed(2),
          frequency: 'monthly',
          nextPaymentDate: new Date(stream.next_payment_date),
          isActive: true
        })
      ));

      // Verify income sources were created
      const sources = await db
        .select()
        .from(incomeSources)
        .where(eq(incomeSources.userId, userId));

      expect(sources).toHaveLength(1);
      expect(sources[0].name).toBe('Test Bank - Primary Income');
      expect(sources[0].amount).toBe("5000.00");
    });

    it('should handle Plaid API errors gracefully', async () => {
      // Mock Plaid API error
      vi.mocked(plaidService.getIncome).mockRejectedValueOnce(
        new Error('Failed to fetch income information')
      );

      const bank = {
        userId,
        plaidAccessToken: 'invalid_token',
        plaidItemId: 'mock_item_id',
        institutionName: 'Test Bank',
        isActive: true
      };

      await expect(
        plaidService.getIncome(bank.plaidAccessToken)
      ).rejects.toThrow('Failed to fetch income information');
    });
  });
});