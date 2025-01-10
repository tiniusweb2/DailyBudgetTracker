import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tinkService } from '../services/TinkService';
import { AppError } from '../domain/errors/AppError';

// Mock fetch globally
const globalFetch = global.fetch;

describe('Tink Service', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = globalFetch;
  });

  describe('Authentication', () => {
    it('should successfully acquire an access token', async () => {
      const mockTokenResponse = {
        access_token: 'test_access_token',
        expires_in: 1800
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => 'application/json'
        },
        json: () => Promise.resolve(mockTokenResponse)
      });

      // @ts-ignore - accessing private method for testing
      const token = await tinkService.getAccessToken();
      expect(token).toBe(mockTokenResponse.access_token);
    });

    it('should handle non-JSON responses', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => 'text/plain'
        }
      });

      // @ts-ignore - accessing private method for testing
      await expect(tinkService.getAccessToken())
        .rejects
        .toThrow('Expected JSON response but got: text/plain');
    });

    it('should handle invalid JSON response format', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => 'application/json'
        },
        json: () => Promise.resolve({ wrong_field: 'value' })
      });

      // @ts-ignore - accessing private method for testing
      await expect(tinkService.getAccessToken())
        .rejects
        .toThrow('Invalid token response format');
    });
  });

  describe('Bank Connection', () => {
    beforeEach(() => {
      // Mock successful token acquisition for all bank connection tests
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => 'application/json'
        },
        json: () => Promise.resolve({
          access_token: 'test_access_token',
          expires_in: 1800
        })
      });
    });

    it('should create authorization link successfully', async () => {
      const mockAuthResponse = {
        code: 'test_auth_code',
        id: 'test_auth_id'
      };

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          headers: {
            get: () => 'application/json'
          },
          json: () => Promise.resolve({
            access_token: 'test_access_token',
            expires_in: 1800
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: {
            get: () => 'application/json'
          },
          json: () => Promise.resolve(mockAuthResponse)
        });

      const result = await tinkService.createAuthorizationLink(1);
      expect(result).toEqual(mockAuthResponse);
      expect(result.code).toBeDefined();
      expect(result.id).toBeDefined();
    });

    it('should handle API errors with AppError', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          headers: {
            get: () => 'application/json'
          },
          text: () => Promise.resolve('{"error": "Invalid request"}')
        });

      try {
        await tinkService.createAuthorizationLink(1);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        if (error instanceof AppError) {
          expect(error.code).toBe('failed_auth');
          expect(error.message).toBe('Failed to authenticate with Tink');
        }
      }
    });

    it('should handle invalid authorization response format', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          headers: {
            get: () => 'application/json'
          },
          json: () => Promise.resolve({
            access_token: 'test_access_token',
            expires_in: 1800
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: {
            get: () => 'application/json'
          },
          json: () => Promise.resolve({ wrong_field: 'value' })
        });

      await expect(tinkService.createAuthorizationLink(1))
        .rejects
        .toThrow('Invalid authorization response format');
    });
  });
});