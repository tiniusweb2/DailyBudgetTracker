import { useQuery } from "@tanstack/react-query";
import type { Transaction, DailyBudget } from "@db/schema";

interface TransactionsResponse {
  transactions: Transaction[];
  dailyBudget: {
    available: number;
    spent: number;
    saved: number;
  };
  dailyBudgets: DailyBudget[];
}

export function useTransactions() {
  const { data, isLoading, error } = useQuery<TransactionsResponse>({
    queryKey: ["/api/transactions"],
  });

  return {
    transactions: data?.transactions ?? [],
    dailyBudget: data?.dailyBudget,
    dailyBudgets: data?.dailyBudgets ?? [],
    isLoading,
    error,
  };
}
