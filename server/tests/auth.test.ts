import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@db';
import { comparePasswords, hashPassword } from '../data/utils/auth';

describe('Authentication', () => {
  beforeEach(() => {
    // Clear the database before each test
    (db as any).users.clear();
  });

  it('should create a new user', async () => {
    const userData = {
      username: 'testuser',
      password: 'password123',
      dailyBudgetAmount: 50,
    };

    const user = await db.createUser(userData);
    expect(user.id).toBe(1);
    expect(user.username).toBe(userData.username);
    expect(user.dailyBudgetAmount).toBe(userData.dailyBudgetAmount);
  });

  it('should not create user with duplicate username', async () => {
    const userData = {
      username: 'testuser',
      password: 'password123',
      dailyBudgetAmount: 50,
    };

    await db.createUser(userData);
    await expect(db.createUser(userData)).rejects.toThrow('Username already exists');
  });

  it('should find user by username', async () => {
    const userData = {
      username: 'testuser',
      password: await hashPassword('password123'),
      dailyBudgetAmount: 50,
    };

    await db.createUser(userData);
    const foundUser = await db.findUserByUsername('testuser');
    expect(foundUser).toBeDefined();
    expect(foundUser?.username).toBe(userData.username);
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
});