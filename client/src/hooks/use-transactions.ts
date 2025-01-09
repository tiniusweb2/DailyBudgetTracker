import { useQuery } from "@tanstack/react-query";
import type { Transaction, DailyBudget } from "@db/schema";

interface DailyBudgetInfo {
  available: number;
  spent: number;
  saved: number;
}

interface TransactionsResponse {
  transactions: Transaction[];
  dailyBudget: DailyBudgetInfo;
  dailyBudgets: DailyBudget[];
}

export function useTransactions() {
  const { data, isLoading, error } = useQuery<TransactionsResponse>({
    queryKey: ["/api/transactions"],
    queryFn: async () => {
      const response = await fetch("/api/transactions", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
  });

  return {
    transactions: data?.transactions ?? [],
    dailyBudget: data?.dailyBudget ?? { available: 0, spent: 0, saved: 0 },
    dailyBudgets: data?.dailyBudgets ?? [],
    isLoading,
    error,
  };
}