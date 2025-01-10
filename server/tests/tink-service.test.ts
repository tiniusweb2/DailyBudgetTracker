import { describe, it, expect, beforeEach } from 'vitest';
import { tinkService } from '../services/TinkService';

describe('Tink Service', () => {
  describe('Authentication', () => {
    it('should successfully acquire an access token', async () => {
      // @ts-ignore - accessing private method for testing
      const token = await tinkService.getAccessToken();
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should reuse existing token if not expired', async () => {
      // @ts-ignore - accessing private method for testing
      const firstToken = await tinkService.getAccessToken();
      // @ts-ignore - accessing private method for testing
      const secondToken = await tinkService.getAccessToken();
      expect(firstToken).toBe(secondToken);
    });
  });

  describe('Bank Connection', () => {
    it('should create authorization link', async () => {
      const userId = 1;
      const result = await tinkService.createAuthorizationLink(userId);
      expect(result).toBeDefined();
      // Add more specific assertions based on the actual response structure
    });
  });
});