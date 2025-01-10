import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { createServer } from 'http';
import { db } from '@db';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { setupAuth } from '../auth';
import { registerRoutes } from '../routes';

describe('Server Health', () => {
  let app: express.Express;
  let server: ReturnType<typeof createServer>;

  beforeAll(async () => {
    // Create Express app instance for testing
    app = express();
    app.use(express.json());

    // Setup auth and routes
    setupAuth(app);
    server = registerRoutes(app);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  describe('Database Connection', () => {
    it('should verify database connection successfully', async () => {
      const result = await db.execute(sql`SELECT 1 as test`);
      expect(result).toBeDefined();
    });

    it('should handle database errors gracefully', async () => {
      try {
        await db.execute(sql`SELECT * FROM non_existent_table`);
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('relation "non_existent_table" does not exist');
      }
    });

    it('should maintain connection pool', async () => {
      const promises = Array(5).fill(0).map(() => 
        db.execute(sql`SELECT 1`)
      );
      const results = await Promise.all(promises);
      expect(results).toHaveLength(5);
      results.forEach(result => expect(result).toBeDefined());
    });
  });

  describe('Environment Variables', () => {
    it('should have required environment variables set', () => {
      const requiredEnvVars = [
        'DATABASE_URL',
        'PGHOST',
        'PGPORT',
        'PGUSER',
        'PGPASSWORD',
        'PGDATABASE',
        'PLAID_CLIENT_ID',
        'PLAID_SECRET',
        'PLAID_ENV'
      ];

      requiredEnvVars.forEach(envVar => {
        expect(process.env[envVar]).toBeDefined();
        expect(process.env[envVar]).not.toBe('');
      });
    });

    it('should have valid PostgreSQL connection string', () => {
      const dbUrl = process.env.DATABASE_URL;
      expect(dbUrl).toMatch(/^postgres(ql)?:\/\/.+:.+@.+:\d+\/.+$/);
    });

    it('should have valid Plaid environment', () => {
      const validEnvs = ['sandbox', 'development', 'production'];
      expect(validEnvs).toContain(process.env.PLAID_ENV);
    });
  });

  describe('API Health Check', () => {
    it('should return 200 OK from health check endpoint', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toEqual({ status: 'ok' });
    });

    it('should handle unknown routes gracefully', async () => {
      const response = await request(app)
        .get('/api/non-existent')
        .expect(404);

      expect(response.body).toBeDefined();
    });

    it('should include CORS headers in development', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('Server Configuration', () => {
    it('should have CORS enabled for development', () => {
      const corsHeaders = app._router.stack
        .filter((layer: any) => layer.name === 'corsMiddleware')
        .length;

      expect(corsHeaders).toBeGreaterThan(0);
    });

    it('should have JSON parsing middleware', () => {
      const jsonMiddleware = app._router.stack
        .filter((layer: any) => layer.name === 'jsonParser')
        .length;

      expect(jsonMiddleware).toBeGreaterThan(0);
    });

    it('should have session middleware configured', () => {
      const sessionMiddleware = app._router.stack
        .filter((layer: any) => layer.name === 'session')
        .length;

      expect(sessionMiddleware).toBeGreaterThan(0);
    });

    it('should have request logging middleware', () => {
      const logMiddleware = app._router.stack
        .filter((layer: any) => layer.route?.path === '/api/*')
        .length;

      expect(logMiddleware).toBeGreaterThan(0);
    });
  });
});