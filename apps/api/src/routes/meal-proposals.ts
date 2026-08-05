import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import {
  mealProposalCandidates,
  mealProposalVotes,
  mealProposals,
  recipes,
  users,
} from "../db/schema";
import type { AppVariables } from "../lib/auth";
import { requireAuth, requireCookRole } from "../lib/auth";
import { newId, nowIso, todayYmd, type Env } from "../lib/crypto";

export const mealProposalRoutes = new Hono<{
  Bindings: Env;
  Variables: AppVariables;
}>();

mealProposalRoutes.use("*", requireAuth);

async function serializeProposal(
  db: ReturnType<typeof import("../db/client").createDb>,
  proposal: typeof mealProposals.$inferSelect,
  currentUserId: string,
) {
  const candidateRows = await db
    .select({
      id: mealProposalCandidates.id,
      recipeId: mealProposalCandidates.recipeId,
      recipeName: recipes.name,
      recipeImageKey: recipes.imageKey,
    })
    .from(mealProposalCandidates)
    .innerJoin(recipes, eq(mealProposalCandidates.recipeId, recipes.id))
    .where(eq(mealProposalCandidates.proposalId, proposal.id))
    .all();

  const voteRows = await db
    .select({
      candidateId: mealProposalVotes.candidateId,
      userId: mealProposalVotes.userId,
      displayName: users.displayName,
    })
    .from(mealProposalVotes)
    .innerJoin(users, eq(mealProposalVotes.userId, users.id))
    .where(eq(mealProposalVotes.proposalId, proposal.id))
    .all();

  const votesByCandidate = new Map<string, Array<{ userId: string; displayName: string }>>();
  let myVoteCandidateId: string | null = null;
  for (const v of voteRows) {
    const arr = votesByCandidate.get(v.candidateId) ?? [];
    arr.push({ userId: v.userId, displayName: v.displayName });
    votesByCandidate.set(v.candidateId, arr);
    if (v.userId === currentUserId) myVoteCandidateId = v.candidateId;
  }

  return {
    id: proposal.id,
    forDate: proposal.forDate,
    status: proposal.status as "open" | "decided",
    decidedRecipeId: proposal.decidedRecipeId,
    decidedAt: proposal.decidedAt,
    myVoteCandidateId,
    candidates: candidateRows.map((c) => ({
      id: c.id,
      recipeId: c.recipeId,
      recipeName: c.recipeName,
      recipeImageUrl: c.recipeImageKey ? `/api/v1/recipes/${c.recipeId}/image` : null,
      votes: votesByCandidate.get(c.id) ?? [],
    })),
  };
}

mealProposalRoutes.get("/", async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const forDate = (c.req.query("date") ?? "").trim() || todayYmd();

  const proposal = await db
    .select()
    .from(mealProposals)
    .where(and(eq(mealProposals.familyId, user.familyId), eq(mealProposals.forDate, forDate)))
    .get();

  if (!proposal) return c.json({ proposal: null, forDate });
  return c.json({ proposal: await serializeProposal(db, proposal, user.id) });
});

mealProposalRoutes.post("/", async (c) => {
  const user = c.get("user");
  const denied = requireCookRole(user);
  if (denied) return c.json({ error: denied }, 403);

  const db = c.get("db");
  const body = await c.req.json<{ forDate?: string; recipeIds?: string[] }>();
  const forDate = (body.forDate ?? "").trim() || todayYmd();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(forDate)) {
    return c.json({ error: "日付は YYYY-MM-DD 形式で入力してください" }, 400);
  }
  const recipeIds = [...new Set((body.recipeIds ?? []).filter(Boolean))];
  if (recipeIds.length === 0) {
    return c.json({ error: "候補を1つ以上選んでください" }, 400);
  }

  const existing = await db
    .select({ id: mealProposals.id })
    .from(mealProposals)
    .where(and(eq(mealProposals.familyId, user.familyId), eq(mealProposals.forDate, forDate)))
    .get();
  if (existing) {
    return c.json({ error: "その日の提案はすでにあります" }, 409);
  }

  const validRecipes = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(eq(recipes.familyId, user.familyId), eq(recipes.isArchived, 0)))
    .all();
  const validIds = new Set(validRecipes.map((r) => r.id));
  const chosenIds = recipeIds.filter((id) => validIds.has(id));
  if (chosenIds.length === 0) {
    return c.json({ error: "有効なレシピが選ばれていません" }, 400);
  }

  const ts = nowIso();
  const proposalId = newId();
  await db.insert(mealProposals).values({
    id: proposalId,
    familyId: user.familyId,
    forDate,
    status: "open",
    decidedRecipeId: null,
    decidedAt: null,
    createdByUserId: user.id,
    createdAt: ts,
    updatedAt: ts,
  });
  await db.insert(mealProposalCandidates).values(
    chosenIds.map((recipeId) => ({
      id: newId(),
      proposalId,
      recipeId,
      addedByUserId: user.id,
      createdAt: ts,
    })),
  );

  const proposal = await db.select().from(mealProposals).where(eq(mealProposals.id, proposalId)).get();
  return c.json({ proposal: await serializeProposal(db, proposal!, user.id) }, 201);
});

