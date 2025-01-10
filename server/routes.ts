import type { Express } from "express";
import { createServer, type Server } from "http";
import { DrizzleTransactionRepository } from "./data/repositories/TransactionRepository";
import { DrizzleUserRepository } from "./data/repositories/UserRepository";
import { DrizzleDailyBudgetRepository } from "./data/repositories/DailyBudgetRepository";
import { DrizzlePlannedExpenseRepository } from "./data/repositories/PlannedExpenseRepository";
import { startOfDay, endOfDay, subDays } from "date-fns";
import { AppError } from "./domain/errors/AppError";
import { requireAuth } from "./auth";
import type { DailyBudgetStatus } from "./domain/entities/DailyBudget";
import { plaidService } from "./services/PlaidService";
import { db } from "@db";
import { bankAccounts } from "@db/schema";

export function registerRoutes(app: Express): Server {
  // Initialize repositories
  const userRepo = new DrizzleUserRepository();
  const dailyBudgetRepo = new DrizzleDailyBudgetRepository();
  const plannedExpenseRepo = new DrizzlePlannedExpenseRepository();
  const transactionRepo = new DrizzleTransactionRepository();

  // Basic health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Protected routes - require authentication
  app.use("/api/budget", requireAuth);
  app.use("/api/transactions", requireAuth);
  app.use("/api/planned-expenses", requireAuth);
  app.use("/api/plaid", requireAuth);

  // Plaid routes
  app.post("/api/plaid/link/token", async (req, res, next) => {
    try {
      const linkTokenResponse = await plaidService.createLinkToken(req.user!.id);
      res.json(linkTokenResponse);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/plaid/link/bank", async (req, res, next) => {
    try {
      const { publicToken, institutionName } = req.body;
      const exchangeResponse = await plaidService.exchangePublicToken(publicToken);

      // Save the access token and item ID
      await db.insert(bankAccounts).values({
        userId: req.user!.id,
        plaidAccessToken: exchangeResponse.access_token,
        plaidItemId: exchangeResponse.item_id,
        institutionName,
        isActive: true,
      });

      // Get initial transaction history
      const now = new Date();
      const thirtyDaysAgo = subDays(now, 30);
      await plaidService.getTransactions(
        exchangeResponse.access_token,
        thirtyDaysAgo.toISOString().split('T')[0],
        now.toISOString().split('T')[0]
      );

      res.json({ message: "Bank account linked successfully" });
    } catch (error) {
      next(error);
    }
  });

  // Get current budget status
  app.get("/api/budget/status", async (req, res, next) => {
    try {
      const dailyBudget = await dailyBudgetRepo.getCurrentDayBudget(req.user!.id);
      const unspentFromPrevious = await dailyBudgetRepo.getUnspentAmount(req.user!.id);
      const plannedExpensesAmount = await plannedExpenseRepo.calculateDailyContributions(req.user!.id);

      // Calculate total available including rollover from previous days
      const totalAvailable = Number(dailyBudget.budgetAmount) + unspentFromPrevious - Number(dailyBudget.spent) - plannedExpensesAmount;

      const status: DailyBudgetStatus = {
        dailyBudget: Number(dailyBudget.budgetAmount),
        available: totalAvailable,
        spent: Number(dailyBudget.spent),
        saved: Number(dailyBudget.saved),
        rollover: unspentFromPrevious,
        plannedExpenses: plannedExpensesAmount
      };

      res.json(status);
    } catch (error) {
      next(error);
    }
  });

  // Get budget history
  app.get("/api/budget/history", async (req, res, next) => {
    try {
      const budgets = await dailyBudgetRepo.findByUserId(req.user!.id);
      res.json(budgets.map(budget => ({
        ...budget,
        budgetAmount: Number(budget.budgetAmount),
        spent: Number(budget.spent),
        saved: Number(budget.saved)
      })));
    } catch (error) {
      next(error);
    }
  });

  // Update daily budget amount
  app.patch("/api/budget", async (req, res, next) => {
    try {
      const { amount } = req.body;

      if (typeof amount !== 'number' || amount <= 0) {
        throw AppError.badRequest("Invalid budget amount");
      }

      // Update user's base daily budget amount
      await userRepo.update(req.user!.id, {
        dailyBudgetAmount: amount.toFixed(2)
      });

      // Update current day's budget
      const dailyBudget = await dailyBudgetRepo.getCurrentDayBudget(req.user!.id);
      await dailyBudgetRepo.update(dailyBudget.id, {
        budgetAmount: amount.toFixed(2)
      });

      // Get updated budget status
      const unspentFromPrevious = await dailyBudgetRepo.getUnspentAmount(req.user!.id);
      const plannedExpensesAmount = await plannedExpenseRepo.calculateDailyContributions(req.user!.id);

      const totalAvailable = amount + unspentFromPrevious - Number(dailyBudget.spent) - plannedExpensesAmount;

      const status: DailyBudgetStatus = {
        dailyBudget: amount,
        available: totalAvailable,
        spent: Number(dailyBudget.spent),
        saved: Number(dailyBudget.saved),
        rollover: unspentFromPrevious,
        plannedExpenses: plannedExpensesAmount
      };

      res.json({
        message: "Budget updated successfully",
        ...status
      });
    } catch (error) {
      next(error);
    }
  });

  // Get user's transactions
  app.get("/api/transactions", async (req, res, next) => {
    try {
      const today = new Date();
      const sevenDaysAgo = subDays(today, 7);

      const transactions = await transactionRepo.findByUserId(req.user!.id);
      const recentTransactions = transactions.filter(t =>
        t.createdAt >= startOfDay(sevenDaysAgo) &&
        t.createdAt <= endOfDay(today)
      );

      const dailyBudget = await dailyBudgetRepo.getCurrentDayBudget(req.user!.id);
      const plannedExpensesContribution = await plannedExpenseRepo.calculateDailyContributions(req.user!.id);

      const available = Number(dailyBudget.budgetAmount) - Number(dailyBudget.spent) - plannedExpensesContribution;

      res.json({
        transactions: recentTransactions.map(t => ({
          ...t,
          amount: Number(t.amount)
        })),
        dailyBudget: {
          available,
          spent: Number(dailyBudget.spent),
          saved: Number(dailyBudget.saved),
          plannedExpensesContribution
        }
      });
    } catch (error) {
      next(error);
    }
  });

  // Create new transaction
  app.post("/api/transactions", async (req, res, next) => {
    try {
      const { amount, description, categoryId } = req.body;

      if (typeof amount !== 'number' || !description || !categoryId) {
        throw AppError.badRequest("Invalid transaction data");
      }

      const transaction = await transactionRepo.create({
        userId: req.user!.id,
        amount: amount.toFixed(2),
        description,
        categoryId
      });

      // Update daily budget spent amount
      const dailyBudget = await dailyBudgetRepo.getCurrentDayBudget(req.user!.id);
      const newSpentAmount = (Number(dailyBudget.spent) + amount).toFixed(2);

      await dailyBudgetRepo.update(dailyBudget.id, {
        spent: newSpentAmount
      });

      res.json({
        ...transaction,
        amount: Number(transaction.amount)
      });
    } catch (error) {
      next(error);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}