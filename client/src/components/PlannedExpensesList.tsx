import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface PlannedExpense {
  id: number;
  name: string;
  amount: number;
  targetDate: string;
  dailyContribution: number;
  isCompleted: boolean;
}

export default function PlannedExpensesList() {
  const { data: expenses, isLoading } = useQuery<PlannedExpense[]>({
    queryKey: ['/api/planned-expenses'],
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center items-center h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </CardContent>
      </Card>
    );
  }

  if (!expenses?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Planned Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No planned expenses yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Planned Expenses</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {expenses.map((expense) => {
          const timeLeft = formatDistanceToNow(new Date(expense.targetDate), { addSuffix: true });
          const progress = expense.isCompleted ? 100 : 
            Math.min(100, (new Date().getTime() - new Date(expense.targetDate).getTime()) / 
            (new Date(expense.targetDate).getTime() - new Date().getTime()) * 100);

          return (
            <div key={expense.id} className="space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium">{expense.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    ${expense.amount.toFixed(2)} • Due {timeLeft}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">${expense.dailyContribution.toFixed(2)}/day</p>
                  <p className="text-sm text-muted-foreground">
                    {expense.isCompleted ? 'Completed' : 'Daily contribution'}
                  </p>
                </div>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
