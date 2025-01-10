import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export interface DailyBudgetStatus {
  dailyBudget: number;
  available: number;
  spent: number;
  saved: number;
  rollover: number;
  plannedExpenses: number;
}

export function useBudget() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: budgetStatus, isLoading } = useQuery<DailyBudgetStatus>({
    queryKey: ['/api/budget/status'],
  });

  const updateBudgetMutation = useMutation({
    mutationFn: async (amount: number) => {
      const response = await fetch('/api/budget', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['/api/budget/status'], data);
      toast({
        title: "Success",
        description: "Daily budget updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    budgetStatus,
    isLoading,
    updateBudget: updateBudgetMutation.mutateAsync,
  };
}