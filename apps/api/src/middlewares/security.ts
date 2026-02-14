/**
 * Security Middleware
 *
 * Helmet.js for security headers
 * CORS for cross-origin requests
 */

import helmet from "helmet";
import cors from "cors";
import type { Express } from "express";

/**
 * Configure and apply Helmet security headers
 *
 * Sets headers to prevent XSS, clickjacking, MIME sniffing, etc.
 */
export function configureHelmet(app: Express): void {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      // Prevent clickjacking
      frameguard: {
        action: "deny",
      },

      // Hide X-Powered-By header
      hidePoweredBy: true,

      // Prevent MIME sniffing
      noSniff: true,

      // Enable XSS filter
      xssFilter: true,

      // Force HTTPS (only in production)
      hsts:
        process.env.NODE_ENV === "production"
          ? {
              maxAge: 31536000, // 1 year
              includeSubDomains: true,
              preload: true,
            }
          : false,
    })
  );
}

/**
 * Configure CORS (Cross-Origin Resource Sharing)
 *
 * Controls which domains can access the API
 */
export function configureCORS(app: Express): void {
  const allowedOrigins = getAllowedOrigins();

  app.use(
    cors({
      // Allow requests from these origins
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) {
          callback(null, true);
          return;
        }

        if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },

      // Allow credentials (cookies, authorization headers)
      credentials: true,

      // Allowed HTTP methods
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],

      // Allowed headers
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Request-ID",
        "X-Requested-With",
      ],

      // Expose headers to client
      exposedHeaders: [
        "X-Request-ID",
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
      ],

      // Preflight cache duration
      maxAge: 600, // 10 minutes
    })
  );
}

/**
 * Get allowed origins based on environment
 */
function getAllowedOrigins(): string[] {
  const env = process.env.NODE_ENV || "development";

  switch (env) {
    case "production":
      // Production: Only allow specific domains
      return [
        process.env.FRONTEND_URL,
        "https://paper-fun.vercel.app",
        "https://paperfun.eeshm.me",
        process.env.ADMIN_URL,
      ].filter(Boolean) as string[];

    case "staging":
      // Staging: Allow staging domains
      return [
        "https://staging.yourdomain.com",
        "https://preview.yourdomain.com",
      ];

    case "development":
    default:
      // Development: Allow localhost on any port
      return [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002", // Next.js frontend
        "http://localhost:4200",
        "http://localhost:5173", // Vite default
        "http://localhost:8080",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3002",
        "http://127.0.0.1:5173",
      ];
  }
}


export function applySecurity(app: Express): void {
  configureHelmet(app);
  configureCORS(app);
}