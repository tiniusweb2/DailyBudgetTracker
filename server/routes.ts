import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { transactions, dailyBudgets, type User } from "@db/schema";
import { eq, and, sql } from "drizzle-orm";
import { startOfDay, endOfDay, subDays } from "date-fns";

declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      dailyBudgetAmount: string;
    }
  }
}

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Get user's transactions and budget data
  app.get("/api/transactions", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const today = new Date();
      const [todayBudget] = await db
        .select()
        .from(dailyBudgets)
        .where(
          and(
            eq(dailyBudgets.userId, req.user.id),
            sql`DATE(${dailyBudgets.date}) = DATE(${sql.raw(today.toISOString())})`
          )
        )
        .limit(1);

      const recentTransactions = await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, req.user.id),
            sql`${transactions.createdAt} >= ${sql.raw(startOfDay(subDays(today, 7)).toISOString())}`,
            sql`${transactions.createdAt} <= ${sql.raw(endOfDay(today).toISOString())}`
          )
        )
        .orderBy(transactions.createdAt);

      const pastWeekBudgets = await db
        .select()
        .from(dailyBudgets)
        .where(
          and(
            eq(dailyBudgets.userId, req.user.id),
            sql`DATE(${dailyBudgets.date}) >= DATE(${sql.raw(subDays(today, 7).toISOString())})`,
            sql`DATE(${dailyBudgets.date}) <= DATE(${sql.raw(today.toISOString())})`
          )
        )
        .orderBy(dailyBudgets.date);

      // Convert decimal strings to numbers for the response
      res.json({
        transactions: recentTransactions.map(t => ({
          ...t,
          amount: Number(t.amount)
        })),
        dailyBudget: todayBudget 
          ? {
              available: Number(todayBudget.available),
              spent: Number(todayBudget.spent),
              saved: Number(todayBudget.saved)
            }
          : {
              available: Number(req.user.dailyBudgetAmount),
              spent: 0,
              saved: 0
            },
        dailyBudgets: pastWeekBudgets.map(b => ({
          ...b,
          available: Number(b.available),
          spent: Number(b.spent),
          saved: Number(b.saved)
        }))
      });
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  // Add new transaction
  app.post("/api/transactions", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const { amount, description } = req.body;

      const [transaction] = await db
        .insert(transactions)
        .values({
          userId: req.user.id,
          amount: amount.toString(),
          description,
        })
        .returning();

      // Update or create today's budget
      const today = new Date();
      const [existingBudget] = await db
        .select()
        .from(dailyBudgets)
        .where(
          and(
            eq(dailyBudgets.userId, req.user.id),
            sql`DATE(${dailyBudgets.date}) = DATE(${sql.raw(today.toISOString())})`
          )
        )
        .limit(1);

      if (existingBudget) {
        await db
          .update(dailyBudgets)
          .set({
            spent: (Number(existingBudget.spent) + Number(amount)).toString(),
            available: (Number(existingBudget.available) - Number(amount)).toString(),
          })
          .where(eq(dailyBudgets.id, existingBudget.id));
      } else {
        await db
          .insert(dailyBudgets)
          .values({
            userId: req.user.id,
            date: today,
            available: (Number(req.user.dailyBudgetAmount) - Number(amount)).toString(),
            spent: amount.toString(),
            saved: '0',
          });
      }

      // Convert decimal strings to numbers for the response
      res.json({
        ...transaction,
        amount: Number(transaction.amount)
      });
    } catch (error) {
      console.error('Failed to add transaction:', error);
      res.status(500).json({ error: "Failed to add transaction" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}