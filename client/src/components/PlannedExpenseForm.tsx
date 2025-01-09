import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

export default function PlannedExpenseForm() {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { mutate: addPlannedExpense, isPending } = useMutation({
    mutationFn: async (data: { name: string; amount: number; targetDate: string }) => {
      const response = await fetch("/api/planned-expenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          ...data,
          categoryId: 1, // Default category for now
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      setName("");
      setAmount("");
      setTargetDate("");
      queryClient.invalidateQueries({ queryKey: ['/api/planned-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] }); // Refresh budget data
      toast({
        title: "Success",
        description: "Planned expense added successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !amount || !targetDate) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please fill in all fields",
      });
      return;
    }

    addPlannedExpense({
      name,
      amount: Number(amount),
      targetDate,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Planned Expense</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g., New Perfume"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Amount ($)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              min="0"
              placeholder="Enter amount"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="targetDate">Target Date</Label>
            <Input
              id="targetDate"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              required
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Add Planned Expense
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
