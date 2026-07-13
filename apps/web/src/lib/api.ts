import { GROQ_STORAGE_KEY, type SessionUser } from "@pf08/shared";

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
  isHallOfFame: boolean;
  createdAt: string;
  updatedAt: string;
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

  listRecipes: (q?: string) =>
    request<{ recipes: Recipe[] }>(
      `/api/v1/recipes${q ? `?q=${encodeURIComponent(q)}` : ""}`,
    ),
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

  imageSrc: (imageUrl: string | null | undefined) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith("http")) return imageUrl;
    return `${API_BASE}${imageUrl}`;
  },
};
