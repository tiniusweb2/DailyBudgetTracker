import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Loader2, DollarSign } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface IncomeSource {
  id: number;
  name: string;
  amount: number;
  frequency: string;
  nextPaymentDate: string;
  isActive: boolean;
}

export default function IncomeSourcesList() {
  const { data: incomeSources, isLoading } = useQuery<IncomeSource[]>({
    queryKey: ['/api/income-sources'],
  });

  // Calculate daily income contribution based on frequency
  const calculateDailyAmount = (amount: number, frequency: string) => {
    switch (frequency) {
      case 'weekly':
        return amount / 7;
      case 'bi-weekly':
        return amount / 14;
      case 'monthly':
        return amount / 30;
      default:
        return 0;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center items-center h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </CardContent>
      </Card>
    );
  }

  if (!incomeSources?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Income Sources</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No income sources added yet.</p>
        </CardContent>
      </Card>
    );
  }

  const totalDailyIncome = incomeSources.reduce((total, source) => 
    total + calculateDailyAmount(source.amount, source.frequency), 0
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Income Sources</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-primary/10 rounded-lg">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <p className="font-medium">Total Daily Income</p>
          </div>
          <p className="text-2xl font-bold mt-1">${totalDailyIncome.toFixed(2)}</p>
        </div>
        
        {incomeSources.map((source) => {
          const dailyAmount = calculateDailyAmount(source.amount, source.frequency);
          const nextPayment = formatDistanceToNow(new Date(source.nextPaymentDate), { addSuffix: true });

          return (
            <div key={source.id} className="flex justify-between items-start p-4 border rounded-lg">
              <div>
                <h3 className="font-medium">{source.name}</h3>
                <p className="text-sm text-muted-foreground">
                  ${source.amount.toFixed(2)} {source.frequency}
                </p>
                <p className="text-sm text-muted-foreground">
                  Next payment {nextPayment}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">${dailyAmount.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">per day</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
