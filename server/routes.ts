import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { startOfDay, endOfDay, subDays } from "date-fns";

declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      dailyBudgetAmount: number;
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
      const sevenDaysAgo = subDays(today, 7);

      // Get all transactions for the user
      const transactions = await db.findTransactionsByUserId(req.user.id);
      const recentTransactions = transactions.filter(t => 
        t.createdAt >= startOfDay(sevenDaysAgo) && 
        t.createdAt <= endOfDay(today)
      );

      // Get or create today's budget
      const todayBudget = await db.findDailyBudgetByUserIdAndDate(req.user.id, today);

      // Get past week's budgets
      const pastWeekBudgets = await db.findDailyBudgetsByUserId(req.user.id);
      const recentBudgets = pastWeekBudgets.filter(b => 
        b.date >= startOfDay(sevenDaysAgo) && 
        b.date <= endOfDay(today)
      );

      res.json({
        transactions: recentTransactions,
        dailyBudget: todayBudget ?? {
          available: req.user.dailyBudgetAmount,
          spent: 0,
          saved: 0
        },
        dailyBudgets: recentBudgets
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

      // Create the transaction
      const transaction = await db.createTransaction({
        userId: req.user.id,
        amount: Number(amount),
        description,
      });

      // Update or create today's budget
      const today = new Date();
      const existingBudget = await db.findDailyBudgetByUserIdAndDate(req.user.id, today);

      if (existingBudget) {
        await db.updateDailyBudget(existingBudget.id, {
          spent: existingBudget.spent + Number(amount),
          available: existingBudget.available - Number(amount),
        });
      } else {
        await db.createDailyBudget({
          userId: req.user.id,
          date: today,
          available: req.user.dailyBudgetAmount - Number(amount),
          spent: Number(amount),
          saved: 0,
        });
      }

      res.json(transaction);
    } catch (error) {
      console.error('Failed to add transaction:', error);
      res.status(500).json({ error: "Failed to add transaction" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}