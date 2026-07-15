import { GROQ_STORAGE_KEY, type SessionUser } from "@tsukutta/shared";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8787";

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    credentials: "include",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      (data as { error?: string }).error || `リクエストに失敗しました (${res.status})`,
      res.status,
      (data as { code?: string }).code,
    );
  }
  return data as T;
}

export type Category = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive?: boolean;
};

export type Recipe = {
  id: string;
  familyId: string;
  name: string;
  sourceUrl: string | null;
  ingredients: string[];
  instructions: string[];
  sourceServings: number | null;
  servingsLabel: string | null;
  notes: string | null;
  imageKey: string | null;
  imageUrl: string | null;
  tags: string[];
  categories: Category[];
  isHallOfFame: boolean;
  createdAt: string;
  updatedAt: string;
};

export type FamilyUser = {
  id: string;
  loginId: string;
  displayName: string;
  role: "owner" | "cook" | "reviewer";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CookLogRating = {
  id: string;
  cookLogId: string;
  userId: string;
  displayName?: string;
  rating: number | null;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RankingEntry = {
  rank: number;
  recipeId: string;
  name: string;
  imageUrl: string | null;
  isHallOfFame: boolean;
  cookCount: number;
  avgRating: number | null;
  ratingCount: number;
  lastCookedAt: string | null;
};

export type RecommendationEntry = RankingEntry & {
  score: number;
  daysSinceLastCooked: number;
  reason: string;
};

export type ShoppingListItem = {
  id: string;
  name: string;
  sourceRecipeId: string | null;
  isChecked: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminInfo = { id: string; loginId: string };

export type AdminFamily = {
  id: string;
  name: string | null;
  householdSize: number;
  isSuspended: boolean;
  isDemo: boolean;
  createdAt: string;
  userCount?: number;
  recipeCount?: number;
};

export type AdminUser = {
  id: string;
  loginId: string;
  displayName: string;
  role: string;
  isActive: boolean;
  familyId: string;
  familyName: string;
};

export type AdminAuditLog = {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  detailJson: string | null;
  createdAt: string;
  adminLoginId: string;
};

export type CookLog = {
  id: string;
  familyId: string;
  recipeId: string;
  recipeName: string | null;
  recipeImageUrl: string | null;
  cookedAt: string;
  cookNote: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export const api = {
  baseUrl: API_BASE,

  me: () => request<{ user: SessionUser }>("/api/v1/auth/me"),
  login: (loginId: string, password: string) =>
    request<{ user: SessionUser }>("/api/v1/auth/login", {
      method: "POST",
      json: { loginId, password },
    }),
  register: (body: {
    loginId: string;
    password: string;
    displayName?: string;
    familyName?: string;
    householdSize?: number;
  }) =>
    request<{ user: SessionUser }>("/api/v1/auth/register", {
      method: "POST",
      json: body,
    }),
  logout: () =>
    request<{ ok: boolean }>("/api/v1/auth/logout", { method: "POST" }),

  getFamily: () =>
    request<{
      family: {
        id: string;
        name: string | null;
        householdSize: number;
        isDemo: boolean;
      };
    }>("/api/v1/family"),
  patchFamily: (body: { name?: string | null; householdSize?: number }) =>
    request<{
      family: {
        id: string;
        name: string | null;
        householdSize: number;
        isDemo: boolean;
      };
    }>("/api/v1/family", { method: "PATCH", json: body }),

  listRecipes: (q?: string, categoryId?: string, hallOfFame?: boolean) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (categoryId) sp.set("categoryId", categoryId);
    if (hallOfFame) sp.set("hallOfFame", "1");
    const s = sp.toString();
    return request<{ recipes: Recipe[] }>(
      `/api/v1/recipes${s ? `?${s}` : ""}`,
    );
  },
  getRecipe: (id: string) =>
    request<{ recipe: Recipe }>(`/api/v1/recipes/${id}`),
  createRecipe: (body: Record<string, unknown>) =>
    request<{ recipe: Recipe }>("/api/v1/recipes", {
      method: "POST",
      json: body,
    }),
  updateRecipe: (id: string, body: Record<string, unknown>) =>
    request<{ recipe: Recipe }>(`/api/v1/recipes/${id}`, {
      method: "PATCH",
      json: body,
    }),
  deleteRecipe: (id: string) =>
    request<{ ok: boolean }>(`/api/v1/recipes/${id}`, { method: "DELETE" }),
  putRecipeCategories: (id: string, categoryIds: string[]) =>
    request<{ recipe: Recipe }>(`/api/v1/recipes/${id}/categories`, {
      method: "PUT",
      json: { categoryIds },
    }),

  listCategories: () =>
    request<{ categories: Category[] }>("/api/v1/categories"),
  listCategoriesForManage: () =>
    request<{ categories: Category[] }>("/api/v1/categories/manage"),
  createCategory: (body: { code: string; name: string; sortOrder?: number }) =>
    request<{ category: Category }>("/api/v1/categories", {
      method: "POST",
      json: body,
    }),
  patchCategory: (
    id: string,
    body: { name?: string; sortOrder?: number; isActive?: boolean },
  ) =>
    request<{ category: Category }>(`/api/v1/categories/${id}`, {
      method: "PATCH",
      json: body,
    }),

  listFamilyUsers: () =>
    request<{ users: FamilyUser[] }>("/api/v1/family/users"),
  createFamilyUser: (body: {
    loginId: string;
    password: string;
    displayName?: string;
    role: "cook" | "reviewer";
  }) =>
    request<{ user: FamilyUser }>("/api/v1/family/users", {
      method: "POST",
      json: body,
    }),
  patchFamilyUser: (
    id: string,
    body: {
      displayName?: string;
      role?: "cook" | "reviewer";
      isActive?: boolean;
      password?: string;
    },
  ) =>
    request<{ user: FamilyUser }>(`/api/v1/family/users/${id}`, {
      method: "PATCH",
      json: body,
    }),

  uploadImage: async (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_BASE}/api/v1/recipes/${id}/image`, {
      method: "POST",
      body: form,
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiError(
        (data as { error?: string }).error || "画像アップロードに失敗しました",
        res.status,
      );
    }
    return data as { recipe: Recipe };
  },

  downloadBackup: async () => {
    const res = await fetch(`${API_BASE}/api/v1/export`, {
      credentials: "include",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new ApiError(
        (data as { error?: string }).error || "バックアップの取得に失敗しました",
        res.status,
      );
    }
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match?.[1] || `tsukutta-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  formatAi: (rawText: string, sourceUrl?: string) => {
    const clientApiKey =
      typeof window !== "undefined"
        ? localStorage.getItem(GROQ_STORAGE_KEY)
        : null;
    return request<{
      result: {
        name: string;
        sourceServings: number | null;
        ingredients: string[];
        instructions: string[];
        notes: string;
      };
    }>("/api/v1/ai/format", {
      method: "POST",
      json: { rawText, sourceUrl, clientApiKey },
    });
  },

  recommendWithAi: () => {
    const clientApiKey =
      typeof window !== "undefined" ? localStorage.getItem(GROQ_STORAGE_KEY) : null;
    return request<{
      recommendation: RankingEntry & { comment: string };
    }>("/api/v1/ai/recommend", {
      method: "POST",
      json: { clientApiKey },
    });
  },

  listCookLogs: (params?: { from?: string; to?: string; recipeId?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    if (params?.recipeId) sp.set("recipeId", params.recipeId);
    const q = sp.toString();
    return request<{ cookLogs: CookLog[] }>(
      `/api/v1/cook-logs${q ? `?${q}` : ""}`,
    );
  },
  createCookLog: (body: {
    recipeId: string;
    cookedAt?: string;
    cookNote?: string;
  }) =>
    request<{ cookLog: CookLog }>("/api/v1/cook-logs", {
      method: "POST",
      json: body,
    }),
  updateCookLog: (
    id: string,
    body: { cookedAt?: string; cookNote?: string | null },
  ) =>
    request<{ cookLog: CookLog }>(`/api/v1/cook-logs/${id}`, {
      method: "PATCH",
      json: body,
    }),
  deleteCookLog: (id: string) =>
    request<{ ok: boolean }>(`/api/v1/cook-logs/${id}`, { method: "DELETE" }),

  listCookLogRatings: (id: string) =>
    request<{ ratings: CookLogRating[] }>(`/api/v1/cook-logs/${id}/ratings`),
  upsertCookLogRating: (
    id: string,
    body: { rating?: number | null; comment?: string | null },
  ) =>
    request<{ rating: CookLogRating }>(`/api/v1/cook-logs/${id}/ratings`, {
      method: "PUT",
      json: body,
    }),

  listRankings: (categoryId?: string) => {
    const sp = new URLSearchParams();
    if (categoryId) sp.set("categoryId", categoryId);
    const s = sp.toString();
    return request<{ rankings: RankingEntry[]; categoryId: string | null }>(
      `/api/v1/rankings${s ? `?${s}` : ""}`,
    );
  },
  listRecommendations: (limit?: number) => {
    const sp = new URLSearchParams();
    if (limit) sp.set("limit", String(limit));
    const s = sp.toString();
    return request<{ recommendations: RecommendationEntry[] }>(
      `/api/v1/rankings/recommendations${s ? `?${s}` : ""}`,
    );
  },

  listShoppingList: () =>
    request<{ items: ShoppingListItem[] }>("/api/v1/shopping-list"),
  addShoppingListItem: (name: string) =>
    request<{ item: ShoppingListItem }>("/api/v1/shopping-list", {
      method: "POST",
      json: { name },
    }),
  addShoppingListFromRecipe: (recipeId: string, servings?: number) =>
    request<{ added: number; items: ShoppingListItem[] }>(
      `/api/v1/shopping-list/from-recipe/${recipeId}`,
      { method: "POST", json: servings ? { servings } : {} },
    ),
  updateShoppingListItem: (id: string, body: { name?: string; isChecked?: boolean }) =>
    request<{ item: ShoppingListItem }>(`/api/v1/shopping-list/${id}`, {
      method: "PATCH",
      json: body,
    }),
  deleteShoppingListItem: (id: string) =>
    request<{ ok: boolean }>(`/api/v1/shopping-list/${id}`, { method: "DELETE" }),
  clearCheckedShoppingListItems: () =>
    request<{ ok: boolean }>("/api/v1/shopping-list/checked", { method: "DELETE" }),

  // --- Admin ---
  adminLogin: (loginId: string, password: string) =>
    request<{ admin: AdminInfo }>("/api/v1/admin/auth/login", {
      method: "POST",
      json: { loginId, password },
    }),
  adminLogout: () =>
    request<{ ok: boolean }>("/api/v1/admin/auth/logout", { method: "POST" }),
  adminMe: () => request<{ admin: AdminInfo }>("/api/v1/admin/auth/me"),
  adminDashboard: () =>
    request<{
      counts: {
        families: number;
        users: number;
        recipes: number;
        cookLogs: number;
        ratings: number;
      };
      recentFamilies: AdminFamily[];
    }>("/api/v1/admin/dashboard"),
  adminHealth: () =>
    request<{ ok: boolean; db: boolean }>("/api/v1/admin/health"),
  adminListFamilies: (q?: string) =>
    request<{ families: AdminFamily[] }>(
      `/api/v1/admin/families${q ? `?q=${encodeURIComponent(q)}` : ""}`,
    ),
  adminGetFamily: (id: string) =>
    request<{ family: AdminFamily; members: FamilyUser[] }>(
      `/api/v1/admin/families/${id}`,
    ),
  adminSuspendFamily: (id: string) =>
    request<{ ok: boolean }>(`/api/v1/admin/families/${id}/suspend`, {
      method: "POST",
    }),
  adminResumeFamily: (id: string) =>
    request<{ ok: boolean }>(`/api/v1/admin/families/${id}/resume`, {
      method: "POST",
    }),
  adminListUsers: (q?: string) =>
    request<{ users: AdminUser[] }>(
      `/api/v1/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`,
    ),
  adminDisableUser: (id: string) =>
    request<{ ok: boolean }>(`/api/v1/admin/users/${id}/disable`, {
      method: "POST",
    }),
  adminEnableUser: (id: string) =>
    request<{ ok: boolean }>(`/api/v1/admin/users/${id}/enable`, {
      method: "POST",
    }),
  adminResetPassword: (id: string) =>
    request<{ ok: boolean; temporaryPassword: string }>(
      `/api/v1/admin/users/${id}/reset-password`,
      { method: "POST" },
    ),
  adminAuditLogs: () =>
    request<{ auditLogs: AdminAuditLog[] }>("/api/v1/admin/audit-logs"),
  adminListCategories: () =>
    request<{ categories: Category[] }>("/api/v1/admin/categories"),
  adminCreateCategory: (body: {
    code: string;
    name: string;
    sortOrder?: number;
  }) =>
    request<{ category: Category }>("/api/v1/admin/categories", {
      method: "POST",
      json: body,
    }),
  adminPatchCategory: (
    id: string,
    body: { name?: string; sortOrder?: number; isActive?: boolean },
  ) =>
    request<{ category: Category }>(`/api/v1/admin/categories/${id}`, {
      method: "PATCH",
      json: body,
    }),

  imageSrc: (imageUrl: string | null | undefined) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith("http")) return imageUrl;
    return `${API_BASE}${imageUrl}`;
  },
};
