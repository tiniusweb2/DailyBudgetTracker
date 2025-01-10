import type { User } from "@db/schema";

declare global {
  namespace Express {
    // Extend Express.User with our schema User type, excluding password
    interface User extends Omit<User, 'password'> {
      id: number;
      username: string;
      dailyBudgetAmount: string;
      createdAt: Date;
    }
  }
}

export {};