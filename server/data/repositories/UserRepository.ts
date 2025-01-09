import { eq } from "drizzle-orm";
import { db } from "@db";
import { users, convertDecimalToNumber } from "@db/schema";
import { User, CreateUser, UpdateUser, UserRepository } from "../../domain/entities/User";
import { AppError } from "../../domain/errors/AppError";
import { comparePasswords, hashPassword } from "../utils/auth";

export class DrizzleUserRepository implements UserRepository {
  async findById(id: number): Promise<User | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return user ? convertDecimalToNumber(user) : null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    return user ? convertDecimalToNumber(user) : null;
  }

  async create(data: CreateUser): Promise<User> {
    const existingUser = await this.findByUsername(data.username);
    if (existingUser) {
      throw AppError.badRequest('Username already exists');
    }

    const hashedPassword = await hashPassword(data.password);
    const [user] = await db
      .insert(users)
      .values({
        username: data.username,
        password: hashedPassword,
        dailyBudgetAmount: data.dailyBudgetAmount?.toString() || "50.00",
      })
      .returning();

    return convertDecimalToNumber(user);
  }

  async update(id: number, data: UpdateUser): Promise<User> {
    const updates: Partial<typeof users.$inferInsert> = {};

    if (data.dailyBudgetAmount !== undefined) {
      updates.dailyBudgetAmount = data.dailyBudgetAmount.toString();
    }

    if (data.password) {
      updates.password = await hashPassword(data.password);
    }

    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();

    if (!user) {
      throw AppError.notFound('User not found');
    }

    return convertDecimalToNumber(user);
  }

  async verifyCredentials(username: string, password: string): Promise<User | null> {
    const user = await this.findByUsername(username);
    if (!user) return null;

    const isValid = await comparePasswords(password, user.password);
    return isValid ? user : null;
  }
}