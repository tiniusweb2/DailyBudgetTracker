import { Alert, AlertDescription } from "@/components/ui/alert";
import BudgetDisplay from "@/components/BudgetDisplay";
import BudgetSetupForm from "@/components/BudgetSetupForm";
import SpendingInsights from "@/components/SpendingInsights";
import { useBudget } from "@/hooks/use-budget";
import { Loader2 } from "lucide-react";

export default function BudgetDashboard() {
  const { budgetStatus, isLoading, error } = useBudget();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="max-w-md mx-auto mt-8">
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Budget Dashboard</h1>
      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-8">
          <BudgetDisplay />
          <SpendingInsights />
        </div>
        <div>
          <BudgetSetupForm />
        </div>
      </div>
    </div>
  );
}