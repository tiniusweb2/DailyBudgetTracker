import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InsertUser, SelectUser } from "@db/schema";

interface AuthResponse {
  user: SelectUser;
  message: string;
}

async function handleRequest(
  url: string,
  method: string,
  body?: Omit<InsertUser, "id" | "createdAt" | "dailyBudgetAmount">
): Promise<AuthResponse> {
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      credentials: "include",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || response.statusText);
    }

    return data;
  } catch (error: any) {
    throw new Error(error.message || 'An unexpected error occurred');
  }
}

async function fetchUser(): Promise<SelectUser | null> {
  try {
    const response = await fetch('/api/user', {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (response.status === 401) {
      return null;
    }

    if (!response.ok) {
      throw new Error('Failed to fetch user data');
    }

    return response.json();
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}

export function useUser() {
  const queryClient = useQueryClient();

  const { data: user, error, isLoading } = useQuery<SelectUser | null, Error>({
    queryKey: ['user'],
    queryFn: fetchUser,
    staleTime: Infinity,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: (userData: Omit<InsertUser, "id" | "createdAt" | "dailyBudgetAmount">) => 
      handleRequest('/api/login', 'POST', userData),
    onSuccess: (data) => {
      queryClient.setQueryData(['user'], data.user);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => handleRequest('/api/logout', 'POST'),
    onSuccess: () => {
      queryClient.setQueryData(['user'], null);
    },
  });

  const registerMutation = useMutation({
    mutationFn: (userData: Omit<InsertUser, "id" | "createdAt" | "dailyBudgetAmount">) => 
      handleRequest('/api/register', 'POST', userData),
    onSuccess: (data) => {
      queryClient.setQueryData(['user'], data.user);
    },
  });

  return {
    user,
    isLoading,
    error,
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    register: registerMutation.mutateAsync,
  };
}