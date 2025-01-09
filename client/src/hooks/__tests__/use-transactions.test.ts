import { renderHook, waitFor } from '@testing-library/react';
import { useTransactions } from '../use-transactions';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReactNode } from 'react';

describe('useTransactions', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
          staleTime: 0
        },
      },
    });

    // Reset fetch mock and clear cache
    vi.restoreAllMocks();
    queryClient.clear();
  });

  const createWrapper = () => {
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );
    };
  };

  it('starts with empty transactions and loading state', () => {
    const { result } = renderHook(() => useTransactions(), {
      wrapper: createWrapper(),
    });

    expect(result.current.transactions).toEqual([]);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.dailyBudget).toBeUndefined();
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
          available: 100,
          spent: 50,
          saved: 0,
        },
      ],
    };

    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockData),
    } as Response);

    const { result } = renderHook(() => useTransactions(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/transactions", {
        credentials: "include",
      });
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