mealProposalRoutes.post("/request", async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const body = await c.req.json<{ recipeId?: string }>();
  const recipeId = body.recipeId?.trim();
  if (!recipeId) return c.json({ error: "レシピを指定してください" }, 400);

  const recipe = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(eq(recipes.id, recipeId), eq(recipes.familyId, user.familyId), eq(recipes.isArchived, 0)))
    .get();
  if (!recipe) return c.json({ error: "レシピが見つかりません" }, 404);

  const forDate = todayYmd();
  const ts = nowIso();

  let proposal = await db
    .select()
    .from(mealProposals)
    .where(and(eq(mealProposals.familyId, user.familyId), eq(mealProposals.forDate, forDate)))
    .get();

  if (!proposal) {
    const proposalId = newId();
    await db.insert(mealProposals).values({
      id: proposalId,
      familyId: user.familyId,
      forDate,
      status: "open",
      decidedRecipeId: null,
      decidedAt: null,
      createdByUserId: user.id,
      createdAt: ts,
      updatedAt: ts,
    });
    proposal = await db.select().from(mealProposals).where(eq(mealProposals.id, proposalId)).get();
  }
  if (proposal!.status !== "open") {
    return c.json({ error: "本日の献立はすでに決定済みです" }, 409);
  }

  let candidate = await db
    .select()
    .from(mealProposalCandidates)
    .where(
      and(
        eq(mealProposalCandidates.proposalId, proposal!.id),
        eq(mealProposalCandidates.recipeId, recipeId),
      ),
    )
    .get();
  if (!candidate) {
    const candidateId = newId();
    await db.insert(mealProposalCandidates).values({
      id: candidateId,
      proposalId: proposal!.id,
      recipeId,
      addedByUserId: user.id,
      createdAt: ts,
    });
    candidate = await db
      .select()
      .from(mealProposalCandidates)
      .where(eq(mealProposalCandidates.id, candidateId))
      .get();
  }

  const existingVote = await db
    .select({ id: mealProposalVotes.id })
    .from(mealProposalVotes)
    .where(and(eq(mealProposalVotes.proposalId, proposal!.id), eq(mealProposalVotes.userId, user.id)))
    .get();
  if (existingVote) {
    await db
      .update(mealProposalVotes)
      .set({ candidateId: candidate!.id, updatedAt: ts })
      .where(eq(mealProposalVotes.id, existingVote.id));
  } else {
    await db.insert(mealProposalVotes).values({
      id: newId(),
      proposalId: proposal!.id,
      candidateId: candidate!.id,
      userId: user.id,
      createdAt: ts,
      updatedAt: ts,
    });
  }

  return c.json({ proposal: await serializeProposal(db, proposal!, user.id) }, 201);
});

async function loadOwnProposal(
  db: ReturnType<typeof import("../db/client").createDb>,
  familyId: string,
  id: string,
) {
  return db
    .select()
    .from(mealProposals)
    .where(and(eq(mealProposals.id, id), eq(mealProposals.familyId, familyId)))
    .get();
}

mealProposalRoutes.post("/:id/candidates", async (c) => {
  const user = c.get("user");
  const denied = requireCookRole(user);
  if (denied) return c.json({ error: denied }, 403);

  const db = c.get("db");
  const id = c.req.param("id");
  const proposal = await loadOwnProposal(db, user.familyId, id);
  if (!proposal) return c.json({ error: "提案が見つかりません" }, 404);
  if (proposal.status !== "open") {
    return c.json({ error: "すでに決定済みです" }, 409);
  }

  const body = await c.req.json<{ recipeId?: string }>();
  const recipeId = body.recipeId?.trim();
  if (!recipeId) return c.json({ error: "レシピを指定してください" }, 400);

  const recipe = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(eq(recipes.id, recipeId), eq(recipes.familyId, user.familyId), eq(recipes.isArchived, 0)))
    .get();
  if (!recipe) return c.json({ error: "レシピが見つかりません" }, 404);

  const existing = await db
    .select({ id: mealProposalCandidates.id })
    .from(mealProposalCandidates)
    .where(
      and(eq(mealProposalCandidates.proposalId, id), eq(mealProposalCandidates.recipeId, recipeId)),
    )
    .get();
  if (!existing) {
    await db.insert(mealProposalCandidates).values({
      id: newId(),
      proposalId: id,
      recipeId,
      addedByUserId: user.id,
      createdAt: nowIso(),
    });
  }

  return c.json({ proposal: await serializeProposal(db, proposal, user.id) }, 201);
});

