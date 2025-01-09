import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { DrizzleTransactionRepository } from "./data/repositories/TransactionRepository";
import { DrizzleUserRepository } from "./data/repositories/UserRepository";
import { DrizzleDailyBudgetRepository } from "./data/repositories/DailyBudgetRepository";
import { DrizzlePlannedExpenseRepository } from "./data/repositories/PlannedExpenseRepository";
import { startOfDay, endOfDay, subDays, differenceInDays } from "date-fns";
import { AppError } from "./domain/errors/AppError";
import { categoryPredictor } from "./services/CategoryPrediction";

export function registerRoutes(app: Express): Server {
  // Initialize repositories
  const transactionRepo = new DrizzleTransactionRepository();
  const userRepo = new DrizzleUserRepository();
  const dailyBudgetRepo = new DrizzleDailyBudgetRepository();
  const plannedExpenseRepo = new DrizzlePlannedExpenseRepository();

  // Setup authentication routes
  setupAuth(app);

  // Middleware to ensure user is authenticated
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
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

      // Get planned expenses daily contribution
      const plannedExpensesContribution = await plannedExpenseRepo.calculateDailyContributions(req.user!.id);

      res.json({
        transactions: recentTransactions,
        dailyBudget: {
          available: dailyBudget.budgetAmount - dailyBudget.spent - plannedExpensesContribution,
          spent: dailyBudget.spent,
          saved: dailyBudget.saved,
          plannedExpensesContribution
        },
        dailyBudgets: recentBudgets.map(b => ({
          ...b,
          available: b.budgetAmount - b.spent
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  // Get all planned expenses
  app.get("/api/planned-expenses", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expenses = await plannedExpenseRepo.findByUserId(req.user!.id);
      res.json(expenses);
    } catch (error) {
      next(error);
    }
  });

  // Add new planned expense
  app.post("/api/planned-expenses", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, amount, targetDate, categoryId } = req.body;

      if (!name || typeof amount !== 'number' || !targetDate || !categoryId) {
        throw AppError.badRequest("Invalid planned expense data");
      }

      const target = new Date(targetDate);
      const daysUntilTarget = Math.max(1, differenceInDays(target, new Date()));
      const dailyContribution = amount / daysUntilTarget;

      const expense = await plannedExpenseRepo.create({
        userId: req.user!.id,
        name,
        amount,
        targetDate: target,
        categoryId,
        dailyContribution,
        isCompleted: false
      });

      res.json(expense);
    } catch (error) {
      next(error);
    }
  });

  // Update planned expense
  app.patch("/api/planned-expenses/:id", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, amount, targetDate, isCompleted } = req.body;
      const updates: any = {};

      if (name !== undefined) updates.name = name;
      if (amount !== undefined) updates.amount = amount;
      if (targetDate !== undefined) {
        updates.targetDate = new Date(targetDate);
        const daysUntilTarget = Math.max(1, differenceInDays(updates.targetDate, new Date()));
        updates.dailyContribution = amount / daysUntilTarget;
      }
      if (isCompleted !== undefined) updates.isCompleted = isCompleted;

      const expense = await plannedExpenseRepo.update(parseInt(req.params.id), updates);
      res.json(expense);
    } catch (error) {
      next(error);
    }
  });

  // Add new transaction with automatic categorization
  app.post("/api/transactions", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { amount, description } = req.body;

      if (typeof amount !== 'number' || !description) {
        throw AppError.badRequest("Invalid transaction data");
      }

      // Use ML to predict the category
      const { categoryId, confidence } = await categoryPredictor.predictCategory(description);

      // Create the transaction with predicted category
      const transaction = await transactionRepo.create({
        userId: req.user!.id,
        amount,
        description,
        categoryId
      });

      // Update daily budget spent amount
      const dailyBudget = await dailyBudgetRepo.getCurrentDayBudget(req.user!.id);
      await dailyBudgetRepo.update(dailyBudget.id, {
        spent: dailyBudget.spent + amount
      });

      res.json({
        ...transaction,
        categoryConfidence: confidence
      });
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