import { eq, and, lt } from "drizzle-orm";
import { db } from "@db";
import { dailyBudgets, users, type User } from "@db/schema";
import { DailyBudget, CreateDailyBudget, UpdateDailyBudget, DailyBudgetRepository } from "../../domain/entities/DailyBudget";
import { AppError } from "../../domain/errors/AppError";
import { startOfDay, endOfDay } from "date-fns";

export class DrizzleDailyBudgetRepository implements DailyBudgetRepository {
  async findById(id: number): Promise<DailyBudget> {
    const [budget] = await db
      .select()
      .from(dailyBudgets)
      .where(eq(dailyBudgets.id, id))
      .limit(1);

    if (!budget) {
      throw AppError.notFound('Daily budget not found');
    }

    return {
      ...budget,
      budgetAmount: Number(budget.budgetAmount),
      spent: Number(budget.spent),
      saved: Number(budget.saved)
    };
  }

  async findByUserIdAndDate(userId: number, date: Date): Promise<DailyBudget | null> {
    const [budget] = await db
      .select()
      .from(dailyBudgets)
      .where(
        and(
          eq(dailyBudgets.userId, userId),
          eq(dailyBudgets.date, startOfDay(date))
        )
      )
      .limit(1);

    if (!budget) return null;

    return {
      ...budget,
      budgetAmount: Number(budget.budgetAmount),
      spent: Number(budget.spent),
      saved: Number(budget.saved)
    };
  }

  async findByUserId(userId: number): Promise<DailyBudget[]> {
    const budgets = await db
      .select()
      .from(dailyBudgets)
      .where(eq(dailyBudgets.userId, userId))
      .orderBy(dailyBudgets.date);

    return budgets.map(budget => ({
      ...budget,
      budgetAmount: Number(budget.budgetAmount),
      spent: Number(budget.spent),
      saved: Number(budget.saved)
    }));
  }

  async create(data: CreateDailyBudget): Promise<DailyBudget> {
    const [budget] = await db
      .insert(dailyBudgets)
      .values({
        userId: data.userId,
        date: startOfDay(data.date),
        budgetAmount: data.budgetAmount.toFixed(2),
        spent: (data.spent || 0).toFixed(2),
        saved: (data.saved || 0).toFixed(2),
      })
      .returning();

    return {
      ...budget,
      budgetAmount: Number(budget.budgetAmount),
      spent: Number(budget.spent),
      saved: Number(budget.saved)
    };
  }

  async update(id: number, data: UpdateDailyBudget): Promise<DailyBudget> {
    const updates: Partial<typeof dailyBudgets.$inferInsert> = {};

    if (data.budgetAmount !== undefined) {
      updates.budgetAmount = data.budgetAmount.toFixed(2);
    }
    if (data.spent !== undefined) {
      updates.spent = data.spent.toFixed(2);
    }
    if (data.saved !== undefined) {
      updates.saved = data.saved.toFixed(2);
    }

    const [budget] = await db
      .update(dailyBudgets)
      .set(updates)
      .where(eq(dailyBudgets.id, id))
      .returning();

    if (!budget) {
      throw AppError.notFound('Daily budget not found');
    }

    return {
      ...budget,
      budgetAmount: Number(budget.budgetAmount),
      spent: Number(budget.spent),
      saved: Number(budget.saved)
    };
  }

  async getCurrentDayBudget(userId: number): Promise<DailyBudget> {
    const today = new Date();
    let budget = await this.findByUserIdAndDate(userId, today);

    if (!budget) {
      // Get the user's daily budget amount from their profile
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        throw AppError.notFound('User not found');
      }

      // Create a new daily budget
      budget = await this.create({
        userId,
        date: today,
        budgetAmount: Number(user.dailyBudgetAmount),
        spent: 0,
        saved: 0,
      });
    }

    return budget;
  }

  async getUnspentAmount(userId: number): Promise<number> {
    const today = new Date();
    const previousDayBudgets = await db
      .select()
      .from(dailyBudgets)
      .where(
        and(
          eq(dailyBudgets.userId, userId),
          lt(dailyBudgets.date, startOfDay(today))
        )
      )
      .orderBy(dailyBudgets.date);

    return previousDayBudgets.reduce((total, budget) => {
      const budgetAmount = Number(budget.budgetAmount);
      const spent = Number(budget.spent);
      return total + (budgetAmount - spent);
    }, 0);
  }
}