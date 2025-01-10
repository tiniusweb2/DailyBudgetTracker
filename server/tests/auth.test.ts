import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@db';
import { comparePasswords, hashPassword } from '../auth';
import { users, refreshTokens } from '@db/schema';
import { eq } from 'drizzle-orm';
import express from 'express';
import { setupAuth } from '../auth';
import { registerRoutes } from '../routes';
import supertest from 'supertest';

describe('Authentication', () => {
  let app: express.Express;
  let request: supertest.SuperTest<supertest.Test>;

  beforeEach(async () => {
    // Clear all test data first
    await db.delete(refreshTokens);
    await db.delete(users);

    // Setup express app with auth
    app = express();
    app.use(express.json());
    setupAuth(app);
    registerRoutes(app);
    request = supertest(app);
  });

  describe('Registration', () => {
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
  });

  describe('Login', () => {
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

      // Should set cookies
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((c: string) => c.includes('refreshToken='))).toBe(true);
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
  });

  describe('Session & Token Management', () => {
    let authCookie: string;
    let refreshToken: string;

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

      const cookies = loginResponse.headers['set-cookie'];
      authCookie = cookies.find((c: string) => c.includes('financeapp.sid=')) || '';
      refreshToken = cookies
        .find((c: string) => c.includes('refreshToken='))
        ?.split(';')[0]
        .split('=')[1] || '';
    });

    it('should allow access to protected routes with valid session', async () => {
      const response = await request
        .get('/api/user')
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body.username).toBe('testuser');
    });

    it('should deny access to protected routes without session', async () => {
      const response = await request.get('/api/user');
      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Not authenticated');
    });

    it('should refresh token successfully', async () => {
      const response = await request
        .post('/api/refresh-token')
        .set('Cookie', `refreshToken=${refreshToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Token refreshed successfully');

      // Verify new refresh token cookie is set
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((c: string) => c.includes('refreshToken='))).toBe(true);
    });

    it('should handle invalid refresh tokens', async () => {
      const response = await request
        .post('/api/refresh-token')
        .set('Cookie', 'refreshToken=invalid_token');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid refresh token');
    });
  });

  describe('Logout', () => {
    let authCookie: string;
    let refreshToken: string;

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

      const cookies = loginResponse.headers['set-cookie'];
      authCookie = cookies.find((c: string) => c.includes('financeapp.sid=')) || '';
      refreshToken = cookies
        .find((c: string) => c.includes('refreshToken='))
        ?.split(';')[0]
        .split('=')[1] || '';
    });

    it('should successfully logout and clear sessions', async () => {
      const response = await request
        .post('/api/logout')
        .set('Cookie', [authCookie, `refreshToken=${refreshToken}`]);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logged out successfully');

      // Verify cookies are cleared
      const cookies = response.headers['set-cookie'];
      expect(cookies.some((c: string) => c.includes('refreshToken=;'))).toBe(true);
    });

    it('should prevent access after logout', async () => {
      // First logout
      await request
        .post('/api/logout')
        .set('Cookie', [authCookie, `refreshToken=${refreshToken}`]);

      // Try to access protected route
      const response = await request
        .get('/api/user')
        .set('Cookie', authCookie);

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Not authenticated');
    });
  });
});