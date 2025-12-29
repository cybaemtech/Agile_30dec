import dotenv from 'dotenv';
dotenv.config(); // ✅ Loads environment variables from .env

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { registerPhpApiRoutes } from "./php-api-routes";
// import { phpProxyRouter } from "./php-proxy-routes.js"; // Disabled - using local API only
import { setupVite, serveStatic, log } from "./vite";
import { storage, initStorage } from "./storage";
import bcrypt from 'bcryptjs';

const app = express();

import cors from 'cors';
app.use(cors({
  origin: true, // Allow all origins for Replit proxy environment
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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

// All data is now managed through the database - no sample data generation

import session from 'express-session';
import ConnectPgSimple from 'connect-pg-simple';
import { Pool } from 'pg';
import MemoryStore from 'memorystore';

// Create session store - use PostgreSQL if DATABASE_URL is available, otherwise use memory store
let sessionStore;
if (process.env.DATABASE_URL) {
  log('✅ Using PostgreSQL session store');
  const pgSession = ConnectPgSimple(session);
  const sessionPool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  sessionStore = new pgSession({
    pool: sessionPool,
    tableName: 'user_sessions',
    createTableIfMissing: true
  });
} else {
  log('⚠️  Using in-memory session store (sessions will not persist between restarts)');
  const MemoryStoreSession = MemoryStore(session);
  sessionStore = new MemoryStoreSession({
    checkPeriod: 86400000 // prune expired entries every 24h
  });
}

// Trust proxy for secure cookies behind Replit's load balancer
app.set('trust proxy', 1);

// Ensure session secret is provided in production
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET environment variable is required in production');
}

app.use(session({
  name: 'AGILE_SESSION_ID', // Use unique session name
  secret: process.env.SESSION_SECRET || 'bHk29!#dfJslP0qW82@3', // Fallback only for development
  store: sessionStore,
  resave: true, // Always save session, even if not modified
  saveUninitialized: false,
  rolling: true, // Refresh session on every response
  cookie: {
    maxAge: 8 * 60 * 60 * 1000, // 8 hours session timeout
    secure: false, // Allow HTTP for development
    httpOnly: true, // Prevent XSS attacks
    sameSite: 'lax' // Better compatibility while maintaining security
  }
}));

// Test route to verify session creation
app.get('/api/test-session', (req, res) => {
  (req.session as any).test = 'hello';
  res.json({ message: 'Session set!' });
});

(async () => {
  // Debug environment variables
  console.log('🔍 Environment Debug:');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('USE_DB:', process.env.USE_DB);
  console.log('MYSQL_DATABASE_URL exists:', !!process.env.MYSQL_DATABASE_URL);
  console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
  
  // Initialize storage first to use the database
  await initStorage();

  const server = await registerRoutes(app);

  // Register PHP API routes
  registerPhpApiRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = process.env.PORT || 5000;
  server.listen(Number(port), '0.0.0.0', () => {
    log(`✅ Server is running on port ${port}`);
  });


})();
