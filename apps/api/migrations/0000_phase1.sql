-- Phase 1 schema (matches docs/SPEC.md §4.6 + is_archived)
CREATE TABLE `families` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`household_size` integer DEFAULT 2 NOT NULL,
	`is_suspended` integer DEFAULT 0 NOT NULL,
	`is_demo` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);

CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`login_id` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`)
);
CREATE UNIQUE INDEX `users_login_id_uq` ON `users` (`login_id`);
CREATE INDEX `idx_users_family_id` ON `users` (`family_id`);

CREATE TABLE `recipes` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`name` text NOT NULL,
	`source_url` text,
	`ingredients_json` text DEFAULT '[]' NOT NULL,
	`instructions_json` text DEFAULT '[]' NOT NULL,
	`source_servings` integer,
	`servings_label` text,
	`notes` text,
	`image_key` text,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`is_hall_of_fame` integer DEFAULT 0 NOT NULL,
	`is_archived` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`)
);
CREATE INDEX `idx_recipes_family_id` ON `recipes` (`family_id`);
CREATE INDEX `idx_recipes_family_name` ON `recipes` (`family_id`,`name`);
CREATE INDEX `idx_recipes_family_hof` ON `recipes` (`family_id`,`is_hall_of_fame`);

CREATE TABLE `cook_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`recipe_id` text NOT NULL,
	`cooked_at` text NOT NULL,
	`cook_note` text,
	`created_by_user_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`),
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`),
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`)
);
CREATE INDEX `idx_cook_logs_family_cooked_at` ON `cook_logs` (`family_id`,`cooked_at`);
CREATE INDEX `idx_cook_logs_recipe_id` ON `cook_logs` (`recipe_id`);

CREATE TABLE `cook_log_ratings` (
	`id` text PRIMARY KEY NOT NULL,
	`cook_log_id` text NOT NULL,
	`user_id` text NOT NULL,
	`rating` integer,
	`comment` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`cook_log_id`) REFERENCES `cook_logs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);
CREATE UNIQUE INDEX `cook_log_ratings_uq` ON `cook_log_ratings` (`cook_log_id`,`user_id`);
CREATE INDEX `idx_ratings_user_id` ON `cook_log_ratings` (`user_id`);

CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX `sessions_token_hash_uq` ON `sessions` (`token_hash`);
CREATE INDEX `idx_sessions_user_id` ON `sessions` (`user_id`);
CREATE INDEX `idx_sessions_expires_at` ON `sessions` (`expires_at`);

CREATE TABLE `admin_users` (
	`id` text PRIMARY KEY NOT NULL,
	`login_id` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text NOT NULL
);
CREATE UNIQUE INDEX `admin_users_login_id_uq` ON `admin_users` (`login_id`);

CREATE TABLE `admin_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_user_id` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text,
	`target_id` text,
	`detail_json` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users`(`id`)
);
CREATE INDEX `idx_admin_audit_logs_created_at` ON `admin_audit_logs` (`created_at`);
