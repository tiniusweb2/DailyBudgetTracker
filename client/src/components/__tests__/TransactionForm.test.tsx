import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import TransactionForm from '../TransactionForm';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/use-user';

// Mock the useToast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn(),
    dismiss: vi.fn(),
    toasts: []
  }))
}));

// Mock the useUser hook
vi.mock('@/hooks/use-user', () => ({
  useUser: vi.fn(() => ({
    user: { id: 1, username: 'testuser' },
    isLoading: false,
    error: null,
  }))
}));

describe('TransactionForm', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    // Reset fetch mock
    vi.spyOn(global, 'fetch').mockReset();
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <TransactionForm />
      </QueryClientProvider>
    );

  it('renders the form fields', async () => {
    renderComponent();

    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add transaction/i })).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    renderComponent();
    const submitButton = screen.getByRole('button', { name: /add transaction/i });

    fireEvent.click(submitButton);

    const amountInput = screen.getByLabelText(/amount/i);
    const descriptionInput = screen.getByLabelText(/description/i);

    expect(amountInput).toBeRequired();
    expect(descriptionInput).toBeRequired();
  });

  it('handles successful form submission', async () => {
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        id: 1,
        amount: 50,
        description: 'Test transaction',
        categoryConfidence: 0.8,
      }),
    } as Response);

    renderComponent();

    await userEvent.type(screen.getByLabelText(/amount/i), '50');
    await userEvent.type(screen.getByLabelText(/description/i), 'Test transaction');

    const submitButton = screen.getByRole('button', { name: /add transaction/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          amount: 50,
          description: 'Test transaction',
        }),
      });
    });
  });

  it('handles API errors', async () => {
    const mockToast = vi.fn();
    const useToastMock = useToast as unknown as ReturnType<typeof vi.fn>;
    vi.mocked(useToastMock).mockReturnValue({
      toast: mockToast,
      dismiss: vi.fn(),
      toasts: []
    });

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      text: () => Promise.resolve('Failed to add transaction'),
    } as Response);

    renderComponent();

    await userEvent.type(screen.getByLabelText(/amount/i), '50');
    await userEvent.type(screen.getByLabelText(/description/i), 'Test transaction');

    const submitButton = screen.getByRole('button', { name: /add transaction/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to add transaction',
      }));
    });
  });
});