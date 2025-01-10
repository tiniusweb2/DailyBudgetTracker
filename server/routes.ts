import type { Express } from "express";
import { createServer, type Server } from "http";
import { DrizzleTransactionRepository } from "./data/repositories/TransactionRepository";
import { DrizzleUserRepository } from "./data/repositories/UserRepository";
import { DrizzleDailyBudgetRepository } from "./data/repositories/DailyBudgetRepository";
import { DrizzlePlannedExpenseRepository } from "./data/repositories/PlannedExpenseRepository";
import { startOfDay, endOfDay, subDays, differenceInDays } from "date-fns";
import { AppError } from "./domain/errors/AppError";
import { categoryPredictor } from "./services/CategoryPrediction";
import { plaidService } from "./services/PlaidService";
import { bankAccounts, incomeSources } from "@db/schema";
import { db } from "@db";
import { convertDecimalToNumber } from "@db/schema";
import { requireAuth } from "./auth";
import type { DailyBudgetStatus } from "./domain/entities/DailyBudget";

export function registerRoutes(app: Express): Server {
  // Initialize repositories
  const transactionRepo = new DrizzleTransactionRepository();
  const userRepo = new DrizzleUserRepository();
  const dailyBudgetRepo = new DrizzleDailyBudgetRepository();
  const plannedExpenseRepo = new DrizzlePlannedExpenseRepository();

  // Basic health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Protected routes - require authentication
  app.use("/api/transactions", requireAuth);
  app.use("/api/budget", requireAuth);
  app.use("/api/planned-expenses", requireAuth);
  app.use("/api/plaid", requireAuth);

  // Get user's current budget status
  app.get("/api/budget/status", async (req, res, next) => {
    try {
      const dailyBudget = await dailyBudgetRepo.getCurrentDayBudget(req.user!.id);
      const unspentFromPrevious = await dailyBudgetRepo.getUnspentAmount(req.user!.id);
      const plannedExpensesAmount = await plannedExpenseRepo.calculateDailyContributions(req.user!.id);

      // Calculate total available including rollover from previous days
      const budget = convertDecimalToNumber(dailyBudget);
      const totalAvailable = budget.budgetAmount + unspentFromPrevious - budget.spent - plannedExpensesAmount;

      const status: DailyBudgetStatus = {
        dailyBudget: budget.budgetAmount,
        available: totalAvailable,
        spent: budget.spent,
        saved: budget.saved,
        rollover: unspentFromPrevious,
        plannedExpenses: plannedExpensesAmount
      };

      res.json(status);
    } catch (error) {
      next(error);
    }
  });

  // Get user's transactions and budget data
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

      // Convert decimal strings to numbers for response
      const convertedBudget = convertDecimalToNumber(dailyBudget);
      const available = Number(convertedBudget.budgetAmount) - Number(convertedBudget.spent) - plannedExpensesContribution;

      res.json({
        transactions: recentTransactions.map(convertDecimalToNumber),
        dailyBudget: {
          available,
          spent: Number(convertedBudget.spent),
          saved: Number(convertedBudget.saved),
          plannedExpensesContribution
        }
      });
    } catch (error) {
      next(error);
    }
  });


  // Get all planned expenses
  app.get("/api/planned-expenses", async (req, res, next) => {
    try {
      const expenses = await plannedExpenseRepo.findByUserId(req.user!.id);
      res.json(expenses.map(convertDecimalToNumber));
    } catch (error) {
      next(error);
    }
  });

  // Add new planned expense
  app.post("/api/planned-expenses", async (req, res, next) => {
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
        amount: amount.toFixed(2),
        targetDate: target,
        categoryId,
        dailyContribution: dailyContribution.toFixed(2),
        isCompleted: false
      });

      res.json(convertDecimalToNumber(expense));
    } catch (error) {
      next(error);
    }
  });

  // Update planned expense
  app.patch("/api/planned-expenses/:id", async (req, res, next) => {
    try {
      const { name, amount, targetDate, isCompleted } = req.body;
      const updates: any = {};

      if (name !== undefined) updates.name = name;
      if (amount !== undefined) {
        updates.amount = amount.toFixed(2);
        if (targetDate !== undefined) {
          updates.targetDate = new Date(targetDate);
          const daysUntilTarget = Math.max(1, differenceInDays(updates.targetDate, new Date()));
          updates.dailyContribution = (amount / daysUntilTarget).toFixed(2);
        }
      }
      if (isCompleted !== undefined) updates.isCompleted = isCompleted;

      const expense = await plannedExpenseRepo.update(parseInt(req.params.id), updates);
      res.json(convertDecimalToNumber(expense));
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
        dailyBudgetAmount: amount
      });

      // Update current day's budget
      const dailyBudget = await dailyBudgetRepo.getCurrentDayBudget(req.user!.id);
      await dailyBudgetRepo.update(dailyBudget.id, {
        budgetAmount: amount
      });

      // Get updated budget status
      const unspentFromPrevious = await dailyBudgetRepo.getUnspentAmount(req.user!.id);
      const plannedExpensesAmount = await plannedExpenseRepo.calculateDailyContributions(req.user!.id);

      const totalAvailable = amount + unspentFromPrevious - dailyBudget.spent - plannedExpensesAmount;

      const status: DailyBudgetStatus = {
        dailyBudget: amount,
        available: totalAvailable,
        spent: dailyBudget.spent,
        saved: dailyBudget.saved,
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

  // Get Plaid link token
  app.post("/api/plaid/link/token", async (req, res, next) => {
    try {
      const linkTokenData = await plaidService.createLinkToken(req.user!.id);
      res.json(linkTokenData);
    } catch (error) {
      next(error);
    }
  });

  // Add new transaction with automatic categorization
  app.post("/api/transactions", async (req, res, next) => {
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
        ...convertDecimalToNumber(transaction),
        categoryConfidence: confidence
      });
    } catch (error) {
      next(error);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}