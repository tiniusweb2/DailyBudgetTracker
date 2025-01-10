import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupAuth } from "./auth";
import { setupVite, serveStatic, log } from "./vite";
import { db, verifyDatabaseConnection } from "@db";
import { sql } from "drizzle-orm";
import cors from "cors";

const app = express();

// Basic middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Enable CORS in development
if (app.get("env") === "development") {
  app.use(cors({
    origin: true,
    credentials: true
  }));
}

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Error handling middleware
const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server Error:', err);
  const status = (err as any).status || (err as any).statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
};

// Initialize server with error handling
(async () => {
  try {
    // Verify database connection before proceeding
    console.log("Verifying database connection...");
    await verifyDatabaseConnection();
    console.log("Database connection verified");

    // Setup authentication routes first
    console.log("Setting up authentication...");
    setupAuth(app);

    // Register application routes
    console.log("Registering routes...");
    const server = registerRoutes(app);

    // Add error handling middleware after all routes
    app.use(errorHandler);

    // Setup Vite in development, static serving in production
    if (app.get("env") === "development") {
      console.log("Setting up Vite development server...");
      await setupVite(app, server);
    } else {
      console.log("Setting up static file serving...");
      serveStatic(app);
    }

    // Start server on port 5000 as per development guidelines
    const PORT = 5000;
    server.listen(PORT, "0.0.0.0", () => {
      log(`Server started on port ${PORT}`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();