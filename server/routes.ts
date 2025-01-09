import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { DrizzleTransactionRepository } from "./data/repositories/TransactionRepository";
import { DrizzleUserRepository } from "./data/repositories/UserRepository";
import { startOfDay, endOfDay, subDays } from "date-fns";
import { AppError } from "./domain/errors/AppError";

export function registerRoutes(app: Express): Server {
  // Initialize repositories
  const transactionRepo = new DrizzleTransactionRepository();
  const userRepo = new DrizzleUserRepository();

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
      const user = await userRepo.findById(req.user!.id);
      if (!user) {
        throw AppError.notFound("User not found");
      }

      const todaySpent = recentTransactions
        .filter(t => t.createdAt >= startOfDay(today))
        .reduce((sum, t) => sum + t.amount, 0);

      res.json({
        transactions: recentTransactions,
        dailyBudget: {
          available: user.dailyBudgetAmount - todaySpent,
          spent: todaySpent,
          saved: 0 // To be implemented with savings goals feature
        }
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

      const transaction = await transactionRepo.create({
        userId: req.user!.id,
        amount,
        description
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

      res.json({
        message: "Budget updated successfully",
        dailyBudgetAmount: user.dailyBudgetAmount
      });
    } catch (error) {
      next(error);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}