import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { transactions, dailyBudgets, categories } from "@db/schema";
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

  // Get user's categories
  app.get("/api/categories", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const userCategories = await db
        .select()
        .from(categories)
        .where(eq(categories.userId, req.user.id))
        .orderBy(categories.name);

      res.json(userCategories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  // Create new category
  app.post("/api/categories", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const { name, color } = req.body;
      const [category] = await db
        .insert(categories)
        .values({
          userId: req.user.id,
          name,
          color,
        })
        .returning();

      res.json(category);
    } catch (error) {
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  // Add new transaction
  app.post("/api/transactions", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const { amount, description, categoryId } = req.body;

      const [transaction] = await db
        .insert(transactions)
        .values({
          userId: req.user.id,
          amount,
          description,
          categoryId,
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