// In-memory storage implementation
import type { User, Transaction, DailyBudget } from "./schema";

class InMemoryDB {
  private users: Map<number, User> = new Map();
  private transactions: Map<number, Transaction> = new Map();
  private dailyBudgets: Map<number, DailyBudget> = new Map();
  private userIdCounter = 1;
  private transactionIdCounter = 1;
  private dailyBudgetIdCounter = 1;

  // User operations
  async createUser(data: Omit<User, "id" | "createdAt">): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = {
      id,
      ...data,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async findUserById(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async findUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.username === username);
  }

  // Transaction operations
  async createTransaction(data: Omit<Transaction, "id" | "createdAt">): Promise<Transaction> {
    const id = this.transactionIdCounter++;
    const transaction: Transaction = {
      id,
      ...data,
      createdAt: new Date(),
    };
    this.transactions.set(id, transaction);
    return transaction;
  }

  async findTransactionsByUserId(userId: number): Promise<Transaction[]> {
    return Array.from(this.transactions.values())
      .filter(t => t.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Daily Budget operations
  async createDailyBudget(data: Omit<DailyBudget, "id" | "createdAt">): Promise<DailyBudget> {
    const id = this.dailyBudgetIdCounter++;
    const budget: DailyBudget = {
      id,
      ...data,
      createdAt: new Date(),
    };
    this.dailyBudgets.set(id, budget);
    return budget;
  }

  async findDailyBudgetsByUserId(userId: number): Promise<DailyBudget[]> {
    return Array.from(this.dailyBudgets.values())
      .filter(b => b.userId === userId)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  async findDailyBudgetByUserIdAndDate(userId: number, date: Date): Promise<DailyBudget | undefined> {
    return Array.from(this.dailyBudgets.values()).find(
      b => b.userId === userId && 
           b.date.toISOString().split('T')[0] === date.toISOString().split('T')[0]
    );
  }

  async updateDailyBudget(id: number, data: Partial<DailyBudget>): Promise<DailyBudget | undefined> {
    const budget = this.dailyBudgets.get(id);
    if (!budget) return undefined;

    const updatedBudget = { ...budget, ...data };
    this.dailyBudgets.set(id, updatedBudget);
    return updatedBudget;
  }
}

export const db = new InMemoryDB();