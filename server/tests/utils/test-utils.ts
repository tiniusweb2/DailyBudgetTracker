import { db } from "@db";
import { users, categories, transactions, type User, type Category, type Transaction } from "@db/schema";
import { hashPassword } from "../../auth";
import type { Express } from "express";
import supertest from "supertest";

export async function createTestUser(overrides?: Partial<User>) {
  const [user] = await db
    .insert(users)
    .values({
      username: `testuser_${Date.now()}`,
      password: await hashPassword('password123'),
      dailyBudgetAmount: "50.00",
      ...overrides,
    })
    .returning();

  return user;
}

export async function createTestCategory(overrides?: Partial<Category>) {
  const [category] = await db
    .insert(categories)
    .values({
      name: `Test Category ${Date.now()}`,
      description: 'Test category description',
      ...overrides,
    })
    .returning();

  return category;
}

export async function createTestTransaction(
  userId: number, 
  categoryId: number,
  overrides?: Partial<Transaction>
) {
  const [transaction] = await db
    .insert(transactions)
    .values({
      userId,
      categoryId,
      amount: "100.00",
      description: "Test transaction",
      ...overrides,
    })
    .returning();

  return transaction;
}

// Helper to setup an authenticated test session
export async function setupTestSession(app: Express) {
  const user = await createTestUser();
  const agent = supertest.agent(app);

  await agent
    .post('/api/login')
    .send({
      username: user.username,
      password: 'password123'
    });

  return { user, agent };
}