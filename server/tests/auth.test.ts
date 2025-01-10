import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@db';
import { comparePasswords, hashPassword } from '../auth';
import { users, refreshTokens } from '@db/schema';
import { eq } from 'drizzle-orm';
import express from 'express';
import { setupAuth } from '../auth';
import { registerRoutes } from '../routes';
import supertest from 'supertest';

describe('Authentication System', () => {
  let app: express.Express;
  let request: supertest.SuperTest<supertest.Test>;

  beforeEach(async () => {
    // Clear all test data first
    await db.delete(refreshTokens).execute();
    await db.delete(users).execute();

    // Setup express app with auth
    app = express();
    app.use(express.json());
    setupAuth(app);
    registerRoutes(app);
    request = supertest(app);
  });

  describe('User Registration', () => {
    it('should create a new user with hashed password', async () => {
      const response = await request
        .post('/api/register')
        .send({
          username: 'testuser',
          password: 'password123',
          dailyBudgetAmount: "50.00"
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Registration successful');
      expect(response.body.user.username).toBe('testuser');

      // Verify password was hashed
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.username, 'testuser'))
        .limit(1);

      expect(user.password).not.toBe('password123');
      expect(await comparePasswords('password123', user.password)).toBe(true);
    });

    it('should prevent duplicate usernames', async () => {
      // Create first user
      await request
        .post('/api/register')
        .send({
          username: 'testuser',
          password: 'password123',
          dailyBudgetAmount: "50.00"
        });

      // Try to create second user with same username
      const response = await request
        .post('/api/register')
        .send({
          username: 'testuser',
          password: 'different123',
          dailyBudgetAmount: "50.00"
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Username already exists');
    });

    it('should validate required fields for registration', async () => {
      const testCases = [
        {
          input: { password: 'password123', dailyBudgetAmount: "50.00" },
          expectedMessage: 'Username and password are required'
        },
        {
          input: { username: 'testuser', dailyBudgetAmount: "50.00" },
          expectedMessage: 'Username and password are required'
        },
        {
          input: { username: '', password: 'password123', dailyBudgetAmount: "50.00" },
          expectedMessage: 'Username and password are required'
        }
      ];

      for (const testCase of testCases) {
        const response = await request
          .post('/api/register')
          .send(testCase.input);

        expect(response.status).toBe(400);
        expect(response.body.message).toBe(testCase.expectedMessage);
      }
    });

    it('should handle registration with special characters in username', async () => {
      const response = await request
        .post('/api/register')
        .send({
          username: 'test.user@domain',
          password: 'password123',
          dailyBudgetAmount: "50.00"
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Registration successful');
      expect(response.body.user.username).toBe('test.user@domain');
    });
  });

  describe('User Login', () => {
    beforeEach(async () => {
      // Create a test user before each test
      await request
        .post('/api/register')
        .send({
          username: 'testuser',
          password: 'password123',
          dailyBudgetAmount: "50.00"
        });
    });

    it('should login with correct credentials and create session', async () => {
      const response = await request
        .post('/api/login')
        .send({
          username: 'testuser',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.user.username).toBe('testuser');

      // Verify session cookies
      const cookies = response.get('Set-Cookie');
      expect(cookies).toBeDefined();
      expect(cookies.some((c: string) => c.includes('financeapp.sid='))).toBe(true);
    });

    it('should reject login with incorrect password', async () => {
      const response = await request
        .post('/api/login')
        .send({
          username: 'testuser',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Incorrect password.');
    });

    it('should reject login with non-existent username', async () => {
      const response = await request
        .post('/api/login')
        .send({
          username: 'nonexistent',
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Incorrect username.');
    });

    it('should handle case-sensitive username matching', async () => {
      const response = await request
        .post('/api/login')
        .send({
          username: 'TestUser', // Original username is 'testuser'
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Incorrect username.');
    });

    it('should handle multiple concurrent login attempts', async () => {
      // Create multiple login requests simultaneously
      const loginAttempts = Array(5).fill(null).map(() =>
        request
          .post('/api/login')
          .send({
            username: 'testuser',
            password: 'password123'
          })
      );

      const responses = await Promise.all(loginAttempts);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Login successful');
      });
    });
  });

  describe('Session Management', () => {
    let cookies: string[];

    beforeEach(async () => {
      // Create and login user
      await request
        .post('/api/register')
        .send({
          username: 'testuser',
          password: 'password123',
          dailyBudgetAmount: "50.00"
        });

      const loginResponse = await request
        .post('/api/login')
        .send({
          username: 'testuser',
          password: 'password123'
        });

      cookies = loginResponse.get('Set-Cookie');
    });

    it('should allow access to protected routes with valid session', async () => {
      const response = await request
        .get('/api/user')
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body.username).toBe('testuser');
    });

    it('should deny access to protected routes without session', async () => {
      const response = await request.get('/api/user');
      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Not authenticated');
    });

    it('should deny access with invalid session token', async () => {
      const response = await request
        .get('/api/user')
        .set('Cookie', 'financeapp.sid=invalid-session-token');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Not authenticated');
    });

    it('should maintain session across multiple requests', async () => {
      const requests = Array(3).fill(null).map(() =>
        request
          .get('/api/user')
          .set('Cookie', cookies)
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.username).toBe('testuser');
      });
    });
  });

  describe('Logout', () => {
    let cookies: string[];

    beforeEach(async () => {
      // Create and login user
      await request
        .post('/api/register')
        .send({
          username: 'testuser',
          password: 'password123',
          dailyBudgetAmount: "50.00"
        });

      const loginResponse = await request
        .post('/api/login')
        .send({
          username: 'testuser',
          password: 'password123'
        });

      cookies = loginResponse.get('Set-Cookie');
    });

    it('should successfully logout and invalidate session', async () => {
      const logoutResponse = await request
        .post('/api/logout')
        .set('Cookie', cookies);

      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body.message).toBe('Logged out successfully');

      // Verify session is invalidated
      const protectedResponse = await request
        .get('/api/user')
        .set('Cookie', cookies);

      expect(protectedResponse.status).toBe(401);
      expect(protectedResponse.body.message).toBe('Not authenticated');
    });

    it('should handle logout without active session', async () => {
      const response = await request
        .post('/api/logout');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logged out successfully');
    });

    it('should allow re-login after logout', async () => {
      // First logout
      await request
        .post('/api/logout')
        .set('Cookie', cookies);

      // Try to login again
      const loginResponse = await request
        .post('/api/login')
        .send({
          username: 'testuser',
          password: 'password123'
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.message).toBe('Login successful');
    });
  });

  describe('Password Security', () => {
    it('should use secure password hashing', async () => {
      const password = 'testPassword123';
      const hashedPassword = await hashPassword(password);

      // Verify hash format and salt
      expect(hashedPassword).toContain('.');
      const [hash, salt] = hashedPassword.split('.');
      expect(hash).toBeTruthy();
      expect(salt).toBeTruthy();
      expect(hash.length).toBeGreaterThan(32); // Ensure sufficient hash length
    });

    it('should consistently validate hashed passwords', async () => {
      const password = 'testPassword123';
      const hashedPassword = await hashPassword(password);

      // Test multiple validations
      for (let i = 0; i < 5; i++) {
        const isValid = await comparePasswords(password, hashedPassword);
        expect(isValid).toBe(true);
      }
    });

    it('should reject different passwords with same hash length', async () => {
      const password1 = 'testPassword123';
      const password2 = 'testPassword124'; // Only differs by last character
      const hashedPassword = await hashPassword(password1);

      const isValid = await comparePasswords(password2, hashedPassword);
      expect(isValid).toBe(false);
    });
  });
});