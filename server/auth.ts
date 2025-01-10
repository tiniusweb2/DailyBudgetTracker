import passport from "passport";
import { IVerifyOptions, Strategy as LocalStrategy } from "passport-local";
import { type Express } from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import createMemoryStore from "memorystore";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { users, type User } from "@db/schema";
import { db } from "@db";
import { eq } from "drizzle-orm";
import { AppError } from "./domain/errors/AppError";
import { TokenService } from "./services/TokenService";

const scryptAsync = promisify(scrypt);

// Define Express.User type to match safe user data
declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      dailyBudgetAmount: string;
      createdAt: Date;
    }
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(
  suppliedPassword: string,
  storedPassword: string
): Promise<boolean> {
  try {
    const [hashedPassword, salt] = storedPassword.split(".");
    const hashedPasswordBuf = Buffer.from(hashedPassword, "hex");
    const suppliedPasswordBuf = (await scryptAsync(
      suppliedPassword,
      salt,
      64
    )) as Buffer;
    return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
  } catch (error) {
    console.error('Error comparing passwords:', error);
    return false;
  }
}

export function setupAuth(app: Express) {
  // Add cookie parser before session middleware
  app.use(cookieParser());

  const MemoryStore = createMemoryStore(session);
  const sessionSettings: session.SessionOptions = {
    secret: process.env.REPL_ID || "finance-app-secret",
    resave: false,
    saveUninitialized: false,
    store: new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    }),
    name: 'financeapp.sid',
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    }
  };

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .limit(1);

        if (!user) {
          return done(null, false, { message: "Incorrect username." });
        }

        const isValid = await comparePasswords(password, user.password);
        if (!isValid) {
          return done(null, false, { message: "Incorrect password." });
        }

        // Construct the safe user object without password
        const safeUser = {
          id: user.id,
          username: user.username,
          dailyBudgetAmount: user.dailyBudgetAmount,
          createdAt: user.createdAt
        };
        return done(null, safeUser);
      } catch (err) {
        console.error('Authentication error:', err);
        return done(err);
      }
    })
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (!user) {
        return done(null, false);
      }

      // Construct safe user object without password
      const safeUser = {
        id: user.id,
        username: user.username,
        dailyBudgetAmount: user.dailyBudgetAmount,
        createdAt: user.createdAt
      };
      done(null, safeUser);
    } catch (err) {
      console.error('Deserialization error:', err);
      done(err);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        throw AppError.badRequest("Username and password are required");
      }

      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (existingUser) {
        throw AppError.badRequest("Username already exists");
      }

      const hashedPassword = await hashPassword(password);

      // Create new user
      const [user] = await db
        .insert(users)
        .values({
          username,
          password: hashedPassword,
          dailyBudgetAmount: "50.00", // Default daily budget
        })
        .returning();

      // Construct safe user object
      const safeUser = {
        id: user.id,
        username: user.username,
        dailyBudgetAmount: user.dailyBudgetAmount,
        createdAt: user.createdAt
      };

      // Log in the user
      await new Promise<void>((resolve, reject) => {
        req.logIn(safeUser, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Create refresh token
      const refreshToken = await TokenService.createRefreshToken(user.id);

      // Set refresh token cookie
      res.cookie('refreshToken', refreshToken.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      // Send response
      res.json({
        message: "Registration successful",
        user: safeUser
      });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", async (err: any, user: Express.User | false, info: IVerifyOptions) => {
      if (err) {
        console.error('Login error:', err);
        return next(err);
      }

      if (!user) {
        return res.status(400).json({ message: info.message || "Login failed" });
      }

      try {
        // Log in the user
        await new Promise<void>((resolve, reject) => {
          req.logIn(user, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        // Create refresh token
        const refreshToken = await TokenService.createRefreshToken(user.id);

        // Set refresh token cookie
        res.cookie('refreshToken', refreshToken.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        // Send success response
        return res.json({
          message: "Login successful",
          user
        });
      } catch (error) {
        console.error('Login process error:', error);
        if (error instanceof AppError) {
          return res.status(error.statusCode).json({ message: error.message });
        }
        return next(error);
      }
    })(req, res, next);
  });

  app.post("/api/refresh-token", async (req, res, next) => {
    try {
      const oldToken = req.cookies.refreshToken;

      if (!oldToken) {
        throw AppError.unauthorized("No refresh token provided");
      }

      const newRefreshToken = await TokenService.replaceRefreshToken(oldToken);

      // Get user data
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, newRefreshToken.userId))
        .limit(1);

      if (!user) {
        throw AppError.unauthorized("User not found");
      }

      // Construct safe user object
      const safeUser = {
        id: user.id,
        username: user.username,
        dailyBudgetAmount: user.dailyBudgetAmount,
        createdAt: user.createdAt
      };

      // Set new refresh token cookie
      res.cookie('refreshToken', newRefreshToken.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      // Log in the user
      await new Promise<void>((resolve, reject) => {
        req.logIn(safeUser, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      res.json({
        message: "Token refreshed successfully",
        user: safeUser
      });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      next(error);
    }
  });

  app.post("/api/logout", async (req, res, next) => {
    try {
      const refreshToken = req.cookies.refreshToken;

      // Clear refresh token cookie
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });

      // Create an array of cleanup tasks
      const tasks: Promise<void>[] = [];

      // Add token revocation if a token exists
      if (refreshToken) {
        tasks.push(
          TokenService.revokeRefreshToken(refreshToken)
            .catch(err => {
              console.error('Error revoking token:', err);
              // Don't fail the logout if token revocation fails
            })
        );
      }

      // Add session destruction if it exists
      if (req.session) {
        tasks.push(
          new Promise<void>((resolve, reject) => {
            req.session.destroy((err) => {
              if (err) reject(err);
              else resolve();
            });
          })
        );
      }

      // Wait for all cleanup tasks
      await Promise.all(tasks);

      // Finally logout from passport
      req.logout(() => {
        res.json({ message: "Logged out successfully" });
      });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      next(error);
    }
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(req.user);
  });
}