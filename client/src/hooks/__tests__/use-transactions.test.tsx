import { renderHook, waitFor } from '@testing-library/react';
import { useTransactions } from '../use-transactions';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PropsWithChildren } from 'react';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function createWrapper() {
  const testQueryClient = createTestQueryClient();
  return function TestWrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={testQueryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

describe('useTransactions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('starts with empty transactions and loading state', () => {
    const { result } = renderHook(() => useTransactions(), {
      wrapper: createWrapper(),
    });

    expect(result.current.transactions).toEqual([]);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.dailyBudget).toEqual({ available: 0, spent: 0, saved: 0 });
  });

  it('handles successful data fetching', async () => {
    const mockData = {
      transactions: [
        {
          id: 1,
          amount: 50,
          description: "Test transaction",
          createdAt: new Date().toISOString(),
        },
      ],
      dailyBudget: {
        available: 100,
        spent: 50,
        saved: 0,
      },
      dailyBudgets: [
        {
          date: new Date().toISOString(),
          budgetAmount: 100,
          spent: 50,
          saved: 0,
        },
      ],
    };

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockData),
    } as Response);

    const { result } = renderHook(() => useTransactions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.transactions).toHaveLength(1);
      expect(result.current.dailyBudget?.available).toBe(100);
      expect(result.current.dailyBudget?.spent).toBe(50);
    });
  });

  it('handles API errors', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('API Error'));

    const { result } = renderHook(() => useTransactions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeDefined();
      expect(result.current.transactions).toEqual([]);
    });
  });
});