mealProposalRoutes.delete("/:id/candidates/:candidateId", async (c) => {
  const user = c.get("user");
  const denied = requireCookRole(user);
  if (denied) return c.json({ error: denied }, 403);

  const db = c.get("db");
  const id = c.req.param("id");
  const candidateId = c.req.param("candidateId");
  const proposal = await loadOwnProposal(db, user.familyId, id);
  if (!proposal) return c.json({ error: "提案が見つかりません" }, 404);
  if (proposal.status !== "open") {
    return c.json({ error: "すでに決定済みです" }, 409);
  }

  await db
    .delete(mealProposalCandidates)
    .where(
      and(eq(mealProposalCandidates.id, candidateId), eq(mealProposalCandidates.proposalId, id)),
    );

  return c.json({ proposal: await serializeProposal(db, proposal, user.id) });
});

mealProposalRoutes.put("/:id/vote", async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const id = c.req.param("id");
  const proposal = await loadOwnProposal(db, user.familyId, id);
  if (!proposal) return c.json({ error: "提案が見つかりません" }, 404);
  if (proposal.status !== "open") {
    return c.json({ error: "すでに決定済みです" }, 409);
  }

  const body = await c.req.json<{ candidateId?: string }>();
  const candidateId = body.candidateId?.trim();
  if (!candidateId) return c.json({ error: "候補を指定してください" }, 400);

  const candidate = await db
    .select({ id: mealProposalCandidates.id })
    .from(mealProposalCandidates)
    .where(and(eq(mealProposalCandidates.id, candidateId), eq(mealProposalCandidates.proposalId, id)))
    .get();
  if (!candidate) return c.json({ error: "候補が見つかりません" }, 404);

  const ts = nowIso();
  const existing = await db
    .select({ id: mealProposalVotes.id })
    .from(mealProposalVotes)
    .where(and(eq(mealProposalVotes.proposalId, id), eq(mealProposalVotes.userId, user.id)))
    .get();

  if (existing) {
    await db
      .update(mealProposalVotes)
      .set({ candidateId, updatedAt: ts })
      .where(eq(mealProposalVotes.id, existing.id));
  } else {
    await db.insert(mealProposalVotes).values({
      id: newId(),
      proposalId: id,
      candidateId,
      userId: user.id,
      createdAt: ts,
      updatedAt: ts,
    });
  }

  return c.json({ proposal: await serializeProposal(db, proposal, user.id) });
});

mealProposalRoutes.delete("/:id/vote", async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const id = c.req.param("id");
  const proposal = await loadOwnProposal(db, user.familyId, id);
  if (!proposal) return c.json({ error: "提案が見つかりません" }, 404);

  await db
    .delete(mealProposalVotes)
    .where(and(eq(mealProposalVotes.proposalId, id), eq(mealProposalVotes.userId, user.id)));

  return c.json({ proposal: await serializeProposal(db, proposal, user.id) });
});

mealProposalRoutes.post("/:id/decide", async (c) => {
  const user = c.get("user");
  const denied = requireCookRole(user);
  if (denied) return c.json({ error: denied }, 403);

  const db = c.get("db");
  const id = c.req.param("id");
  const proposal = await loadOwnProposal(db, user.familyId, id);
  if (!proposal) return c.json({ error: "提案が見つかりません" }, 404);
  if (proposal.status !== "open") {
    return c.json({ error: "すでに決定済みです" }, 409);
  }

  const body = await c.req.json<{ candidateId?: string }>();
  const candidateId = body.candidateId?.trim();
  if (!candidateId) return c.json({ error: "候補を指定してください" }, 400);

  const candidate = await db
    .select({ recipeId: mealProposalCandidates.recipeId })
    .from(mealProposalCandidates)
    .where(and(eq(mealProposalCandidates.id, candidateId), eq(mealProposalCandidates.proposalId, id)))
    .get();
  if (!candidate) return c.json({ error: "候補が見つかりません" }, 404);

  const ts = nowIso();
  await db
    .update(mealProposals)
    .set({ status: "decided", decidedRecipeId: candidate.recipeId, decidedAt: ts, updatedAt: ts })
    .where(eq(mealProposals.id, id));

  const updated = await db.select().from(mealProposals).where(eq(mealProposals.id, id)).get();
  return c.json({ proposal: await serializeProposal(db, updated!, user.id) });
});
