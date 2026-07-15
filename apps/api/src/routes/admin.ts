import { Hono } from "hono";
import type { Context, Next } from "hono";
import { and, asc, count, desc, eq, like, sql } from "drizzle-orm";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import {
  adminAuditLogs,
  adminSessions,
  adminUsers,
  categories,
  cookLogRatings,
  cookLogs,
  families,
  recipes,
  users,
} from "../db/schema";
import type { AppVariables } from "../lib/auth";
import {
  hashPassword,
  newId,
  nowIso,
  sha256Hex,
  verifyPassword,
  type Env,
} from "../lib/crypto";
import { isLocked, normalizeIdentifier, recordFailure, resetAttempts } from "../lib/rate-limit";

const ADMIN_COOKIE = "tsukutta_admin_session";
const SESSION_DAYS = 14;

type AdminApp = { Bindings: Env; Variables: AppVariables };
type AdminCtx = Context<AdminApp>;

export const adminRoutes = new Hono<AdminApp>();

async function getAdmin(c: AdminCtx) {
  const token = getCookie(c, ADMIN_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const now = new Date().toISOString();
  const row = await c
    .get("db")
    .select({
      id: adminUsers.id,
      loginId: adminUsers.loginId,
      expiresAt: adminSessions.expiresAt,
    })
    .from(adminSessions)
    .innerJoin(adminUsers, eq(adminSessions.adminUserId, adminUsers.id))
    .where(eq(adminSessions.tokenHash, tokenHash))
    .get();
  if (!row || row.expiresAt <= now) return null;
  return { id: row.id, loginId: row.loginId };
}

async function requireAdminMw(c: AdminCtx, next: Next) {
  const admin = await getAdmin(c);
  if (!admin) return c.json({ error: "Adminログインが必要です" }, 401);
  c.set("admin", admin);
  await next();
}

async function writeAudit(
  c: AdminCtx,
  adminId: string,
  action: string,
  targetType?: string,
  targetId?: string,
  detail?: Record<string, unknown>,
) {
  await c.get("db").insert(adminAuditLogs).values({
    id: newId(),
    adminUserId: adminId,
    action,
    targetType: targetType ?? null,
    targetId: targetId ?? null,
    detailJson: detail ? JSON.stringify(detail) : null,
    createdAt: nowIso(),
  });
}

adminRoutes.post("/auth/login", async (c) => {
  const body = await c.req.json<{ loginId?: string; password?: string }>();
  const loginId = (body.loginId ?? "").trim();
  const password = body.password ?? "";
  if (!loginId || !password) {
    return c.json({ error: "ログインIDとパスワードを入力してください" }, 400);
  }

  const db = c.get("db");
  const identifier = normalizeIdentifier(loginId);

  if (await isLocked(db, "admin", identifier)) {
    return c.json(
      { error: "ログイン試行回数が上限に達しました。15分ほど待ってから再試行してください" },
      429,
    );
  }

  const row = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.loginId, loginId))
    .get();
  if (!row || !(await verifyPassword(password, row.passwordHash))) {
    await recordFailure(db, "admin", identifier);
    return c.json({ error: "ログインIDまたはパスワードが違います" }, 401);
  }
  await resetAttempts(db, "admin", identifier);

  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = [...tokenBytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  const expires = new Date();
  expires.setDate(expires.getDate() + SESSION_DAYS);
  await c.get("db").insert(adminSessions).values({
    id: newId(),
    adminUserId: row.id,
    tokenHash: await sha256Hex(token),
    expiresAt: expires.toISOString(),
    createdAt: nowIso(),
  });

  const isLocal = (c.env.APP_BASE_URL || "").includes("localhost");
  setCookie(c, ADMIN_COOKIE, token, {
    httpOnly: true,
    path: "/",
    sameSite: isLocal ? "Lax" : "None",
    secure: !isLocal,
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });

  return c.json({ admin: { id: row.id, loginId: row.loginId } });
});

