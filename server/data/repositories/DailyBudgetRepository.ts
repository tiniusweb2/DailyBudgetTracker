import { eq, and } from "drizzle-orm";
import { db } from "@db";
import { dailyBudgets, convertDecimalToNumber } from "@db/schema";
import { DailyBudget, CreateDailyBudget, UpdateDailyBudget, DailyBudgetRepository } from "../../domain/entities/DailyBudget";
import { AppError } from "../../domain/errors/AppError";
import { startOfDay, endOfDay } from "date-fns";

export class DrizzleDailyBudgetRepository implements DailyBudgetRepository {
  async findById(id: number): Promise<DailyBudget | null> {
    const [budget] = await db
      .select()
      .from(dailyBudgets)
      .where(eq(dailyBudgets.id, id))
      .limit(1);

    return budget ? convertDecimalToNumber(budget) : null;
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

    return budget ? convertDecimalToNumber(budget) : null;
  }

  async findByUserId(userId: number): Promise<DailyBudget[]> {
    const budgets = await db
      .select()
      .from(dailyBudgets)
      .where(eq(dailyBudgets.userId, userId))
      .orderBy(dailyBudgets.date);

    return budgets.map(convertDecimalToNumber);
  }

  async create(data: CreateDailyBudget): Promise<DailyBudget> {
    const [budget] = await db
      .insert(dailyBudgets)
      .values({
        userId: data.userId,
        date: startOfDay(data.date),
        budgetAmount: data.budgetAmount.toString(),
        spent: (data.spent || 0).toString(),
        saved: (data.saved || 0).toString(),
      })
      .returning();

    return convertDecimalToNumber(budget);
  }

  async update(id: number, data: UpdateDailyBudget): Promise<DailyBudget> {
    const updates: Partial<typeof dailyBudgets.$inferInsert> = {};

    if (data.spent !== undefined) {
      updates.spent = data.spent.toString();
    }
    if (data.saved !== undefined) {
      updates.saved = data.saved.toString();
    }
    if (data.budgetAmount !== undefined) {
      updates.budgetAmount = data.budgetAmount.toString();
    }

    const [budget] = await db
      .update(dailyBudgets)
      .set(updates)
      .where(eq(dailyBudgets.id, id))
      .returning();

    if (!budget) {
      throw AppError.notFound('Daily budget not found');
    }

    return convertDecimalToNumber(budget);
  }

  async getCurrentDayBudget(userId: number): Promise<DailyBudget> {
    const today = new Date();
    let budget = await this.findByUserIdAndDate(userId, today);

    if (!budget) {
      // Get the user's daily budget amount
      const [user] = await db
        .select()
        .from(dailyBudgets)
        .where(eq(dailyBudgets.userId, userId))
        .limit(1);

      if (!user) {
        throw AppError.notFound('User not found');
      }

      // Create a new daily budget
      budget = await this.create({
        userId,
        date: today,
        budgetAmount: Number(user.budgetAmount),
        spent: 0,
        saved: 0,
      });
    }

    return budget;
  }
}