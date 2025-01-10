import passport from "passport";
import { IVerifyOptions, Strategy as LocalStrategy } from "passport-local";
import { type Express } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { users } from "@db/schema";
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
  const MemoryStore = createMemoryStore(session);
  const sessionSettings: session.SessionOptions = {
    secret: process.env.REPL_ID || "secure-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    },
    store: new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
      ttl: 24 * 60 * 60 * 1000 // Match cookie maxAge
    }),
    name: 'financeapp.sid' // Custom session cookie name
  };

  if (app.get("env") === "production") {
    app.set("trust proxy", 1);
    sessionSettings.cookie!.secure = true;
  }

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

      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (existingUser) {
        throw AppError.badRequest("Username already exists");
      }

      const hashedPassword = await hashPassword(password);
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

      req.logIn(safeUser, (err) => {
        if (err) {
          return next(err);
        }
        return res.json({
          message: "Registration successful",
          user: safeUser
        });
      });
    } catch (error) {
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

      try {
        // Create refresh token
        const refreshToken = await TokenService.createRefreshToken(user.id);

        req.logIn(user, (err) => {
          if (err) {
            return next(err);
          }

          // Set refresh token in HTTP-only cookie
          res.cookie('refreshToken', refreshToken.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
          });

          return res.json({
            message: "Login successful",
            user
          });
        });
      } catch (error) {
        next(error);
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

      // Set new refresh token in cookie
      res.cookie('refreshToken', newRefreshToken.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      // Get user data
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, newRefreshToken.userId))
        .limit(1);

      if (!user) {
        throw AppError.unauthorized("User not found");
      }

      const { password: _, ...safeUser } = user;

      // Log the user in
      req.logIn(safeUser, (err) => {
        if (err) {
          return next(err);
        }

        res.json({
          message: "Token refreshed successfully",
          user: safeUser
        });
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/logout", async (req, res) => {
    try {
      const refreshToken = req.cookies.refreshToken;

      if (refreshToken) {
        await TokenService.revokeRefreshToken(refreshToken);
      }

      // Clear refresh token cookie
      res.clearCookie('refreshToken');

      req.logout((err) => {
        if (err) {
          return res.status(500).json({ message: "Logout failed" });
        }
        res.json({ message: "Logged out successfully" });
      });
    } catch (error) {
      res.status(500).json({ message: "Logout failed" });
    }
  });

  app.get("/api/user", (req, res) => {
    if (req.isAuthenticated()) {
      return res.json(req.user);
    }
    res.status(401).json({ message: "Not authenticated" });
  });
}