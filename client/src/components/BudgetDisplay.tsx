import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTransactions } from "@/hooks/use-transactions";
import { Loader2 } from "lucide-react";

export default function BudgetDisplay() {
  const { dailyBudget, isLoading } = useTransactions();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center items-center h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today's Budget</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Available</span>
            <span className="text-3xl font-bold">
              ${dailyBudget?.available.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Spent Today</span>
            <span className="text-lg text-destructive">
              ${dailyBudget?.spent.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Saved</span>
            <span className="text-lg text-green-600">
              ${dailyBudget?.saved.toFixed(2)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
