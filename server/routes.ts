import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { transactions, dailyBudgets } from "@db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { startOfDay, endOfDay, subDays } from "date-fns";

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
            eq(dailyBudgets.date, today)
          )
        )
        .limit(1);

      const recentTransactions = await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, req.user.id),
            gte(transactions.createdAt, startOfDay(subDays(today, 7))),
            lte(transactions.createdAt, endOfDay(today))
          )
        )
        .orderBy(transactions.createdAt);

      const pastWeekBudgets = await db
        .select()
        .from(dailyBudgets)
        .where(
          and(
            eq(dailyBudgets.userId, req.user.id),
            gte(dailyBudgets.date, subDays(today, 7)),
            lte(dailyBudgets.date, today)
          )
        )
        .orderBy(dailyBudgets.date);

      res.json({
        transactions: recentTransactions,
        dailyBudget: todayBudget || {
          available: req.user.dailyBudgetAmount,
          spent: 0,
          saved: 0,
        },
        dailyBudgets: pastWeekBudgets,
      });
    } catch (error) {
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
          amount,
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
            eq(dailyBudgets.date, today)
          )
        )
        .limit(1);

      if (existingBudget) {
        await db
          .update(dailyBudgets)
          .set({
            spent: Number(existingBudget.spent) + Number(amount),
            available: Number(existingBudget.available) - Number(amount),
          })
          .where(eq(dailyBudgets.id, existingBudget.id));
      } else {
        await db
          .insert(dailyBudgets)
          .values({
            userId: req.user.id,
            date: today,
            available: Number(req.user.dailyBudgetAmount) - Number(amount),
            spent: Number(amount),
            saved: 0,
          });
      }

      res.json(transaction);
    } catch (error) {
      res.status(500).json({ error: "Failed to add transaction" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}