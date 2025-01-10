import { useState } from "react";
import { useBudget } from "@/hooks/use-budget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { DollarSign, Loader2 } from "lucide-react";

const formSchema = z.object({
  amount: z.string().refine(
    (val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    },
    { message: "Please enter a valid amount greater than 0" }
  ),
});

type FormData = z.infer<typeof formSchema>;

export default function BudgetSetupForm() {
  const { budgetStatus, updateBudget } = useBudget();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: budgetStatus?.dailyBudget?.toString() || "",
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      setIsSubmitting(true);
      const numAmount = parseFloat(data.amount);
      await updateBudget(numAmount);
      form.reset({ amount: numAmount.toString() });
    } catch (error) {
      console.error('Failed to update budget:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Set Daily Budget</CardTitle>
        <CardDescription>
          Set your daily spending limit to help manage your finances
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Daily Budget Amount</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Enter amount"
                        className="pl-9"
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Set the amount you want to spend each day
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isSubmitting || !form.formState.isDirty}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Budget'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}