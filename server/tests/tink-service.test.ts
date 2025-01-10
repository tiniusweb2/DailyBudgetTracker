import { describe, it, expect, beforeAll } from 'vitest';
import { tinkService } from '../services/TinkService';

describe('Tink Service', () => {
  describe('Authentication', () => {
    it('should successfully acquire an access token', async () => {
      // @ts-ignore - accessing private method for testing
      const token = await tinkService.getAccessToken();
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });
  });
});
