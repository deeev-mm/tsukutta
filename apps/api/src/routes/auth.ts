import { Hono } from "hono";
import type { Context } from "hono";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import { eq } from "drizzle-orm";
import { MIN_PASSWORD_LENGTH, type SessionUser } from "@tsukutta/shared";
import { families, sessions, users } from "../db/schema";
import type { AppVariables } from "../lib/auth";
import { requireAuth } from "../lib/auth";
import {
  hashPassword,
  newId,
  nowIso,
  sha256Hex,
  verifyPassword,
  type Env,
} from "../lib/crypto";
import { isLocked, normalizeIdentifier, recordFailure, resetAttempts } from "../lib/rate-limit";

const SESSION_DAYS = 30;

type App = { Bindings: Env; Variables: AppVariables };

export const authRoutes = new Hono<App>();

authRoutes.post("/register", async (c) => {
  const body = await c.req.json<{
    loginId?: string;
    password?: string;
    displayName?: string;
    familyName?: string;
    householdSize?: number;
  }>();

  const loginId = (body.loginId ?? "").trim();
  const password = body.password ?? "";
  const displayName = (body.displayName ?? "").trim() || loginId;
  const familyName = (body.familyName ?? "").trim() || null;
  const householdSize =
    typeof body.householdSize === "number" && body.householdSize >= 1
      ? Math.floor(body.householdSize)
      : 2;

  if (!loginId || loginId.length < 2) {
    return c.json({ error: "ログインIDは2文字以上で入力してください" }, 400);
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return c.json(
      { error: `パスワードは${MIN_PASSWORD_LENGTH}文字以上にしてください` },
      400,
    );
  }

  const db = c.get("db");
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.loginId, loginId))
    .get();
  if (existing) {
    return c.json({ error: "このログインIDは既に使われています" }, 409);
  }

  const ts = nowIso();
  const familyId = newId();
  const userId = newId();
  const passwordHash = await hashPassword(password);

  await db.insert(families).values({
    id: familyId,
    name: familyName,
    householdSize,
    isSuspended: 0,
    isDemo: 0,
    createdAt: ts,
    updatedAt: ts,
  });

  await db.insert(users).values({
    id: userId,
    familyId,
    loginId,
    passwordHash,
    displayName,
    role: "owner",
    isActive: 1,
    createdAt: ts,
    updatedAt: ts,
  });

  const sessionUser: SessionUser = {
    id: userId,
    familyId,
    loginId,
    displayName,
    role: "owner",
    isDemo: false,
    householdSize,
    familyName,
  };
  await issueSession(c, sessionUser);
  return c.json({ user: sessionUser }, 201);
});

authRoutes.post("/login", async (c) => {
  const body = await c.req.json<{ loginId?: string; password?: string }>();
  const loginId = (body.loginId ?? "").trim();
  const password = body.password ?? "";
  if (!loginId || !password) {
    return c.json({ error: "ログインIDとパスワードを入力してください" }, 400);
  }

  const db = c.get("db");
  const identifier = normalizeIdentifier(loginId);

  if (await isLocked(db, "user", identifier)) {
    return c.json(
      { error: "ログイン試行回数が上限に達しました。15分ほど待ってから再試行してください" },
      429,
    );
  }

  const row = await db
    .select({
      user: users,
      family: families,
    })
    .from(users)
    .innerJoin(families, eq(users.familyId, families.id))
    .where(eq(users.loginId, loginId))
    .get();

  if (!row || row.user.isActive !== 1) {
    await recordFailure(db, "user", identifier);
    return c.json({ error: "ログインIDまたはパスワードが違います" }, 401);
  }
  if (row.family.isSuspended === 1) {
    return c.json({ error: "この家族アカウントは停止中です" }, 403);
  }

  const ok = await verifyPassword(password, row.user.passwordHash);
  if (!ok) {
    await recordFailure(db, "user", identifier);
    return c.json({ error: "ログインIDまたはパスワードが違います" }, 401);
  }
  await resetAttempts(db, "user", identifier);

  const sessionUser: SessionUser = {
    id: row.user.id,
    familyId: row.user.familyId,
    loginId: row.user.loginId,
    displayName: row.user.displayName,
    role: row.user.role as SessionUser["role"],
    isDemo: row.family.isDemo === 1,
    householdSize: row.family.householdSize,
    familyName: row.family.name,
  };
  await issueSession(c, sessionUser);
  return c.json({ user: sessionUser });
});

authRoutes.post("/logout", requireAuth, async (c) => {
  const cookieName = c.env.SESSION_COOKIE_NAME || "tsukutta_session";
  const token = getCookie(c, cookieName);
  if (token) {
    const db = c.get("db");
    const tokenHash = await sha256Hex(token);
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
  }
  deleteCookie(c, cookieName, { path: "/" });
  return c.json({ ok: true });
});

authRoutes.get("/me", requireAuth, async (c) => {
  return c.json({ user: c.get("user") });
});

async function issueSession(c: Context<App>, user: SessionUser) {
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = [...tokenBytes]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const tokenHash = await sha256Hex(token);
  const ts = nowIso();
  const expires = new Date();
  expires.setDate(expires.getDate() + SESSION_DAYS);

  await c.get("db").insert(sessions).values({
    id: newId(),
    userId: user.id,
    tokenHash,
    expiresAt: expires.toISOString(),
    createdAt: ts,
  });

  const cookieName = c.env.SESSION_COOKIE_NAME || "tsukutta_session";
  const isLocal = (c.env.APP_BASE_URL || "").includes("localhost");
  setCookie(c, cookieName, token, {
    httpOnly: true,
    path: "/",
    sameSite: isLocal ? "Lax" : "None",
    secure: !isLocal,
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}
