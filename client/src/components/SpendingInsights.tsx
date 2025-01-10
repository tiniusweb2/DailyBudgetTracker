import { useState, useEffect } from "react";
import { useBudget } from "@/hooks/use-budget";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, animate } from "recharts";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

export default function SpendingInsights() {
  const { budgetStatus, isLoading } = useBudget();
  const [pieData, setPieData] = useState<any[]>([]);

  useEffect(() => {
    if (budgetStatus) {
      setPieData([
        { name: "Spent", value: budgetStatus.spent },
        { name: "Available", value: budgetStatus.available },
        { name: "Saved", value: budgetStatus.saved }
      ]);
    }
  }, [budgetStatus]);

  const COLORS = ['#ef4444', '#22c55e', '#3b82f6'];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center items-center h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </CardContent>
      </Card>
    );
  }

  if (!budgetStatus) return null;

  const availablePercentage = (budgetStatus.available / budgetStatus.dailyBudget) * 100;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Spending Insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Animated Wave for Available Budget */}
        <div className="relative h-32 bg-background rounded-lg overflow-hidden">
          <motion.div
            className="absolute bottom-0 left-0 right-0 bg-primary/20"
            initial={{ height: "0%" }}
            animate={{ height: `${availablePercentage}%` }}
            transition={{
              type: "spring",
              stiffness: 20,
              damping: 5
            }}
          >
            <motion.div
              className="absolute top-0 left-0 right-0 h-2 bg-primary/30"
              animate={{
                y: [-4, 4, -4],
              }}
              transition={{
                repeat: Infinity,
                duration: 2,
                ease: "easeInOut"
              }}
            />
          </motion.div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold">
              ${budgetStatus.available.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Animated Pie Chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                animationBegin={0}
                animationDuration={1500}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex justify-center gap-4">
          {pieData.map((entry, index) => (
            <div key={entry.name} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: COLORS[index] }}
              />
              <span className="text-sm">
                {entry.name}: ${entry.value.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
