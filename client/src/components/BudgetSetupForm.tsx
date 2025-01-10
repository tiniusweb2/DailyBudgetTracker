import { useState } from "react";
import { useBudget } from "@/hooks/use-budget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";

export default function BudgetSetupForm() {
  const { budgetStatus, updateBudget } = useBudget();
  const [amount, setAmount] = useState(budgetStatus?.dailyBudget?.toString() || "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;
    await updateBudget(numAmount);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set Daily Budget</CardTitle>
        <CardDescription>
          Set your daily spending limit to help manage your finances
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 h-4 w-4" />
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pl-9"
              placeholder="Enter daily budget amount"
            />
          </div>
          <Button type="submit" className="w-full">
            Update Budget
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
