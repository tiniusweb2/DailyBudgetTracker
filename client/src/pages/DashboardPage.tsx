import { Button } from "@/components/ui/button";
import BudgetDisplay from "@/components/BudgetDisplay";
import TransactionList from "@/components/TransactionList";
import BudgetChart from "@/components/BudgetChart";
import TransactionForm from "@/components/TransactionForm";
import PlannedExpenseForm from "@/components/PlannedExpenseForm";
import PlannedExpensesList from "@/components/PlannedExpensesList";
import { useUser } from "@/hooks/use-user";

export default function DashboardPage() {
  const { user, logout } = useUser();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-6">
          <h1 className="text-2xl font-bold">Welcome, {user?.username}</h1>
          <Button onClick={() => logout()}>Log Out</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6">
          <BudgetDisplay />
          <BudgetChart />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-6">
          <div className="space-y-6">
            <TransactionForm />
            <PlannedExpenseForm />
          </div>
          <div className="md:col-span-2 space-y-6">
            <PlannedExpensesList />
            <TransactionList />
          </div>
        </div>
      </div>
    </div>
  );
}