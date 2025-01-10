import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InsertUser, SelectUser } from "@db/schema";
import { useToast } from "@/hooks/use-toast";

interface AuthResponse {
  user: SelectUser;
  token: string;
  message: string;
}

// Store token in localStorage
const TOKEN_KEY = 'auth_token';

function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function handleRequest(
  url: string,
  method: string,
  body?: Omit<InsertUser, "id" | "createdAt" | "dailyBudgetAmount">
): Promise<AuthResponse> {
  try {
    const token = getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || response.statusText);
    }

    return response.json();
  } catch (error: any) {
    throw new Error(error.message || 'An unexpected error occurred');
  }
}

async function fetchUser(): Promise<SelectUser | null> {
  try {
    const token = getToken();
    if (!token) {
      return null;
    }

    const response = await fetch('/api/user', {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      }
    });

    if (response.status === 401) {
      removeToken();
      return null;
    }

    if (!response.ok) {
      throw new Error('Failed to fetch user data');
    }

    return response.json();
  } catch (error: any) {
    console.error('Error fetching user:', error);
    return null;
  }
}

export function useUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
      setToken(data.token);
      queryClient.setQueryData(['user'], data.user);
      toast({
        title: "Success",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const logoutMutation = useMutation({
    mutationFn: () => {
      removeToken();
      return Promise.resolve({ message: "Logged out successfully" });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['user'], null);
      toast({
        title: "Success",
        description: data.message,
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: (userData: Omit<InsertUser, "id" | "createdAt" | "dailyBudgetAmount">) => 
      handleRequest('/api/register', 'POST', userData),
    onSuccess: (data) => {
      setToken(data.token);
      queryClient.setQueryData(['user'], data.user);
      toast({
        title: "Success",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
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