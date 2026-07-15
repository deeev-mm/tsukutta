import { eq, and } from "drizzle-orm";
import type { createDb } from "../db/client";
import { loginAttempts } from "../db/schema";
import { newId, nowIso } from "./crypto";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

type Db = ReturnType<typeof createDb>;

export async function isLocked(
  db: Db,
  scope: string,
  identifier: string,
): Promise<boolean> {
  const row = await db
    .select({ lockedUntil: loginAttempts.lockedUntil })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.scope, scope), eq(loginAttempts.identifier, identifier)))
    .get();
  if (!row?.lockedUntil) return false;
  return row.lockedUntil > nowIso();
}

export async function recordFailure(
  db: Db,
  scope: string,
  identifier: string,
): Promise<void> {
  const existing = await db
    .select()
    .from(loginAttempts)
    .where(and(eq(loginAttempts.scope, scope), eq(loginAttempts.identifier, identifier)))
    .get();

  const ts = nowIso();
  const failedCount = (existing?.failedCount ?? 0) + 1;
  const lockedUntil =
    failedCount >= MAX_FAILED_ATTEMPTS
      ? new Date(Date.now() + LOCKOUT_MS).toISOString()
      : null;

  if (existing) {
    await db
      .update(loginAttempts)
      .set({ failedCount: lockedUntil ? 0 : failedCount, lockedUntil, updatedAt: ts })
      .where(eq(loginAttempts.id, existing.id));
  } else {
    await db.insert(loginAttempts).values({
      id: newId(),
      scope,
      identifier,
      failedCount: lockedUntil ? 0 : failedCount,
      lockedUntil,
      updatedAt: ts,
    });
  }
}

export async function resetAttempts(
  db: Db,
  scope: string,
  identifier: string,
): Promise<void> {
  await db
    .delete(loginAttempts)
    .where(and(eq(loginAttempts.scope, scope), eq(loginAttempts.identifier, identifier)));
}

export function normalizeIdentifier(raw: string): string {
  return raw.trim().toLowerCase();
}