adminRoutes.post("/auth/logout", async (c) => {
  const token = getCookie(c, ADMIN_COOKIE);
  if (token) {
    await c
      .get("db")
      .delete(adminSessions)
      .where(eq(adminSessions.tokenHash, await sha256Hex(token)));
  }
  deleteCookie(c, ADMIN_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

const protectedAdmin = new Hono<AdminApp>();
protectedAdmin.use("*", requireAdminMw);

protectedAdmin.get("/auth/me", async (c) => {
  return c.json({ admin: c.get("admin") });
});

protectedAdmin.get("/dashboard", async (c) => {
  const db = c.get("db");
  const [f, u, r, l, rt] = await Promise.all([
    db.select({ n: count() }).from(families).get(),
    db.select({ n: count() }).from(users).get(),
    db.select({ n: count() }).from(recipes).get(),
    db.select({ n: count() }).from(cookLogs).get(),
    db.select({ n: count() }).from(cookLogRatings).get(),
  ]);
  const recentFamilies = await db
    .select({
      id: families.id,
      name: families.name,
      createdAt: families.createdAt,
      isSuspended: families.isSuspended,
      isDemo: families.isDemo,
    })
    .from(families)
    .orderBy(desc(families.createdAt))
    .limit(10)
    .all();

  return c.json({
    counts: {
      families: f?.n ?? 0,
      users: u?.n ?? 0,
      recipes: r?.n ?? 0,
      cookLogs: l?.n ?? 0,
      ratings: rt?.n ?? 0,
    },
    recentFamilies: recentFamilies.map((x) => ({
      ...x,
      isSuspended: x.isSuspended === 1,
      isDemo: x.isDemo === 1,
    })),
  });
});

protectedAdmin.get("/health", async (c) => {
  try {
    await c.env.DB.prepare("SELECT 1").first();
    return c.json({ ok: true, db: true });
  } catch {
    return c.json({ ok: false, db: false }, 503);
  }
});

protectedAdmin.get("/families", async (c) => {
  const q = (c.req.query("q") ?? "").trim();
  const db = c.get("db");
  const rows = await db
    .select({
      id: families.id,
      name: families.name,
      householdSize: families.householdSize,
      isSuspended: families.isSuspended,
      isDemo: families.isDemo,
      createdAt: families.createdAt,
      userCount: sql<number>`(select count(*) from users where users.family_id = ${families.id})`,
      recipeCount: sql<number>`(select count(*) from recipes where recipes.family_id = ${families.id})`,
    })
    .from(families)
    .where(q ? like(families.name, `%${q}%`) : undefined)
    .orderBy(desc(families.createdAt))
    .all();

  return c.json({
    families: rows.map((r) => ({
      ...r,
      isSuspended: r.isSuspended === 1,
      isDemo: r.isDemo === 1,
    })),
  });
});

protectedAdmin.get("/families/:id", async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  const family = await db.select().from(families).where(eq(families.id, id)).get();
  if (!family) return c.json({ error: "Familyが見つかりません" }, 404);
  const members = await db.select().from(users).where(eq(users.familyId, id)).all();
  return c.json({
    family: {
      id: family.id,
      name: family.name,
      householdSize: family.householdSize,
      isSuspended: family.isSuspended === 1,
      isDemo: family.isDemo === 1,
      createdAt: family.createdAt,
    },
    members: members.map((m) => ({
      id: m.id,
      loginId: m.loginId,
      displayName: m.displayName,
      role: m.role,
      isActive: m.isActive === 1,
    })),
  });
});

protectedAdmin.post("/families/:id/suspend", async (c) => {
  const admin = c.get("admin")!;
  const id = c.req.param("id");
  const db = c.get("db");
  const family = await db.select().from(families).where(eq(families.id, id)).get();
  if (!family) return c.json({ error: "Familyが見つかりません" }, 404);
  await db
    .update(families)
    .set({ isSuspended: 1, updatedAt: nowIso() })
    .where(eq(families.id, id));
  await writeAudit(c, admin.id, "family.suspend", "family", id);
  return c.json({ ok: true });
});

protectedAdmin.post("/families/:id/resume", async (c) => {
  const admin = c.get("admin")!;
  const id = c.req.param("id");
  const db = c.get("db");
  const family = await db.select().from(families).where(eq(families.id, id)).get();
  if (!family) return c.json({ error: "Familyが見つかりません" }, 404);
  await db
    .update(families)
    .set({ isSuspended: 0, updatedAt: nowIso() })
    .where(eq(families.id, id));
  await writeAudit(c, admin.id, "family.resume", "family", id);
  return c.json({ ok: true });
});

protectedAdmin.get("/users", async (c) => {
  const q = (c.req.query("q") ?? "").trim();
  const db = c.get("db");
  const rows = await db
    .select({
      id: users.id,
      loginId: users.loginId,
      displayName: users.displayName,
      role: users.role,
      isActive: users.isActive,
      familyId: users.familyId,
      familyName: families.name,
    })
    .from(users)
    .innerJoin(families, eq(users.familyId, families.id))
    .where(
      q
        ? sql`(${users.loginId} like ${"%" + q + "%"} or ${users.displayName} like ${"%" + q + "%"})`
        : undefined,
    )
    .orderBy(asc(users.loginId))
    .limit(100)
    .all();

  return c.json({
    users: rows.map((r) => ({ ...r, isActive: r.isActive === 1 })),
  });
});

protectedAdmin.post("/users/:id/disable", async (c) => {
  const admin = c.get("admin")!;
  const id = c.req.param("id");
  const db = c.get("db");
  const row = await db.select().from(users).where(eq(users.id, id)).get();
  if (!row) return c.json({ error: "ユーザーが見つかりません" }, 404);
  await db.update(users).set({ isActive: 0, updatedAt: nowIso() }).where(eq(users.id, id));
  await writeAudit(c, admin.id, "user.disable", "user", id);
  return c.json({ ok: true });
});

protectedAdmin.post("/users/:id/enable", async (c) => {
  const admin = c.get("admin")!;
  const id = c.req.param("id");
  const db = c.get("db");
  const row = await db.select().from(users).where(eq(users.id, id)).get();
  if (!row) return c.json({ error: "ユーザーが見つかりません" }, 404);
  await db.update(users).set({ isActive: 1, updatedAt: nowIso() }).where(eq(users.id, id));
  await writeAudit(c, admin.id, "user.enable", "user", id);
  return c.json({ ok: true });
});

protectedAdmin.post("/users/:id/reset-password", async (c) => {
  const admin = c.get("admin")!;
  const id = c.req.param("id");
  const db = c.get("db");
  const row = await db.select().from(users).where(eq(users.id, id)).get();
  if (!row) return c.json({ error: "ユーザーが見つかりません" }, 404);

  const chars = "abcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  const newPassword = [...bytes].map((b) => chars[b % chars.length]).join("");
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword), updatedAt: nowIso() })
    .where(eq(users.id, id));
  await writeAudit(c, admin.id, "user.reset_password", "user", id, {
    note: "password regenerated",
  });
  return c.json({ ok: true, temporaryPassword: newPassword });
});

