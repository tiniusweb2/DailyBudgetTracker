import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import BankLinkButton from "./BankLinkButton";

export default function IncomeSourceForm() {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [nextPaymentDate, setNextPaymentDate] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { mutate: addIncomeSource, isPending } = useMutation({
    mutationFn: async (data: { name: string; amount: number; frequency: string; nextPaymentDate: string }) => {
      const response = await fetch("/api/income-sources", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      setName("");
      setAmount("");
      setNextPaymentDate("");
      queryClient.invalidateQueries({ queryKey: ['/api/income-sources'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] }); 
      toast({
        title: "Success",
        description: "Income source added successfully",
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

    if (!name || !amount || !nextPaymentDate) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please fill in all fields",
      });
      return;
    }

    addIncomeSource({
      name,
      amount: Number(amount),
      frequency,
      nextPaymentDate,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Income Source</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <BankLinkButton />
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                or add manually
              </span>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Source Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g., Salary"
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
              <Label htmlFor="frequency">Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nextPaymentDate">Next Payment Date</Label>
              <Input
                id="nextPaymentDate"
                type="date"
                value={nextPaymentDate}
                onChange={(e) => setNextPaymentDate(e.target.value)}
                required
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Add Income Source
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}