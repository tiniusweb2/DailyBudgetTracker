import { describe, it, expect, beforeEach, vi } from 'vitest';
import { tinkService } from '../services/TinkService';
import { AppError } from '../domain/errors/AppError';

// Mock fetch globally
const globalFetch = global.fetch;

describe('Tink Service', () => {
  beforeEach(() => {
    // Reset fetch mock before each test
    global.fetch = vi.fn();
    // Clear token cache
    // @ts-ignore - accessing private property for testing
    tinkService.accessToken = null;
    // @ts-ignore - accessing private property for testing
    tinkService.tokenExpiration = null;
  });

  afterEach(() => {
    // Restore fetch after each test
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
        json: () => Promise.resolve(mockTokenResponse)
      });

      // @ts-ignore - accessing private method for testing
      const token = await tinkService.getAccessToken();

      expect(token).toBe(mockTokenResponse.access_token);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.tink.com/api/v1/oauth/token',
        expect.any(Object)
      );
    });

    it('should reuse existing token if not expired', async () => {
      const mockTokenResponse = {
        access_token: 'test_access_token',
        expires_in: 1800
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      });

      // First call should make the API request
      // @ts-ignore - accessing private method for testing
      const firstToken = await tinkService.getAccessToken();

      // Second call should use cached token
      // @ts-ignore - accessing private method for testing
      const secondToken = await tinkService.getAccessToken();

      expect(firstToken).toBe(secondToken);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Bank Connection', () => {
    it('should create authorization link successfully', async () => {
      const mockTokenResponse = {
        access_token: 'test_access_token',
        expires_in: 1800
      };

      const mockAuthResponse = {
        id: 'mock-auth-id',
        code: 'mock-auth-code',
        status: 'created'
      };

      // Mock both API calls
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockAuthResponse)
        });

      const userId = 1;
      const result = await tinkService.createAuthorizationLink(userId);

      expect(result).toEqual(mockAuthResponse);
      expect(result.id).toBeDefined();
      expect(result.code).toBeDefined();
      expect(result.status).toBe('created');

      // Verify API calls
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenLastCalledWith(
        'https://api.tink.com/api/v1/authorization-grant/request',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': expect.stringContaining('Bearer ')
          })
        })
      );
    });

    it('should handle authorization link creation errors', async () => {
      const mockTokenResponse = {
        access_token: 'test_access_token',
        expires_in: 1800
      };

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse)
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: () => Promise.resolve('Invalid request parameters')
        });

      const userId = 1;
      await expect(tinkService.createAuthorizationLink(userId))
        .rejects
        .toThrow('Failed to create bank link');
    });
  });
});