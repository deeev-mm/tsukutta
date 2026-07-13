import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { MIN_PASSWORD_LENGTH } from "@pf08/shared";
import { users } from "../db/schema";
import type { AppVariables } from "../lib/auth";
import { requireAuth, requireOwnerRole } from "../lib/auth";
import {
  hashPassword,
  newId,
  nowIso,
  type Env,
} from "../lib/crypto";
import { families } from "../db/schema";

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

function serializeMember(u: typeof users.$inferSelect) {
  return {
    id: u.id,
    loginId: u.loginId,
    displayName: u.displayName,
    role: u.role,
    isActive: u.isActive === 1,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

familyRoutes.get("/users", async (c) => {
  const user = c.get("user");
  const denied = requireOwnerRole(user);
  if (denied) return c.json({ error: denied }, 403);

  const rows = await c
    .get("db")
    .select()
    .from(users)
    .where(eq(users.familyId, user.familyId))
    .all();

  return c.json({ users: rows.map(serializeMember) });
});

familyRoutes.post("/users", async (c) => {
  const user = c.get("user");
  const denied = requireOwnerRole(user);
  if (denied) return c.json({ error: denied }, 403);

  const body = await c.req.json<{
    loginId?: string;
    password?: string;
    displayName?: string;
    role?: string;
  }>();

  const loginId = (body.loginId ?? "").trim();
  const password = body.password ?? "";
  const displayName = (body.displayName ?? "").trim() || loginId;
  const role = body.role === "cook" || body.role === "reviewer" ? body.role : null;

  if (!loginId || loginId.length < 2) {
    return c.json({ error: "ログインIDは2文字以上で入力してください" }, 400);
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return c.json(
      { error: `パスワードは${MIN_PASSWORD_LENGTH}文字以上にしてください` },
      400,
    );
  }
  if (!role) {
    return c.json({ error: "ロールは cook または reviewer を指定してください" }, 400);
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
  const id = newId();
  await db.insert(users).values({
    id,
    familyId: user.familyId,
    loginId,
    passwordHash: await hashPassword(password),
    displayName,
    role,
    isActive: 1,
    createdAt: ts,
    updatedAt: ts,
  });

  const row = await db.select().from(users).where(eq(users.id, id)).get();
  return c.json({ user: serializeMember(row!) }, 201);
});

familyRoutes.patch("/users/:id", async (c) => {
  const user = c.get("user");
  const denied = requireOwnerRole(user);
  if (denied) return c.json({ error: denied }, 403);

  const id = c.req.param("id");
  const db = c.get("db");
  const target = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), eq(users.familyId, user.familyId)))
    .get();
  if (!target) return c.json({ error: "ユーザーが見つかりません" }, 404);
  if (target.role === "owner") {
    return c.json({ error: "親ユーザーはこの画面から変更できません" }, 400);
  }

  const body = await c.req.json<{
    displayName?: string;
    role?: string;
    isActive?: boolean;
    password?: string;
  }>();

  const patch: Record<string, unknown> = { updatedAt: nowIso() };
  if (body.displayName !== undefined) {
    patch.displayName = body.displayName.trim() || target.displayName;
  }
  if (body.role === "cook" || body.role === "reviewer") {
    patch.role = body.role;
  }
  if (body.isActive !== undefined) {
    patch.isActive = body.isActive ? 1 : 0;
  }
  if (body.password !== undefined) {
    if (body.password.length < MIN_PASSWORD_LENGTH) {
      return c.json(
        { error: `パスワードは${MIN_PASSWORD_LENGTH}文字以上にしてください` },
        400,
      );
    }
    patch.passwordHash = await hashPassword(body.password);
  }

  await db.update(users).set(patch).where(eq(users.id, id));
  const row = await db.select().from(users).where(eq(users.id, id)).get();
  return c.json({ user: serializeMember(row!) });
});
