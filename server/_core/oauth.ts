import { randomUUID } from "crypto";
import {
  COOKIE_NAME,
  ONE_YEAR_MS,
  OAUTH_STATE_COOKIE,
  decodeOAuthState,
  encodeOAuthState,
} from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function getPublicOrigin(req: Request): string {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const forwardedHost = req.headers["x-forwarded-host"];
  const proto = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto?.split(",")[0])?.trim();
  const host = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost?.split(",")[0])?.trim();

  if (proto && host) return `${proto}://${host}`;

  const hostHeader = req.get("host");
  if (hostHeader) return `${req.protocol}://${hostHeader}`;

  return "";
}

export function registerOAuthRoutes(app: Express) {
  // Start Manus login on the backend. This is intentionally server-side so a
  // Vercel frontend does not need VITE_APP_ID or VITE_OAUTH_PORTAL_URL at build
  // time. It also guarantees the state nonce and cookie are created together.
  app.get("/api/oauth/login", (req: Request, res: Response) => {
    if (!ENV.appId || !ENV.oAuthServerUrl) {
      console.error("[OAuth] Missing VITE_APP_ID or OAUTH_SERVER_URL");
      res.status(503).json({ error: "OAuth is not configured on the server" });
      return;
    }

    const origin = getPublicOrigin(req);
    if (!origin) {
      res.status(400).json({ error: "Unable to determine public application origin" });
      return;
    }

    const redirectUri = `${origin}/api/oauth/callback`;
    const nonce = randomUUID();
    const state = encodeOAuthState({ redirectUri, nonce });
    const secure = req.protocol === "https" || req.get("x-forwarded-proto") === "https";

    res.cookie(OAUTH_STATE_COOKIE, nonce, {
      httpOnly: true,
      secure,
      sameSite: "none",
      path: "/",
      maxAge: 10 * 60 * 1000,
    });

    const url = new URL(`${ENV.oAuthServerUrl}/app-auth`);
    url.searchParams.set("appId", ENV.appId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");

    res.redirect(302, url.toString());
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