protectedAdmin.get("/audit-logs", async (c) => {
  const rows = await c
    .get("db")
    .select({
      id: adminAuditLogs.id,
      action: adminAuditLogs.action,
      targetType: adminAuditLogs.targetType,
      targetId: adminAuditLogs.targetId,
      detailJson: adminAuditLogs.detailJson,
      createdAt: adminAuditLogs.createdAt,
      adminLoginId: adminUsers.loginId,
    })
    .from(adminAuditLogs)
    .innerJoin(adminUsers, eq(adminAuditLogs.adminUserId, adminUsers.id))
    .orderBy(desc(adminAuditLogs.createdAt))
    .limit(100)
    .all();
  return c.json({ auditLogs: rows });
});

protectedAdmin.get("/categories", async (c) => {
  const rows = await c
    .get("db")
    .select()
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.name))
    .all();
  return c.json({
    categories: rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      sortOrder: r.sortOrder,
      isActive: r.isActive === 1,
    })),
  });
});

protectedAdmin.post("/categories", async (c) => {
  const admin = c.get("admin")!;
  const body = await c.req.json<{
    code?: string;
    name?: string;
    sortOrder?: number;
  }>();
  const code = (body.code ?? "").trim().toLowerCase();
  const name = (body.name ?? "").trim();
  if (!code || !name) {
    return c.json({ error: "code と name は必須です" }, 400);
  }
  const ts = nowIso();
  const id = newId();
  try {
    await c.get("db").insert(categories).values({
      id,
      code,
      name,
      sortOrder: body.sortOrder ?? 100,
      isActive: 1,
      createdAt: ts,
      updatedAt: ts,
    });
  } catch {
    return c.json({ error: "code が重複しています" }, 409);
  }
  await writeAudit(c, admin.id, "category.create", "category", id, { code, name });
  return c.json(
    { category: { id, code, name, sortOrder: body.sortOrder ?? 100, isActive: true } },
    201,
  );
});

protectedAdmin.patch("/categories/:id", async (c) => {
  const admin = c.get("admin")!;
  const id = c.req.param("id");
  const body = await c.req.json<{
    name?: string;
    sortOrder?: number;
    isActive?: boolean;
  }>();
  const db = c.get("db");
  const row = await db.select().from(categories).where(eq(categories.id, id)).get();
  if (!row) return c.json({ error: "カテゴリが見つかりません" }, 404);

  const patch: Record<string, unknown> = { updatedAt: nowIso() };
  if (body.name !== undefined) patch.name = body.name.trim() || row.name;
  if (body.sortOrder !== undefined) patch.sortOrder = Math.floor(body.sortOrder);
  if (body.isActive !== undefined) patch.isActive = body.isActive ? 1 : 0;

  await db.update(categories).set(patch).where(eq(categories.id, id));
  await writeAudit(c, admin.id, "category.update", "category", id, body as Record<string, unknown>);
  const updated = await db.select().from(categories).where(eq(categories.id, id)).get();
  return c.json({
    category: {
      id: updated!.id,
      code: updated!.code,
      name: updated!.name,
      sortOrder: updated!.sortOrder,
      isActive: updated!.isActive === 1,
    },
  });
});

adminRoutes.route("/", protectedAdmin);
