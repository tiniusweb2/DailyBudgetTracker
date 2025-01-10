import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTransactions } from "@/hooks/use-transactions";
import { Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { Loader2 } from "lucide-react";

export default function BudgetChart() {
  const { dailyBudgets, isLoading } = useTransactions();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Budget History</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </CardContent>
      </Card>
    );
  }

  if (!dailyBudgets?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Budget History</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-[200px]">
          <p className="text-muted-foreground">No budget history available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Budget History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] w-full">
          <LineChart width={800} height={200} data={dailyBudgets}>
            <XAxis
              dataKey="date"
              tickFormatter={(value) => new Date(value).toLocaleDateString()}
              stroke="hsl(var(--muted-foreground))"
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip
              formatter={(value: number) => [`$${value.toFixed(2)}`, "Amount"]}
              labelFormatter={(label) => new Date(label).toLocaleDateString()}
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
              }}
            />
            <Line
              type="monotone"
              dataKey="budgetAmount"
              name="Budget"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="spent"
              name="Spent"
              stroke="hsl(var(--destructive))"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="saved"
              name="Saved"
              stroke="hsl(var(--success))"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </div>
      </CardContent>
    </Card>
  );
}