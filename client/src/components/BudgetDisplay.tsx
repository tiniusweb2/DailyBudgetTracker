import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useBudget } from "@/hooks/use-budget";
import { Loader2, TrendingUp, TrendingDown, Wallet } from "lucide-react";

export default function BudgetDisplay() {
  const { budgetStatus, isLoading } = useBudget();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center items-center h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </CardContent>
      </Card>
    );
  }

  const spentPercentage = budgetStatus ? (budgetStatus.spent / budgetStatus.dailyBudget) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today's Budget</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Available
            </span>
            <span className="text-3xl font-bold">
              ${budgetStatus?.available.toFixed(2)}
            </span>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-destructive" />
                Spent Today
              </span>
              <span className="text-lg text-destructive">
                ${budgetStatus?.spent.toFixed(2)}
              </span>
            </div>
            <Progress value={spentPercentage} className="h-2" />
          </div>

          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-sm text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              Saved
            </span>
            <span className="text-lg text-green-600">
              ${budgetStatus?.saved.toFixed(2)}
            </span>
          </div>

          {budgetStatus?.rollover > 0 && (
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-sm text-muted-foreground">
                Rollover from Previous Days
              </span>
              <span className="text-lg text-blue-600">
                ${budgetStatus.rollover.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}