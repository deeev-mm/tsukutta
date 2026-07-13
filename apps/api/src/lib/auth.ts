import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { and, eq, gt } from "drizzle-orm";
import type { SessionUser } from "@pf08/shared";
import { createDb } from "../db/client";
import { families, sessions, users } from "../db/schema";
import type { Env } from "./crypto";
import { sha256Hex } from "./crypto";

export type AppVariables = {
  user: SessionUser;
  admin?: { id: string; loginId: string };
  db: ReturnType<typeof createDb>;
};

export const withDb = createMiddleware<{ Bindings: Env; Variables: AppVariables }>(
  async (c, next) => {
    c.set("db", createDb(c.env.DB));
    await next();
  },
);

export const requireAuth = createMiddleware<{
  Bindings: Env;
  Variables: AppVariables;
}>(async (c, next) => {
  const cookieName = c.env.SESSION_COOKIE_NAME || "pf08_session";
  const token = getCookie(c, cookieName);
  if (!token) {
    return c.json({ error: "ログインが必要です" }, 401);
  }

  const db = c.get("db");
  const tokenHash = await sha256Hex(token);
  const now = new Date().toISOString();

  const row = await db
    .select({
      sessionId: sessions.id,
      userId: users.id,
      familyId: users.familyId,
      loginId: users.loginId,
      displayName: users.displayName,
      role: users.role,
      isActive: users.isActive,
      isSuspended: families.isSuspended,
      isDemo: families.isDemo,
      householdSize: families.householdSize,
      familyName: families.name,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .innerJoin(families, eq(users.familyId, families.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
    .get();

  if (!row || row.isActive !== 1) {
    return c.json({ error: "セッションが無効です" }, 401);
  }
  if (row.isSuspended === 1) {
    return c.json({ error: "この家族アカウントは停止中です" }, 403);
  }

  const user: SessionUser = {
    id: row.userId,
    familyId: row.familyId,
    loginId: row.loginId,
    displayName: row.displayName,
    role: row.role as SessionUser["role"],
    isDemo: row.isDemo === 1,
    householdSize: row.householdSize,
    familyName: row.familyName,
  };
  c.set("user", user);
  await next();
});

export function canCook(role: SessionUser["role"]): boolean {
  return role === "owner" || role === "cook";
}

export function requireCookRole(user: SessionUser): string | null {
  if (!canCook(user.role)) return "調理権限がありません";
  return null;
}

export function requireOwnerRole(user: SessionUser): string | null {
  if (user.role !== "owner") return "親ユーザーのみ操作できます";
  return null;
}
