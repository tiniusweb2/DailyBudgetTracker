import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { DrizzleTransactionRepository } from "./data/repositories/TransactionRepository";
import { DrizzleUserRepository } from "./data/repositories/UserRepository";
import { DrizzleDailyBudgetRepository } from "./data/repositories/DailyBudgetRepository";
import { startOfDay, endOfDay, subDays } from "date-fns";
import { AppError } from "./domain/errors/AppError";

export function registerRoutes(app: Express): Server {
  // Initialize repositories
  const transactionRepo = new DrizzleTransactionRepository();
  const userRepo = new DrizzleUserRepository();
  const dailyBudgetRepo = new DrizzleDailyBudgetRepository();

  // Setup authentication routes
  setupAuth(app);

  // Middleware to ensure user is authenticated
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    next();
  };

  // Get user's transactions and budget data
  app.get("/api/transactions", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const today = new Date();
      const sevenDaysAgo = subDays(today, 7);

      // Get all transactions for the user
      const transactions = await transactionRepo.findByUserId(req.user!.id);
      const recentTransactions = transactions.filter(t => 
        t.createdAt >= startOfDay(sevenDaysAgo) && 
        t.createdAt <= endOfDay(today)
      );

      // Get user's current daily budget
      const dailyBudget = await dailyBudgetRepo.getCurrentDayBudget(req.user!.id);

      // Get budget history for the last 7 days
      const dailyBudgets = await dailyBudgetRepo.findByUserId(req.user!.id);
      const recentBudgets = dailyBudgets.filter(b => 
        b.date >= startOfDay(sevenDaysAgo) && 
        b.date <= endOfDay(today)
      );

      res.json({
        transactions: recentTransactions,
        dailyBudget: {
          available: dailyBudget.budgetAmount - dailyBudget.spent,
          spent: dailyBudget.spent,
          saved: dailyBudget.saved
        },
        dailyBudgets: recentBudgets
      });
    } catch (error) {
      next(error);
    }
  });

  // Add new transaction
  app.post("/api/transactions", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { amount, description } = req.body;

      if (typeof amount !== 'number' || !description) {
        throw AppError.badRequest("Invalid transaction data");
      }

      // Create the transaction
      const transaction = await transactionRepo.create({
        userId: req.user!.id,
        amount,
        description
      });

      // Update daily budget spent amount
      const dailyBudget = await dailyBudgetRepo.getCurrentDayBudget(req.user!.id);
      await dailyBudgetRepo.update(dailyBudget.id, {
        spent: dailyBudget.spent + amount
      });

      res.json(transaction);
    } catch (error) {
      next(error);
    }
  });

  // Update daily budget amount
  app.patch("/api/budget", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { amount } = req.body;

      if (typeof amount !== 'number' || amount <= 0) {
        throw AppError.badRequest("Invalid budget amount");
      }

      const user = await userRepo.update(req.user!.id, {
        dailyBudgetAmount: amount
      });

      // Update current day's budget amount
      const dailyBudget = await dailyBudgetRepo.getCurrentDayBudget(req.user!.id);
      await dailyBudgetRepo.update(dailyBudget.id, {
        budgetAmount: amount
      });

      res.json({
        message: "Budget updated successfully",
        dailyBudgetAmount: amount
      });
    } catch (error) {
      next(error);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}