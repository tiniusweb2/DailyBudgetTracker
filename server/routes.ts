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
import { plaidService } from "./services/PlaidService";
import { bankAccounts, incomeSources } from "@db/schema";
import { db } from "@db";

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
        amount: amount.toString(),
        targetDate: target,
        categoryId,
        dailyContribution: dailyContribution.toString(),
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
      if (amount !== undefined) updates.amount = amount.toString();
      if (targetDate !== undefined) {
        updates.targetDate = new Date(targetDate);
        const daysUntilTarget = Math.max(1, differenceInDays(updates.targetDate, new Date()));
        updates.dailyContribution = (amount / daysUntilTarget).toString();
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
        amount: amount.toString(),
        description,
        categoryId
      });

      // Update daily budget spent amount
      const dailyBudget = await dailyBudgetRepo.getCurrentDayBudget(req.user!.id);
      await dailyBudgetRepo.update(dailyBudget.id, {
        spent: (Number(dailyBudget.spent) + amount).toString()
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

      await userRepo.update(req.user!.id, {
        dailyBudgetAmount: amount.toString()
      });

      // Update current day's budget amount
      const dailyBudget = await dailyBudgetRepo.getCurrentDayBudget(req.user!.id);
      await dailyBudgetRepo.update(dailyBudget.id, {
        budgetAmount: amount.toString()
      });

      res.json({
        message: "Budget updated successfully",
        dailyBudgetAmount: amount
      });
    } catch (error) {
      next(error);
    }
  });

  // Get Plaid link token
  app.post("/api/plaid/link/token", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const linkTokenData = await plaidService.createLinkToken(req.user!.id);
      res.json(linkTokenData);
    } catch (error) {
      next(error);
    }
  });

  // Exchange Plaid public token and setup income sources
  app.post("/api/plaid/link/bank", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { publicToken, institutionName } = req.body;

      if (!publicToken || !institutionName) {
        throw AppError.badRequest("Missing required information");
      }

      const exchangeResponse = await plaidService.exchangePublicToken(publicToken);

      // Store the access token and item ID
      const [bankAccount] = await db
        .insert(bankAccounts)
        .values({
          userId: req.user!.id,
          plaidAccessToken: exchangeResponse.access_token,
          plaidItemId: exchangeResponse.item_id,
          institutionName,
        })
        .returning();

      // Fetch initial income data
      const incomeData = await plaidService.getIncome(exchangeResponse.access_token);

      // Create or update income sources based on Plaid data
      if (incomeData.income_streams) {
        for (const stream of incomeData.income_streams) {
          await db
            .insert(incomeSources)
            .values({
              userId: req.user!.id,
              name: `${institutionName} - ${stream.name || 'Income'}`,
              amount: stream.monthly_income.toString(),
              frequency: 'monthly',
              nextPaymentDate: new Date(stream.next_payment_date || Date.now()),
              isActive: true,
            })
            .onConflictDoNothing();
        }
      }

      res.json({
        message: "Bank account linked successfully",
        bankAccount: {
          id: bankAccount.id,
          institutionName: bankAccount.institutionName,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}