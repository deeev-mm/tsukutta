import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { families } from "../db/schema";
import type { AppVariables } from "../lib/auth";
import { requireAuth } from "../lib/auth";
import { nowIso, type Env } from "../lib/crypto";

export const familyRoutes = new Hono<{
  Bindings: Env;
  Variables: AppVariables;
}>();

familyRoutes.use("*", requireAuth);

familyRoutes.get("/", async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const family = await db
    .select()
    .from(families)
    .where(eq(families.id, user.familyId))
    .get();
  if (!family) return c.json({ error: "家族が見つかりません" }, 404);
  return c.json({
    family: {
      id: family.id,
      name: family.name,
      householdSize: family.householdSize,
      isDemo: family.isDemo === 1,
      createdAt: family.createdAt,
      updatedAt: family.updatedAt,
    },
  });
});

familyRoutes.patch("/", async (c) => {
  const user = c.get("user");
  if (user.role !== "owner") {
    return c.json({ error: "家族設定は親ユーザーのみ変更できます" }, 403);
  }

  const body = await c.req.json<{
    name?: string | null;
    householdSize?: number;
  }>();

  const patch: {
    name?: string | null;
    householdSize?: number;
    updatedAt: string;
  } = { updatedAt: nowIso() };

  if (body.name !== undefined) {
    patch.name = body.name?.trim() || null;
  }
  if (body.householdSize !== undefined) {
    if (!Number.isFinite(body.householdSize) || body.householdSize < 1) {
      return c.json({ error: "家族人数は1以上の整数にしてください" }, 400);
    }
    patch.householdSize = Math.floor(body.householdSize);
  }

  const db = c.get("db");
  await db.update(families).set(patch).where(eq(families.id, user.familyId));

  const family = await db
    .select()
    .from(families)
    .where(eq(families.id, user.familyId))
    .get();

  return c.json({
    family: {
      id: family!.id,
      name: family!.name,
      householdSize: family!.householdSize,
      isDemo: family!.isDemo === 1,
      createdAt: family!.createdAt,
      updatedAt: family!.updatedAt,
    },
  });
});
