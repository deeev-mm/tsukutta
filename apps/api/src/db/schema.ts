import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const families = sqliteTable("families", {
  id: text("id").primaryKey(),
  name: text("name"),
  householdSize: integer("household_size").notNull().default(2),
  isSuspended: integer("is_suspended").notNull().default(0),
  isDemo: integer("is_demo").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id),
    loginId: text("login_id").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    role: text("role").notNull(), // owner | cook | reviewer
    isActive: integer("is_active").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    loginIdUq: uniqueIndex("users_login_id_uq").on(t.loginId),
    familyIdx: index("idx_users_family_id").on(t.familyId),
  }),
);

export const recipes = sqliteTable(
  "recipes",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id),
    name: text("name").notNull(),
    sourceUrl: text("source_url"),
    ingredientsJson: text("ingredients_json").notNull().default("[]"),
    instructionsJson: text("instructions_json").notNull().default("[]"),
    sourceServings: integer("source_servings"),
    servingsLabel: text("servings_label"),
    notes: text("notes"),
    imageKey: text("image_key"),
    tagsJson: text("tags_json").notNull().default("[]"),
    isHallOfFame: integer("is_hall_of_fame").notNull().default(0),
    isArchived: integer("is_archived").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    familyIdx: index("idx_recipes_family_id").on(t.familyId),
    nameIdx: index("idx_recipes_family_name").on(t.familyId, t.name),
    hofIdx: index("idx_recipes_family_hof").on(t.familyId, t.isHallOfFame),
  }),
);

export const cookLogs = sqliteTable(
  "cook_logs",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id),
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id),
    cookedAt: text("cooked_at").notNull(),
    cookNote: text("cook_note"),
    createdByUserId: text("created_by_user_id").references(() => users.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    timelineIdx: index("idx_cook_logs_family_cooked_at").on(
      t.familyId,
      t.cookedAt,
    ),
    recipeIdx: index("idx_cook_logs_recipe_id").on(t.recipeId),
  }),
);

export const cookLogRatings = sqliteTable(
  "cook_log_ratings",
  {
    id: text("id").primaryKey(),
    cookLogId: text("cook_log_id")
      .notNull()
      .references(() => cookLogs.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    rating: integer("rating"),
    comment: text("comment"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    uniqueRating: uniqueIndex("cook_log_ratings_uq").on(t.cookLogId, t.userId),
    userIdx: index("idx_ratings_user_id").on(t.userId),
  }),
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => ({
    tokenUq: uniqueIndex("sessions_token_hash_uq").on(t.tokenHash),
    userIdx: index("idx_sessions_user_id").on(t.userId),
    expiresIdx: index("idx_sessions_expires_at").on(t.expiresAt),
  }),
);

export const adminUsers = sqliteTable("admin_users", {
  id: text("id").primaryKey(),
  loginId: text("login_id").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull(),
}, (t) => ({
  loginUq: uniqueIndex("admin_users_login_id_uq").on(t.loginId),
}));

export const adminAuditLogs = sqliteTable(
  "admin_audit_logs",
  {
    id: text("id").primaryKey(),
    adminUserId: text("admin_user_id")
      .notNull()
      .references(() => adminUsers.id),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    detailJson: text("detail_json"),
    createdAt: text("created_at").notNull(),
  },
  (t) => ({
    createdIdx: index("idx_admin_audit_logs_created_at").on(t.createdAt),
  }),
);

export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: integer("is_active").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    codeUq: uniqueIndex("categories_code_uq").on(t.code),
    sortIdx: index("idx_categories_sort").on(t.sortOrder, t.name),
  }),
);

export const recipeCategories = sqliteTable(
  "recipe_categories",
  {
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id),
  },
  (t) => ({
    pk: uniqueIndex("recipe_categories_pk").on(t.recipeId, t.categoryId),
    categoryIdx: index("idx_recipe_categories_category_id").on(t.categoryId),
  }),
);

export const adminSessions = sqliteTable(
  "admin_sessions",
  {
    id: text("id").primaryKey(),
    adminUserId: text("admin_user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => ({
    tokenUq: uniqueIndex("admin_sessions_token_hash_uq").on(t.tokenHash),
  }),
);

export const shoppingListItems = sqliteTable(
  "shopping_list_items",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id),
    name: text("name").notNull(),
    sourceRecipeId: text("source_recipe_id").references(() => recipes.id, {
      onDelete: "set null",
    }),
    isChecked: integer("is_checked").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    familyIdx: index("idx_shopping_list_family_id").on(t.familyId, t.isChecked),
  }),
);

export const loginAttempts = sqliteTable(
  "login_attempts",
  {
    id: text("id").primaryKey(),
    scope: text("scope").notNull(), // user | admin | register
    identifier: text("identifier").notNull(), // loginId or IP, lowercased/trimmed
    failedCount: integer("failed_count").notNull().default(0),
    lockedUntil: text("locked_until"),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    scopeIdentifierUq: uniqueIndex("login_attempts_scope_identifier_uq").on(
      t.scope,
      t.identifier,
    ),
  }),
);

export type Family = typeof families.$inferSelect;
export type User = typeof users.$inferSelect;
export type Recipe = typeof recipes.$inferSelect;
export type CookLog = typeof cookLogs.$inferSelect;
export type Category = typeof categories.$inferSelect;
