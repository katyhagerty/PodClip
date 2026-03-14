import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";
import passport from "passport";
import type { Express } from "express";
import memoize from "memoizee";
import { storage } from "../../storage";

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

// In deployed Replit containers, req.hostname resolves to an internal hostname.
// REPLIT_DOMAINS always contains the correct public-facing domain.
function getPublicDomain(reqHostname: string): string {
  const replitDomains = process.env.REPLIT_DOMAINS;
  if (replitDomains) {
    return replitDomains.split(",")[0].trim();
  }
  return reqHostname;
}

export async function registerOIDCRoutes(app: Express) {
  const config = await getOidcConfig();

  const verify: VerifyFunction = async (tokens, verified) => {
    try {
      const claims = tokens.claims();
      const user = await storage.upsertUserByReplitId({
        replitId: claims.sub,
        email: (claims.email as string) ?? null,
        firstName: (claims.first_name as string) ?? null,
        lastName: (claims.last_name as string) ?? null,
        profileImageUrl: (claims.profile_image_url as string) ?? null,
      });
      verified(null, user);
    } catch (err) {
      verified(err as Error);
    }
  };

  const registeredStrategies = new Set<string>();

  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  app.get("/api/login", (req, res, next) => {
    const domain = getPublicDomain(req.hostname);
    ensureStrategy(domain);
    passport.authenticate(`replitauth:${domain}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    const domain = getPublicDomain(req.hostname);
    ensureStrategy(domain);
    passport.authenticate(`replitauth:${domain}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(async () => {
      try {
        const domain = getPublicDomain(req.hostname);
        const cfg = await getOidcConfig();
        res.redirect(
          client.buildEndSessionUrl(cfg, {
            client_id: process.env.REPL_ID!,
            post_logout_redirect_uri: `https://${domain}`,
          }).href
        );
      } catch {
        res.redirect("/login");
      }
    });
  });
}
