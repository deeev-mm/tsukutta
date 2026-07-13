-- Phase 2: categories + recipe_categories + admin_sessions
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
CREATE UNIQUE INDEX `categories_code_uq` ON `categories` (`code`);
CREATE INDEX `idx_categories_sort` ON `categories` (`sort_order`,`name`);

CREATE TABLE `recipe_categories` (
	`recipe_id` text NOT NULL,
	`category_id` text NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE UNIQUE INDEX `recipe_categories_pk` ON `recipe_categories` (`recipe_id`,`category_id`);
CREATE INDEX `idx_recipe_categories_category_id` ON `recipe_categories` (`category_id`);

CREATE TABLE `admin_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX `admin_sessions_token_hash_uq` ON `admin_sessions` (`token_hash`);
