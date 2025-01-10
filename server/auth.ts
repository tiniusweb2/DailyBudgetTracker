import { type Express, Request, Response, NextFunction } from "express";
import { db } from "@db";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.REPL_ID || "finance-app-secret";

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
      };
    }
  }
}

// Helper functions for password hashing
async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

async function comparePasswords(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// JWT token generation
function generateToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
}

// Authentication middleware
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    req.user = { id: decoded.userId };
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

// Setup authentication routes
export function setupAuth(app: Express) {
  // Registration endpoint
  app.post("/api/register", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      // Check if user exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Create new user
      const hashedPassword = await hashPassword(password);
      const [user] = await db
        .insert(users)
        .values({
          username,
          password: hashedPassword,
          dailyBudgetAmount: "50.00", // Default daily budget
        })
        .returning();

      // Generate token
      const token = generateToken(user.id);

      res.json({
        message: "Registration successful",
        user: {
          id: user.id,
          username: user.username,
          dailyBudgetAmount: user.dailyBudgetAmount,
        },
        token
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // Login endpoint
  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      // Find user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (!user) {
        return res.status(400).json({ message: "Invalid credentials" });
      }

      // Verify password
      const isValid = await comparePasswords(password, user.password);
      if (!isValid) {
        return res.status(400).json({ message: "Invalid credentials" });
      }

      // Generate token
      const token = generateToken(user.id);

      res.json({
        message: "Login successful",
        user: {
          id: user.id,
          username: user.username,
          dailyBudgetAmount: user.dailyBudgetAmount,
        },
        token
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Get current user endpoint
  app.get("/api/user", requireAuth, async (req, res) => {
    try {
      // We can safely assert req.user exists because of requireAuth middleware
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, req.user!.id))
        .limit(1);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        id: user.id,
        username: user.username,
        dailyBudgetAmount: user.dailyBudgetAmount,
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ message: "Failed to get user data" });
    }
  });
}