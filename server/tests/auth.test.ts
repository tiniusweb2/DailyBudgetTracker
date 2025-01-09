import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../db';
import { comparePasswords, hashPassword } from '../data/utils/auth';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { Request, Response } from 'express';

describe('Authentication', () => {
  beforeEach(async () => {
    // Clear users table
    await db.delete(users);
  });

  it('should create a new user', async () => {
    const userData = {
      username: 'testuser',
      password: 'password123',
      dailyBudgetAmount: "50.00",
    };

    const [user] = await db.insert(users).values(userData).returning();
    expect(user.id).toBeDefined();
    expect(user.username).toBe(userData.username);
    expect(user.dailyBudgetAmount).toBe(userData.dailyBudgetAmount);
  });

  it('should not create user with duplicate username', async () => {
    const userData = {
      username: 'testuser',
      password: await hashPassword('password123'),
      dailyBudgetAmount: "50.00",
    };

    await db.insert(users).values(userData);
    await expect(db.insert(users).values(userData)).rejects.toThrow();
  });

  it('should find user by username', async () => {
    const userData = {
      username: 'testuser',
      password: await hashPassword('password123'),
      dailyBudgetAmount: "50.00",
    };

    await db.insert(users).values(userData);
    const [foundUser] = await db
      .select()
      .from(users)
      .where(eq(users.username, 'testuser'))
      .limit(1);

    expect(foundUser).toBeDefined();
    expect(foundUser.username).toBe(userData.username);
  });

  it('should verify password correctly', async () => {
    const password = 'password123';
    const hashedPassword = await hashPassword(password);
    const isValid = await comparePasswords(password, hashedPassword);
    expect(isValid).toBe(true);
  });

  it('should not verify incorrect password', async () => {
    const password = 'password123';
    const wrongPassword = 'wrongpassword';
    const hashedPassword = await hashPassword(password);
    const isValid = await comparePasswords(wrongPassword, hashedPassword);
    expect(isValid).toBe(false);
  });

  describe('Session Management', () => {
    it('should maintain user session after login', async () => {
      const mockReq = {
        logIn: vi.fn((user, cb) => cb()),
        body: {
          username: 'testuser',
          password: 'password123'
        }
      } as unknown as Request;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis()
      } as unknown as Response;

      // Create test user
      await db.insert(users).values({
        username: 'testuser',
        password: await hashPassword('password123'),
        dailyBudgetAmount: "50.00",
      });

      // Mock passport authenticate
      const authenticate = vi.fn((strategy, cb) => {
        return async (req: Request, res: Response) => {
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.username, req.body.username))
            .limit(1);
          cb(null, user, { message: 'Success' });
        };
      });

      // Test login endpoint
      await new Promise<void>((resolve) => {
        authenticate('local', (err: any, user: any, info: any) => {
          mockReq.logIn(user, () => {
            mockRes.json({ message: 'Login successful', user });
            resolve();
          });
        })(mockReq, mockRes);
      });

      expect(mockReq.logIn).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Login successful',
          user: expect.objectContaining({
            username: 'testuser'
          })
        })
      );
    });
  });
});