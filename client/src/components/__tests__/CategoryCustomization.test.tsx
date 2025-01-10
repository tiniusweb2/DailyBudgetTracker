import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CategoryCustomization from '../CategoryCustomization';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Setup QueryClient for tests
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

// Wrapper component with QueryClientProvider
function createWrapper() {
  const testQueryClient = createTestQueryClient();
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={testQueryClient}>{children}</QueryClientProvider>
  );
}

describe('CategoryCustomization', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockFetch.mockReset();
    
    // Mock the categories API response
    mockFetch.mockImplementation((url) => {
      if (url === '/api/categories') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 1, name: 'Groceries', icon: 'ShoppingCart', color: 'bg-green-500' }
          ])
        });
      }
      return Promise.reject(new Error('not found'));
    });
  });

  it('renders the component correctly', async () => {
    render(<CategoryCustomization />, { wrapper: createWrapper() });
    
    // Check for main elements
    expect(screen.getByText('Category Customization')).toBeInTheDocument();
    expect(screen.getByText('Create and customize your budget categories')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g., Groceries')).toBeInTheDocument();
    
    // Wait for categories to load
    await waitFor(() => {
      expect(screen.getByText('Groceries')).toBeInTheDocument();
    });
  });

  it('validates form inputs correctly', async () => {
    const user = userEvent.setup();
    render(<CategoryCustomization />, { wrapper: createWrapper() });

    // Try to submit empty form
    const submitButton = screen.getByText('Add Category');
    await user.click(submitButton);

    // Check for validation messages
    await waitFor(() => {
      expect(screen.getByText('Category name is required')).toBeInTheDocument();
    });
  });

  it('creates a new category successfully', async () => {
    const user = userEvent.setup();
    mockFetch.mockImplementationOnce((url, options) => {
      if (url === '/api/categories' && options.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 2, ...JSON.parse(options.body) })
        });
      }
    });

    render(<CategoryCustomization />, { wrapper: createWrapper() });

    // Fill out the form
    await user.type(screen.getByPlaceholderText('e.g., Groceries'), 'Shopping');
    
    // Submit the form
    const submitButton = screen.getByText('Add Category');
    await user.click(submitButton);

    // Verify API call
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/categories', expect.any(Object));
    });
  });

  it('handles API errors gracefully', async () => {
    const user = userEvent.setup();
    mockFetch.mockImplementationOnce((url, options) => {
      if (url === '/api/categories' && options.method === 'POST') {
        return Promise.resolve({
          ok: false,
          text: () => Promise.resolve('Failed to create category')
        });
      }
    });

    render(<CategoryCustomization />, { wrapper: createWrapper() });

    // Fill out and submit the form
    await user.type(screen.getByPlaceholderText('e.g., Groceries'), 'Shopping');
    await user.click(screen.getByText('Add Category'));

    // Verify error handling
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/categories', expect.any(Object));
    });
  });
});
