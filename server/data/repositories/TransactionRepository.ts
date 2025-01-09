import { eq } from "drizzle-orm";
import { db } from "@db";
import { transactions, convertDecimalToNumber } from "@db/schema";
import { 
  Transaction,
  CreateTransaction,
  UpdateTransaction,
  TransactionRepository 
} from "../../domain/entities/Transaction";
import { AppError } from "../../domain/errors/AppError";

export class DrizzleTransactionRepository implements TransactionRepository {
  async findById(id: number): Promise<Transaction | null> {
    const [transaction] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, id))
      .limit(1);

    return transaction ? convertDecimalToNumber(transaction) : null;
  }

  async findByUserId(userId: number): Promise<Transaction[]> {
    const results = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(transactions.createdAt);

    return results.map(convertDecimalToNumber);
  }

  async create(data: CreateTransaction): Promise<Transaction> {
    const [transaction] = await db
      .insert(transactions)
      .values({
        userId: data.userId,
        amount: data.amount.toString(),
        description: data.description,
      })
      .returning();

    return convertDecimalToNumber(transaction);
  }

  async update(id: number, data: UpdateTransaction): Promise<Transaction> {
    const updates: Partial<typeof transactions.$inferInsert> = {};

    if (data.amount !== undefined) {
      updates.amount = data.amount.toString();
    }
    if (data.description !== undefined) {
      updates.description = data.description;
    }

    const [transaction] = await db
      .update(transactions)
      .set(updates)
      .where(eq(transactions.id, id))
      .returning();

    if (!transaction) {
      throw AppError.notFound('Transaction not found');
    }

    return convertDecimalToNumber(transaction);
  }

  async delete(id: number): Promise<void> {
    const [transaction] = await db
      .delete(transactions)
      .where(eq(transactions.id, id))
      .returning();

    if (!transaction) {
      throw AppError.notFound('Transaction not found');
    }
  }
}