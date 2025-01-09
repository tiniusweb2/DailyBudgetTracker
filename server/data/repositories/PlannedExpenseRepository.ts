import { eq, and, gte } from "drizzle-orm";
import { db } from "@db";
import { plannedExpenses, convertDecimalToNumber } from "@db/schema";
import type { PlannedExpense, InsertPlannedExpense } from "@db/schema";
import { AppError } from "../../domain/errors/AppError";

export interface UpdatePlannedExpense {
  name?: string;
  amount?: number;
  targetDate?: Date;
  isCompleted?: boolean;
  dailyContribution?: number;
}

export class DrizzlePlannedExpenseRepository {
  async findById(id: number): Promise<PlannedExpense | null> {
    const [expense] = await db
      .select()
      .from(plannedExpenses)
      .where(eq(plannedExpenses.id, id))
      .limit(1);

    return expense ? convertDecimalToNumber(expense) : null;
  }

  async findByUserId(userId: number): Promise<PlannedExpense[]> {
    const expenses = await db
      .select()
      .from(plannedExpenses)
      .where(eq(plannedExpenses.userId, userId))
      .orderBy(plannedExpenses.targetDate);

    return expenses.map(convertDecimalToNumber);
  }

  async findActiveByUserId(userId: number): Promise<PlannedExpense[]> {
    const expenses = await db
      .select()
      .from(plannedExpenses)
      .where(
        and(
          eq(plannedExpenses.userId, userId),
          eq(plannedExpenses.isCompleted, false),
          gte(plannedExpenses.targetDate, new Date())
        )
      )
      .orderBy(plannedExpenses.targetDate);

    return expenses.map(convertDecimalToNumber);
  }

  async create(data: InsertPlannedExpense): Promise<PlannedExpense> {
    const [expense] = await db
      .insert(plannedExpenses)
      .values({
        ...data,
        amount: data.amount.toString(),
        dailyContribution: data.dailyContribution.toString(),
      })
      .returning();

    return convertDecimalToNumber(expense);
  }

  async update(id: number, data: UpdatePlannedExpense): Promise<PlannedExpense> {
    const updates: Partial<typeof plannedExpenses.$inferInsert> = {};

    if (data.name !== undefined) {
      updates.name = data.name;
    }
    if (data.amount !== undefined) {
      updates.amount = data.amount.toString();
    }
    if (data.targetDate !== undefined) {
      updates.targetDate = data.targetDate;
    }
    if (data.isCompleted !== undefined) {
      updates.isCompleted = data.isCompleted;
    }
    if (data.dailyContribution !== undefined) {
      updates.dailyContribution = data.dailyContribution.toString();
    }

    const [expense] = await db
      .update(plannedExpenses)
      .set(updates)
      .where(eq(plannedExpenses.id, id))
      .returning();

    if (!expense) {
      throw AppError.notFound('Planned expense not found');
    }

    return convertDecimalToNumber(expense);
  }

  async calculateDailyContributions(userId: number): Promise<number> {
    const activeExpenses = await this.findActiveByUserId(userId);
    return activeExpenses.reduce((total, expense) => total + expense.dailyContribution, 0);
  }
}
