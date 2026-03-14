import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { type Express, type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { type User } from "@shared/schema";
import { registerOIDCRoutes } from "./replit_integrations/auth/replitAuth";

declare global {
  namespace Express {
    interface User extends Omit<import("@shared/schema").User, never> {}
  }
}

export async function hashPassword(password: string) {
  return await bcrypt.hash(password, 10);
}

export async function comparePassword(plain: string, hash: string) {
  return await bcrypt.compare(plain, hash);
}

export async function setupAuth(app: Express) {
  // Local username/password strategy
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !user.password) {
          return done(null, false, { message: "Invalid username or password" });
        }
        const valid = await comparePassword(password, user.password);
        if (!valid) {
          return done(null, false, { message: "Invalid username or password" });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }),
  );

  // Unified serialize/deserialize — works for both local and OAuth users
  // since both end up as a row in our users table
  passport.serializeUser((user: User, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user ?? false);
    } catch (err) {
      done(err);
    }
  });

  // Register Replit OIDC routes (/api/login, /api/callback, /api/logout)
  let oidcAvailable = false;
  try {
    await registerOIDCRoutes(app);
    oidcAvailable = true;
  } catch (err) {
    console.warn("OIDC setup failed — OAuth login unavailable:", err);
  }

  // Fallback handlers if OIDC failed to initialize
  if (!oidcAvailable) {
    app.get("/api/login", (_req, res) => {
      res.redirect("/?error=oauth_unavailable");
    });
    app.get("/api/callback", (_req, res) => {
      res.redirect("/?error=oauth_unavailable");
    });
    app.get("/api/logout", (req, res) => {
      req.logout(() => res.redirect("/"));
    });
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}
