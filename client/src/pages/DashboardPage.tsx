import { Button } from "@/components/ui/button";
import BudgetDisplay from "@/components/BudgetDisplay";
import BudgetSetupForm from "@/components/BudgetSetupForm";
import TransactionList from "@/components/TransactionList";
import BudgetChart from "@/components/BudgetChart";
import { useUser } from "@/hooks/use-user";

export default function DashboardPage() {
  const { user, logout } = useUser();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-6">
          <h1 className="text-2xl font-bold text-foreground">Welcome, {user?.username}</h1>
          <Button onClick={() => logout()}>Log Out</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6">
          <BudgetSetupForm />
          <BudgetDisplay />
        </div>

        <div className="py-6">
          <BudgetChart />
        </div>

        <div className="py-6">
          <TransactionList />
        </div>
      </div>
    </div>
  );
}