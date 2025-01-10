import passport from "passport";
import { IVerifyOptions, Strategy as LocalStrategy } from "passport-local";
import { type Express } from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import createMemoryStore from "memorystore";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { users, type InsertUser } from "@db/schema";
import { db } from "@db";
import { eq } from "drizzle-orm";
import { AppError } from "./domain/errors/AppError";
import { TokenService } from "./services/TokenService";

const scryptAsync = promisify(scrypt);

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
    secret: process.env.REPL_ID || "secure-session-secret",
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

        // Don't send password to client
        const { password: _, ...safeUser } = user;
        return done(null, safeUser);
      } catch (err) {
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

      // Don't send password to client
      const { password: _, ...safeUser } = user;
      done(null, safeUser);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        throw AppError.badRequest("Username and password are required");
      }

      // Check if user already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (existingUser) {
        throw AppError.badRequest("Username already exists");
      }

      const hashedPassword = await hashPassword(password);

      // Create the new user
      const [user] = await db
        .insert(users)
        .values({
          username,
          password: hashedPassword,
          dailyBudgetAmount: "50.00", // Default daily budget
        })
        .returning();

      // Don't send password to client
      const { password: _, ...safeUser } = user;

      // Create refresh token
      const refreshToken = await TokenService.createRefreshToken(user.id);

      // Set refresh token cookie
      res.cookie('refreshToken', refreshToken.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      // Log the user in
      req.login(safeUser, (err) => {
        if (err) {
          return next(err);
        }
        return res.json({
          message: "Registration successful",
          user: safeUser
        });
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
        return next(err);
      }

      if (!user) {
        return res.status(400).json({ message: info.message || "Login failed" });
      }

      // Create refresh token before logging in
      try {
        const refreshToken = await TokenService.createRefreshToken(user.id);

        // Set refresh token cookie
        res.cookie('refreshToken', refreshToken.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        // Log the user in after setting cookie
        req.login(user, (err) => {
          if (err) {
            return next(err);
          }
          return res.json({
            message: "Login successful",
            user
          });
        });
      } catch (error) {
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

      let refreshToken;
      try {
        refreshToken = await TokenService.replaceRefreshToken(oldToken);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw AppError.unauthorized("Invalid refresh token");
      }

      // Get user data
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, refreshToken.userId))
        .limit(1);

      if (!user) {
        throw AppError.unauthorized("User not found");
      }

      // Remove password from user object
      const { password: _, ...safeUser } = user;

      // Set refresh token cookie
      res.cookie('refreshToken', refreshToken.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      // Log the user in
      req.login(safeUser, (err) => {
        if (err) {
          return next(err);
        }

        res.json({
          message: "Token refreshed successfully",
          user: safeUser
        });
      });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      next(error);
    }
  });

  app.post("/api/logout", (req, res, next) => {
    try {
      const refreshToken = req.cookies.refreshToken;

      // Clear refresh token cookie
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });

      const promises = [];

      // Add session destruction if it exists
      if (req.session) {
        promises.push(
          new Promise<void>((resolve, reject) => {
            req.session.destroy((err) => {
              if (err) reject(err);
              else resolve();
            });
          })
        );
      }

      // Add token revocation if it exists
      if (refreshToken) {
        promises.push(
          TokenService.revokeRefreshToken(refreshToken)
            .catch(err => {
              console.error('Error revoking token:', err);
              // Don't fail the logout if token revocation fails
            })
        );
      }

      // Handle all cleanup operations
      Promise.all(promises)
        .then(() => {
          req.logout(() => {
            res.json({ message: "Logged out successfully" });
          });
        })
        .catch(next);
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