import { renderHook, waitFor } from '@testing-library/react';
import { useTransactions } from '../use-transactions';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React, { type PropsWithChildren } from 'react';

describe('useTransactions', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Infinity,
          cacheTime: Infinity,
          refetchOnMount: false,
          refetchOnWindowFocus: false,
          refetchOnReconnect: false
        },
      },
    });

    // Reset fetch mock and clear cache
    vi.restoreAllMocks();
    queryClient.clear();
  });

  function createWrapper() {
    return function Wrapper({ children }: PropsWithChildren) {
      return React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children
      );
    };
  }

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

    // Setup initial state in the cache
    queryClient.setQueryData(['/api/transactions'], mockData);

    // Mock successful API response
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
      status: 200,
      headers: new Headers(),
      statusText: 'OK',
      type: 'default',
      url: '/api/transactions',
      clone: () => ({ json: () => Promise.resolve(mockData) } as Response),
      body: null,
      bodyUsed: false,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      blob: () => Promise.resolve(new Blob()),
      formData: () => Promise.resolve(new FormData()),
      text: () => Promise.resolve(''),
      redirected: false,
    });

    const { result } = renderHook(() => useTransactions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 3000 });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/transactions', {
        credentials: 'include',
      });
      expect(result.current.transactions).toHaveLength(1);
      expect(result.current.dailyBudget?.available).toBe(100);
      expect(result.current.dailyBudget?.spent).toBe(50);
    }, { timeout: 3000 });
  });

  it('handles API errors', async () => {
    // Mock failed API response
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() => useTransactions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeDefined();
      expect(result.current.transactions).toEqual([]);
    }, { timeout: 2000 });
  });
});