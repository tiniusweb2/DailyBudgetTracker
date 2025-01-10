import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from "../db";
import { users, bankAccounts, type BankAccount } from "../db/schema";
import { plaidService } from '../services/PlaidService';
import express from 'express';
import { setupAuth } from '../auth';
import { registerRoutes } from '../routes';
import supertest from 'supertest';
import { eq } from 'drizzle-orm';

describe('Bank Link Authentication', () => {
  let app: express.Express;
  let request: supertest.SuperTest<supertest.Test>;
  let userId: number;
  let authToken: string;

  beforeEach(async () => {
    // Clear test data
    await db.delete(bankAccounts);
    await db.delete(users);

    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        username: `testuser_${Date.now()}`,
        password: 'password123',
        dailyBudgetAmount: "50.00",
      })
      .returning();

    userId = user.id;

    // Setup express app with auth
    app = express();
    app.use(express.json());
    setupAuth(app);
    registerRoutes(app);
    request = supertest(app);

    // Login to get auth token
    const loginResponse = await request
      .post('/api/login')
      .send({ username: user.username, password: 'password123' });

    authToken = loginResponse.headers['set-cookie'][0];
  });

  describe('Plaid Link Token', () => {
    beforeEach(() => {
      vi.mock('../services/PlaidService', () => ({
        plaidService: {
          createLinkToken: vi.fn().mockResolvedValue({
            link_token: 'mock_link_token'
          }),
          exchangePublicToken: vi.fn().mockResolvedValue({
            access_token: 'mock_access_token',
            item_id: 'mock_item_id'
          }),
          getIncome: vi.fn().mockResolvedValue({
            income_streams: [{
              monthly_income: 5000,
              name: "Primary Income",
              next_payment_date: new Date().toISOString().split('T')[0]
            }]
          })
        }
      }));
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should require authentication for link token creation', async () => {
      const response = await request
        .post('/api/plaid/link/token')
        .send();

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Not authenticated");
    });

    it('should create link token when authenticated', async () => {
      const response = await request
        .post('/api/plaid/link/token')
        .set('Cookie', authToken)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.link_token).toBe('mock_link_token');
    });

    it('should handle Plaid API errors', async () => {
      vi.spyOn(plaidService, 'createLinkToken').mockRejectedValueOnce(
        new Error('Failed to create link token')
      );

      const response = await request
        .post('/api/plaid/link/token')
        .set('Cookie', authToken)
        .send();

      expect(response.status).toBe(500);
      expect(response.body.message).toContain('Failed to create link token');
    });
  });

  describe('Bank Account Linking', () => {
    beforeEach(() => {
      vi.mock('../services/PlaidService', () => ({
        plaidService: {
          exchangePublicToken: vi.fn().mockResolvedValue({
            access_token: 'mock_access_token',
            item_id: 'mock_item_id'
          }),
          getIncome: vi.fn().mockResolvedValue({
            income_streams: [{
              monthly_income: 5000,
              name: "Primary Income",
              next_payment_date: new Date().toISOString().split('T')[0]
            }]
          })
        }
      }));
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should require authentication for linking bank', async () => {
      const response = await request
        .post('/api/plaid/link/bank')
        .send({
          publicToken: 'mock_public_token',
          institutionName: 'Test Bank'
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Not authenticated");
    });

    it('should link bank account when authenticated', async () => {
      const response = await request
        .post('/api/plaid/link/bank')
        .set('Cookie', authToken)
        .send({
          publicToken: 'mock_public_token',
          institutionName: 'Test Bank'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Bank account linked successfully");
      expect(response.body.bankAccount.institutionName).toBe("Test Bank");
    });

    it('should validate required fields', async () => {
      const response = await request
        .post('/api/plaid/link/bank')
        .set('Cookie', authToken)
        .send({
          publicToken: 'mock_public_token'
          // Missing institutionName
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Missing required information");
    });

    it('should handle Plaid API errors during linking', async () => {
      vi.spyOn(plaidService, 'exchangePublicToken').mockRejectedValueOnce(
        new Error('Failed to exchange token')
      );

      const response = await request
        .post('/api/plaid/link/bank')
        .set('Cookie', authToken)
        .send({
          publicToken: 'invalid_token',
          institutionName: 'Test Bank'
        });

      expect(response.status).toBe(500);
      expect(response.body.message).toContain('Failed to exchange token');
    });

    it('should handle multiple bank account links for the same user', async () => {
      // First bank link
      await request
        .post('/api/plaid/link/bank')
        .set('Cookie', authToken)
        .send({
          publicToken: 'mock_public_token_1',
          institutionName: 'Test Bank 1'
        });

      // Second bank link
      const response = await request
        .post('/api/plaid/link/bank')
        .set('Cookie', authToken)
        .send({
          publicToken: 'mock_public_token_2',
          institutionName: 'Test Bank 2'
        });

      expect(response.status).toBe(200);

      // Verify both bank accounts exist in database
      const accounts: BankAccount[] = await db
        .select()
        .from(bankAccounts)
        .where(eq(bankAccounts.userId, userId));

      expect(accounts).toHaveLength(2);
      expect(accounts.map(b => b.institutionName)).toContain('Test Bank 1');
      expect(accounts.map(b => b.institutionName)).toContain('Test Bank 2');
    });
  });
});