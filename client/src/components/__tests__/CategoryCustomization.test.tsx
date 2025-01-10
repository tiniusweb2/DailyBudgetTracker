import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CategoryCustomization from '../CategoryCustomization';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Loader2: () => <div data-testid="loader-icon">Loading...</div>,
  Plus: () => <div data-testid="plus-icon">Plus</div>,
  ShoppingCart: () => <div data-testid="shopping-cart-icon">Shopping Cart</div>,
  // Add more icon mocks as needed
}));

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
          json: () => Promise.resolve({ 
            id: 2, 
            name: 'Shopping',
            icon: 'ShoppingCart',
            color: 'bg-blue-500'
          })
        });
      }
    });

    render(<CategoryCustomization />, { wrapper: createWrapper() });

    // Fill out the form
    await user.type(screen.getByPlaceholderText('e.g., Groceries'), 'Shopping');

    // Open and select icon
    const iconSelect = screen.getByLabelText('Icon');
    await user.click(iconSelect);
    await user.click(screen.getByText('ShoppingCart'));

    // Open and select color
    const colorSelect = screen.getByLabelText('Color');
    await user.click(colorSelect);
    await user.click(screen.getByText('Blue'));

    // Submit the form
    const submitButton = screen.getByText('Add Category');
    await user.click(submitButton);

    // Verify API call
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/categories', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'Shopping',
          icon: 'ShoppingCart',
          color: 'bg-blue-500'
        })
      }));
    });
  });

  it('handles API errors gracefully', async () => {
    const user = userEvent.setup();
    mockFetch.mockImplementationOnce((url, options) => {
      if (url === '/api/categories' && options.method === 'POST') {
        return Promise.resolve({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Internal Server Error')
        });
      }
    });

    render(<CategoryCustomization />, { wrapper: createWrapper() });

    // Fill out form with minimum required fields
    await user.type(screen.getByPlaceholderText('e.g., Groceries'), 'Shopping');
    await user.click(screen.getByText('Add Category'));

    // Verify error handling
    await waitFor(() => {
      expect(screen.getByText(/failed to create category/i)).toBeInTheDocument();
    });
  });

  it('displays loading state while fetching categories', async () => {
    // Delay the mock response to test loading state
    mockFetch.mockImplementationOnce(() => 
      new Promise(resolve => 
        setTimeout(() => 
          resolve({
            ok: true,
            json: () => Promise.resolve([])
          }), 100
        )
      )
    );

    render(<CategoryCustomization />, { wrapper: createWrapper() });

    // Check for loading indicator
    expect(screen.getByTestId('loader-icon')).toBeInTheDocument();

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loader-icon')).not.toBeInTheDocument();
    });
  });

  it('shows empty state message when no categories exist', async () => {
    mockFetch.mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([])
      })
    );

    render(<CategoryCustomization />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/no categories yet/i)).toBeInTheDocument();
    });
  });

  it('prevents form submission while request is in progress', async () => {
    const user = userEvent.setup();
    let resolveRequest: (value: any) => void;

    mockFetch.mockImplementationOnce(() => 
      new Promise(resolve => {
        resolveRequest = resolve;
      })
    );

    render(<CategoryCustomization />, { wrapper: createWrapper() });

    // Fill out and submit form
    await user.type(screen.getByPlaceholderText('e.g., Groceries'), 'Shopping');
    const submitButton = screen.getByText('Add Category');
    await user.click(submitButton);

    // Verify button is disabled during submission
    expect(submitButton).toBeDisabled();
    expect(screen.getByText(/creating/i)).toBeInTheDocument();

    // Resolve the pending request
    resolveRequest!({
      ok: true,
      json: () => Promise.resolve({ id: 1, name: 'Shopping' })
    });

    // Verify button is re-enabled
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
      expect(screen.queryByText(/creating/i)).not.toBeInTheDocument();
    });
  });
});